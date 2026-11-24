import { describe, expect, it } from 'vitest';
import { FORMATS, replay, type MatchConfig, type MatchEvent, type PointDetails, type Side } from '../src/lib/engine';
import { computeGameStats, computeStats, formatDuration, frac, pct } from '../src/lib/stats';
import { balance, shotsPlayed, statRows, timingRows } from '../src/lib/export/rows';

const cfg: MatchConfig = { format: FORMATS.FFT2, firstServer: 'A', letEnabled: false };

let t = 0;
const p = (winner: Side, details?: PointDetails): MatchEvent => ({
  kind: 'point',
  winner,
  ts: (t += 60_000),
  ...(details ? { details } : {}),
});
const many = (seq: string) => [...seq].map((c) => p(c as Side));

const stats = (events: MatchEvent[], set?: number) => computeStats(replay(cfg, events).points, set);

describe('stats en mode rapide', () => {
  // Jeu 1, A au service : ace, point A, double faute A, point A, point A.
  // Jeu 2, B au service : A gagne les 4 points (break).
  const events = [
    p('A', { serveOutcome: 'ace' }),
    p('A'),
    p('B', { firstServeIn: false, serveOutcome: 'double_fault' }),
    p('A'),
    p('A'),
    ...many('AAAA'),
  ];
  const s = stats(events);

  it('points, service et retour', () => {
    expect(s.totalPoints).toBe(9);
    expect(s.A.pointsWon).toBe(8);
    expect(s.B.pointsWon).toBe(1);
    expect(s.A.servicePoints).toEqual({ won: 4, total: 5 });
    expect(s.A.returnPoints).toEqual({ won: 4, total: 4 });
    expect(s.B.servicePoints).toEqual({ won: 0, total: 4 });
  });

  it('aces et doubles fautes', () => {
    expect(s.A.aces).toBe(1);
    expect(s.A.doubleFaults).toBe(1);
    expect(s.B.aces).toBe(0);
  });

  it('jeux de service et breaks', () => {
    expect(s.A.serviceGames).toEqual({ won: 1, total: 1 });
    expect(s.A.returnGames).toEqual({ won: 1, total: 1 });
    expect(s.B.serviceGames).toEqual({ won: 0, total: 1 });
    expect(s.A.breakPointsConverted).toEqual({ won: 1, total: 1 });
    expect(s.B.breakPointsSaved).toEqual({ won: 0, total: 1 });
  });

  it('série, momentum et durée', () => {
    expect(s.A.longestStreak).toBe(6);
    expect(s.B.longestStreak).toBe(1);
    expect(s.momentum).toEqual([1, 2, 1, 2, 3, 4, 5, 6, 7]);
    expect(s.durationMs).toBe(8 * 60_000);
  });

  it('sans détail 1re balle, les stats de 1re balle sont signalées absentes', () => {
    expect(s.hasServeDetail).toBe(false);
    expect(s.hasEndingDetail).toBe(false);
  });
});

describe('stats détaillées', () => {
  it('1re et 2e balle', () => {
    const s = stats([
      p('A', { firstServeIn: true, serveOutcome: 'in' }),
      p('B', { firstServeIn: true, serveOutcome: 'in' }),
      p('A', { firstServeIn: false, serveOutcome: 'in' }),
      p('B', { firstServeIn: false, serveOutcome: 'double_fault' }),
    ]);
    expect(s.hasServeDetail).toBe(true);
    expect(s.A.firstServeIn).toEqual({ won: 2, total: 4 });
    expect(s.A.firstServeWon).toEqual({ won: 1, total: 2 });
    expect(s.A.secondServeWon).toEqual({ won: 1, total: 2 });
  });

  it('coups gagnants et fautes attribués au bon joueur', () => {
    const s = stats([
      p('A', { ending: 'winner' }),
      p('A', { ending: 'unforced_error' }),
      p('B', { ending: 'forced_error' }),
    ]);
    expect(s.hasEndingDetail).toBe(true);
    expect(s.A.winners).toBe(1);
    expect(s.B.unforcedErrors).toBe(1);
    expect(s.A.forcedErrors).toBe(1);
  });
});

