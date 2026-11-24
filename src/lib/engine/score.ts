// Moteur de score : fonctions pures. Le score est toujours recalculé en rejouant
// la liste des événements du match (annuler = retirer le dernier événement).

import {
  other,
  type MatchConfig,
  type MatchEvent,
  type NoteTag,
  type Pair,
  type PointDetails,
  type Side,
} from './types';

export interface SetScore {
  games: Pair;
  /** Points du jeu décisif s'il y en a eu un. */
  tiebreak?: Pair;
  /** Set joué sous forme de super jeu décisif. */
  superTiebreak?: boolean;
}

export type EndReason = 'completed' | 'retirement' | 'walkover';

export interface ScoreState {
  completedSets: SetScore[];
  setsWon: Pair;
  /** Jeux du set en cours. */
  games: Pair;
  /** Points du jeu (ou du jeu décisif) en cours. */
  points: Pair;
  inTiebreak: boolean;
  isSuperTiebreakSet: boolean;
  tiebreakTarget: number;
  /** Serveur au début du jeu (ou du jeu décisif) en cours. */
  gameServer: Side;
  /** Serveur du prochain point. */
  server: Side;
  winner: Side | null;
  endReason: EndReason | null;
  /** Les joueurs doivent changer de côté après le dernier point joué. */
  changeEnds: boolean;
}

export interface PointSituation {
  /** Balle de break pour le relanceur. */
  breakPoint: boolean;
  setPoint: Side | null;
  matchPoint: Side | null;
  /** Point décisif (40/40 en format avec point décisif). */
  decidingPoint: boolean;
}

export interface PointRecord {
  eventIndex: number;
  winner: Side;
  server: Side;
  /** 1 = 1er set. */
  setNumber: number;
  /** Numéro du jeu dans le set (1 = 1er jeu). */
  gameNumber: number;
  inTiebreak: boolean;
  superTiebreak: boolean;
  /** Score affiché avant le point. */
  scoreBefore: { A: string; B: string };
  pointsBefore: Pair;
  gamesBefore: Pair;
  situation: PointSituation;
  /** Le jeu (ou le set) a été gagné sur ce point. */
  wonGame: boolean;
  ts: number;
  details?: PointDetails;
}

/** Note du coach replacée dans le match : score au moment où elle a été prise. */
export interface NoteRecord {
  eventIndex: number;
  ts: number;
  text: string;
  tags: NoteTag[];
  player?: Side;
  setNumber: number;
  /** Jeux du set en cours (ou du set qui vient de se terminer si le match est fini). */
  games: Pair;
  /** Score du jeu affiché (0, 15, 30, 40, AV ou points du jeu décisif). */
  score: { A: string; B: string };
  inTiebreak: boolean;
  /** Index (dans `points`) du dernier point joué avant la note, ou null. */
  lastPointIndex: number | null;
  matchOver: boolean;
}

/** Jeu terminé, quelle que soit la façon dont il a été saisi. */
export interface GameRecord {
  eventIndex: number;
  ts: number;
  winner: Side;
  /** Serveur du jeu (ou premier serveur du jeu décisif). */
  server: Side;
  setNumber: number;
  tiebreak: boolean;
  /** Saisi point par point, d'un seul tap (mode Jeux) ou attribué par pénalité. */
  source: 'points' | 'game' | 'penalty';
}

export interface SetTiming {
  setNumber: number;
  start: number | null;
  /** null tant que le set est en cours. */
  end: number | null;
}

/**
 * Horaires du match : début = bouton « Démarrer le match » s'il a été utilisé, sinon premier
 * score saisi ; fin = dernier point du match.
 * Chaque set commence à la fin du précédent (pauses comprises).
 */
export interface Timeline {
  start: number | null;
  end: number | null;
  sets: SetTiming[];
}

export interface ReplayResult {
  state: ScoreState;
  points: PointRecord[];
  notes: NoteRecord[];
  games: GameRecord[];
  timeline: Timeline;
}

const zero = (): Pair => ({ A: 0, B: 0 });

export function initialState(config: MatchConfig): ScoreState {
  return {
    completedSets: [],
    setsWon: zero(),
    games: zero(),
    points: zero(),
    inTiebreak: false,
    isSuperTiebreakSet: false,
    tiebreakTarget: config.format.tiebreakPoints,
    gameServer: config.firstServer,
    server: config.firstServer,
    winner: null,
    endReason: null,
    changeEnds: false,
  };
}

/**
 * Serveur d'un point de jeu décisif : le premier point est servi par `starter`,
 * puis les joueurs servent à tour de rôle 2 points.
 */
