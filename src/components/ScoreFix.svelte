<script lang="ts">
  // Correction du score : modifier un jeu mal suivi (mode Jeux) ou saisir le score exact
  // (après une absence de quelques jeux, par exemple).
  import { untrack } from 'svelte';
  import type { GameRecord, MatchFormat, Pair, ScoreState, Side } from '../lib/engine';
  import { isSuperSet, maxSets, parseScore } from '../lib/scoreFix';

  let {
    score,
    format,
    games,
    names,
    onFlip,
    onDelete,
    onAdjust,
    onClose,
  }: {
    score: ScoreState;
    format: MatchFormat;
    games: GameRecord[];
    names: { A: string; B: string };
    onFlip: (eventIndex: number) => void;
    onDelete: (eventIndex: number) => void;
    onAdjust: (adj: { sets: Pair[]; games: Pair; server: Side }) => void;
    onClose: () => void;
  } = $props();

  /** Derniers jeux, du plus récent au plus ancien, avec leur numéro dans le set. */
  const recent = $derived.by(() => {
    const counters = new Map<number, number>();
    const numbered = games.map((g) => {
      const n = (counters.get(g.setNumber) ?? 0) + 1;
      counters.set(g.setNumber, n);
      return { ...g, n };
    });
    return numbered.slice(-10).reverse();
  });

  // ---- Score exact : pré-rempli avec le score actuel ----
  function initialRows(): Pair[] {
    return Array.from({ length: maxSets(format) }, (_, i) => {
      const done = score.completedSets[i];
      if (done) return { ...done.games };
      if (i === score.completedSets.length && !score.isSuperTiebreakSet && !score.winner) return { ...score.games };
      return { A: 0, B: 0 };
    });
  }
  // Copie volontaire du score à l'ouverture : le formulaire ne suit pas les changements ensuite.
  let rows = $state<Pair[]>(untrack(initialRows));
  let server = $state<Side>(untrack(() => score.server));
  let error = $state('');

  function apply() {
    error = '';
    try {
      const parsed = parseScore(format, rows.map((r) => ({ A: Number(r.A), B: Number(r.B) })));
      onAdjust({ ...parsed, server });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Score impossible.';
    }
  }
</script>

<section class="fix card">
  <div class="head">
    <strong>Corriger le score</strong>
    <button class="ghost" onclick={onClose}>Fermer</button>
  </div>

  <h3>Derniers jeux</h3>
  {#if recent.length === 0}
    <p class="hint">Aucun jeu terminé pour l'instant.</p>
  {:else}
    <ul>
      {#each recent as g (g.eventIndex + '-' + g.n)}
        <li>
          <span class="what">
            Set {g.setNumber} · {g.tiebreak ? 'jeu décisif' : `jeu ${g.n}`}
            <strong class={g.winner === 'A' ? 'pa' : 'pb'}>{names[g.winner]}</strong>
          </span>
          {#if g.source === 'game'}
            <button onclick={() => onFlip(g.eventIndex)} aria-label="Donner ce jeu à l'autre joueur">⇄ Inverser</button>
            <button onclick={() => onDelete(g.eventIndex)} aria-label="Supprimer ce jeu">✕</button>
          {:else}
            <span class="ro">{g.source === 'points' ? 'saisi au point' : 'pénalité'}</span>
          {/if}
        </li>
      {/each}
    </ul>
    <p class="hint">« Inverser » donne le jeu à l'autre joueur ; « ✕ » le supprime. Les jeux saisis point par point se corrigent avec « Annuler ».</p>
  {/if}

  <h3>Score exact</h3>
  <p class="hint">Par exemple après une absence : saisissez le score réel, il remplace le score actuel. Les jeux non suivis ne compteront pas dans les stats.</p>
  <table>
    <thead>
      <tr><th></th><th class="pa">{names.A}</th><th class="pb">{names.B}</th></tr>
    </thead>
    <tbody>
      {#each rows as r, i (i)}
        <tr>
          <th scope="row">Set {i + 1}{isSuperSet(format, i) ? ' (super JD)' : ''}</th>
          <td><input type="number" inputmode="numeric" min="0" max="7" bind:value={r.A} oninput={() => (error = '')} aria-label="Set {i + 1}, jeux {names.A}" /></td>
          <td><input type="number" inputmode="numeric" min="0" max="7" bind:value={r.B} oninput={() => (error = '')} aria-label="Set {i + 1}, jeux {names.B}" /></td>
        </tr>
      {/each}
    </tbody>
  </table>
  <span class="lbl">Au service au prochain jeu</span>
  <div class="who">
    <button class:on={server === 'A'} onclick={() => (server = 'A')}>{names.A}</button>
    <button class:on={server === 'B'} onclick={() => (server = 'B')}>{names.B}</button>
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <button class="primary" onclick={apply}>Appliquer ce score</button>
</section>

<style>
  .fix {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .head button {
    min-height: 40px;
  }
  h3 {
    font-size: 14px;
    margin: 6px 0 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  li {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
    border-bottom: 1px solid var(--border);
  }
  .what {
    flex: 1;
    min-width: 0;
    font-size: 14px;
  }
  li button {
    min-height: 40px;
    padding: 0 10px;
    font-size: 14px;
  }
  .ro {
    font-size: 12px;
    color: var(--muted);
  }
  .pa {
    color: var(--a-text);
  }
  .pb {
    color: var(--b-text);
  }
  .hint {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    padding: 4px;
    text-align: center;
    font-size: 14px;
  }
  tbody th {
    text-align: left;
    font-weight: 500;
    white-space: nowrap;
  }
  thead th {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 0;
    white-space: nowrap;
  }
  td input {
    width: 100%;
    min-height: 44px;
    text-align: center;
    font-size: 18px;
    padding: 0 4px;
  }
  .lbl {
    font-size: 12px;
    color: var(--muted);
  }
  .who {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .who button {
    min-height: 44px;
  }
  .on {
    background: var(--a-bg);
    color: var(--a);
    border: 2px solid var(--a-strong);
    font-weight: 600;
  }
  .error {
    margin: 0;
  }
</style>
