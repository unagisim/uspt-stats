<script lang="ts">
  // Saisie d'un point en mode standard ou expert (voir lib/pointDraft.ts pour la logique).
  import {
    other,
    type CourtPosition,
    type EndZone,
    type PointDetails,
    type PointEnding,
    type RallyLength,
    type ServeZone,
    type Shot,
    type Side,
    type Spin,
  } from '../lib/engine';
  import { END_ZONE, ENDING, POSITION, RALLY, SERVE_ZONE, SHOT, SPIN } from '../lib/labels';
  import { afterWinner, back as draftBack, buildDetails, emptyDraft, type DetailedMode, type Draft } from '../lib/pointDraft';

  let {
    mode,
    server,
    names,
    letEnabled,
    onRecord,
  }: {
    mode: DetailedMode;
    server: Side;
    names: { A: string; B: string };
    letEnabled: boolean;
    onRecord: (winner: Side, details: PointDetails) => void;
  } = $props();

  let d = $state<Draft>(emptyDraft());

  const receiver = $derived(other(server));
  const hitter = $derived(d.winner ? (d.ending && d.ending !== 'winner' ? other(d.winner) : d.winner) : null);

  /** Annule la dernière action du point en cours. Renvoie false si rien n'est en cours. */
  export function back(): boolean {
    const prev = draftBack(d);
    if (!prev) return false;
    d = prev;
    return true;
  }

  function finish(winner: Side, extra: PointDetails) {
    onRecord(winner, buildDetails(d, extra));
    d = emptyDraft();
  }

  // ---- Service ----
  function fault() {
    if (d.serveNo === 1) d.serveNo = 2;
    else finish(receiver, { serveOutcome: 'double_fault' });
  }
  const ace = () => finish(server, { serveOutcome: 'ace' });
  const inPlay = () => (d.step = 'winner');
  const toggleZone = (z: ServeZone) => (d.serveZone = d.serveZone === z ? undefined : z);

  // ---- Gagnant ----
  function chooseWinner(w: Side) {
    d.winner = w;
    d.step = afterWinner(mode);
  }

  // ---- Standard : fin du point puis coup ----
  function chooseEnding(e: PointEnding) {
    d.ending = e;
    d.step = 'shot';
  }
  const chooseShot = (s: Shot) => finish(d.winner!, { serveOutcome: 'in', shot: s });
  const skip = () => finish(d.winner!, { serveOutcome: 'in' });

  // ---- Expert : fiche détaillée ----
  function pick<K extends 'ending' | 'shot' | 'spin' | 'position' | 'endZone' | 'rally'>(key: K, v: Draft[K]) {
    d[key] = d[key] === v ? undefined : v;
  }
  const validate = () => finish(d.winner!, { serveOutcome: 'in' });

  const SHOTS: Shot[] = ['forehand', 'backhand', 'volley', 'smash', 'drop_shot', 'lob', 'passing', 'return', 'serve'];
  const ZONES: EndZone[] = ['left_deep', 'center_deep', 'right_deep', 'left_short', 'center_short', 'right_short', 'net', 'out_long', 'out_wide'];
  const entries = <T extends string>(o: Record<T, string>) => Object.entries(o) as [T, string][];
  const endingLabel = (e: PointEnding, w: Side) =>
    e === 'winner' ? `Coup gagnant ${names[w]}` : `${ENDING[e]} ${names[other(w)]}`;
</script>

