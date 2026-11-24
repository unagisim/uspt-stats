// Libellés français des valeurs stockées en anglais dans les points.

import type {
  CourtPosition,
  EndZone,
  IncidentType,
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
  net: 'Filet',
  out_long: 'Out long',
  out_wide: 'Out large',
};

export const RALLY: Record<RallyLength, string> = {
  '1-4': '1 à 4 coups',
  '5-8': '5 à 8 coups',
  '9+': '9 coups et plus',
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
