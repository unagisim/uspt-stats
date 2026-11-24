// Libellés français des valeurs stockées en anglais dans les points.

import type {
  CourtPosition,
  EndZone,
  IncidentType,
  NoteTag,
  PointDetails,
  PointEnding,
  RallyLength,
  ServeOutcome,
  ServeZone,
  Shot,
  Spin,
} from './engine';

export const SERVE_OUTCOME: Record<ServeOutcome, string> = {
  in: 'Balle en jeu',
  ace: 'Ace',
  double_fault: 'Double faute',
};

export const SERVE_ZONE: Record<ServeZone, string> = {
  wide: 'Large',
  body: 'Corps',
  T: 'Axe',
};

export const ENDING: Record<PointEnding, string> = {
  winner: 'Coup gagnant',
  unforced_error: 'Faute directe',
  forced_error: 'Faute provoquée',
};

export const SHOT: Record<Shot, string> = {
  forehand: 'Coup droit',
  backhand: 'Revers',
  volley: 'Volée',
  smash: 'Smash',
  serve: 'Service',
  return: 'Retour',
  drop_shot: 'Amortie',
  lob: 'Lob',
  passing: 'Passing',
};

export const SPIN: Record<Spin, string> = {
  topspin: 'Lift',
  slice: 'Slice',
  flat: 'À plat',
};

export const POSITION: Record<CourtPosition, string> = {
  baseline: 'Fond de court',
  midcourt: 'Milieu',
  net: 'Filet',
};

export const END_ZONE: Record<EndZone, string> = {
  left_deep: 'Gauche long',
  center_deep: 'Centre long',
  right_deep: 'Droite long',
  left_short: 'Gauche court',
  center_short: 'Centre court',
  right_short: 'Droite court',
  net: 'Dans le filet',
  out_long: 'Out long',
  out_wide: 'Out large',
};

export const RALLY: Record<RallyLength, string> = {
  '1-4': '1 à 4 coups',
  '5-8': '5 à 8 coups',
  '9+': '9 coups et plus',
};

export const NOTE_TAGS: Record<NoteTag, string> = {
  positive: 'Attitude positive',
  negative: 'Attitude négative',
  frustration: 'Énervement',
  concentration: 'Déconcentration',
  tactic: 'Tactique',
  technique: 'Technique',
  physical: 'Physique',
};

/** "Point L. Martin (Faute directe, revers)", "Point L. Martin (ace)". */
export function describePoint(winner: 'A' | 'B', details: PointDetails | undefined, names: { A: string; B: string }): string {
  let extra = '';
  if (details?.serveOutcome === 'ace') extra = 'ace';
  else if (details?.serveOutcome === 'double_fault') extra = 'double faute';
  else if (details?.ending) {
    extra = [ENDING[details.ending], details.shot ? SHOT[details.shot].toLowerCase() : ''].filter(Boolean).join(', ');
  }
  return `Point ${names[winner]}${extra ? ` (${extra})` : ''}`;
}

/** Moment d'une note : "Set 2 · 3-4 · 15-30" ou "Après le match". */
export function noteMoment(n: {
  setNumber: number;
  games: { A: number; B: number };
  score: { A: string; B: string };
  inTiebreak: boolean;
  matchOver: boolean;
}): string {
  if (n.matchOver) return 'Après le match';
  const parts = [`Set ${n.setNumber}`, `${n.games.A}-${n.games.B}`];
  const pointsPlayed = n.score.A !== '0' || n.score.B !== '0';
  if (pointsPlayed) parts.push(`${n.inTiebreak ? 'jeu décisif ' : ''}${n.score.A}-${n.score.B}`);
  return parts.join(' · ');
}

export const SURFACE_LABELS: Record<string, string> = {
  dur: 'Dur',
  terre: 'Terre battue',
  gazon: 'Gazon',
  moquette: 'Moquette',
  synthetique: 'Gazon synthétique',
};

export const INCIDENTS: Record<IncidentType, string> = {
  warning: 'Avertissement',
  point_penalty: 'Pénalité de point',
  game_penalty: 'Pénalité de jeu',
  medical_timeout: 'Temps mort médical',
  interruption: 'Interruption',
  resumption: 'Reprise',
  retirement: 'Abandon',
  walkover: 'Forfait',
};
