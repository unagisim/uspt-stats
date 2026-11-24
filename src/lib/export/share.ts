// Partage d'un fichier : feuille de partage native du téléphone si possible, sinon téléchargement.

export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

export async function shareOrDownload(blob: Blob, fileName: string, title: string): Promise<ShareResult> {
  const file = new File([blob], fileName, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // Partage refusé par le navigateur : on bascule sur le téléchargement.
    }
  }
  download(blob, fileName);
  return 'downloaded';
}

export function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
