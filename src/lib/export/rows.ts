// Lignes de statistiques communes aux exports (CSV et PDF).

import { frac, pct, type MatchStats, type Ratio } from '../stats';

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
  return rows;
}