export function tiebreakServer(starter: Side, pointsPlayed: number): Side {
  return Math.floor((pointsPlayed + 1) / 2) % 2 === 0 ? starter : other(starter);
}

function clone(s: ScoreState): ScoreState {
  return {
    ...s,
    completedSets: s.completedSets.map((set) => ({
      ...set,
      games: { ...set.games },
      ...(set.tiebreak ? { tiebreak: { ...set.tiebreak } } : {}),
    })),
    setsWon: { ...s.setsWon },
    games: { ...s.games },
    points: { ...s.points },
  };
}

function finishSet(n: ScoreState, config: MatchConfig, w: Side, tiebreak?: Pair): void {
  const fmt = config.format;
  const games = n.isSuperTiebreakSet ? { A: w === 'A' ? 1 : 0, B: w === 'B' ? 1 : 0 } : { ...n.games };
  const set: SetScore = { games };
  if (tiebreak) set.tiebreak = tiebreak;
  if (n.isSuperTiebreakSet) set.superTiebreak = true;
  n.completedSets.push(set);
  n.setsWon[w]++;

  n.changeEnds = (games.A + games.B) % 2 === 1;
  n.games = zero();
  n.points = zero();
  n.inTiebreak = false;
  n.isSuperTiebreakSet = false;
  n.tiebreakTarget = fmt.tiebreakPoints;

  if (n.setsWon[w] >= fmt.setsToWin) {
    n.winner = w;
    n.endReason = 'completed';
    n.changeEnds = false;
    return;
  }

  // Le service continue d'alterner ; après un jeu décisif, celui qui a servi
  // en premier dans le jeu décisif reçoit au premier jeu du set suivant.
  n.gameServer = other(n.gameServer);
  n.server = n.gameServer;

  const decider = fmt.setsToWin - 1;
  if (fmt.finalSetSuperTiebreak && n.setsWon.A === decider && n.setsWon.B === decider) {
    n.inTiebreak = true;
    n.isSuperTiebreakSet = true;
    n.tiebreakTarget = fmt.superTiebreakPoints;
  }
}

function finishGame(n: ScoreState, config: MatchConfig, w: Side): void {
  const fmt = config.format;
  n.games[w]++;
  n.points = zero();
  const g = n.games[w];
  const og = n.games[other(w)];
  if (g >= fmt.gamesPerSet && g - og >= 2) {
    finishSet(n, config, w);
    return;
  }
  n.changeEnds = (n.games.A + n.games.B) % 2 === 1;
  n.gameServer = other(n.gameServer);
  n.server = n.gameServer;
  if (n.games.A === fmt.tiebreakAt && n.games.B === fmt.tiebreakAt) {
    n.inTiebreak = true;
    n.tiebreakTarget = fmt.tiebreakPoints;
  }
}

function finishTiebreak(n: ScoreState, config: MatchConfig, w: Side): void {
  // Jeu décisif attribué sans les points (mode Jeux, pénalité) : score du jeu décisif inconnu.
  const tb = n.points.A + n.points.B > 0 ? { ...n.points } : undefined;
  if (!n.isSuperTiebreakSet) n.games[w]++;
  finishSet(n, config, w, tb);
}

export interface ScoreAdjustment {
  /** Sets terminés, dans l'ordre (un super jeu décisif gagné s'écrit 1-0 ou 0-1). */
  sets: Pair[];
  /** Jeux du set en cours. */
  games: Pair;
  /** Joueur au service au prochain jeu. */
  server: Side;
}

/** Remplace le score par un score saisi à la main (correction après une absence, une erreur…). */
export function adjustScore(s: ScoreState, config: MatchConfig, adj: ScoreAdjustment): ScoreState {
  const fmt = config.format;
  const n = clone(s);
  n.completedSets = adj.sets.map((g, i) => {
    const superSet =
      fmt.finalSetSuperTiebreak && i === fmt.setsToWin * 2 - 2 && g.A + g.B === 1;
    return superSet ? { games: { ...g }, superTiebreak: true } : { games: { ...g } };
  });
  n.setsWon = { A: 0, B: 0 };
  for (const set of n.completedSets) n.setsWon[set.games.A > set.games.B ? 'A' : 'B']++;
  n.games = { ...adj.games };
  n.points = zero();
  n.gameServer = adj.server;
  n.server = adj.server;
  n.changeEnds = false;
  n.inTiebreak = false;
  n.isSuperTiebreakSet = false;
  n.tiebreakTarget = fmt.tiebreakPoints;
  n.winner = null;
  n.endReason = null;

  const leader = n.setsWon.A >= fmt.setsToWin ? 'A' : n.setsWon.B >= fmt.setsToWin ? 'B' : null;
  if (leader) {
    n.winner = leader;
    n.endReason = 'completed';
    n.games = zero();
    return n;
  }
  const decider = fmt.setsToWin - 1;
  if (fmt.finalSetSuperTiebreak && n.setsWon.A === decider && n.setsWon.B === decider) {
    n.inTiebreak = true;
    n.isSuperTiebreakSet = true;
    n.tiebreakTarget = fmt.superTiebreakPoints;
    n.games = zero();
  } else if (n.games.A === fmt.tiebreakAt && n.games.B === fmt.tiebreakAt) {
    n.inTiebreak = true;
  }
  return n;
}

