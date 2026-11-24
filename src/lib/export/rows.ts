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
import { frac, pct, type MatchStats, type Ratio } from '../stats';

/** Rubriques alimentées par les modes standard et expert. */
export const DETAIL_SECTIONS = [
  'Coups gagnants / fautes directes',
  'Longueur des échanges',
  'Service par zone',
  'Jeu au filet',
  'Zones des coups gagnants',
];

export interface StatRow {
  section: string;
  label: string;
  a: string;
  b: string;
}

const withPct = (r: Ratio) => (r.total ? `${frac(r)} (${pct(r)})` : '–');

/** Mêmes règles d'affichage que l'écran de stats. */
export function statRows(s: MatchStats): StatRow[] {
  const rows: StatRow[] = [];
  const add = (section: string, label: string, a: string | number, b: string | number) =>
    rows.push({ section, label, a: String(a), b: String(b) });

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
    add('Fin des points', 'Fautes directes', s.A.unforcedErrors, s.B.unforcedErrors);
    add('Fin des points', 'Fautes provoquées', s.A.forcedErrors, s.B.forcedErrors);
  }

  const [shots, rally, serve, net, zones] = DETAIL_SECTIONS;
  if (s.hasShotDetail) {
    for (const k of Object.keys(SHOT) as Shot[]) {
      const a = s.A.byShot[k];
      const b = s.B.byShot[k];
      if (!a && !b) continue;
      const fmt = (c = { winners: 0, unforcedErrors: 0 }) => `${c.winners} / ${c.unforcedErrors}`;
      add(shots, SHOT[k], fmt(a), fmt(b));
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
    add(net, 'Points gagnés au filet', withPct(s.A.netPoints), withPct(s.B.netPoints));
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
