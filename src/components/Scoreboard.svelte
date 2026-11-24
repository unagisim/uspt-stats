<script lang="ts">
  import { formatPoints, other, type ScoreState, type Side } from '../lib/engine';

  let { score, names }: { score: ScoreState; names: { A: string; B: string } } = $props();

  const sides: Side[] = ['A', 'B'];
  const pts = $derived(formatPoints(score));
  const live = $derived(!score.winner);
</script>

<div class="board" role="table" aria-label="Score">
  {#each sides as s (s)}
    <div class="row {s === 'A' ? 'ra' : 'rb'}" class:winner={score.winner === s} role="row">
      <span class="srv" role="cell">
        {#if live && score.server === s}<span class="ball" title="Au service" aria-label="Au service"></span>{/if}
      </span>
      <span class="name" role="cell">{names[s]}</span>
      {#each score.completedSets as set, i (i)}
        <span class="set" class:lost={set.games[s] < set.games[other(s)]} role="cell">
          {set.superTiebreak && set.tiebreak ? set.tiebreak[s] : set.games[s]}{#if set.tiebreak && !set.superTiebreak && set.games[s] < set.games[other(s)]}<sup>{set.tiebreak[s]}</sup>{/if}
        </span>
      {/each}
      {#if live}
        {#if !score.isSuperTiebreakSet}
          <span class="set current" role="cell">{score.games[s]}</span>
        {/if}
        <span class="pts" role="cell">{pts[s]}</span>
      {/if}
    </div>
  {/each}
  {#if live && score.inTiebreak}
    <p class="tb">{score.isSuperTiebreakSet ? 'Super jeu décisif (10 points)' : 'Jeu décisif'}</p>
  {/if}
</div>

<style>
  .board {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 6px 10px;
    font-variant-numeric: tabular-nums;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    font-size: 20px;
  }
  .row + .row {
    border-top: 1px solid var(--border);
  }
  .srv {
    width: 14px;
    flex: none;
    display: flex;
    justify-content: center;
  }
  .ball {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #c8d400;
    border: 1px solid #8a9300;
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }
  .winner .name {
    font-weight: 800;
  }
  .set {
    width: 30px;
    text-align: center;
    flex: none;
  }
  .set.lost {
    color: var(--muted);
  }
  .set.current {
    font-weight: 700;
  }
  sup {
    font-size: 11px;
  }
  .pts {
    width: 52px;
    flex: none;
    text-align: center;
    font-weight: 800;
    border-radius: 8px;
    padding: 2px 0;
  }
  .ra .pts {
    background: var(--a-bg);
    color: var(--a);
  }
  .rb .pts {
    background: var(--b-bg);
    color: var(--b);
  }
  .tb {
    margin: 0 0 4px;
    font-size: 13px;
    color: var(--muted);
    text-align: right;
  }
</style>
