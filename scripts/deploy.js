import SftpClient from 'ssh2-sftp-client';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { syncMedia } from './sync-media.js';

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
  // Synchroniseer eerst geüploade foto's, mappen en logboek-media vanaf TransIP naar lokaal + Git
  try {
    await syncMedia(true);
  } catch (err) {
    console.warn('⚠️ Kon uploads niet vooraf synchroniseren:', err.message);
  }

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

    // 3c. Upload inkijkexemplaren (dist/inkijk/**)
    const localInkijkDir = path.join(DIST_DIR, 'inkijk');
    const remoteInkijkDir = `${REMOTE_ROOT}/inkijk`;
    if (fs.existsSync(localInkijkDir)) {
      const inkijkFiles = [];
      function walkInkijk(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walkInkijk(full);
          else if (entry.isFile()) inkijkFiles.push(full);
        }
      }
      walkInkijk(localInkijkDir);

      let inkijkUploaded = 0;
      for (const localPath of inkijkFiles) {
        const relativePath = path.relative(localInkijkDir, localPath).replace(/\\/g, '/');
        const remotePath = `${remoteInkijkDir}/${relativePath}`;
        const remoteSubdir = remotePath.substring(0, remotePath.lastIndexOf('/'));
        const localStat = fs.statSync(localPath);

        let needUpload = true;
        try {
          const stat = await sftp.stat(remotePath);
          const localMtimeSec = Math.floor(localStat.mtimeMs / 1000);
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
          inkijkUploaded++;
        }
      }
      console.log(`✅ ${inkijkUploaded} van ${inkijkFiles.length} inkijkexemplaar-pagina's gesynchroniseerd!`);
    }

    // 3d. Upload videos (dist/videos/**), maar sla video's over die in /beheer zijn verwijderd en ruim hun lokale kopie op
    const localVideosDir = path.join(DIST_DIR, 'videos');
    const remoteVideosDir = `${REMOTE_ROOT}/videos`;
    if (fs.existsSync(localVideosDir)) {
      const deletedHomeVideos = new Set();
      try {
        const delRes = await fetch('https://paulvangeenen.nl/api/home_videos.php?action=deleted_list');
        if (delRes.ok) {
          const delData = await delRes.json();
          if (Array.isArray(delData?.deleted)) {
            for (const item of delData.deleted) {
              const orient = String(item.orientation || '').toLowerCase();
              const fname = String(item.filename || '');
              if (orient && fname) {
                deletedHomeVideos.add(`${orient}/${fname}`);
              }
            }
          }
        }
      } catch {}

      const videoFiles = [];
      function walkVideos(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walkVideos(full);
          else if (entry.isFile()) videoFiles.push(full);
        }
      }
      walkVideos(localVideosDir);

      let videosUploaded = 0;
      let deletedSkipped = 0;
      for (const localPath of videoFiles) {
        const relativePath = path.relative(localVideosDir, localPath).replace(/\\/g, '/');

        // Controleer of dit een in /beheer verwijderde homepage-video is
        const homeMatch = relativePath.match(/^home\/(Portrait|Landscape)\/(.+)$/i);
        if (homeMatch) {
          const delKey = `${homeMatch[1].toLowerCase()}/${homeMatch[2]}`;
          if (deletedHomeVideos.has(delKey)) {
            deletedSkipped++;
            // Ruim ook de lokale kopie in public/videos/ op zodat deze niet blijft liggen
            const publicCopy = path.join(PUBLIC_DIR, 'videos', relativePath);
            try {
              if (fs.existsSync(publicCopy)) fs.unlinkSync(publicCopy);
            } catch {}
            continue;
          }
        }

        const remotePath = `${remoteVideosDir}/${relativePath}`;
        const remoteSubdir = remotePath.substring(0, remotePath.lastIndexOf('/'));
        const localStat = fs.statSync(localPath);

        let needUpload = true;
        try {
          const stat = await sftp.stat(remotePath);
          const localMtimeSec = Math.floor(localStat.mtimeMs / 1000);
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
          videosUploaded++;
        }
      }
      console.log(
        `✅ ${videosUploaded} van ${videoFiles.length} video-bestanden gesynchroniseerd!` +
          (deletedSkipped > 0 ? ` (${deletedSkipped} verwijderde homepage-video's overgeslagen & lokaal opgeruimd)` : '')
      );
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
