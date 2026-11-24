<script lang="ts">
  let {
    label,
    a,
    b,
    va = undefined,
    vb = undefined,
    lowerIsBetter = false,
  }: { label: string; a: string; b: string; va?: number; vb?: number; lowerIsBetter?: boolean } = $props();

  const hasBar = $derived(va !== undefined && vb !== undefined && va + vb > 0);
  const share = $derived(hasBar ? (va! / (va! + vb!)) * 100 : 50);
  // Valeur en gras = la meilleure des deux (la plus basse pour les fautes).
  const lead = $derived(
    va !== undefined && vb !== undefined ? Math.sign(va - vb) * (lowerIsBetter ? -1 : 1) : 0,
  );
</script>

<div class="row">
  <div class="vals">
    <span class="v" class:lead={lead > 0}>{a}</span>
    <span class="label">{label}</span>
    <span class="v right" class:lead={lead < 0}>{b}</span>
  </div>
  {#if hasBar}
    <div class="bar" aria-hidden="true">
      <span class="ba" style:width="{share}%"></span>
      <span class="bb" style:width="{100 - share}%"></span>
    </div>
  {/if}
</div>

<style>
  .row {
    padding: 8px 0;
  }
  .row + :global(.row) {
    border-top: 1px solid var(--border);
  }
  .vals {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    font-variant-numeric: tabular-nums;
  }
  .label {
    font-size: 13px;
    color: var(--muted);
    text-align: center;
  }
  .v {
    font-size: 15px;
    white-space: nowrap;
  }
  .right {
    text-align: right;
  }
  .lead {
    font-weight: 700;
  }
  .bar {
    display: flex;
    gap: 2px;
    height: 6px;
    margin-top: 6px;
  }
  .bar span {
    border-radius: 3px;
    min-width: 2px;
  }
  .ba {
    background: var(--a-strong);
  }
  .bb {
    background: var(--b-strong);
  }
</style>
