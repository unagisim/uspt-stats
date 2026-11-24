<script lang="ts">
  import { onMount } from 'svelte';
  import Scoreboard from '../components/Scoreboard.svelte';
  import { configOf, db, shortName, type StoredMatch } from '../lib/db';
  import { INCIDENTS } from '../lib/labels';
  import {
    other,
    pointSituation,
    replay,
    setsSummary,
    type IncidentType,
    type MatchEvent,
    type PointDetails,
    type Side,
  } from '../lib/engine';

  let { id, onExit, onStats }: { id: string; onExit: () => void; onStats: () => void } = $props();

  const NO_PLAYER: IncidentType[] = ['interruption', 'resumption'];

  let match = $state<StoredMatch | null>(null);
  let notFound = $state(false);
  let pendingLets = $state(0);
  let menuOpen = $state(false);
  let incidentType = $state<IncidentType | null>(null);

  const config = $derived(match ? configOf(match) : null);
  const result = $derived(match && config ? replay(config, match.events) : null);
  const score = $derived(result?.state ?? null);
  const situation = $derived(score && config ? pointSituation(score, config) : null);
  const names = $derived(
    match ? { A: shortName(match.players.A), B: shortName(match.players.B) } : { A: '', B: '' },
  );
  const lastEvent = $derived(match?.events.at(-1) ?? null);
  const interrupted = $derived.by(() => {
    const last = match?.events.findLast(
      (e) => e.kind === 'incident' && (e.type === 'interruption' || e.type === 'resumption'),
    );
    return last?.kind === 'incident' && last.type === 'interruption';
  });

  const banner = $derived.by(() => {
    if (!score || !situation || score.winner) return null;
    if (situation.matchPoint) return { text: `Balle de match ${names[situation.matchPoint]}`, tone: 'hot' };
    if (situation.setPoint) return { text: `Balle de set ${names[situation.setPoint]}`, tone: 'hot' };
    if (situation.breakPoint) return { text: `Balle de break ${names[other(score.server)]}`, tone: 'warm' };
    if (situation.decidingPoint) return { text: 'Point décisif', tone: 'warm' };
    return null;
  });

  // ---- Écran toujours allumé pendant la saisie ----
  let wakeLock: WakeLockSentinel | null = null;
  async function keepAwake() {
    try {
      if (document.visibilityState === 'visible' && 'wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch {
      wakeLock = null;
    }
  }

  onMount(() => {
    db.matches.get(id).then((m) => {
      if (m) match = m;
      else notFound = true;
    });
    keepAwake();
    document.addEventListener('visibilitychange', keepAwake);
    return () => {
      document.removeEventListener('visibilitychange', keepAwake);
      wakeLock?.release().catch(() => {});
    };
  });

  // ---- Enregistrement ----
  async function persist() {
    if (!match || !config) return;
    const s = replay(config, match.events).state;
    match.status = s.winner ? 'finished' : 'in_progress';
    match.winner = s.winner;
    match.updatedAt = Date.now();
    await db.matches.put($state.snapshot(match));
  }

  async function record(ev: MatchEvent) {
    if (!match) return;
    match.events.push(ev);
    navigator.vibrate?.(15);
    await persist();
  }

  function point(winner: Side, details: PointDetails = {}) {
    if (!score || score.winner) return;
    const d: PointDetails = { ...details };
    if (pendingLets) d.lets = pendingLets;
    pendingLets = 0;
    record({ kind: 'point', winner, ts: Date.now(), ...(Object.keys(d).length ? { details: d } : {}) });
  }

  const ace = () => score && point(score.server, { serveOutcome: 'ace' });
  const doubleFault = () =>
    score && point(other(score.server), { firstServeIn: false, serveOutcome: 'double_fault' });

  async function undo() {
    if (pendingLets) {
      pendingLets = 0;
      return;
    }
    if (!match || match.events.length === 0) return;
    match.events.pop();
    await persist();
  }

  function chooseIncident(t: IncidentType) {
    if (NO_PLAYER.includes(t)) {
      record({ kind: 'incident', type: t, ts: Date.now() });
      closeMenu();
    } else {
      incidentType = t;
    }
  }

  function incidentFor(player: Side) {
    if (!incidentType) return;
    const t = incidentType;
    if ((t === 'retirement' || t === 'walkover') && !confirm(`${INCIDENTS[t]} de ${names[player]} : le match sera terminé. Continuer ?`)) {
      return;
    }
    record({ kind: 'incident', type: t, player, ts: Date.now() });
    closeMenu();
  }

  function closeMenu() {
    menuOpen = false;
    incidentType = null;
  }

  function describe(e: MatchEvent): string {
    if (e.kind === 'incident') return `${INCIDENTS[e.type]}${e.player ? ` ${names[e.player]}` : ''}`;
    const extra =
      e.details?.serveOutcome === 'ace' ? ' (ace)' : e.details?.serveOutcome === 'double_fault' ? ' (double faute)' : '';
    return `Point ${names[e.winner]}${extra}`;
  }

  const endText = $derived.by(() => {
    if (!score?.winner) return '';
    const w = names[score.winner];
    if (score.endReason === 'retirement') return `Victoire de ${w} par abandon`;
    if (score.endReason === 'walkover') return `Victoire de ${w} par forfait`;
    return `Victoire de ${w}`;
  });
</script>

{#if notFound}
  <div class="page">
    <p>Ce match est introuvable.</p>
    <button onclick={onExit}>Retour à l'accueil</button>
  </div>
{:else if match && score && config}
  <div class="live">
    <header>
      <button class="ghost" onclick={onExit}>‹ Accueil</button>
      <span class="fmt">{config.format.label}</span>
      <button class="ghost" onclick={() => (menuOpen ? closeMenu() : (menuOpen = true))} aria-expanded={menuOpen}>
        Incidents
      </button>
    </header>

    <Scoreboard {score} {names} />

    <div class="banners" aria-live="polite">
      {#if banner}<p class="banner {banner.tone}">{banner.text}</p>{/if}
      {#if score.changeEnds}<p class="banner info">Changement de côté</p>{/if}
      {#if interrupted}
        <p class="banner warm">
          Match interrompu
          <button onclick={() => record({ kind: 'incident', type: 'resumption', ts: Date.now() })}>Reprendre</button>
        </p>
      {/if}
    </div>

    {#if menuOpen}
      <section class="menu card">
        {#if !incidentType}
          <div class="grid">
            {#each Object.entries(INCIDENTS) as [t, text] (t)}
              <button onclick={() => chooseIncident(t as IncidentType)}>{text}</button>
            {/each}
          </div>
        {:else}
          <p class="q">{INCIDENTS[incidentType]} : quel joueur ?</p>
          <div class="grid">
            <button onclick={() => incidentFor('A')}>{names.A}</button>
            <button onclick={() => incidentFor('B')}>{names.B}</button>
          </div>
        {/if}
        <button class="ghost close" onclick={closeMenu}>Fermer</button>
      </section>
    {/if}

    {#if score.winner}
      <section class="end card">
        <h2>{endText}</h2>
        <p class="final">{setsSummary(score).join('  ')}</p>
        <button class="primary" onclick={onStats}>Voir les statistiques</button>
        <button onclick={onExit}>Retour à l'accueil</button>
      </section>
    {:else}
      <div class="big">
        <button class="pa" onclick={() => point('A')}>
          <span>Point</span>
          <strong>{names.A}</strong>
        </button>
        <button class="pb" onclick={() => point('B')}>
          <span>Point</span>
          <strong>{names.B}</strong>
        </button>
      </div>
      <div class="serve">
        <button onclick={ace}>Ace</button>
        <button onclick={doubleFault}>Double faute</button>
        {#if config.letEnabled}
          <button onclick={() => pendingLets++}>Let{pendingLets ? ` (${pendingLets})` : ''}</button>
        {/if}
      </div>
    {/if}

    <footer>
      <button class="undo" onclick={undo} aria-label="Annuler le dernier point">↶ Annuler</button>
      <span class="last">{lastEvent ? `Dernier : ${describe(lastEvent)}` : 'Aucun point saisi'}</span>
      <button class="stats" onclick={onStats}>Stats</button>
    </footer>
  </div>
{/if}

<style>
  .live {
    height: 100dvh;
    max-width: 640px;
    margin: 0 auto;
    padding: 8px 12px calc(10px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  header button {
    min-height: 44px;
    padding: 0 8px;
  }
  .fmt {
    font-size: 14px;
    color: var(--muted);
  }
  .banners {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  /* Hauteur réservée : l'apparition d'un bandeau ne déplace pas les gros boutons. */
  .banners {
    min-height: 38px;
  }
  .banner {
    margin: 0;
    padding: 8px 12px;
    border-radius: 10px;
    font-weight: 600;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }
  .banner button {
    min-height: 36px;
  }
  .hot {
    background: var(--danger-bg);
    color: var(--danger);
  }
  .warm {
    background: var(--warn-bg);
    color: var(--warn);
  }
  .info {
    background: var(--surface-2);
    color: var(--text);
  }
  .menu .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .menu .q {
    margin: 0 0 10px;
    font-weight: 600;
  }
  .close {
    width: 100%;
    margin-top: 6px;
  }
  .big {
    flex: 1;
    min-height: 200px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .big button {
    flex: 1;
    border: none;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 18px;
  }
  .big strong {
    font-size: 26px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pa {
    background: var(--a-bg);
    color: var(--a);
  }
  .pb {
    background: var(--b-bg);
    color: var(--b);
  }
  .serve {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 8px;
  }
  .serve button {
    min-height: 56px;
    font-weight: 600;
  }
  .end {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    gap: 12px;
  }
  .end h2 {
    margin: 0;
    font-size: 22px;
  }
  .final {
    margin: 0;
    font-size: 20px;
    font-variant-numeric: tabular-nums;
  }
  footer {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .undo {
    flex: none;
    font-weight: 600;
  }
  .stats {
    flex: none;
    margin-left: auto;
    font-weight: 600;
  }
  .last {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (orientation: landscape) and (max-height: 560px) {
    .live {
      max-width: none;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      grid-template-rows: auto auto 1fr auto auto;
      column-gap: 12px;
    }
    header,
    footer {
      grid-column: 1 / -1;
    }
    .big,
    .end {
      grid-column: 2;
      grid-row: 2 / 5;
      flex-direction: row;
      min-height: 0;
    }
    .serve {
      grid-column: 1;
    }
  }
</style>
