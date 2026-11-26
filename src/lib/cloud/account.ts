// Compte coach (V2) : connexion par lien envoyé par e-mail, puis vérification que
// l'adresse figure dans la liste des coachs du club (collection « coaches »).
// Ce module charge Firebase : il est importé à la demande (accountApi() dans state.svelte.ts).

import {
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut as fbSignOut,
} from 'firebase/auth';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { cloud } from './firebase';
import { account, type Coach, type Role } from './state.svelte';

const EMAIL_KEY = 'uspt-signin-email';
const remember = (email: string) => {
  try {
    localStorage.setItem(EMAIL_KEY, email);
  } catch {
    /* stockage indisponible : l'adresse sera redemandée */
  }
};
const recall = () => {
  try {
    return localStorage.getItem(EMAIL_KEY);
  } catch {
    return null;
  }
};

const ERRORS: Record<string, string> = {
  'auth/invalid-email': 'Cette adresse e-mail n’est pas valide.',
  'auth/missing-email': 'Saisissez votre adresse e-mail.',
  'auth/invalid-action-code': 'Ce lien a expiré ou a déjà servi. Demandez un nouveau lien.',
  'auth/expired-action-code': 'Ce lien a expiré. Demandez un nouveau lien.',
  'auth/network-request-failed': 'Pas de connexion réseau. Réessayez quand le téléphone est connecté.',
  'auth/quota-exceeded': 'Trop de liens envoyés aujourd’hui. Réessayez demain.',
  'auth/too-many-requests': 'Trop de tentatives. Patientez quelques minutes.',
  'auth/unauthorized-continue-uri': 'Ce site n’est pas autorisé dans Firebase (Authentication > Paramètres > Domaines autorisés).',
  'auth/unauthorized-domain': 'Ce site n’est pas autorisé dans Firebase (Authentication > Paramètres > Domaines autorisés).',
  'auth/operation-not-allowed': 'La connexion par lien e-mail n’est pas activée dans Firebase (Authentication > Méthode de connexion).',
};
const message = (e: unknown) => {
  const code = (e as { code?: string })?.code ?? '';
  return ERRORS[code] ?? 'La connexion a échoué. Réessayez.';
};

/** Adresse du site où le lien de connexion ramène (racine de l'application). */
const returnUrl = () => new URL(import.meta.env.BASE_URL, location.origin).href;

let stopCoachWatch: (() => void) | null = null;
let started = false;

export function initAccount(): void {
  if (started) return;
  started = true;
  const { auth, db } = cloud();

  onAuthStateChanged(auth, (u) => {
    stopCoachWatch?.();
    stopCoachWatch = null;
    account.email = u?.email?.toLowerCase() ?? null;
    account.uid = u?.uid ?? null;
    account.role = null;
    account.authorized = null;
    account.ready = true;
    if (!account.email) return;
    // Suit le document du coach : un ajout ou un retrait par un administrateur s'applique aussitôt.
    stopCoachWatch = onSnapshot(
      doc(db, 'coaches', account.email),
      (snap) => {
        // Hors ligne, un document absent du cache ne prouve rien : on attend le réseau.
        if (!snap.exists() && snap.metadata.fromCache) return;
        account.authorized = snap.exists();
        account.role = snap.exists() ? ((snap.data().role as Role) ?? 'coach') : null;
      },
      (err) => {
        // Les règles refusent la lecture à une adresse qui n'est pas dans la liste.
        if ((err as { code?: string }).code === 'permission-denied') account.authorized = false;
      },
    );
  });

  if (isSignInWithEmailLink(auth, location.href)) {
    const email = recall();
    if (email) void finishSignIn(email);
    else account.needsEmailToFinish = true;
  }
}

export async function sendLink(email: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  account.error = '';
  account.busy = true;
  try {
    await sendSignInLinkToEmail(cloud().auth, clean, { url: returnUrl(), handleCodeInApp: true });
    remember(clean);
    account.linkSentTo = clean;
  } catch (e) {
    account.error = message(e);
  } finally {
    account.busy = false;
  }
}

/** Termine la connexion à l'ouverture du lien (adresse mémorisée, ou saisie à nouveau). */
export async function finishSignIn(email: string): Promise<void> {
  account.error = '';
  account.busy = true;
  try {
    await signInWithEmailLink(cloud().auth, email.trim().toLowerCase(), location.href);
    account.needsEmailToFinish = false;
    account.linkSentTo = null;
    try {
      localStorage.removeItem(EMAIL_KEY);
    } catch {
      /* rien à nettoyer */
    }
  } catch (e) {
    account.error = message(e);
  } finally {
    account.busy = false;
    // Retire les paramètres du lien de l'adresse affichée.
    history.replaceState(history.state, '', returnUrl());
  }
}

export async function signOut(): Promise<void> {
  await fbSignOut(cloud().auth);
  account.linkSentTo = null;
}

// ---- Gestion des coachs (administrateurs) ----

export function watchCoaches(onChange: (list: Coach[]) => void, onError: (msg: string) => void): () => void {
  const { db } = cloud();
  return onSnapshot(
    query(collection(db, 'coaches'), orderBy('email')),
    (snap) => onChange(snap.docs.map((d) => d.data() as Coach)),
    () => onError('Impossible de lire la liste des coachs.'),
  );
}

export async function saveCoach(c: Coach): Promise<void> {
  const email = c.email.trim().toLowerCase();
  await setDoc(doc(cloud().db, 'coaches', email), {
    email,
    role: c.role,
    ...(c.name?.trim() ? { name: c.name.trim() } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function removeCoach(email: string): Promise<void> {
  await deleteDoc(doc(cloud().db, 'coaches', email));
}
