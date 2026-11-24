import { describe, expect, it } from 'vitest';
import { FORMATS, replay, type MatchConfig, type MatchEvent, type PointDetails, type Side } from '../src/lib/engine';
import { computeStats, formatDuration, frac, pct } from '../src/lib/stats';

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

describe('affichage', () => {
  it('pourcentages, fractions et durées', () => {
    expect(pct({ won: 2, total: 3 })).toBe('67 %');
    expect(pct({ won: 0, total: 0 })).toBe('–');
    expect(frac({ won: 3, total: 5 })).toBe('3/5');
    expect(formatDuration(42 * 60_000)).toBe('42 min');
    expect(formatDuration(65 * 60_000)).toBe('1 h 05');
  });
});
