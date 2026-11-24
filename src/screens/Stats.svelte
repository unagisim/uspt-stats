<script lang="ts">
  import { onMount } from 'svelte';
  import CompareRow from '../components/CompareRow.svelte';
  import Momentum from '../components/Momentum.svelte';
  import { configOf, db, exportMatch, shortName, type StoredMatch } from '../lib/db';
  import { replay, setsSummary } from '../lib/engine';
  import { computeGameStats, computeStats, formatDuration, frac, pct, type Ratio } from '../lib/stats';
  import FileReady from '../components/FileReady.svelte';
  import ShotTable from '../components/ShotTable.svelte';
  import {
    balance,
    DETAIL_SECTIONS,
    NET_SECTION,
    noteRows,
    SHOT_SECTION,
    shotsPlayed,
    statRows,
    tagCounts,
    timingRows,
    type StatRow,
  } from '../lib/export/rows';

  let { id, onBack }: { id: string; onBack: () => void } = $props();

  let match = $state<StoredMatch | null>(null);
  let notFound = $state(false);
  let setFilter = $state<number | undefined>(undefined);

  onMount(async () => {
    const m = await db.matches.get(id);
    if (m) match = m;
    else notFound = true;
  });

  const result = $derived(match ? replay(configOf(match), match.events) : null);
  const names = $derived(
    match ? { A: shortName(match.players.A), B: shortName(match.players.B) } : { A: '', B: '' },
  );
  const setCount = $derived(
    result
      ? Math.max(1, result.timeline.sets.length, ...result.points.map((p) => p.setNumber), ...result.games.map((g) => g.setNumber))
      : 1,
  );
  const s = $derived(result ? computeStats(result.points, setFilter) : null);
  /** Stats par jeu : seules disponibles quand les points ne sont pas saisis (mode Jeux). */
  const g = $derived(result ? computeGameStats(result.games, setFilter) : null);
  const showGames = $derived(!!g && g.total > 0 && (g.hasGameOnly || (s?.totalPoints ?? 0) === 0));
  const timing = $derived(result ? timingRows(result.timeline, setFilter) : []);
  /** Notes du coach du périmètre affiché (match entier ou set). */
  const notes = $derived(
    result ? result.notes.filter((n) => setFilter === undefined || n.setNumber === setFilter) : [],
  );
  const notesShown = $derived(result ? noteRows(notes, result.points, names) : []);
  const tagSummary = $derived(
    (['A', 'B'] as const)
      .map((side) => [side, tagCounts(notes, side)] as const)
      .filter(([, counts]) => counts.length > 0),
  );

  const score = $derived.by(() => {
    if (!result) return '';
    const st = result.state;
    const parts = setsSummary(st);
    if (!st.winner && (st.games.A || st.games.B)) parts.push(`${st.games.A}-${st.games.B}`);
    return parts.join('  ');
  });

  // ---- Exports ----
  type ExportKind = 'pdf' | 'points' | 'stats' | 'json';
  let exporting = $state<ExportKind | null>(null);
  let exportMsg = $state('');
  let exportError = $state(false);
  /** Fichier préparé, à partager par un tap dédié (exigence d'Android). */
  let ready = $state<File | null>(null);

  // Précharge le module PDF pour que la préparation soit rapide, même hors ligne.
  onMount(() => {
    import('../lib/export/pdf').catch(() => {});
  });

  async function exportFile(kind: ExportKind) {
    if (!match || exporting) return;
    exporting = kind;
    exportMsg = '';
    exportError = false;
    ready = null;
    try {
      const m = $state.snapshot(match);
      let blob: Blob;
      let fileName: string;
      if (kind === 'pdf') {
        const { buildMatchPdf } = await import('../lib/export/pdf');
        ({ blob, fileName } = buildMatchPdf(m));
      } else if (kind === 'json') {
        const { matchInfo } = await import('../lib/export/meta');
        blob = new Blob([JSON.stringify(await exportMatch(m.id), null, 1)], { type: 'application/json' });
        fileName = `${matchInfo(m).fileBase}.json`;
      } else {
        const csv = await import('../lib/export/csv');
        const { matchInfo } = await import('../lib/export/meta');
        const base = matchInfo(m).fileBase;
        const text = kind === 'points' ? csv.pointsCsv(m) : csv.statsCsv(m);
        blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
        fileName = `${base}_${kind === 'points' ? 'points' : 'stats'}.csv`;
      }
      ready = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
    } catch (e) {
      exportError = true;
      exportMsg = "L'export a échoué. Réessayez.";
      console.error(e);
    } finally {
      exporting = null;
    }
  }

  /** Rubriques détaillées (modes standard et expert), regroupées par section. */
  const detail = $derived.by(() => {
    if (!s) return [];
    const groups = new Map<string, StatRow[]>();
    for (const r of statRows(s)) {
      if (!DETAIL_SECTIONS.includes(r.section)) continue;
      groups.set(r.section, [...(groups.get(r.section) ?? []), r]);
    }
    return [...groups.entries()];
  });

  const n = (r: Ratio) => (r.total ? r.won / r.total : 0);
  const withPct = (r: Ratio) => (r.total ? `${frac(r)} (${pct(r)})` : '–');
