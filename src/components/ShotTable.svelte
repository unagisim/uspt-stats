<script lang="ts">
  // Répartition par type de coup : coups gagnants (G), fautes provoquées (FP), fautes directes (FD)
  // pour chaque joueur, avec une ligne de total.
  import type { Shot } from '../lib/engine';
  import { SHOT } from '../lib/labels';
  import type { ShotCount } from '../lib/stats';

  let {
    shots,
    a,
    b,
    names,
  }: {
    shots: Shot[];
    a: Partial<Record<Shot, ShotCount>>;
    b: Partial<Record<Shot, ShotCount>>;
    names: { A: string; B: string };
  } = $props();

  const KEYS = ['winners', 'forcedErrors', 'unforcedErrors'] as const;
  const total = (by: Partial<Record<Shot, ShotCount>>, k: (typeof KEYS)[number]) =>
    shots.reduce((sum, s) => sum + (by[s]?.[k] ?? 0), 0);
</script>

<div class="wrap">
  <table>
    <colgroup>
      <col class="shot" />
      <col span="3" />
      <col span="3" />
    </colgroup>
    <thead>
      <tr>
        <th rowspan="2" scope="col" class="left">Coup</th>
        <th colspan="3" scope="colgroup" class="pa">{names.A}</th>
        <th colspan="3" scope="colgroup" class="pb">{names.B}</th>
      </tr>
      <tr class="sub">
        <th scope="col" title="Coups gagnants">G</th>
        <th scope="col" title="Fautes provoquées">FP</th>
        <th scope="col" title="Fautes directes">FD</th>
        <th scope="col" class="sep" title="Coups gagnants">G</th>
        <th scope="col" title="Fautes provoquées">FP</th>
        <th scope="col" title="Fautes directes">FD</th>
      </tr>
    </thead>
    <tbody>
      {#each shots as s (s)}
        <tr>
          <th scope="row" class="left">{SHOT[s]}</th>
          {#each [a, b] as by, i (i)}
            {#each KEYS as k, j (k)}
              {@const v = by[s]?.[k] ?? 0}
              <td class:zero={v === 0} class:sep={i === 1 && j === 0} class:win={k === 'winners'}>{v}</td>
            {/each}
          {/each}
        </tr>
      {/each}
    </tbody>
    <tfoot>
      <tr>
        <th scope="row" class="left">Total</th>
        {#each [a, b] as by, i (i)}
          {#each KEYS as k, j (k)}
            <td class:sep={i === 1 && j === 0} class:win={k === 'winners'}>{total(by, k)}</td>
          {/each}
        {/each}
      </tr>
    </tfoot>
  </table>
</div>
<p class="legend">G : coups gagnants · FP : fautes provoquées · FD : fautes directes, commises par le joueur avec ce coup.</p>

<style>
  .wrap {
    overflow-x: auto;
    margin-top: 6px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-variant-numeric: tabular-nums;
    font-size: 14px;
  }
  col.shot {
    width: 30%;
  }
  th,
  td {
    padding: 6px 2px;
    text-align: center;
    border-bottom: 1px solid var(--border);
  }
  th {
    font-weight: 600;
  }
  .left {
    text-align: left;
    padding-left: 0;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  thead th {
    font-size: 13px;
  }
  .sub th {
    font-size: 11px;
    color: var(--muted);
    font-weight: 600;
  }
  .pa {
    color: var(--a-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pb {
    color: var(--b-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sep {
    border-left: 1px solid var(--border);
  }
  thead tr:first-child th.pb {
    border-left: 1px solid var(--border);
  }
  .win {
    font-weight: 700;
  }
  .zero {
    color: var(--muted);
    font-weight: 400;
  }
  tfoot th,
  tfoot td {
    border-bottom: none;
    border-top: 2px solid var(--border);
    font-weight: 700;
  }
  .legend {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
</style>
