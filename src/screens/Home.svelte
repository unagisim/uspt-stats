<script lang="ts">
  import { onMount } from 'svelte';
  import { backupFileName } from '../lib/backup';
  import { configOf, db, deleteMatch, exportBackup, fullName, importBackup, type StoredMatch } from '../lib/db';
  import { replay, setsSummary } from '../lib/engine';
  import { applyUpdate, install, pwa } from '../lib/pwa.svelte';
  import { filterMatches, type StatusFilter } from '../lib/search';

  let {
    onNew,
    onOpen,
    onPresets,
  }: { onNew: () => void; onOpen: (id: string) => void; onPresets: () => void } = $props();

  let matches = $state<StoredMatch[]>([]);
  let loaded = $state(false);
  let query = $state('');
  let status = $state<StatusFilter>('all');
  /** Match dont la suppression attend une confirmation. */
  let confirmId = $state<string | null>(null);
  let deleteError = $state('');

  const shown = $derived(filterMatches(matches, { text: query, status }));
  const STATUS: [StatusFilter, string][] = [
    ['all', 'Tous'],
    ['in_progress', 'En cours'],
    ['finished', 'Terminés'],
  ];

  // ---- Sauvegarde JSON ----
  let backupMsg = $state('');
  let backupError = $state(false);
  let busy = $state(false);

  async function loadMatches() {
    matches = await db.matches.orderBy('updatedAt').reverse().toArray();
  }

  async function saveBackup() {
    busy = true;
    backupMsg = '';
    backupError = false;
    try {
      const b = await exportBackup();
      const blob = new Blob([JSON.stringify(b, null, 1)], { type: 'application/json' });
      const { shareOrDownload } = await import('../lib/export/share');
      const name = backupFileName();
      const res = await shareOrDownload(blob, name, 'Sauvegarde USPT Stats');
      if (res !== 'cancelled') {
        backupMsg = `${b.matches.length} match${b.matches.length > 1 ? 's' : ''} sauvegardé${b.matches.length > 1 ? 's' : ''} dans ${name}.`;
      }
    } catch {
      backupError = true;
      backupMsg = 'La sauvegarde a échoué. Réessayez.';
    } finally {
      busy = false;
    }
  }

  async function restore(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    busy = true;
    backupMsg = '';
    backupError = false;
    try {
      const r = await importBackup(await file.text());
      await loadMatches();
      const parts = [`${r.added} ajouté${r.added > 1 ? 's' : ''}`, `${r.updated} mis à jour`];
      if (r.unchanged) parts.push(`${r.unchanged} déjà à jour`);
      if (r.invalid) parts.push(`${r.invalid} illisible${r.invalid > 1 ? 's' : ''} ignoré${r.invalid > 1 ? 's' : ''}`);
      const presetPart = r.presetsAdded
        ? ` ${r.presetsAdded} note${r.presetsAdded > 1 ? 's' : ''} rapide${r.presetsAdded > 1 ? 's' : ''} ajoutée${r.presetsAdded > 1 ? 's' : ''}.`
        : '';
      backupMsg = `Import terminé : ${parts.join(', ')}.${presetPart}`;
    } catch (err) {
      backupError = true;
      backupMsg = err instanceof Error ? err.message : "L'import a échoué.";
    } finally {
      busy = false;
    }
  }

  async function remove(id: string) {
    deleteError = '';
    try {
      await deleteMatch(id);
      matches = matches.filter((m) => m.id !== id);
      confirmId = null;
    } catch {
      deleteError = "La suppression a échoué. Réessayez.";
    }
  }

  onMount(async () => {
    matches = await db.matches.orderBy('updatedAt').reverse().toArray();
    loaded = true;
  });

  function scoreLine(m: StoredMatch): string {
    const s = replay(configOf(m), m.events).state;
    const parts = setsSummary(s);
    if (!s.winner && (s.games.A || s.games.B || s.points.A || s.points.B)) {
      parts.push(s.isSuperTiebreakSet ? `[${s.points.A}-${s.points.B}]` : `${s.games.A}-${s.games.B}`);
    }
    if (s.endReason === 'retirement') parts.push('ab.');
    if (s.endReason === 'walkover') parts.push('forfait');
    return parts.join('  ') || 'Pas encore commencé';
  }

  const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<div class="page">
  <header class="brand">
    <img src="{import.meta.env.BASE_URL}logo.png" alt="US Pontet Tennis" width="96" height="94" />
    <h1>USPT Stats</h1>
  </header>

  {#if pwa.needRefresh}
    <div class="notice" role="status">
      <span>Une nouvelle version est disponible.</span>
      <button onclick={applyUpdate}>Mettre à jour</button>
    </div>
  {:else if pwa.offlineReady}
    <div class="notice" role="status">
      <span>L'application fonctionne maintenant sans réseau.</span>
      <button class="ghost" onclick={() => (pwa.offlineReady = false)}>OK</button>
    </div>
  {/if}
  {#if pwa.canInstall}
    <button class="install" onclick={install}>Installer l'application sur cet appareil</button>
  {/if}

  <button class="primary new" onclick={onNew}>Nouveau match</button>

  <h2>Matchs</h2>
  {#if loaded && matches.length === 0}
    <p class="empty">Aucun match pour l'instant. Créez le premier pour commencer la saisie.</p>
  {:else if matches.length > 0}
    <div class="search">
      <input
        type="search"
        bind:value={query}
        placeholder="Joueur, tournoi, lieu, date (jj/mm/aaaa)…"
        aria-label="Rechercher un match"
        autocomplete="off"
      />
      <div class="chips" role="group" aria-label="Statut">
        {#each STATUS as [value, label] (value)}
          <button class:on={status === value} aria-pressed={status === value} onclick={() => (status = value)}>{label}</button>
        {/each}
      </div>
      <p class="count">
        {shown.length} match{shown.length > 1 ? 's' : ''}{shown.length !== matches.length ? ` sur ${matches.length}` : ''}
      </p>
    </div>
    {#if shown.length === 0}
      <p class="empty">Aucun match ne correspond à cette recherche.</p>
    {/if}
  {/if}
  {#if deleteError}<p class="error" role="alert">{deleteError}</p>{/if}
  <ul>
    {#each shown as m (m.id)}
      <li class="item" class:confirming={confirmId === m.id}>
        <button class="match" onclick={() => onOpen(m.id)}>
          <span class="players">
            <span class:won={m.winner === 'A'}>{fullName(m.players.A)}</span>
            <span class="vs">contre</span>
            <span class:won={m.winner === 'B'}>{fullName(m.players.B)}</span>
          </span>
          <span class="score">{scoreLine(m)}</span>
          <span class="meta">
            {#if m.status === 'in_progress'}<span class="live">En cours</span>{/if}
            {dateFmt.format(m.createdAt)}{m.context.tournoi ? ` · ${m.context.tournoi}` : ''}
          </span>
        </button>
        {#if confirmId === m.id}
          <div class="confirm" role="alertdialog" aria-label="Confirmer la suppression">
            <span>Supprimer définitivement ce match ? Ses points et ses stats seront perdus.</span>
            <div>
              <button onclick={() => (confirmId = null)}>Annuler</button>
              <button class="danger" onclick={() => remove(m.id)}>Supprimer</button>
            </div>
          </div>
        {:else}
          <button class="trash" aria-label="Supprimer ce match" title="Supprimer" onclick={() => (confirmId = m.id)}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"
              ><path
                d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              /></svg
            >
          </button>
        {/if}
      </li>
    {/each}
  </ul>

  <section class="card backup">
    <h2>Notes rapides</h2>
    <p class="hint">Les notes pré-enregistrées que vous ajoutez en un tap pendant les matchs.</p>
    <button onclick={onPresets}>Gérer les notes rapides</button>
  </section>

  <section class="card backup">
    <h2>Sauvegarde</h2>
    <p class="hint">
      Les matchs ne sont enregistrés que sur cet appareil. Exportez-les régulièrement dans un fichier, et
      importez ce fichier pour les retrouver sur un autre appareil. Un match seul s'exporte depuis son écran de
      statistiques et s'importe ici de la même façon. L'import n'efface rien : il ajoute les matchs manquants et
      met à jour ceux qui ont changé.
    </p>
    <button onclick={saveBackup} disabled={busy || matches.length === 0}>Exporter tous les matchs (JSON)</button>
    <label class="file" class:disabled={busy}>
      Importer un match ou une sauvegarde
      <input type="file" accept="application/json,.json" onchange={restore} disabled={busy} />
    </label>
    {#if backupMsg}<p class="hint" class:error={backupError} role="status">{backupMsg}</p>{/if}
  </section>
</div>

<style>
  h1 {
    font-size: 24px;
    margin: 8px 0 16px;
  }
  h2 {
    font-size: 18px;
    margin: 28px 0 10px;
  }
  .notice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: var(--a-bg);
    color: var(--a);
    border-radius: var(--radius);
    padding: 8px 8px 8px 14px;
    margin-bottom: 12px;
    font-size: 15px;
  }
  .notice button {
    min-height: 44px;
    flex: none;
  }
  .install {
    width: 100%;
    margin-bottom: 12px;
  }
  .new {
    width: 100%;
    min-height: 60px;
    font-size: 18px;
  }
  .empty {
    color: var(--muted);
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 4px 0 16px;
  }
  .brand img {
    width: 96px;
    height: auto;
    border-radius: 14px;
    background: #fff;
    flex: none;
  }
  .brand h1 {
    margin: 0;
  }
  .backup {
    margin-top: 28px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .backup h2 {
    margin: 0;
  }
  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
  .file {
    position: relative;
    min-height: var(--tap);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    font-size: 16px;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .file.disabled {
    opacity: 0.6;
  }
  .file input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  .search {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }
  .chips {
    display: flex;
    gap: 6px;
  }
  .chips button {
    min-height: 40px;
    flex: 1;
  }
  .chips .on {
    background: var(--text);
    color: var(--bg);
    border-color: var(--text);
    font-weight: 600;
  }
  .count {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
  .item {
    display: flex;
    gap: 6px;
    align-items: stretch;
  }
  .item.confirming {
    flex-direction: column;
  }
  .trash {
    flex: none;
    width: 48px;
    padding: 0;
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .confirm {
    background: var(--danger-bg);
    color: var(--danger);
    border-radius: var(--radius);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
  }
  .confirm div {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .danger {
    background: var(--danger);
    border-color: var(--danger);
    color: var(--danger-bg);
    font-weight: 600;
  }
  .match {
    flex: 1;
    min-width: 0;
    width: 100%;
    text-align: left;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .players {
    font-weight: 500;
  }
  .vs {
    color: var(--muted);
    font-weight: 400;
    margin: 0 4px;
  }
  .won {
    font-weight: 700;
  }
  .score {
    font-variant-numeric: tabular-nums;
    font-size: 15px;
  }
  .meta {
    font-size: 13px;
    color: var(--muted);
  }
  .live {
    background: var(--warn-bg);
    color: var(--warn);
    border-radius: 6px;
    padding: 1px 6px;
    margin-right: 6px;
    font-weight: 600;
  }
</style>
