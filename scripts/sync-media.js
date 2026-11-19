import SftpClient from 'ssh2-sftp-client';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else {
  dotenv.config();
}

const SFTP_CONFIG = {
  host: process.env.TRANSIP_SFTP_HOST || 'paulw6.ssh.transip.me',
  port: parseInt(process.env.TRANSIP_SFTP_PORT || '22', 10),
  username: process.env.TRANSIP_SFTP_USER || 'paulvangeenennl',
  password: process.env.TRANSIP_SFTP_PASS,
};

const REMOTE_ROOT = '/data/sites/web/paulvangeenennl/www';

async function syncDir(sftp, remoteDir, localDir) {
  let downloadedCount = 0;
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  let remoteItems = [];
  try {
    remoteItems = await sftp.list(remoteDir);
  } catch {
    return 0;
  }

  for (const item of remoteItems) {
    if (item.name === '.' || item.name === '..') continue;
    const remoteItemPath = `${remoteDir}/${item.name}`;
    const localItemPath = path.join(localDir, item.name);

    if (item.type === 'd') {
      const subCount = await syncDir(sftp, remoteItemPath, localItemPath);
      downloadedCount += subCount;
      // Ensure empty user-created folders get a .gitkeep so git tracks the folder
      const contents = fs.readdirSync(localItemPath);
      if (contents.length === 0) {
        fs.writeFileSync(path.join(localItemPath, '.gitkeep'), '');
        downloadedCount++;
      }
    } else if (item.type === '-') {
      let needDownload = true;
      if (fs.existsSync(localItemPath)) {
        const localStat = fs.statSync(localItemPath);
        if (localStat.size === item.size) {
          needDownload = false;
        }
      }

      if (needDownload) {
        await sftp.fastGet(remoteItemPath, localItemPath);
        console.log(`  📥 Download: ${path.relative(process.cwd(), localItemPath)}`);
        downloadedCount++;
      }
    }
  }

  return downloadedCount;
}

export async function syncMedia(autoCommitAndPush = true) {
  console.log('🔄 Bestandsbeheer, Logboek & Social uploads synchroniseren vanaf TransIP naar Git...');

  if (!SFTP_CONFIG.password) {
    console.error('❌ TRANSIP_SFTP_PASS ontbreekt in .env.local.');
    return 0;
  }

  const sftp = new SftpClient();
  try {
    await sftp.connect(SFTP_CONFIG);

    const foldersToSync = [
      { remote: `${REMOTE_ROOT}/storage`, local: path.join(process.cwd(), 'public', 'storage') },
      { remote: `${REMOTE_ROOT}/uploads`, local: path.join(process.cwd(), 'public', 'uploads') },
      { remote: `${REMOTE_ROOT}/images/logboek`, local: path.join(process.cwd(), 'public', 'images', 'logboek') },
      { remote: `${REMOTE_ROOT}/audio/logboek`, local: path.join(process.cwd(), 'public', 'audio', 'logboek') },
      { remote: `${REMOTE_ROOT}/videos/logboek`, local: path.join(process.cwd(), 'public', 'videos', 'logboek') },
    ];

    let total = 0;
    for (const f of foldersToSync) {
      total += await syncDir(sftp, f.remote, f.local);
    }

    if (total > 0) {
      console.log(`✅ ${total} nieuw(e) geüpload(e) bestand(en)/map(pen) binnengehaald vanaf TransIP!`);
      if (autoCommitAndPush) {
        try {
          execSync('git add "public/storage" "public/uploads" "public/images/logboek" "public/audio/logboek" "public/videos/logboek"', { stdio: 'ignore' });
          const status = execSync('git status --porcelain "public/storage" "public/uploads" "public/images/logboek" "public/audio/logboek" "public/videos/logboek"').toString().trim();
          if (status) {
            execSync('git commit -m "chore(media): sync uploaded storage and logboek media from TransIP"', { stdio: 'inherit' });
            execSync('git push', { stdio: 'inherit' });
            console.log('✅ Nieuwe media direct gecommit en gepusht naar Git!');
          }
        } catch (gitErr) {
          console.warn('⚠️ Kon gesynchroniseerde media niet automatisch pushen naar Git:', gitErr.message);
        }
      }
    } else {
      console.log('✅ Alle geüploade media is al up-to-date met TransIP & Git.');
    }
    return total;
  } catch (err) {
    console.warn('⚠️ Waarschuwing bij synchroniseren van uploads:', err.message);
    return 0;
  } finally {
    await sftp.end();
  }
}

if (process.argv[1]?.endsWith('sync-media.js')) {
  syncMedia(true);
}