describe('stats du mode expert', () => {
  // A sert les 4 points.
  const s = stats([
    p('A', { serveZone: 'T', ending: 'winner', shot: 'forehand', endZone: 'right_deep', rally: '1-4' }),
    p('A', { serveZone: 'wide', ending: 'unforced_error', shot: 'backhand', rally: '5-8' }),
    p('B', { serveZone: 'T', ending: 'winner', shot: 'volley', position: 'net', rally: '5-8' }),
    p('A', { ending: 'forced_error', shot: 'volley', position: 'net' }),
  ]);

  it('fin des points par coup, attribuée au joueur qui frappe', () => {
    expect(s.hasShotDetail).toBe(true);
    expect(s.A.byShot.forehand).toEqual({ winners: 1, unforcedErrors: 0, forcedErrors: 0 });
    expect(s.B.byShot.backhand).toEqual({ winners: 0, unforcedErrors: 1, forcedErrors: 0 });
    expect(s.B.byShot.volley).toEqual({ winners: 1, unforcedErrors: 0, forcedErrors: 1 });
  });

  it('longueur des échanges', () => {
    expect(s.A.rally['1-4']).toEqual({ won: 1, total: 1 });
    expect(s.A.rally['5-8']).toEqual({ won: 1, total: 2 });
    expect(s.B.rally['5-8']).toEqual({ won: 1, total: 2 });
  });

  it('zones de service', () => {
    expect(s.A.serveZones.T).toEqual({ won: 1, total: 2 });
    expect(s.A.serveZones.wide).toEqual({ won: 1, total: 1 });
  });

  it('points au filet et zones des coups gagnants', () => {
    expect(s.B.netPoints).toEqual({ won: 1, total: 2 });
    expect(s.B.netWinners).toBe(1);
    expect(s.B.netErrors).toBe(1);
    expect(s.A.winnerZones).toEqual({ right_deep: 1 });
    expect(s.hasZoneDetail).toBe(true);
  });
});

describe('jeu au filet en mode standard', () => {
  const s = stats([
    p('A', { ending: 'winner', shot: 'volley' }),
    p('A', { ending: 'winner', shot: 'smash' }),
    p('B', { ending: 'unforced_error', shot: 'volley' }), // faute de A au filet
    p('B', { ending: 'winner', shot: 'forehand' }), // fond de court : ignoré
    p('A', { ending: 'winner', shot: 'volley', position: 'midcourt' }), // position donnée : pas au filet
  ]);

  it('volée et smash comptés au filet quand la position n’est pas saisie', () => {
    expect(s.hasNetDetail).toBe(true);
    expect(s.A.netPoints).toEqual({ won: 2, total: 3 });
    expect(s.A.netWinners).toBe(2);
    expect(s.A.netErrors).toBe(1);
    expect(s.B.netPoints).toEqual({ won: 0, total: 0 });
  });

  it('lignes de la rubrique', () => {
    expect(statRows(s).filter((r) => r.section === 'Jeu au filet').map((r) => [r.label, r.a, r.b])).toEqual([
      ['Points terminés au filet', '3', '0'],
      ['Points gagnés au filet', '2/3 (67 %)', '–'],
      ['Coups gagnants au filet', '2', '0'],
      ['Fautes au filet', '1', '0'],
    ]);
  });
});

