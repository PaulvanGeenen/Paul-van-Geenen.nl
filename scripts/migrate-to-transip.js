import fs from 'fs';
import path from 'path';

const API_KEY = "visitor-secret-key-paul-2026";
const API_URL = "https://www.paulvangeenen.nl/api/visitor_database.php";

async function runSql(sql) {
  const res = await fetch(`${API_URL}?key=${API_KEY}&action=execute_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({ sql })
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'SQL execution failed');
  }
  return data;
}

async function migrate() {
  console.log('1. Creating tables in TransIP MySQL (paulw6_Analytics)...');

  await runSql(`
    CREATE TABLE IF NOT EXISTS \`boeken\` (
      \`id\` VARCHAR(64) PRIMARY KEY,
      \`volgnummer\` INT NOT NULL DEFAULT 1,
      \`boektitel\` VARCHAR(255) NOT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log(' - Created/verified table boeken');

  await runSql(`
    CREATE TABLE IF NOT EXISTS \`hoofdstukken\` (
      \`id\` VARCHAR(64) PRIMARY KEY,
      \`boek_id\` VARCHAR(64) NOT NULL,
      \`volgnummer\` INT NOT NULL DEFAULT 1,
      \`omschrijving\` VARCHAR(255) NOT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_boek_id\` (\`boek_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log(' - Created/verified table hoofdstukken');

  await runSql(`
    CREATE TABLE IF NOT EXISTS \`qrcodes\` (
      \`id\` VARCHAR(64) PRIMARY KEY,
      \`boek_id\` VARCHAR(64) NULL,
      \`boek_titel\` VARCHAR(255) NULL,
      \`hoofdstuk_id\` VARCHAR(64) NULL,
      \`hoofdstuk\` VARCHAR(255) NOT NULL,
      \`song\` VARCHAR(255) NOT NULL,
      \`artist\` VARCHAR(255) NOT NULL,
      \`spotify_link\` TEXT NOT NULL,
      \`qr_image\` LONGTEXT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log(' - Created/verified table qrcodes');

  // 2. Import Books
  console.log('\n2. Importing Books...');
  const booksData = JSON.parse(fs.readFileSync('_private_manuscripts/boeken_firestore_backup.json', 'utf-8'));
  for (const b of booksData) {
    const id = b.id.replace(/'/g, "''");
    const boektitel = (b.boektitel || '').replace(/'/g, "''");
    const volgnummer = parseInt(b.volgnummer) || 1;
    await runSql(`
      INSERT INTO \`boeken\` (\`id\`, \`volgnummer\`, \`boektitel\`)
      VALUES ('${id}', ${volgnummer}, '${boektitel}')
      ON DUPLICATE KEY UPDATE \`volgnummer\` = VALUES(\`volgnummer\`), \`boektitel\` = VALUES(\`boektitel\`);
    `);
  }
  console.log(` - Migrated ${booksData.length} books.`);

  // 3. Import Chapters
  console.log('\n3. Importing Chapters...');
  const chaptersData = JSON.parse(fs.readFileSync('_private_manuscripts/hoofdstukken_firestore_backup.json', 'utf-8'));
  for (const h of chaptersData) {
    const id = h.id.replace(/'/g, "''");
    const boekId = (h.boekId || '').replace(/'/g, "''");
    const omschrijving = (h.omschrijving || '').replace(/'/g, "''");
    const volgnummer = parseInt(h.volgnummer) || 1;
    await runSql(`
      INSERT INTO \`hoofdstukken\` (\`id\`, \`boek_id\`, \`volgnummer\`, \`omschrijving\`)
      VALUES ('${id}', '${boekId}', ${volgnummer}, '${omschrijving}')
      ON DUPLICATE KEY UPDATE \`boek_id\` = VALUES(\`boek_id\`), \`volgnummer\` = VALUES(\`volgnummer\`), \`omschrijving\` = VALUES(\`omschrijving\`);
    `);
  }
  console.log(` - Migrated ${chaptersData.length} chapters.`);

  // 4. Import QR Codes
  console.log('\n4. Importing QR Codes...');
  const qrData = JSON.parse(fs.readFileSync('_private_manuscripts/qrcodes_firestore_backup.json', 'utf-8'));
  for (const q of qrData) {
    const id = q.id.replace(/'/g, "''");
    const boekId = (q.boekId || '').replace(/'/g, "''");
    const boekTitel = (q.boekTitel || '').replace(/'/g, "''");
    const hoofdstukId = (q.hoofdstukId || '').replace(/'/g, "''");
    const hoofdstuk = (q.hoofdstuk || '').replace(/'/g, "''");
    const song = (q.song || '').replace(/'/g, "''");
    const artist = (q.artist || '').replace(/'/g, "''");
    const spotifyLink = (q.spotifyLink || '').replace(/'/g, "''");
    const qrImage = (q.qrImage || '').replace(/'/g, "''");

    await runSql(`
      INSERT INTO \`qrcodes\` (\`id\`, \`boek_id\`, \`boek_titel\`, \`hoofdstuk_id\`, \`hoofdstuk\`, \`song\`, \`artist\`, \`spotify_link\`, \`qr_image\`)
      VALUES ('${id}', '${boekId}', '${boekTitel}', '${hoofdstukId}', '${hoofdstuk}', '${song}', '${artist}', '${spotifyLink}', '${qrImage}')
      ON DUPLICATE KEY UPDATE 
        \`boek_id\` = VALUES(\`boek_id\`),
        \`boek_titel\` = VALUES(\`boek_titel\`),
        \`hoofdstuk_id\` = VALUES(\`hoofdstuk_id\`),
        \`hoofdstuk\` = VALUES(\`hoofdstuk\`),
        \`song\` = VALUES(\`song\`),
        \`artist\` = VALUES(\`artist\`),
        \`spotify_link\` = VALUES(\`spotify_link\`),
        \`qr_image\` = VALUES(\`qr_image\`);
    `);
  }
  console.log(` - Migrated ${qrData.length} QR codes.`);

  console.log('\nVERIFYING COUNTS IN TRANSIP MYSQL:');
  const countBoeken = await runSql('SELECT COUNT(*) as cnt FROM boeken;');
  const countHoofdstukken = await runSql('SELECT COUNT(*) as cnt FROM hoofdstukken;');
  const countQrcodes = await runSql('SELECT COUNT(*) as cnt FROM qrcodes;');
  console.log('Boeken count:', countBoeken.data[0].cnt);
  console.log('Hoofdstukken count:', countHoofdstukken.data[0].cnt);
  console.log('Qrcodes count:', countQrcodes.data[0].cnt);
  console.log('\nMigration to TransIP MySQL finished successfully!');
}

migrate().catch(console.error);
