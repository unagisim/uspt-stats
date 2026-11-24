<script lang="ts">
  // Mode Jeux : un tap = un jeu gagné, sans le détail des points.
  import type { ScoreState, Side } from '../lib/engine';

  let {
    score,
    names,
    onGame,
    onCorrect,
  }: {
    score: ScoreState;
    names: { A: string; B: string };
    onGame: (winner: Side) => void;
    onCorrect: () => void;
  } = $props();

  const what = $derived(
    score.isSuperTiebreakSet ? 'Super jeu décisif' : score.inTiebreak ? 'Jeu décisif (set)' : 'Jeu',
  );
</script>

<div class="input">
  <p class="title">
    {#if score.isSuperTiebreakSet}
      Super jeu décisif : qui le gagne ?
    {:else if score.inTiebreak}
      Jeu décisif : qui gagne le set ?
    {:else}
      Jeu {score.games.A + score.games.B + 1} · service {names[score.server]}
    {/if}
  </p>
  <div class="big">
    <button class="pa" onclick={() => onGame('A')}>
      <span>{what}</span>
      <strong>{names.A}</strong>
    </button>
    <button class="pb" onclick={() => onGame('B')}>
      <span>{what}</span>
      <strong>{names.B}</strong>
    </button>
  </div>
  <button class="fix" onclick={onCorrect}>Corriger le score</button>
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
  }
  .big {
    flex: 1;
    min-height: 180px;
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
  .fix {
    min-height: 48px;
    font-weight: 600;
  }
</style>