</script>

<div class="page">
  <header>
    <button class="ghost back" onclick={onBack}>‹ Retour</button>
    <h1>Statistiques</h1>
  </header>

  {#if notFound}
    <p>Ce match est introuvable.</p>
  {:else if match && s}
    <div class="players card">
      <span class="pa">{names.A}</span>
      <span class="score">{score || 'Début du match'}</span>
      <span class="pb">{names.B}</span>
    </div>

    {#if setCount > 1}
      <div class="tabs" role="tablist">
        <button role="tab" aria-selected={setFilter === undefined} class:on={setFilter === undefined} onclick={() => (setFilter = undefined)}>Match</button>
        {#each Array.from({ length: setCount }, (_, i) => i + 1) as k (k)}
          <button role="tab" aria-selected={setFilter === k} class:on={setFilter === k} onclick={() => (setFilter = k)}>Set {k}</button>
        {/each}
      </div>
    {/if}

    {#if timing.length}
      <section class="card">
        <h2>Horaires</h2>
        <dl class="timing">
          {#each timing as [label, value] (label)}
            <dt>{label}</dt>
            <dd>{value}</dd>
          {/each}
        </dl>
        <p class="hint">Début = premier point ou jeu saisi. Chaque set commence à la fin du précédent (pause comprise).</p>
      </section>
    {/if}

    {#if notesShown.length}
      <section class="card notes">
        <h2>Notes du coach ({notesShown.length})</h2>
        {#each tagSummary as [side, counts] (side)}
          <p class="tagsum">
            <strong class={side === 'A' ? 'pa' : 'pb'}>{names[side]}</strong> :
            {counts.map(([t, c]) => (c > 1 ? `${t} ×${c}` : t)).join(', ')}
          </p>
        {/each}
        <ol>
          {#each notesShown as n, i (i)}
            <li>
              <div class="nhead">
                <span class="moment">{n.moment}</span>
                <span class="who {n.side === 'A' ? 'pa' : n.side === 'B' ? 'pb' : ''}">{n.player}</span>
              </div>
              {#if n.tags.length}
                <div class="ntags">{#each n.tags as t (t)}<span>{t}</span>{/each}</div>
              {/if}
              {#if n.text}<p class="ntext">{n.text}</p>{/if}
              {#if n.after}<p class="after">Après : {n.after}</p>{/if}
            </li>
          {/each}
        </ol>
      </section>
    {/if}

    {#if showGames && g}
      <section class="card">
        <h2>Jeux</h2>
        <CompareRow label="Jeux gagnés" a={String(g.A.gamesWon)} b={String(g.B.gamesWon)} va={g.A.gamesWon} vb={g.B.gamesWon} />
        <CompareRow label="Jeux de service gagnés" a={frac(g.A.serviceGames)} b={frac(g.B.serviceGames)} va={n(g.A.serviceGames)} vb={n(g.B.serviceGames)} />
        <CompareRow label="Breaks (jeux de retour gagnés)" a={frac(g.A.breaks)} b={frac(g.B.breaks)} va={g.A.breaks.won} vb={g.B.breaks.won} />
        <CompareRow label="Plus longue série de jeux" a={String(g.A.longestStreak)} b={String(g.B.longestStreak)} va={g.A.longestStreak} vb={g.B.longestStreak} />
        <p class="hint">{g.total} jeux suivis. Les jeux non suivis (score corrigé à la main) ne sont pas comptés.</p>
      </section>
      {#if s.totalPoints === 0}
        <section class="card">
          <h2>Momentum (par jeu)</h2>
          <Momentum series={g.momentum} setStarts={g.setStarts} {names} />
        </section>
      {/if}
    {/if}

    {#if s.totalPoints === 0}
      {#if !showGames}<p class="empty">Aucun point ni jeu saisi pour l'instant.</p>{/if}
    {:else}
      <section class="card">
        <h2>Résumé</h2>
        <CompareRow label="Points gagnés" a={String(s.A.pointsWon)} b={String(s.B.pointsWon)} va={s.A.pointsWon} vb={s.B.pointsWon} />
        <CompareRow label="Plus longue série" a={String(s.A.longestStreak)} b={String(s.B.longestStreak)} va={s.A.longestStreak} vb={s.B.longestStreak} />
        <p class="duration">{s.totalPoints} points saisis</p>
      </section>

      <section class="card">
        <h2>Momentum</h2>
        <Momentum series={s.momentum} setStarts={s.setStarts} {names} />
      </section>

      <section class="card">
        <h2>Service</h2>
        <CompareRow label="Aces" a={String(s.A.aces)} b={String(s.B.aces)} va={s.A.aces} vb={s.B.aces} />
        <CompareRow label="Doubles fautes" a={String(s.A.doubleFaults)} b={String(s.B.doubleFaults)} va={s.A.doubleFaults} vb={s.B.doubleFaults} lowerIsBetter />
        {#if s.hasServeDetail}
          <CompareRow label="1res balles" a={pct(s.A.firstServeIn)} b={pct(s.B.firstServeIn)} va={n(s.A.firstServeIn)} vb={n(s.B.firstServeIn)} />
          <CompareRow label="Points gagnés sur 1re" a={pct(s.A.firstServeWon)} b={pct(s.B.firstServeWon)} va={n(s.A.firstServeWon)} vb={n(s.B.firstServeWon)} />
          <CompareRow label="Points gagnés sur 2e" a={pct(s.A.secondServeWon)} b={pct(s.B.secondServeWon)} va={n(s.A.secondServeWon)} vb={n(s.B.secondServeWon)} />
        {/if}
        <CompareRow label="Points gagnés au service" a={pct(s.A.servicePoints)} b={pct(s.B.servicePoints)} va={n(s.A.servicePoints)} vb={n(s.B.servicePoints)} />
        <CompareRow label="Jeux de service gagnés" a={frac(s.A.serviceGames)} b={frac(s.B.serviceGames)} va={n(s.A.serviceGames)} vb={n(s.B.serviceGames)} />
        {#if !s.hasServeDetail}
          <p class="hint">Le % de 1res balles s'affiche avec les modes de saisie standard et expert.</p>
        {/if}
      </section>

      <section class="card">
        <h2>Retour</h2>
        <CompareRow label="Points gagnés en retour" a={pct(s.A.returnPoints)} b={pct(s.B.returnPoints)} va={n(s.A.returnPoints)} vb={n(s.B.returnPoints)} />
        <CompareRow label="Jeux de retour gagnés" a={frac(s.A.returnGames)} b={frac(s.B.returnGames)} va={s.A.returnGames.won} vb={s.B.returnGames.won} />
      </section>

      <section class="card">
        <h2>Points importants</h2>
        <CompareRow label="Balles de break converties" a={withPct(s.A.breakPointsConverted)} b={withPct(s.B.breakPointsConverted)} />
        <CompareRow label="Balles de break sauvées" a={withPct(s.A.breakPointsSaved)} b={withPct(s.B.breakPointsSaved)} />
        {#if s.A.setPoints.total || s.B.setPoints.total}
          <CompareRow label="Balles de set" a={frac(s.A.setPoints)} b={frac(s.B.setPoints)} />
        {/if}
        {#if s.A.matchPoints.total || s.B.matchPoints.total}
          <CompareRow label="Balles de match" a={frac(s.A.matchPoints)} b={frac(s.B.matchPoints)} />
        {/if}
        {#if s.A.decidingPoints.total}
          <CompareRow label="Points décisifs gagnés" a={frac(s.A.decidingPoints)} b={frac(s.B.decidingPoints)} va={s.A.decidingPoints.won} vb={s.B.decidingPoints.won} />
        {/if}
        {#if s.A.tiebreakPoints.total}
          <CompareRow label="Points en jeu décisif" a={frac(s.A.tiebreakPoints)} b={frac(s.B.tiebreakPoints)} va={s.A.tiebreakPoints.won} vb={s.B.tiebreakPoints.won} />
        {/if}
      </section>

      {#if s.hasEndingDetail}
        <section class="card">
          <h2>Fin des points</h2>
          <CompareRow label="Coups gagnants" a={String(s.A.winners)} b={String(s.B.winners)} va={s.A.winners} vb={s.B.winners} />
          <CompareRow label="Fautes provoquées" a={String(s.A.forcedErrors)} b={String(s.B.forcedErrors)} va={s.A.forcedErrors} vb={s.B.forcedErrors} lowerIsBetter />
          <CompareRow label="Fautes directes" a={String(s.A.unforcedErrors)} b={String(s.B.unforcedErrors)} va={s.A.unforcedErrors} vb={s.B.unforcedErrors} lowerIsBetter />
          <CompareRow
            label="Bilan coups gagnants − fautes directes"
            a={balance(s.A)}
            b={balance(s.B)}
            va={s.A.winners - s.A.unforcedErrors}
            vb={s.B.winners - s.B.unforcedErrors}
            showBar={false}
          />
          <p class="hint">
            Coups gagnants réussis par le joueur ; fautes provoquées et fautes directes commises par le joueur. Les aces
            et doubles fautes sont comptés à part, dans « Service ».
          </p>
        </section>
      {/if}

      {#each detail as [section, rows] (section)}
        <section class="card">
          <h2>{section}</h2>
          {#if section === SHOT_SECTION}
            <ShotTable shots={shotsPlayed(s)} a={s.A.byShot} b={s.B.byShot} {names} />
          {:else if section === NET_SECTION}
            <CompareRow label="Points terminés au filet" a={String(s.A.netPoints.total)} b={String(s.B.netPoints.total)} va={s.A.netPoints.total} vb={s.B.netPoints.total} />
            <CompareRow label="Points gagnés au filet" a={withPct(s.A.netPoints)} b={withPct(s.B.netPoints)} va={n(s.A.netPoints)} vb={n(s.B.netPoints)} />
            <CompareRow label="Coups gagnants au filet" a={String(s.A.netWinners)} b={String(s.B.netWinners)} va={s.A.netWinners} vb={s.B.netWinners} />
            <CompareRow label="Fautes au filet" a={String(s.A.netErrors)} b={String(s.B.netErrors)} va={s.A.netErrors} vb={s.B.netErrors} lowerIsBetter />
            <p class="hint">
              Points terminés par le joueur au filet : position « Filet » en mode expert, sinon volée ou smash. Gagnés =
              coup gagnant ou faute provoquée chez l'adversaire.
            </p>
          {:else}
            {#each rows as r (r.label)}
              <CompareRow label={r.label} a={r.a} b={r.b} />
            {/each}
          {/if}
        </section>
      {/each}
    {/if}

    <section class="card">
      <h2>Exporter</h2>
      <div class="exports">
        <button class="primary" onclick={() => exportFile('pdf')} disabled={exporting !== null}>
          {exporting === 'pdf' ? 'Création du PDF…' : 'Feuille de match (PDF)'}
        </button>
        <button onclick={() => exportFile('stats')} disabled={exporting !== null}>Statistiques (CSV)</button>
        <button onclick={() => exportFile('points')} disabled={exporting !== null}>Détail des points (CSV)</button>
        <button onclick={() => exportFile('json')} disabled={exporting !== null}>Match complet (JSON, réimportable)</button>
      </div>
      <p class="hint">
        Le fichier JSON contient tout le match (points, incidents, notes). Il s'importe sur un autre appareil depuis
        l'accueil, rubrique Sauvegarde.
      </p>
      {#if exportMsg}<p class="hint" class:error={exportError} role="status">{exportMsg}</p>{/if}
      {#if ready}
        <FileReady file={ready} title="Feuille de match" onClose={() => (ready = null)} />
      {/if}
    </section>
  {/if}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 32px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .back {
    padding: 0 8px;
  }
  h1 {
    font-size: 22px;
    margin: 0;
  }
  h2 {
    font-size: 16px;
    margin: 0 0 4px;
  }
  .players {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
  }
  .pa,
  .pb {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pa {
    color: var(--a-text);
  }
  .pb {
    color: var(--b-text);
    text-align: right;
  }
  .score {
    font-variant-numeric: tabular-nums;
    font-size: 14px;
    text-align: center;
  }
  .tabs {
    display: flex;
    gap: 6px;
    overflow-x: auto;
  }
  .tabs button {
    min-height: 40px;
    flex: 1;
    white-space: nowrap;
  }
  .tabs .on {
    background: var(--text);
    color: var(--bg);
    border-color: var(--text);
    font-weight: 600;
  }
  .timing {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 16px;
    margin: 8px 0 0;
    font-variant-numeric: tabular-nums;
  }
  .timing dt {
    color: var(--muted);
    font-size: 14px;
  }
  .timing dd {
    margin: 0;
    font-weight: 600;
    text-align: right;
  }
  .notes ol {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .notes li {
    padding: 10px 0;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .nhead {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
  }
  .moment {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .who {
    font-weight: 600;
  }
  .notes .pa,
  .tagsum .pa {
    color: var(--a-text);
  }
  .notes .pb,
  .tagsum .pb {
    color: var(--b-text);
  }
  .ntags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .ntags span {
    background: var(--warn-bg);
    color: var(--warn);
    border-radius: 6px;
    padding: 1px 6px;
    font-size: 12px;
    font-weight: 600;
  }
  .ntext {
    margin: 0;
    white-space: pre-wrap;
  }
  .after {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }
  .tagsum {
    margin: 4px 0 0;
    font-size: 14px;
  }
  .exports {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }
  .duration,
  .hint,
  .empty {
    font-size: 13px;
    color: var(--muted);
    margin: 8px 0 0;
  }
</style>