<div class="input">
  {#if d.step === 'serve'}
    <p class="title">
      <strong>{d.serveNo === 1 ? '1re balle' : '2e balle'}</strong> · service {names[server]}
      {#if d.lets}<span class="tag">{d.lets} let{d.lets > 1 ? 's' : ''}</span>{/if}
    </p>
    {#if mode === 'expert'}
      <div class="row3">
        {#each entries(SERVE_ZONE) as [z, label] (z)}
          <button class="sm" class:sel={d.serveZone === z} onclick={() => toggleZone(z)}>{label}</button>
        {/each}
      </div>
    {/if}
    <div class="grid2 grow">
      <button class="big" onclick={fault}>{d.serveNo === 1 ? 'Faute' : 'Double faute'}</button>
      <button class="big" onclick={ace}>Ace</button>
      {#if letEnabled}
        <button class="big" onclick={() => d.lets++}>Let</button>
      {/if}
      <button class="big main" class:wide={!letEnabled} onclick={inPlay}>Balle en jeu</button>
    </div>
  {:else if d.step === 'winner'}
    <p class="title">Qui gagne le point ?</p>
    <div class="col grow">
      <button class="big pa" onclick={() => chooseWinner('A')}>{names.A}</button>
      <button class="big pb" onclick={() => chooseWinner('B')}>{names.B}</button>
    </div>
  {:else if d.step === 'ending'}
    <p class="title">Point {names[d.winner!]} : comment se termine-t-il ?</p>
    <div class="col grow">
      {#each entries(ENDING) as [e] (e)}
        <button class="big" onclick={() => chooseEnding(e)}>{endingLabel(e, d.winner!)}</button>
      {/each}
      <button class="skip" onclick={skip}>Passer</button>
    </div>
  {:else if d.step === 'shot'}
    <p class="title">{ENDING[d.ending!]} · coup de {names[hitter!]}</p>
    <div class="grid3 grow">
      {#each SHOTS as s (s)}
        <button class="big" onclick={() => chooseShot(s)}>{SHOT[s]}</button>
      {/each}
    </div>
    <button class="skip" onclick={skip}>Passer</button>
  {:else}
    <div class="details">
      <p class="title">Point {names[d.winner!]}</p>
      <span class="lbl">Fin du point</span>
      <div class="row3">
        {#each entries(ENDING) as [e, label] (e)}
          <button class="sm" class:sel={d.ending === e} onclick={() => pick('ending', e)}>{label}</button>
        {/each}
      </div>
      <span class="lbl">Coup{hitter && d.ending ? ` de ${names[hitter]}` : ''}</span>
      <div class="row3">
        {#each SHOTS as s (s)}
          <button class="sm" class:sel={d.shot === s} onclick={() => pick('shot', s)}>{SHOT[s]}</button>
        {/each}
      </div>
      <span class="lbl">Effet</span>
      <div class="row3">
        {#each entries<Spin>(SPIN) as [s, label] (s)}
          <button class="sm" class:sel={d.spin === s} onclick={() => pick('spin', s)}>{label}</button>
        {/each}
      </div>
      <span class="lbl">Position</span>
      <div class="row3">
        {#each entries<CourtPosition>(POSITION) as [p, label] (p)}
          <button class="sm" class:sel={d.position === p} onclick={() => pick('position', p)}>{label}</button>
        {/each}
      </div>
      <span class="lbl">Zone de fin</span>
      <div class="row3">
        {#each ZONES as z (z)}
          <button class="sm" class:sel={d.endZone === z} onclick={() => pick('endZone', z)}>{END_ZONE[z]}</button>
        {/each}
      </div>
      <span class="lbl">Échange</span>
      <div class="row3">
        {#each entries<RallyLength>(RALLY) as [r] (r)}
          <button class="sm" class:sel={d.rally === r} onclick={() => pick('rally', r)}>{r}</button>
        {/each}
      </div>
    </div>
    <button class="primary validate" onclick={validate}>Valider le point</button>
  {/if}
</div>

<style>
  .input {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .title {
    margin: 0;
    font-size: 15px;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .title strong {
    color: var(--text);
    font-size: 17px;
  }
  .tag {
    background: var(--warn-bg);
    color: var(--warn);
    border-radius: 6px;
    padding: 1px 6px;
    font-size: 13px;
    font-weight: 600;
  }
  .grow {
    flex: 1;
    min-height: 0;
  }
  .grid2,
  .grid3,
  .row3 {
    display: grid;
    gap: 8px;
  }
  .grid2 {
    grid-template-columns: 1fr 1fr;
    grid-auto-rows: 1fr;
  }
  .grid3 {
    grid-template-columns: repeat(3, 1fr);
    grid-auto-rows: 1fr;
  }
  .row3 {
    grid-template-columns: repeat(3, 1fr);
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .col .big {
    flex: 1;
  }
  .big {
    font-size: 17px;
    font-weight: 600;
    border-radius: 14px;
    padding: 4px 6px;
  }
  .main {
    background: var(--primary-bg);
    border-color: var(--primary-bg);
    color: var(--primary-fg);
  }
  .wide {
    grid-column: 1 / -1;
  }
  .pa {
    background: var(--a-bg);
    color: var(--a);
    border: none;
    font-size: 24px;
  }
  .pb {
    background: var(--b-bg);
    color: var(--b);
    border: none;
    font-size: 24px;
  }
  .sm {
    min-height: 40px;
    padding: 0 4px;
    font-size: 14px;
  }
  .sel {
    background: var(--a-bg);
    color: var(--a);
    border: 2px solid var(--a-strong);
    font-weight: 600;
  }
  .skip {
    flex: none !important;
    min-height: 44px;
    color: var(--muted);
  }
  .details {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lbl {
    font-size: 12px;
    color: var(--muted);
    margin-top: 4px;
  }
  .validate {
    min-height: 56px;
    font-size: 17px;
  }
</style>
