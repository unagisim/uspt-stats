// Service worker (hors ligne), mises à jour, installation et stockage persistant.

import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const pwa = $state({
  /** Une nouvelle version est prête : à appliquer quand l'utilisateur le décide. */
  needRefresh: false,
  /** L'application est entièrement en cache et fonctionne hors ligne. */
  offlineReady: false,
  /** Le navigateur propose l'installation sur l'écran d'accueil. */
  canInstall: false,
});

let updateSW: ((reload?: boolean) => Promise<void>) | null = null;
let installEvent: BeforeInstallPromptEvent | null = null;

export function initPwa(): void {
  updateSW = registerSW({
    onNeedRefresh() {
      pwa.needRefresh = true;
    },
    onOfflineReady() {
      pwa.offlineReady = true;
    },
  });

  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e as BeforeInstallPromptEvent;
    pwa.canInstall = true;
  });
  addEventListener('appinstalled', () => {
    installEvent = null;
    pwa.canInstall = false;
  });

  // Demande au navigateur de ne pas effacer les matchs enregistrés en cas de manque de place.
  navigator.storage?.persist?.().catch(() => {});
}

export async function applyUpdate(): Promise<void> {
  await updateSW?.(true);
}

export async function install(): Promise<void> {
  if (!installEvent) return;
  await installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  pwa.canInstall = false;
}
