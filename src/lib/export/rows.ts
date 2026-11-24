// Lignes de statistiques communes aux exports (CSV et PDF).

import type { EndZone, NoteRecord, NoteTag, PointRecord, RallyLength, ServeZone, Shot, Side } from '../engine';
import { describePoint, END_ZONE, NOTE_TAGS, noteMoment, RALLY, SERVE_ZONE, SHOT } from '../labels';

export interface NoteRow {
  setNumber: number;
  moment: string;
  player: string;
  side?: Side;
  tags: string[];
  text: string;
  /** Dernier point joué avant la note. */
  after: string;
}

/** Notes du coach mises en forme, avec le moment et le dernier point joué. */
export function noteRows(
  notes: readonly NoteRecord[],
  points: readonly PointRecord[],
  names: { A: string; B: string },
): NoteRow[] {
  return notes.map((n) => {
    const last = n.lastPointIndex !== null ? points[n.lastPointIndex] : undefined;
    return {
      setNumber: n.setNumber,
      moment: noteMoment(n),
      player: n.player ? names[n.player] : 'Match',
      ...(n.player ? { side: n.player } : {}),
      tags: n.tags.map((t) => NOTE_TAGS[t]),
      text: n.text,
      after: last ? describePoint(last.winner, last.details, names) : '',
    };
  });
}

/** Nombre de notes par thème pour un joueur : [["Énervement", 2], …]. */
export function tagCounts(notes: readonly NoteRecord[], side: Side): [string, number][] {
  const counts = new Map<NoteTag, number>();
  for (const n of notes) {
    if (n.player !== side) continue;
    for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t, c]) => [NOTE_TAGS[t], c]);
}
import { span, type Timeline } from '../engine';
import {
  formatClock,
  formatDuration,
  frac,
  pct,
  type GameStats,
  type MatchStats,
  type Ratio,
  type ShotCount,
} from '../stats';

/** Rubriques alimentées par les modes standard et expert. */
export const SHOT_SECTION = 'Détail par type de coup';
export const NET_SECTION = 'Jeu au filet';

export const DETAIL_SECTIONS = [
  SHOT_SECTION,
  'Longueur des échanges',
  'Service par zone',
  NET_SECTION,
  'Zones des coups gagnants',
];

export interface StatRow {
  section: string;
  label: string;
  a: string;
  b: string;
}

const withPct = (r: Ratio) => (r.total ? `${frac(r)} (${pct(r)})` : '–');

/** Coups gagnants moins fautes directes, signé : "+4", "−2", "0". */
export function balance(p: { winners: number; unforcedErrors: number }): string {
  const d = p.winners - p.unforcedErrors;
  return d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '0';
}

/** Types de coup ayant terminé au moins un point, dans l'ordre habituel. */
export const shotsPlayed = (s: MatchStats): Shot[] =>
  (Object.keys(SHOT) as Shot[]).filter((k) => s.A.byShot[k] || s.B.byShot[k]);

/** "G 3 · FP 1 · FD 2" (coups gagnants, fautes provoquées, fautes directes). */
export const shotSummary = (c?: ShotCount): string =>
  `G ${c?.winners ?? 0} · FP ${c?.forcedErrors ?? 0} · FD ${c?.unforcedErrors ?? 0}`;

/** Horaires du match (ou d'un set) : [libellé, valeur]. */
export function timingRows(t: Timeline, setNumber?: number): [string, string][] {
  const rows: [string, string][] = [];
  if (t.start === null) return rows;
  if (setNumber) {
    const set = t.sets.find((x) => x.setNumber === setNumber);
    if (!set || set.start === null) return rows;
    rows.push(['Début du set', formatClock(set.start)]);
    rows.push(['Fin du set', set.end !== null ? formatClock(set.end) : 'en cours']);
    const d = span(set.start, set.end);
    if (d !== null) rows.push(['Durée du set', formatDuration(d)]);
    return rows;
  }
  rows.push(['Début', formatClock(t.start)]);
  rows.push(['Fin', t.end !== null ? formatClock(t.end) : 'en cours']);
  const d = span(t.start, t.end);
  if (d !== null) rows.push(['Durée du match', formatDuration(d)]);
  for (const set of t.sets) {
    const sd = span(set.start, set.end);
    rows.push([`Durée du set ${set.setNumber}`, sd !== null ? formatDuration(sd) : 'en cours']);
  }
  return rows;
}

