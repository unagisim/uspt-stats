<script lang="ts">
  // Courbe de l'écart cumulé de points : au-dessus de la ligne, le joueur 1 mène.
  let {
    series,
    setStarts = [],
    names,
  }: { series: number[]; setStarts?: number[]; names: { A: string; B: string } } = $props();

  const W = 320;
  const H = 120;
  const mid = H / 2;
  const uid = Math.random().toString(36).slice(2, 8);

  const values = $derived([0, ...series]);
  const max = $derived(Math.max(3, ...values.map(Math.abs)));
  const x = (i: number) => (values.length > 1 ? (i / (values.length - 1)) * W : 0);
  const y = (v: number) => mid - (v / max) * (mid - 6);
  const line = $derived(values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' '));
  const area = $derived(`0,${mid} ${line} ${W},${mid}`);
</script>

<figure>
  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" role="img" aria-label="Courbe de momentum">
    <defs>
      <clipPath id="top-{uid}"><rect x="0" y="0" width={W} height={mid} /></clipPath>
      <clipPath id="bot-{uid}"><rect x="0" y={mid} width={W} height={mid} /></clipPath>
    </defs>
    {#each setStarts as s (s)}
      <line class="set" x1={x(s)} x2={x(s)} y1="0" y2={H} />
    {/each}
    <polygon class="fa" points={area} clip-path="url(#top-{uid})" />
    <polygon class="fb" points={area} clip-path="url(#bot-{uid})" />
    <line class="zero" x1="0" x2={W} y1={mid} y2={mid} />
    <polyline class="curve" points={line} />
  </svg>
  <figcaption>
    <span class="ka">▲ {names.A} mène</span>
    <span class="kb">▼ {names.B} mène</span>
  </figcaption>
</figure>

<style>
  figure {
    margin: 0;
  }
  svg {
    width: 100%;
    height: 140px;
    display: block;
  }
  .fa {
    fill: var(--a-bg);
  }
  .fb {
    fill: var(--b-bg);
  }
  .zero {
    stroke: var(--muted);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .set {
    stroke: var(--border);
    stroke-width: 1;
    stroke-dasharray: 4 4;
    vector-effect: non-scaling-stroke;
  }
  .curve {
    fill: none;
    stroke: var(--text);
    stroke-width: 2;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  figcaption {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    margin-top: 4px;
  }
  .ka {
    color: var(--a-text);
  }
  .kb {
    color: var(--b-text);
  }
</style>
