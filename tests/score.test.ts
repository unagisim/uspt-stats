import { describe, expect, it } from 'vitest';
import {
  FORMATS,
  formatPoints,
  replay,
  setsSummary,
  tiebreakServer,
  type FormatId,
  type IncidentType,
  type MatchConfig,
  type MatchEvent,
  type Side,
} from '../src/lib/engine';

const cfg = (format: FormatId = 'FFT1', firstServer: Side = 'A'): MatchConfig => ({
  format: FORMATS[format],
  firstServer,
  letEnabled: false,
});

/** "AABB" -> 4 points. Les espaces sont ignorés. */
const pts = (seq: string): MatchEvent[] =>
  [...seq.replace(/\s/g, '')].map((c, i) => ({ kind: 'point' as const, winner: c as Side, ts: i }));

const game = (s: Side) => s.repeat(4);
/** Jeux gagnés dans l'ordre : "ABAB" -> 4 jeux blancs. */
const games = (seq: string) => [...seq].map((c) => game(c as Side)).join('');
const set60 = (s: Side) => games(s.repeat(6));
/** Mène les jeux à 6/6 en alternant A, B. */
const toSixAll = games('AB'.repeat(6));

const incident = (type: IncidentType, player: Side): MatchEvent => ({
  kind: 'incident',
  type,
  player,
  ts: 0,
});

const play = (seq: string, c = cfg()) => replay(c, pts(seq));

describe('jeu', () => {
  it('jeu blanc : le jeu est gagné et le service change', () => {
    const { state } = play('AAAA');
    expect(state.games).toEqual({ A: 1, B: 0 });
    expect(state.points).toEqual({ A: 0, B: 0 });
    expect(state.server).toBe('B');
  });

  it('affiche 0, 15, 30, 40', () => {
    expect(formatPoints(play('').state)).toEqual({ A: '0', B: '0' });
    expect(formatPoints(play('A').state)).toEqual({ A: '15', B: '0' });
    expect(formatPoints(play('AAB').state)).toEqual({ A: '30', B: '15' });
    expect(formatPoints(play('AAAB').state)).toEqual({ A: '40', B: '15' });
  });

  it('égalité et avantage', () => {
    expect(formatPoints(play('AAABBB').state)).toEqual({ A: '40', B: '40' });
    expect(formatPoints(play('AAABBBA').state)).toEqual({ A: 'AV', B: '40' });
    expect(formatPoints(play('AAABBBAB').state)).toEqual({ A: '40', B: '40' });
    expect(formatPoints(play('AAABBBABB').state)).toEqual({ A: '40', B: 'AV' });
    expect(play('AAABBBABBB').state.games).toEqual({ A: 0, B: 1 });
  });

  it('sans point décisif, 4-3 ne termine pas le jeu', () => {
    expect(play('AAABBBA', cfg('FFT2')).state.games).toEqual({ A: 0, B: 0 });
  });

  it('format 3 : le point décisif à 40/40 termine le jeu', () => {
    const { state, points } = play('AAABBBB', cfg('FFT3'));
    expect(state.games).toEqual({ A: 0, B: 1 });
    expect(points[6].situation.decidingPoint).toBe(true);
    expect(points[5].situation.decidingPoint).toBe(false);
  });
});

describe('set', () => {
  it('6-0 : set gagné, le service continue d’alterner', () => {
    const { state } = play(set60('A'));
    expect(state.setsWon).toEqual({ A: 1, B: 0 });
    expect(state.completedSets).toEqual([{ games: { A: 6, B: 0 } }]);
    expect(state.games).toEqual({ A: 0, B: 0 });
    // 6 jeux servis par A, B, A, B, A, B -> A sert le 1er jeu du set 2.
    expect(state.server).toBe('A');
  });

  it('6-5 ne termine pas le set, 7-5 oui', () => {
    const to65 = games('ABABABABABA');
    expect(play(to65).state.games).toEqual({ A: 6, B: 5 });
    const { state } = play(to65 + game('A'));
    expect(state.completedSets[0].games).toEqual({ A: 7, B: 5 });
  });

  it('jeu décisif déclenché à 6/6', () => {
    const { state } = play(toSixAll);
    expect(state.inTiebreak).toBe(true);
    expect(state.tiebreakTarget).toBe(7);
    expect(formatPoints(play(toSixAll + 'AB').state)).toEqual({ A: '1', B: '1' });
  });

  it('jeu décisif gagné 7-0 : set 7-6', () => {
    const { state } = play(toSixAll + 'AAAAAAA');
    expect(state.completedSets[0]).toEqual({ games: { A: 7, B: 6 }, tiebreak: { A: 7, B: 0 } });
    expect(state.setsWon.A).toBe(1);
  });

  it('jeu décisif : 2 points d’écart nécessaires', () => {
    const tb66 = toSixAll + 'ABABABABABAB';
    expect(play(tb66 + 'A').state.inTiebreak).toBe(true);
    const { state } = play(tb66 + 'AA');
    expect(state.completedSets[0].tiebreak).toEqual({ A: 8, B: 6 });
  });

  it('rotation du service en jeu décisif : 1 point puis 2 par 2', () => {
    // 12 jeux joués en alternance depuis A : A sert le jeu décisif.
    const { points } = play(toSixAll + 'ABABAB');
    const tbServers = points.filter((p) => p.inTiebreak).map((p) => p.server);
    expect(tbServers).toEqual(['A', 'B', 'B', 'A', 'A', 'B']);
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => tiebreakServer('A', i))).toEqual([
      'A', 'B', 'B', 'A', 'A', 'B', 'B',
    ]);
  });

  it('après un jeu décisif, le premier serveur du jeu décisif reçoit', () => {
    const { state } = play(toSixAll + 'AAAAAAA');
    expect(state.server).toBe('B');
  });
});