/** Applique un point gagné par `w`. Renvoie un nouvel état (l'état d'origine n'est pas modifié). */
export function applyPoint(s: ScoreState, config: MatchConfig, w: Side): ScoreState {
  if (s.winner) return s;
  const n = clone(s);
  n.changeEnds = false;
  n.points[w]++;
  const p = n.points[w];
  const o = n.points[other(w)];

  if (n.inTiebreak) {
    if (p >= n.tiebreakTarget && p - o >= 2) {
      finishTiebreak(n, config, w);
    } else {
      const played = p + o;
      if (played % 6 === 0) n.changeEnds = true;
      n.server = tiebreakServer(n.gameServer, played);
    }
    return n;
  }

  const won = p >= 4 && (p - o >= 2 || (config.format.decidingPoint && p - o >= 1));
  if (won) finishGame(n, config, w);
  return n;
}

/** Pénalité de jeu : le jeu en cours est attribué à `w`. */
export function awardGame(s: ScoreState, config: MatchConfig, w: Side): ScoreState {
  if (s.winner) return s;
  const n = clone(s);
  n.changeEnds = false;
  if (n.inTiebreak) finishTiebreak(n, config, w);
  else finishGame(n, config, w);
  return n;
}

export function endMatch(s: ScoreState, loser: Side, reason: EndReason): ScoreState {
  if (s.winner) return s;
  const n = clone(s);
  n.winner = other(loser);
  n.endReason = reason;
  n.changeEnds = false;
  return n;
}

const gameWon = (before: ScoreState, after: ScoreState, side: Side): boolean =>
  after.setsWon[side] > before.setsWon[side] || after.games[side] > before.games[side];

/** Enjeux du prochain point (balle de break, de set, de match, point décisif). */
export function pointSituation(s: ScoreState, config: MatchConfig): PointSituation {
  const result: PointSituation = {
    breakPoint: false,
    setPoint: null,
    matchPoint: null,
    decidingPoint: false,
  };
  if (s.winner) return result;
  for (const side of ['A', 'B'] as const) {
    const after = applyPoint(s, config, side);
    if (after.winner === side) result.matchPoint = side;
    if (after.setsWon[side] > s.setsWon[side]) result.setPoint = side;
    if (!s.inTiebreak && side !== s.server && gameWon(s, after, side)) result.breakPoint = true;
  }
  result.decidingPoint =
    config.format.decidingPoint && !s.inTiebreak && s.points.A === 3 && s.points.B === 3;
  return result;
}

const LABELS = ['0', '15', '30', '40'];

/** Score du jeu en cours tel qu'affiché (0, 15, 30, 40, AV ; chiffres en jeu décisif). */
export function formatPoints(s: ScoreState): { A: string; B: string } {
  const { A, B } = s.points;
  if (s.inTiebreak) return { A: String(A), B: String(B) };
  if (A >= 3 && B >= 3) {
    if (A === B) return { A: '40', B: '40' };
    return A > B ? { A: 'AV', B: '40' } : { A: '40', B: 'AV' };
  }
  return { A: LABELS[A], B: LABELS[B] };
}

/**
 * Score des sets terminés, du point de vue du joueur A : "6-4", "7-6 (5)" (points du
 * perdant du jeu décisif), "[10-8]" pour un super jeu décisif.
 */
export function setsSummary(s: ScoreState): string[] {
  return s.completedSets.map((set) => {
    if (set.superTiebreak && set.tiebreak) return `[${set.tiebreak.A}-${set.tiebreak.B}]`;
    if (set.superTiebreak) return `[${set.games.A}-${set.games.B}]`;
    const base = `${set.games.A}-${set.games.B}`;
    if (set.tiebreak) return `${base} (${Math.min(set.tiebreak.A, set.tiebreak.B)})`;
    return base;
  });
}

