// Saisie d'un point en modes standard et expert : brouillon du point en cours, étape par étape.
//
// Standard : service -> gagnant -> fin du point -> coup (enregistré dès le coup choisi).
// Expert   : service (+ zone) -> gagnant -> fiche détaillée (validée en une fois).

import type {
  CourtPosition,
  EndZone,
  PointDetails,
  PointEnding,
  RallyLength,
  ServeZone,
  Shot,
  Side,
  Spin,
} from './engine';

export type DetailedMode = 'standard' | 'expert';
export type Step = 'serve' | 'winner' | 'ending' | 'shot' | 'details';

export interface Draft {
  step: Step;
  serveNo: 1 | 2;
  lets: number;
  serveZone?: ServeZone;
  winner?: Side;
  ending?: PointEnding;
  shot?: Shot;
  spin?: Spin;
  position?: CourtPosition;
  endZone?: EndZone;
  rally?: RallyLength;
}

export const emptyDraft = (): Draft => ({ step: 'serve', serveNo: 1, lets: 0 });

/** Étape suivant le choix du gagnant. */
export const afterWinner = (mode: DetailedMode): Step => (mode === 'standard' ? 'ending' : 'details');

/**
 * Annule la dernière action du brouillon. Renvoie null si le brouillon est vide :
 * l'annulation porte alors sur le dernier point enregistré.
 */
export function back(d: Draft): Draft | null {
  switch (d.step) {
    case 'shot':
      return { ...d, step: 'ending', ending: undefined, shot: undefined };
    case 'details':
      return { ...emptyDraftKeepServe(d), step: 'winner' };
    case 'ending':
      return { ...d, step: 'winner', winner: undefined, ending: undefined };
    case 'winner':
      return { ...d, step: 'serve' };
    case 'serve':
      if (d.serveZone) return { ...d, serveZone: undefined };
      if (d.lets > 0) return { ...d, lets: d.lets - 1 };
      if (d.serveNo === 2) return { ...d, serveNo: 1 };
      return null;
  }
}

/** Garde les informations de service, efface tout ce qui suit. */
function emptyDraftKeepServe(d: Draft): Draft {
  return { step: d.step, serveNo: d.serveNo, lets: d.lets, serveZone: d.serveZone };
}

/** Détails à enregistrer pour le point, sans les champs vides. */
export function buildDetails(d: Draft, extra: PointDetails = {}): PointDetails {
  const all: PointDetails = {
    firstServeIn: d.serveNo === 1,
    lets: d.lets || undefined,
    serveZone: d.serveZone,
    ending: d.ending,
    shot: d.shot,
    spin: d.spin,
    position: d.position,
    netApproach: d.position ? d.position === 'net' : undefined,
    endZone: d.endZone,
    rally: d.rally,
    ...extra,
  };
  return Object.fromEntries(Object.entries(all).filter(([, v]) => v !== undefined)) as PointDetails;
}
