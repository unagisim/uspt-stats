// Initialisation de Firebase (Authentication + Firestore), chargée à la demande.
// Firestore garde une copie locale (IndexedDB) : les écritures faites sans réseau
// partent d'elles-mêmes au retour du réseau.

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { firebaseConfig } from './config';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;

export function cloud(): { app: FirebaseApp; auth: Auth; db: Firestore } {
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    auth.languageCode = 'fr';
    firestore = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  }
  return { app, auth: auth!, db: firestore! };
}
