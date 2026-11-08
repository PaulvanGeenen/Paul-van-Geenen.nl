import SftpClient from 'ssh2-sftp-client';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Laad instellingen uit .env.local indien aanwezig
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
  password: process.env.TRANSIP_SFTP_PASS
};

const REMOTE_ROOT = '/data/sites/web/paulvangeenennl/www';
const DIST_DIR = path.join(process.cwd(), 'dist');

async function deploy() {
  console.log('🚀 Start deploy naar live server (TransIP)...');
  console.log(`📡 Host: ${SFTP_CONFIG.host} (${SFTP_CONFIG.username})`);
  console.log(`📁 Doelmap: ${REMOTE_ROOT}`);

  if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ Map dist/ niet gevonden. Voer eerst npm run build uit.');
    process.exit(1);
  }

  const sftp = new SftpClient();

  try {
    console.log('\n1. Verbinding maken via SFTP...');
    await sftp.connect(SFTP_CONFIG);
    console.log('✅ Verbonden!');

    // 2. Upload API scripts (visitor_database.php, music_database.php, etc.)
    console.log('\n2. Updaten van API scripts in public/api/...');
    const localApiDir = path.join(process.cwd(), 'public', 'api');
    const remoteApiDir = `${REMOTE_ROOT}/api`;
    if (fs.existsSync(localApiDir)) {
      const apiFiles = fs.readdirSync(localApiDir);
      for (const file of apiFiles) {
        if (file.endsWith('.php')) {
          const localPath = path.join(localApiDir, file);
          const remotePath = `${remoteApiDir}/${file}`;
          await sftp.fastPut(localPath, remotePath);
          console.log(`✅ api/${file} geüpload`);
        }
      }
    }

    // 2b. Synchroniseer nieuwe/gewijzigde bestanden (.srt, .txt, .json, .mp3, .jpg, .png) in public/@music/
    console.log('\n2b. Synchroniseren van ondertitels (.srt), teksten (.txt) en gewijzigde media in @music...');
    const localMusicDir = path.join(process.cwd(), 'public', '@music');
    const remoteMusicDir = `${REMOTE_ROOT}/@music`;
    if (fs.existsSync(localMusicDir)) {
      let uploadedCount = 0;
      function getFilesRecursive(dir) {
        let results = [];
        const list = fs.readdirSync(dir);
        for (const file of list) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            results = results.concat(getFilesRecursive(filePath));
          } else {
            const ext = path.extname(file).toLowerCase();
            if (['.srt', '.txt', '.json', '.mp3', '.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
              results.push(filePath);
            }
          }
        }
        return results;
      }

      const musicFiles = getFilesRecursive(localMusicDir);
      console.log(`📡 Controleren van ${musicFiles.length} bestanden in @music op wijzigingen...`);

      for (const localPath of musicFiles) {
        const relativePath = path.relative(localMusicDir, localPath).replace(/\\/g, '/');
        const remotePath = `${remoteMusicDir}/${relativePath}`;
        const remoteSubdir = path.posix.dirname(remotePath);
        const localStat = fs.statSync(localPath);

        let needUpload = true;
        try {
          const stat = await sftp.stat(remotePath);
          const localMtimeSec = Math.floor(localStat.mtimeMs / 1000);
          // Alleen uploaden als de bestandsgrootte verschilt of het lokale bestand nieuwer is dan op de server
          if (stat.size === localStat.size && localMtimeSec <= stat.modifyTime + 2) {
            needUpload = false;
          }
        } catch (e) {
          needUpload = true;
        }

        if (needUpload) {
          try {
            await sftp.mkdir(remoteSubdir, true);
          } catch {}
          await sftp.fastPut(localPath, remotePath);
          uploadedCount++;
          console.log(`  ✔ Geüpload: @music/${relativePath}`);
        }
      }
      console.log(`✅ ${uploadedCount} nieuwe/gewijzigde @music bestanden gesynchroniseerd naar server!`);
    }

    // 3. Upload assets
    console.log('\n3. Updaten van frontend assets (JS/CSS/afbeeldingen)...');
    const localAssetsDir = path.join(DIST_DIR, 'assets');
    const remoteAssetsDir = `${REMOTE_ROOT}/assets`;

    if (fs.existsSync(localAssetsDir)) {
      const assetFiles = fs.readdirSync(localAssetsDir);
      console.log(`📦 ${assetFiles.length} asset-bestanden worden gesynchroniseerd...`);

      for (const file of assetFiles) {
        const localPath = path.join(localAssetsDir, file);
        const remotePath = `${remoteAssetsDir}/${file}`;
        await sftp.fastPut(localPath, remotePath);
      }
      console.log(`✅ Alle ${assetFiles.length} assets succesvol geüpload!`);
    }

    // 3b. Upload images (such as lion-books-logo.jpg)
    const localImagesDir = path.join(DIST_DIR, 'images');
    const remoteImagesDir = `${REMOTE_ROOT}/images`;
    if (fs.existsSync(localImagesDir)) {
      const imageFiles = fs.readdirSync(localImagesDir);
      for (const file of imageFiles) {
        const localPath = path.join(localImagesDir, file);
        const remotePath = `${remoteImagesDir}/${file}`;
        if (fs.statSync(localPath).isFile()) {
          try {
            await sftp.fastPut(localPath, remotePath);
          } catch (e) {
            console.log(`Upload note for ${file}:`, e.message);
          }
        }
      }
      console.log(`✅ ${imageFiles.length} afbeeldingen gesynchroniseerd!`);
    }

    // 4. Upload .htaccess & manifest.json
    const localHtaccess = path.join(DIST_DIR, '.htaccess');
    if (fs.existsSync(localHtaccess)) {
      await sftp.fastPut(localHtaccess, `${REMOTE_ROOT}/.htaccess`);
      console.log('✅ .htaccess geüpload');
    }
    const localManifest = path.join(DIST_DIR, 'manifest.json');
    if (fs.existsSync(localManifest)) {
      await sftp.fastPut(localManifest, `${REMOTE_ROOT}/manifest.json`);
      console.log('✅ manifest.json geüpload');
    }

    // 5. Upload index.html (as the final atomic step so users get new assets seamlessly)
    console.log('\n4. Live zetten van index.html...');
    const localIndex = path.join(DIST_DIR, 'index.html');
    const remoteIndex = `${REMOTE_ROOT}/index.html`;
    await sftp.fastPut(localIndex, remoteIndex);
    console.log('✅ index.html geüpload!');

    console.log('\n🎉 DEPLOY VOLTOOID! De live website is succesvol bijgewerkt.');
  } catch (err) {
    console.error('❌ Fout tijdens deploy:', err);
    process.exit(1);
  } finally {
    await sftp.end();
  }
}

deploy();