describe('changements de côté', () => {
  it('après les jeux impairs', () => {
    expect(play(game('A')).state.changeEnds).toBe(true);
    expect(play(games('AA')).state.changeEnds).toBe(false);
    expect(play(games('AAA')).state.changeEnds).toBe(true);
  });

  it('en fin de set si le nombre de jeux est impair', () => {
    expect(play(set60('A')).state.changeEnds).toBe(false);
    expect(play(games('ABABABABABAA')).state.changeEnds).toBe(false); // 7-5 : 12 jeux
    expect(play(games('AAAAABA')).state.changeEnds).toBe(true); // 6-1 : 7 jeux
  });

  it('tous les 6 points en jeu décisif', () => {
    expect(play(toSixAll + 'ABABA').state.changeEnds).toBe(false);
    expect(play(toSixAll + 'ABABAB').state.changeEnds).toBe(true);
  });
});

describe('match', () => {
  it('format 1 : victoire en 2 sets', () => {
    const { state } = play(set60('A') + set60('A'));
    expect(state.winner).toBe('A');
    expect(state.endReason).toBe('completed');
  });

  it('format 1 : 3e set classique à 1 set partout', () => {
    const { state } = play(set60('A') + set60('B'));
    expect(state.inTiebreak).toBe(false);
    expect(state.winner).toBeNull();
    expect(play(set60('A') + set60('B') + set60('B')).state.winner).toBe('B');
  });

  it('format 2 : super jeu décisif à 10 points au 3e set', () => {
    const c = cfg('FFT2');
    const base = set60('A') + set60('B');
    const s = play(base, c).state;
    expect(s.inTiebreak).toBe(true);
    expect(s.isSuperTiebreakSet).toBe(true);
    expect(s.tiebreakTarget).toBe(10);

    expect(play(base + 'A'.repeat(9), c).state.winner).toBeNull();
    const nineAll = base + 'AB'.repeat(9);
    expect(play(nineAll + 'A', c).state.winner).toBeNull();
    const end = play(nineAll + 'AA', c).state;
    expect(end.winner).toBe('A');
    expect(end.completedSets[2]).toEqual({
      games: { A: 1, B: 0 },
      tiebreak: { A: 11, B: 9 },
      superTiebreak: true,
    });
  });

  it('les points après la fin du match sont ignorés', () => {
    const { state, points } = play(set60('A') + set60('A') + 'BBBB');
    expect(state.winner).toBe('A');
    expect(points).toHaveLength(48);
  });
});

describe('enjeux des points', () => {
  it('balle de break pour le relanceur', () => {
    const { points } = play('BBBB');
    expect(points.map((p) => p.situation.breakPoint)).toEqual([false, false, false, true]);
  });

  it('balle de set et balle de match', () => {
    const { points } = play(set60('A') + set60('A'));
    // Dernier point du 1er set : 5-0, 40-0.
    const setPointA = points[23];
    expect(setPointA.situation.setPoint).toBe('A');
    expect(setPointA.situation.matchPoint).toBeNull();
    // À 30-0, gagner le point ne donne pas encore le set.
    expect(points[22].situation.setPoint).toBeNull();
    const last = points[points.length - 1];
    expect(last.situation.matchPoint).toBe('A');
  });

  it('enregistre le serveur, le set et le numéro de jeu de chaque point', () => {
    const { points } = play(game('A') + 'B');
    expect(points[4]).toMatchObject({ server: 'B', setNumber: 1, gameNumber: 2, wonGame: false });
    expect(points[3].wonGame).toBe(true);
  });
});