/** Mêmes règles d'affichage que l'écran de stats. `g` : stats par jeu, ajoutées si des jeux ont été saisis sans les points. */
export function statRows(s: MatchStats, g?: GameStats): StatRow[] {
  const rows: StatRow[] = [];
  const add = (section: string, label: string, a: string | number, b: string | number) =>
    rows.push({ section, label, a: String(a), b: String(b) });

  if (g && g.total > 0 && g.hasGameOnly) {
    add('Jeux', 'Jeux gagnés', g.A.gamesWon, g.B.gamesWon);
    add('Jeux', 'Jeux de service gagnés', frac(g.A.serviceGames), frac(g.B.serviceGames));
    add('Jeux', 'Breaks (jeux de retour gagnés)', frac(g.A.breaks), frac(g.B.breaks));
    add('Jeux', 'Plus longue série de jeux', g.A.longestStreak, g.B.longestStreak);
  }
  if (s.totalPoints === 0) return rows;

  add('Résumé', 'Points gagnés', s.A.pointsWon, s.B.pointsWon);
  add('Résumé', 'Plus longue série de points', s.A.longestStreak, s.B.longestStreak);

  add('Service', 'Aces', s.A.aces, s.B.aces);
  add('Service', 'Doubles fautes', s.A.doubleFaults, s.B.doubleFaults);
  if (s.hasServeDetail) {
    add('Service', '1res balles', pct(s.A.firstServeIn), pct(s.B.firstServeIn));
    add('Service', 'Points gagnés sur 1re balle', pct(s.A.firstServeWon), pct(s.B.firstServeWon));
    add('Service', 'Points gagnés sur 2e balle', pct(s.A.secondServeWon), pct(s.B.secondServeWon));
  }
  add('Service', 'Points gagnés au service', withPct(s.A.servicePoints), withPct(s.B.servicePoints));
  add('Service', 'Jeux de service gagnés', frac(s.A.serviceGames), frac(s.B.serviceGames));

  add('Retour', 'Points gagnés en retour', withPct(s.A.returnPoints), withPct(s.B.returnPoints));
  add('Retour', 'Jeux de retour gagnés', frac(s.A.returnGames), frac(s.B.returnGames));

  add('Points importants', 'Balles de break converties', withPct(s.A.breakPointsConverted), withPct(s.B.breakPointsConverted));
  add('Points importants', 'Balles de break sauvées', withPct(s.A.breakPointsSaved), withPct(s.B.breakPointsSaved));
  if (s.A.setPoints.total || s.B.setPoints.total) {
    add('Points importants', 'Balles de set', frac(s.A.setPoints), frac(s.B.setPoints));
  }
  if (s.A.matchPoints.total || s.B.matchPoints.total) {
    add('Points importants', 'Balles de match', frac(s.A.matchPoints), frac(s.B.matchPoints));
  }
  if (s.A.decidingPoints.total) {
    add('Points importants', 'Points décisifs gagnés', frac(s.A.decidingPoints), frac(s.B.decidingPoints));
  }
  if (s.A.tiebreakPoints.total) {
    add('Points importants', 'Points en jeu décisif', frac(s.A.tiebreakPoints), frac(s.B.tiebreakPoints));
  }

  if (s.hasEndingDetail) {
    add('Fin des points', 'Coups gagnants', s.A.winners, s.B.winners);
    add('Fin des points', 'Fautes provoquées', s.A.forcedErrors, s.B.forcedErrors);
    add('Fin des points', 'Fautes directes', s.A.unforcedErrors, s.B.unforcedErrors);
    add('Fin des points', 'Bilan coups gagnants − fautes directes', balance(s.A), balance(s.B));
  }

  const [shots, rally, serve, net, zones] = DETAIL_SECTIONS;
  if (s.hasShotDetail) {
    for (const k of shotsPlayed(s)) {
      add(shots, SHOT[k], shotSummary(s.A.byShot[k]), shotSummary(s.B.byShot[k]));
    }
  }
  if (s.hasRallyDetail) {
    for (const k of Object.keys(RALLY) as RallyLength[]) {
      if (s.A.rally[k]) add(rally, `Points gagnés (${RALLY[k]})`, withPct(s.A.rally[k]!), withPct(s.B.rally[k]!));
    }
  }
  if (s.hasServeZoneDetail) {
    for (const k of Object.keys(SERVE_ZONE) as ServeZone[]) {
      const a = s.A.serveZones[k];
      const b = s.B.serveZones[k];
      if (a || b) add(serve, `Points gagnés, service ${SERVE_ZONE[k].toLowerCase()}`, a ? withPct(a) : '–', b ? withPct(b) : '–');
    }
  }
  if (s.hasNetDetail) {
    add(net, 'Points terminés au filet', s.A.netPoints.total, s.B.netPoints.total);
    add(net, 'Points gagnés au filet', withPct(s.A.netPoints), withPct(s.B.netPoints));
    add(net, 'Coups gagnants au filet', s.A.netWinners, s.B.netWinners);
    add(net, 'Fautes au filet', s.A.netErrors, s.B.netErrors);
  }
  if (s.hasZoneDetail) {
    for (const k of Object.keys(END_ZONE) as EndZone[]) {
      const a = s.A.winnerZones[k] ?? 0;
      const b = s.B.winnerZones[k] ?? 0;
      if (a || b) add(zones, END_ZONE[k], a, b);
    }
  }
  return rows;
}
