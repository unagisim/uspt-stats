// Calcul des statistiques à partir des points rejoués par le moteur (PointRecord).
// Les stats qui dépendent du mode de saisie (1re balle, fin de point) ne sont
// remplies que si les données existent.

import {
  other,
  type EndZone,
  type GameRecord,
  type PointRecord,
  type RallyLength,
  type ServeZone,
  type Shot,
  type Side,
} from './engine';

/** Coups gagnants, fautes directes et fautes provoquées d'un joueur pour un type de coup. */
export interface ShotCount {
  winners: number;
  unforcedErrors: number;
  forcedErrors: number;
}

export interface Ratio {
  won: number;
  total: number;
}

export interface SideStats {
  pointsWon: number;
  servicePoints: Ratio;
  returnPoints: Ratio;
  aces: number;
  doubleFaults: number;
  /** 1res balles passées sur 1res balles servies. */
  firstServeIn: Ratio;
  firstServeWon: Ratio;
  secondServeWon: Ratio;
  serviceGames: Ratio;
  returnGames: Ratio;
  breakPointsConverted: Ratio;
  breakPointsSaved: Ratio;
  setPoints: Ratio;
  matchPoints: Ratio;
  decidingPoints: Ratio;
  tiebreakPoints: Ratio;
  winners: number;
  unforcedErrors: number;
  /** Fautes commises par ce joueur sous la pression de l'adversaire. */
  forcedErrors: number;
  longestStreak: number;
  /** Fin des points par type de coup (coups joués par ce joueur). */
  byShot: Partial<Record<Shot, ShotCount>>;
  /** Points gagnés selon la longueur de l'échange. */
  rally: Partial<Record<RallyLength, Ratio>>;
  /** Points gagnés sur son service selon la zone visée. */
  serveZones: Partial<Record<ServeZone, Ratio>>;
  /**
   * Points terminés par ce joueur au filet : won = gagnés (coup gagnant ou faute
   * provoquée chez l'adversaire), total = gagnés + perdus (fautes du joueur au filet).
   */
  netPoints: Ratio;
  /** Coups gagnants réussis au filet. */
  netWinners: number;
  /** Fautes (directes ou provoquées) commises au filet. */
  netErrors: number;
  /** Zones des coups gagnants de ce joueur. */
  winnerZones: Partial<Record<EndZone, number>>;
}

export interface MatchStats {
  A: SideStats;
  B: SideStats;
  totalPoints: number;
  /** Au moins un point saisi avec le détail 1re / 2e balle. */
  hasServeDetail: boolean;
  /** Au moins un point saisi avec le type de fin de point. */
  hasEndingDetail: boolean;
  hasShotDetail: boolean;
  hasRallyDetail: boolean;
  hasServeZoneDetail: boolean;
  hasNetDetail: boolean;
  hasZoneDetail: boolean;
  /** Écart cumulé de points (A − B) après chaque point. */
  momentum: number[];
  /** Index (dans momentum) des premiers points de chaque nouveau set. */
  setStarts: number[];
  /** Temps écoulé entre le premier et le dernier point saisi. */
  durationMs: number | null;
}

const ratio = (): Ratio => ({ won: 0, total: 0 });

function emptySide(): SideStats {
  return {
    pointsWon: 0,
    servicePoints: ratio(),
    returnPoints: ratio(),
    aces: 0,
    doubleFaults: 0,
    firstServeIn: ratio(),
    firstServeWon: ratio(),
    secondServeWon: ratio(),
    serviceGames: ratio(),
    returnGames: ratio(),
    breakPointsConverted: ratio(),
    breakPointsSaved: ratio(),
    setPoints: ratio(),
    matchPoints: ratio(),
    decidingPoints: ratio(),
    tiebreakPoints: ratio(),
    winners: 0,
    unforcedErrors: 0,
    forcedErrors: 0,
    longestStreak: 0,
    byShot: {},
    rally: {},
    serveZones: {},
    netPoints: ratio(),
    netWinners: 0,
    netErrors: 0,
    winnerZones: {},
  };
}

function count(r: Ratio, won: boolean): void {
  r.total++;
  if (won) r.won++;
}