describe('incidents', () => {
  it('pénalité de point : point donné à l’adversaire', () => {
    const { state, points } = replay(cfg(), [incident('point_penalty', 'A')]);
    expect(state.points).toEqual({ A: 0, B: 1 });
    expect(points).toHaveLength(0);
  });

  it('pénalité de jeu : jeu donné à l’adversaire', () => {
    const { state } = replay(cfg(), [...pts('AA'), incident('game_penalty', 'A')]);
    expect(state.games).toEqual({ A: 0, B: 1 });
    expect(state.points).toEqual({ A: 0, B: 0 });
  });

  it('abandon : l’adversaire gagne', () => {
    const { state } = replay(cfg(), [...pts('AAAA'), incident('retirement', 'A')]);
    expect(state.winner).toBe('B');
    expect(state.endReason).toBe('retirement');
  });

  it('un avertissement ne change pas le score', () => {
    const { state } = replay(cfg(), [...pts('A'), incident('warning', 'B')]);
    expect(state.points).toEqual({ A: 1, B: 0 });
  });
});

describe('résumé du score', () => {
  it('sets classiques, jeu décisif et super jeu décisif', () => {
    const c = cfg('FFT2');
    const tb75 = toSixAll + 'ABABABABAB' + 'AA'; // jeu décisif 7-5
    const seq = set60('A') + tb75.replace(/A/g, 'x').replace(/B/g, 'A').replace(/x/g, 'B');
    const { state } = play(seq + 'B'.repeat(10), c);
    expect(setsSummary(state)).toEqual(['6-0', '6-7 (5)', '[0-10]']);
  });
});

describe('notes du coach', () => {
  const note = (text: string, player?: Side): MatchEvent => ({
    kind: 'note',
    ts: 0,
    text,
    tags: ['frustration'],
    ...(player ? { player } : {}),
  });

  it('une note ne change pas le score et garde le moment', () => {
    const { state, notes, points } = replay(cfg(), [...pts(game('A') + 'AB'), note('Lance sa raquette', 'B')]);
    expect(state.points).toEqual({ A: 1, B: 1 });
    expect(points).toHaveLength(6);
    expect(notes).toEqual([
      {
        eventIndex: 6,
        ts: 0,
        text: 'Lance sa raquette',
        tags: ['frustration'],
        player: 'B',
        setNumber: 1,
        games: { A: 1, B: 0 },
        score: { A: '15', B: '15' },
        inTiebreak: false,
        lastPointIndex: 5,
        matchOver: false,
      },
    ]);
  });

  it('les notes après la fin du match sont gardées', () => {
    const { notes } = replay(cfg(), [...pts(set60('A') + set60('A')), note('Bon match')]);
    expect(notes[0]).toMatchObject({ matchOver: true, setNumber: 2, games: { A: 6, B: 0 }, lastPointIndex: 47 });
  });

  it('note avant le premier point', () => {
    expect(replay(cfg(), [note('Échauffement tendu')]).notes[0]).toMatchObject({ lastPointIndex: null, setNumber: 1 });
  });
});

describe('mode Jeux : jeux saisis d’un seul tap', () => {
  const g = (seq: string, t0 = 0): MatchEvent[] =>
    [...seq].map((c, i) => ({ kind: 'game' as const, winner: c as Side, ts: t0 + i * 300_000 }));

  it('un jeu par événement, le service alterne', () => {
    const { state, games } = replay(cfg(), g('AAB'));
    expect(state.games).toEqual({ A: 2, B: 1 });
    expect(state.server).toBe('B');
    expect(games.map((x) => [x.winner, x.server, x.source])).toEqual([
      ['A', 'A', 'game'],
      ['A', 'B', 'game'],
      ['B', 'A', 'game'],
    ]);
  });

  it('jeu décisif attribué sans le score du jeu décisif', () => {
    const { state } = replay(cfg(), g('AB'.repeat(6) + 'B'));
    expect(state.completedSets[0]).toEqual({ games: { A: 6, B: 7 } });
    expect(setsSummary(state)).toEqual(['6-7']);
  });

  it('super jeu décisif attribué : noté [1-0]', () => {
    const { state } = replay(cfg('FFT2'), g('AAAAAA' + 'BBBBBB' + 'A'));
    expect(state.winner).toBe('A');
    expect(setsSummary(state)).toEqual(['6-0', '0-6', '[1-0]']);
  });

  it('mélange avec la saisie point par point', () => {
    const { state, games } = replay(cfg(), [...pts('AAAA'), ...g('B')]);
    expect(state.games).toEqual({ A: 1, B: 1 });
    expect(games.map((x) => x.source)).toEqual(['points', 'game']);
  });
});

