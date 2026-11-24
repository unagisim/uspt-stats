<script lang="ts">
  // Fichier exporté prêt : un tap dédié pour le partager (obligatoire sur Android),
  // et le téléchargement direct quand il est sûr (navigateur, pas l'application installée).
  import { canShareFile, download, fileSize, isStandalone, shareFile } from '../lib/export/share';

  let { file, title, onClose }: { file: File; title: string; onClose: () => void } = $props();

  const shareable = $derived(canShareFile(file));
  let failed = $state(false);
  let message = $state('');
  // Dans l'application installée, le téléchargement ouvre une fenêtre noire : seulement en secours.
  const showDownload = $derived(!shareable || failed || !isStandalone());

  async function share() {
    message = '';
    const res = await shareFile(file, title);
    if (res === 'shared') message = 'Fichier partagé.';
    if (res === 'failed') {
      failed = true;
      message = 'Le partage a échoué sur cet appareil. Essayez « Télécharger ».';
    }
  }

  function save() {
    download(file, file.name);
    message = `Téléchargement lancé : ${file.name}`;
  }
</script>

<div class="ready" role="status">
  <p class="name"><strong>Fichier prêt</strong> · {file.name} ({fileSize(file.size)})</p>
  <div class="actions">
    {#if shareable}
      <button class="primary" onclick={share}>Partager / enregistrer</button>
    {/if}
    {#if showDownload}
      <button class:primary={!shareable} onclick={save}>Télécharger</button>
    {/if}
    <button class="ghost" onclick={onClose}>Fermer</button>
  </div>
  {#if message}<p class="msg" class:error={failed}>{message}</p>{/if}
  {#if shareable}
    <p class="tip">Dans la liste de partage : Drive, e-mail, WhatsApp… ou « Enregistrer » dans les fichiers du téléphone.</p>
  {/if}
</div>

<style>
  .ready {
    margin-top: 10px;
    padding: 12px;
    border-radius: 10px;
    background: var(--a-bg);
    color: var(--a);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .name {
    margin: 0;
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .actions button {
    flex: 1 1 auto;
  }
  .actions .ghost {
    flex: 0 0 auto;
    color: var(--a);
  }
  .msg,
  .tip {
    margin: 0;
    font-size: 13px;
  }
  .tip {
    opacity: 0.85;
  }
</style>