/** Statistiques du match entier, ou d'un seul set si `setNumber` est donné. */
export function computeStats(allPoints: readonly PointRecord[], setNumber?: number): MatchStats {
  const points = setNumber ? allPoints.filter((p) => p.setNumber === setNumber) : allPoints;
  const S: Record<Side, SideStats> = { A: emptySide(), B: emptySide() };
  const momentum: number[] = [];
  const setStarts: number[] = [];
  let hasServeDetail = false;
  let hasEndingDetail = false;
  let hasShotDetail = false;
  let hasRallyDetail = false;
  let hasServeZoneDetail = false;
  let hasNetDetail = false;
  let hasZoneDetail = false;
  let diff = 0;
  let streakSide: Side | null = null;
  let streak = 0;

  points.forEach((p, i) => {
    const w = p.winner;
    const l = other(w);
    const srv = p.server;
    const rcv = other(srv);
    const d = p.details;

    S[w].pointsWon++;
    count(S[srv].servicePoints, w === srv);
    count(S[rcv].returnPoints, w === rcv);

    if (d?.serveOutcome === 'ace') S[srv].aces++;
    if (d?.serveOutcome === 'double_fault') S[srv].doubleFaults++;
    if (d?.firstServeIn !== undefined) {
      if (d.firstServeIn) hasServeDetail = true;
      count(S[srv].firstServeIn, d.firstServeIn);
      count(d.firstServeIn ? S[srv].firstServeWon : S[srv].secondServeWon, w === srv);
    }

    if (p.wonGame && !p.inTiebreak) {
      count(S[srv].serviceGames, w === srv);
      count(S[rcv].returnGames, w === rcv);
    }

    if (p.situation.breakPoint) {
      count(S[rcv].breakPointsConverted, w === rcv);
      count(S[srv].breakPointsSaved, w === srv);
    }
    const sp = p.situation.setPoint;
    if (sp) count(S[sp].setPoints, w === sp);
    const mp = p.situation.matchPoint;
    if (mp) count(S[mp].matchPoints, w === mp);
    if (p.situation.decidingPoint) {
      count(S[w].decidingPoints, true);
      count(S[l].decidingPoints, false);
    }
    if (p.inTiebreak) {
      count(S[w].tiebreakPoints, true);
      count(S[l].tiebreakPoints, false);
    }

    if (d?.ending) {
      hasEndingDetail = true;
      if (d.ending === 'winner') S[w].winners++;
      else if (d.ending === 'unforced_error') S[l].unforcedErrors++;
      else S[l].forcedErrors++;
    }

    // Joueur qui a frappé le dernier coup : le gagnant sur un coup gagnant, le perdant sur une faute.
    const hitter = d?.ending && d.ending !== 'winner' ? l : w;
    if (d?.shot) {
      hasShotDetail = true;
      const c = (S[hitter].byShot[d.shot] ??= { winners: 0, unforcedErrors: 0, forcedErrors: 0 });
      if (d.ending === 'winner') c.winners++;
      else if (d.ending === 'unforced_error') c.unforcedErrors++;
      else if (d.ending === 'forced_error') c.forcedErrors++;
    }
    if (d?.rally) {
      hasRallyDetail = true;
      count((S[w].rally[d.rally] ??= ratio()), true);
      count((S[l].rally[d.rally] ??= ratio()), false);
    }
    if (d?.serveZone) {
      hasServeZoneDetail = true;
      count((S[srv].serveZones[d.serveZone] ??= ratio()), w === srv);
    }
    // Au filet : position « Filet » (mode expert) ; sans position, une volée ou un smash.
    const atNet = d?.position ? d.position === 'net' : d?.netApproach === true || d?.shot === 'volley' || d?.shot === 'smash';
    if (atNet) {
      hasNetDetail = true;
      count(S[hitter].netPoints, hitter === w);
      if (d?.ending === 'winner') S[hitter].netWinners++;
      else if (d?.ending) S[hitter].netErrors++;
    }
    if (d?.endZone && d.ending === 'winner') {
      hasZoneDetail = true;
      S[w].winnerZones[d.endZone] = (S[w].winnerZones[d.endZone] ?? 0) + 1;
    }

    streak = w === streakSide ? streak + 1 : 1;
    streakSide = w;
    S[w].longestStreak = Math.max(S[w].longestStreak, streak);

    if (i > 0 && p.setNumber !== points[i - 1].setNumber) setStarts.push(i);
    diff += w === 'A' ? 1 : -1;
    momentum.push(diff);
  });

  const durationMs = points.length >= 2 ? points[points.length - 1].ts - points[0].ts : null;

  return {
    A: S.A,
    B: S.B,
    totalPoints: points.length,
    hasServeDetail,
    hasEndingDetail,
    hasShotDetail,
    hasRallyDetail,
    hasServeZoneDetail,
    hasNetDetail,
    hasZoneDetail,
    momentum,
    setStarts,
    durationMs,
  };
}

// ---- Stats par jeu (toutes saisies, y compris le mode Jeux sans points) ----

export interface GameSideStats {
  gamesWon: number;
  /** Jeux de service gagnés / joués (hors jeux décisifs). */
  serviceGames: Ratio;
  /** Jeux de retour gagnés (breaks) / joués. */
  breaks: Ratio;
  longestStreak: number;
}

export interface GameStats {
  A: GameSideStats;
  B: GameSideStats;
  total: number;
  /** Écart cumulé de jeux (A − B) après chaque jeu. */
  momentum: number[];
  setStarts: number[];
  /** Au moins un jeu saisi sans le détail des points. */
  hasGameOnly: boolean;
}

export function computeGameStats(all: readonly GameRecord[], setNumber?: number): GameStats {
  const games = setNumber ? all.filter((g) => g.setNumber === setNumber) : all;
  const side = (): GameSideStats => ({ gamesWon: 0, serviceGames: ratio(), breaks: ratio(), longestStreak: 0 });
  const S: Record<Side, GameSideStats> = { A: side(), B: side() };
  const momentum: number[] = [];
  const setStarts: number[] = [];
  let diff = 0;
  let streakSide: Side | null = null;
  let streak = 0;
  games.forEach((g, i) => {
    const w = g.winner;
    S[w].gamesWon++;
    if (!g.tiebreak) {
      count(S[g.server].serviceGames, w === g.server);
      count(S[other(g.server)].breaks, w !== g.server);
    }
    streak = w === streakSide ? streak + 1 : 1;
    streakSide = w;
    S[w].longestStreak = Math.max(S[w].longestStreak, streak);
    if (i > 0 && g.setNumber !== games[i - 1].setNumber) setStarts.push(i);
    diff += w === 'A' ? 1 : -1;
    momentum.push(diff);
  });
  return { A: S.A, B: S.B, total: games.length, momentum, setStarts, hasGameOnly: games.some((g) => g.source === 'game') };
}

/** "14:05". */
export function formatClock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "60 %" ou "–" si aucune donnée. */
export const pct = (r: Ratio): string => (r.total ? `${Math.round((r.won / r.total) * 100)} %` : '–');

/** "3/5" ou "–" si aucune donnée. */
export const frac = (r: Ratio): string => (r.total ? `${r.won}/${r.total}` : '–');

/** "1 h 05", "42 min", "< 1 min". */
export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) return '< 1 min';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}