describe('correction du score', () => {
  const adjust = (sets: { A: number; B: number }[], games: { A: number; B: number }, server: Side): MatchEvent => ({
    kind: 'adjust',
    ts: 0,
    sets,
    games,
    server,
  });

  it('remplace le score courant', () => {
    const { state } = replay(cfg(), [...pts('AAAA'), adjust([{ A: 6, B: 4 }], { A: 2, B: 3 }, 'B')]);
    expect(state.completedSets).toEqual([{ games: { A: 6, B: 4 } }]);
    expect(state.setsWon).toEqual({ A: 1, B: 0 });
    expect(state.games).toEqual({ A: 2, B: 3 });
    expect(state.server).toBe('B');
    expect(state.points).toEqual({ A: 0, B: 0 });
  });

  it('la saisie reprend normalement après la correction', () => {
    const { state } = replay(cfg(), [adjust([], { A: 5, B: 4 }, 'A'), ...pts('AAAA')]);
    expect(state.completedSets).toEqual([{ games: { A: 6, B: 4 } }]);
  });

  it('6/6 corrigé : jeu décisif en cours', () => {
    expect(replay(cfg(), [adjust([], { A: 6, B: 6 }, 'A')]).state.inTiebreak).toBe(true);
  });

  it('1 set partout en format 2 : super jeu décisif', () => {
    const s = replay(cfg('FFT2'), [adjust([{ A: 6, B: 3 }, { A: 4, B: 6 }], { A: 0, B: 0 }, 'A')]).state;
    expect(s.isSuperTiebreakSet).toBe(true);
    expect(s.tiebreakTarget).toBe(10);
  });

  it('score final saisi : match terminé', () => {
    const s = replay(cfg(), [adjust([{ A: 6, B: 3 }, { A: 7, B: 5 }], { A: 0, B: 0 }, 'A')]).state;
    expect(s.winner).toBe('A');
  });
});

describe('horaires', () => {
  const at = (min: number) => new Date(2026, 10, 24, 14, min).getTime();
  const gAt = (winner: Side, min: number): MatchEvent => ({ kind: 'game', winner, ts: at(min) });

  it('début, fin du match et durée de chaque set', () => {
    const events = [
      ...[...'AAAAAA'].map((w, i) => gAt(w as Side, 2 + i * 5)), // set 1 : 14:02 → 14:27
      ...[...'AAAAAA'].map((w, i) => gAt(w as Side, 32 + i * 5)), // set 2 : → 14:57
    ];
    const { timeline } = replay(cfg(), events);
    expect(timeline.start).toBe(at(2));
    expect(timeline.end).toBe(at(57));
    expect(timeline.sets).toEqual([
      { setNumber: 1, start: at(2), end: at(27) },
      { setNumber: 2, start: at(27), end: at(57) },
    ]);
  });

  it('match en cours : set courant sans fin', () => {
    const { timeline } = replay(cfg(), [gAt('A', 0), gAt('B', 5)]);
    expect(timeline.end).toBeNull();
    expect(timeline.sets).toEqual([{ setNumber: 1, start: at(0), end: null }]);
  });

  it('bouton « Démarrer le match » : heure exacte du début', () => {
    const { timeline, state } = replay(cfg(), [{ kind: 'start', ts: at(0) }, gAt('A', 6)]);
    expect(timeline.start).toBe(at(0));
    expect(timeline.sets[0].start).toBe(at(0));
    expect(state.games).toEqual({ A: 1, B: 0 });
  });

  it('un début saisi après le premier score est ignoré', () => {
    expect(replay(cfg(), [gAt('A', 6), { kind: 'start', ts: at(10) }]).timeline.start).toBe(at(6));
  });

  it('les notes ne comptent pas dans les horaires', () => {
    const { timeline } = replay(cfg(), [{ kind: 'note', ts: at(0), text: 'Échauffement' }, gAt('A', 10)]);
    expect(timeline.start).toBe(at(10));
  });
});

describe('annulation', () => {
  it('retirer le dernier événement revient à l’état précédent', () => {
    const events = pts(toSixAll + 'AAAAAAA');
    const undone = replay(cfg(), events.slice(0, -1)).state;
    expect(undone).toEqual(replay(cfg(), pts(toSixAll + 'AAAAAA')).state);
    expect(undone.inTiebreak).toBe(true);
  });
});