describe('lignes « fin des points » et détail par coup', () => {
  const s = stats([
    p('A', { ending: 'winner', shot: 'forehand' }),
    p('A', { ending: 'winner', shot: 'forehand' }),
    p('A', { ending: 'forced_error', shot: 'backhand' }),
    p('B', { ending: 'unforced_error', shot: 'forehand' }),
    p('B', { ending: 'unforced_error', shot: 'volley' }),
    p('B', { ending: 'unforced_error', shot: 'volley' }),
  ]);
  const rows = statRows(s);

  it('totaux dans l’ordre coups gagnants, fautes provoquées, fautes directes, bilan', () => {
    expect(rows.filter((r) => r.section === 'Fin des points')).toEqual([
      { section: 'Fin des points', label: 'Coups gagnants', a: '2', b: '0' },
      { section: 'Fin des points', label: 'Fautes provoquées', a: '0', b: '1' },
      { section: 'Fin des points', label: 'Fautes directes', a: '3', b: '0' },
      { section: 'Fin des points', label: 'Bilan coups gagnants − fautes directes', a: '−1', b: '0' },
    ]);
  });

  it('détail par type de coup avec les trois catégories', () => {
    expect(shotsPlayed(s)).toEqual(['forehand', 'backhand', 'volley']);
    expect(rows.filter((r) => r.section === 'Détail par type de coup')).toEqual([
      { section: 'Détail par type de coup', label: 'Coup droit', a: 'G 2 · FP 0 · FD 1', b: 'G 0 · FP 0 · FD 0' },
      { section: 'Détail par type de coup', label: 'Revers', a: 'G 0 · FP 0 · FD 0', b: 'G 0 · FP 1 · FD 0' },
      { section: 'Détail par type de coup', label: 'Volée', a: 'G 0 · FP 0 · FD 2', b: 'G 0 · FP 0 · FD 0' },
    ]);
  });

  it('bilan signé', () => {
    expect(balance({ winners: 5, unforcedErrors: 1 })).toBe('+4');
    expect(balance({ winners: 1, unforcedErrors: 3 })).toBe('−2');
    expect(balance({ winners: 2, unforcedErrors: 2 })).toBe('0');
  });
});

describe('filtre par set', () => {
  const events = many('A'.repeat(24) + 'BBBB');

  it('ne garde que les points du set demandé', () => {
    expect(stats(events, 1).totalPoints).toBe(24);
    expect(stats(events, 2).totalPoints).toBe(4);
    expect(stats(events, 2).B.pointsWon).toBe(4);
  });

  it('repère le début de chaque set', () => {
    expect(stats(events).setStarts).toEqual([24]);
  });

  it('balles de set', () => {
    const s = stats(events, 1);
    expect(s.A.setPoints).toEqual({ won: 1, total: 1 });
  });
});

describe('stats par jeu (mode Jeux)', () => {
  const at = (min: number) => new Date(2026, 10, 24, 14, min).getTime();
  // A sert le 1er jeu ; les services alternent A, B, A, B.
  const events: MatchEvent[] = [...'AABA'].map((w, i) => ({ kind: 'game' as const, winner: w as Side, ts: at(i * 5) }));
  const r = replay(cfg, events);
  const g = computeGameStats(r.games);

  it('jeux gagnés, jeux de service et breaks', () => {
    expect(g.total).toBe(4);
    expect(g.hasGameOnly).toBe(true);
    expect(g.A.gamesWon).toBe(3);
    // Services : A, B, A, B. Gagnants : A, A, B, A.
    expect(g.A.serviceGames).toEqual({ won: 1, total: 2 });
    expect(g.A.breaks).toEqual({ won: 2, total: 2 });
    expect(g.B.breaks).toEqual({ won: 1, total: 2 });
    expect(g.A.longestStreak).toBe(2);
    expect(g.momentum).toEqual([1, 2, 1, 2]);
  });

  it('rubrique « Jeux » dans les lignes d’export, sans lignes de points', () => {
    const rows = statRows(computeStats(r.points), g);
    expect(rows.map((x) => x.section)).toEqual(['Jeux', 'Jeux', 'Jeux', 'Jeux']);
    expect(rows[2]).toMatchObject({ label: 'Breaks (jeux de retour gagnés)', a: '2/2', b: '1/2' });
  });

  it('horaires du match et des sets', () => {
    expect(timingRows(r.timeline)).toEqual([
      ['Début', '14:00'],
      ['Fin', 'en cours'],
      ['Durée du set 1', 'en cours'],
    ]);
    expect(timingRows(r.timeline, 1)).toEqual([
      ['Début du set', '14:00'],
      ['Fin du set', 'en cours'],
    ]);
  });
});

describe('affichage', () => {
  it('pourcentages, fractions et durées', () => {
    expect(pct({ won: 2, total: 3 })).toBe('67 %');
    expect(pct({ won: 0, total: 0 })).toBe('–');
    expect(frac({ won: 3, total: 5 })).toBe('3/5');
    expect(formatDuration(42 * 60_000)).toBe('42 min');
    expect(formatDuration(20_000)).toBe('< 1 min');
    expect(formatDuration(65 * 60_000)).toBe('1 h 05');
  });
});
