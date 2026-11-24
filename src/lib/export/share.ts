// Partage et téléchargement des fichiers exportés.
//
// Sur Android, navigator.share() n'est autorisé que juste après un tap de l'utilisateur.
// Les exports se font donc en deux temps : préparation du fichier, puis un tap dédié pour
// le partager. Dans l'application installée (mode standalone), un téléchargement par lien
// « blob: » ouvre une fenêtre noire : on ne le propose que dans le navigateur.

export type ShareOutcome = 'shared' | 'cancelled' | 'failed';

/** Application lancée depuis l'écran d'accueil (PWA installée). */
export function isStandalone(): boolean {
  return (
    (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function canShareFile(file: File): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** À appeler directement dans le gestionnaire d'un tap. */
export async function shareFile(file: File, title: string): Promise<ShareOutcome> {
  try {
    await navigator.share({ files: [file], title });
    return 'shared';
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    console.warn('Partage impossible', e);
    return 'failed';
  }
}

export function download(file: Blob, fileName: string): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const fileSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} o` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} Ko` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
