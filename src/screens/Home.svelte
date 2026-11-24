<script lang="ts">
  import { onMount } from 'svelte';
  import { configOf, db, deleteMatch, fullName, type StoredMatch } from '../lib/db';
  import { replay, setsSummary } from '../lib/engine';
  import { applyUpdate, install, pwa } from '../lib/pwa.svelte';
  import { filterMatches, type StatusFilter } from '../lib/search';

  let { onNew, onOpen }: { onNew: () => void; onOpen: (id: string) => void } = $props();

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
  <h1>USPT Stats</h1>

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
