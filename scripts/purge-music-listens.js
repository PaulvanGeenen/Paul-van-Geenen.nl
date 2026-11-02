import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function purgeMusicListens() {
  console.log('Fetching music_listens collection...');
  const snap = await getDocs(collection(db, 'music_listens'));
  console.log(`Found ${snap.docs.length} music_listens documents.`);

  if (snap.docs.length === 0) {
    console.log('No documents to delete.');
    process.exit(0);
  }

  let count = 0;
  for (const docSnap of snap.docs) {
    await deleteDoc(doc(db, 'music_listens', docSnap.id));
    count++;
    console.log(`Deleted document (${count}/${snap.docs.length}): ${docSnap.id}`);
  }

  console.log(`Successfully deleted all ${count} music listen records from Firestore!`);
  process.exit(0);
}

purgeMusicListens().catch(err => {
  console.error('Error purging music listens:', err);
  process.exit(1);
});
