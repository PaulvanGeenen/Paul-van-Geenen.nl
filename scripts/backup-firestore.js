import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

async function backup() {
  const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
  const app = initializeApp(config);
  const db = getFirestore(app, config.firestoreDatabaseId);

  const cols = ['qrcodes', 'boeken', 'hoofdstukken', 'subscribers', 'qr_scans', 'visitor_sessions'];
  for (const c of cols) {
    try {
      const snap = await getDocs(collection(db, c));
      console.log(c, 'count:', snap.size);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const outPath = path.join(process.cwd(), '_private_manuscripts', `${c}_firestore_backup.json`);
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`Saved ${c} (${data.length}) to ${outPath}`);
    } catch (e) {
      console.error(`Error backing up ${c}:`, e.message);
    }
  }
}

backup().then(() => {
  console.log('All Firestore collections successfully backed up!');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