/** Rejoue tous les événements et renvoie l'état final et le détail de chaque point joué. */
export function replay(config: MatchConfig, events: readonly MatchEvent[]): ReplayResult {
  let s = initialState(config);
  const points: PointRecord[] = [];
  const notes: NoteRecord[] = [];
  const games: GameRecord[] = [];
  let start: number | null = null;
  let end: number | null = null;
  const setEnds: number[] = [];

  /** Après chaque événement qui touche au score : jeux gagnés, fins de set et de match. */
  const track = (i: number, ts: number, before: ScoreState, source: GameRecord['source']) => {
    start ??= ts;
    for (const side of ['A', 'B'] as const) {
      if (gameWon(before, s, side)) {
        games.push({
          eventIndex: i,
          ts,
          winner: side,
          server: before.gameServer,
          setNumber: before.completedSets.length + 1,
          tiebreak: before.inTiebreak,
          source,
        });
      }
    }
    // Une correction peut ajouter ou retirer des sets : on garde une fin par set terminé.
    setEnds.length = Math.min(setEnds.length, s.completedSets.length);
    while (setEnds.length < s.completedSets.length) setEnds.push(ts);
    if (s.winner && !before.winner) end = ts;
  };

  events.forEach((e, i) => {
    // Heure de début exacte, si elle est donnée avant le premier score.
    if (e.kind === 'start') {
      start ??= e.ts;
      return;
    }
    // Les notes sont gardées même après la fin du match (commentaires d'après-match).
    if (e.kind === 'note') {
      const over = s.winner !== null;
      const lastSet = s.completedSets[s.completedSets.length - 1];
      notes.push({
        eventIndex: i,
        ts: e.ts,
        text: e.text,
        tags: e.tags ?? [],
        ...(e.player ? { player: e.player } : {}),
        setNumber: over ? s.completedSets.length : s.completedSets.length + 1,
        games: over && lastSet ? { ...lastSet.games } : { ...s.games },
        score: over ? { A: '', B: '' } : formatPoints(s),
        inTiebreak: !over && s.inTiebreak,
        lastPointIndex: points.length ? points.length - 1 : null,
        matchOver: over,
      });
      return;
    }
    if (s.winner) return;
    if (e.kind === 'point') {
      const before = s;
      s = applyPoint(s, config, e.winner);
      points.push({
        eventIndex: i,
        winner: e.winner,
        server: before.server,
        setNumber: before.completedSets.length + 1,
        gameNumber: before.games.A + before.games.B + 1,
        inTiebreak: before.inTiebreak,
        superTiebreak: before.isSuperTiebreakSet,
        scoreBefore: formatPoints(before),
        pointsBefore: { ...before.points },
        gamesBefore: { ...before.games },
        situation: pointSituation(before, config),
        wonGame: gameWon(before, s, e.winner),
        ts: e.ts,
        ...(e.details ? { details: e.details } : {}),
      });
      track(i, e.ts, before, 'points');
      return;
    }
    if (e.kind === 'game') {
      const before = s;
      s = awardGame(s, config, e.winner);
      track(i, e.ts, before, 'game');
      return;
    }
    if (e.kind === 'adjust') {
      const before = s;
      s = adjustScore(s, config, e);
      // Pas d'enregistrement de jeux : on ne sait pas qui a gagné les jeux manqués.
      start ??= e.ts;
      setEnds.length = Math.min(setEnds.length, s.completedSets.length);
      while (setEnds.length < s.completedSets.length) setEnds.push(e.ts);
      if (s.winner && !before.winner) end = e.ts;
      return;
    }
    if (!e.player) return;
    const before = s;
    switch (e.type) {
      case 'point_penalty':
        s = applyPoint(s, config, other(e.player));
        track(i, e.ts, before, 'penalty');
        break;
      case 'game_penalty':
        s = awardGame(s, config, other(e.player));
        track(i, e.ts, before, 'penalty');
        break;
      case 'retirement':
      case 'walkover':
        s = endMatch(s, e.player, e.type);
        start ??= e.ts;
        end = e.ts;
        break;
      default:
        break;
    }
  });

  return { state: s, points, notes, games, timeline: buildTimeline(start, end, setEnds, s) };
}

function buildTimeline(start: number | null, end: number | null, setEnds: number[], s: ScoreState): Timeline {
  const sets: SetTiming[] = setEnds.map((e, i) => ({
    setNumber: i + 1,
    start: i === 0 ? start : setEnds[i - 1],
    end: e,
  }));
  if (!s.winner && start !== null) {
    sets.push({ setNumber: setEnds.length + 1, start: setEnds.length ? setEnds[setEnds.length - 1] : start, end: null });
  }
  return { start, end, sets };
}

/** Durée en ms entre deux instants, ou null si l'un manque. */
export const span = (from: number | null, to: number | null): number | null =>
  from !== null && to !== null ? Math.max(0, to - from) : null;
