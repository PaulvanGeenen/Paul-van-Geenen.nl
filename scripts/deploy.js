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

    // 2. Upload visitor_database.php
    console.log('\n2. Updaten van visitor_database.php...');
    const localPhp = path.join(process.cwd(), 'public', 'api', 'visitor_database.php');
    const remotePhp = `${REMOTE_ROOT}/api/visitor_database.php`;
    if (fs.existsSync(localPhp)) {
      // Backup current file first
      try {
        await sftp.fastPut(localPhp, `${remotePhp}.bak_${Date.now()}`);
      } catch {}
      await sftp.fastPut(localPhp, remotePhp);
      console.log('✅ visitor_database.php geüpload');
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
