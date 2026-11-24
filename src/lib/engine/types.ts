// Types du moteur de score. Les identifiants sont en anglais, les libellés affichés en français.

export type Side = 'A' | 'B';

export const other = (s: Side): Side => (s === 'A' ? 'B' : 'A');

export interface Pair {
  A: number;
  B: number;
}

export type FormatId = 'FFT1' | 'FFT2' | 'FFT3';

export interface MatchFormat {
  id: FormatId;
  label: string;
  description: string;
  /** Nombre de sets à gagner (2 = match en 2 sets gagnants). */
  setsToWin: number;
  /** Jeux nécessaires pour gagner un set (avec 2 jeux d'écart). */
  gamesPerSet: number;
  /** Score de jeux (à égalité) déclenchant le jeu décisif. */
  tiebreakAt: number;
  /** Points du jeu décisif (7). */
  tiebreakPoints: number;
  /** Le set décisif est remplacé par un super jeu décisif. */
  finalSetSuperTiebreak: boolean;
  /** Points du super jeu décisif (10). */
  superTiebreakPoints: number;
  /** Point décisif à 40/40 (pas d'avantage). */
  decidingPoint: boolean;
}

export interface MatchConfig {
  format: MatchFormat;
  firstServer: Side;
  /** Option ITF : comptage des lets au service. */
  letEnabled: boolean;
}

// ---- Détails facultatifs d'un point (modes standard et expert) ----

export type ServeOutcome = 'in' | 'ace' | 'double_fault';
export type ServeZone = 'wide' | 'body' | 'T';
export type PointEnding = 'winner' | 'unforced_error' | 'forced_error';
export type Shot =
  | 'forehand'
  | 'backhand'
  | 'volley'
  | 'smash'
  | 'serve'
  | 'return'
  | 'drop_shot'
  | 'lob'
  | 'passing';
export type Spin = 'topspin' | 'slice' | 'flat';
export type CourtPosition = 'baseline' | 'midcourt' | 'net';
export type EndZone =
  | 'left_deep'
  | 'center_deep'
  | 'right_deep'
  | 'left_short'
  | 'center_short'
  | 'right_short'
  | 'net'
  | 'out_long'
  | 'out_wide';
export type RallyLength = '1-4' | '5-8' | '9+';

export interface PointDetails {
  /** false si la 1re balle est faute (le point se joue sur 2e balle). */
  firstServeIn?: boolean;
  serveOutcome?: ServeOutcome;
  lets?: number;
  serveZone?: ServeZone;
  ending?: PointEnding;
  /** Coup qui termine le point (coup gagnant ou faute). */
  shot?: Shot;
  spin?: Spin;
  position?: CourtPosition;
  netApproach?: boolean;
  endZone?: EndZone;
  rally?: RallyLength;
  note?: string;
}

// ---- Événements (le match est stocké comme une liste d'événements) ----

export interface PointEvent {
  kind: 'point';
  winner: Side;
  /** Horodatage automatique (ms). */
  ts: number;
  details?: PointDetails;
}

export type IncidentType =
  | 'warning'
  | 'point_penalty'
  | 'game_penalty'
  | 'medical_timeout'
  | 'interruption'
  | 'resumption'
  | 'retirement'
  | 'walkover';

export interface IncidentEvent {
  kind: 'incident';
  type: IncidentType;
  /** Joueur concerné (sanctionné, qui abandonne…). */
  player?: Side;
  ts: number;
  note?: string;
}

/** Thèmes proposés pour les notes du coach. */
export type NoteTag =
  | 'positive'
  | 'negative'
  | 'frustration'
  | 'concentration'
  | 'tactic'
  | 'physical'
  | 'technique';

/** Note du coach sur un point ou un moment du match (sans effet sur le score). */
export interface NoteEvent {
  kind: 'note';
  ts: number;
  text: string;
  tags?: NoteTag[];
  /** Joueur concerné ; absent = le match en général. */
  player?: Side;
}

export type MatchEvent = PointEvent | IncidentEvent | NoteEvent;
