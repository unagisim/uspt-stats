<script lang="ts">
  import { onMount } from 'svelte';
  import { configOf, db, fullName, type StoredMatch } from '../lib/db';
  import { replay, setsSummary } from '../lib/engine';
  import { applyUpdate, install, pwa } from '../lib/pwa.svelte';

  let { onNew, onOpen }: { onNew: () => void; onOpen: (id: string) => void } = $props();

  let matches = $state<StoredMatch[]>([]);
  let loaded = $state(false);

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
  {/if}
  <ul>
    {#each matches as m (m.id)}
      <li>
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
  .match {
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
