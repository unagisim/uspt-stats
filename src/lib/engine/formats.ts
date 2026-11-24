import type { FormatId, MatchFormat } from './types';

const base = {
  setsToWin: 2,
  gamesPerSet: 6,
  tiebreakAt: 6,
  tiebreakPoints: 7,
  superTiebreakPoints: 10,
};

export const FORMATS: Record<FormatId, MatchFormat> = {
  FFT1: {
    ...base,
    id: 'FFT1',
    label: 'Format 1',
    description: '3 sets à 6 jeux, jeu décisif à 6/6 dans tous les sets',
    finalSetSuperTiebreak: false,
    decidingPoint: false,
  },
  FFT2: {
    ...base,
    id: 'FFT2',
    label: 'Format 2',
    description: '2 sets à 6 jeux, jeu décisif à 6/6, super jeu décisif (10 points) au 3e set',
    finalSetSuperTiebreak: true,
    decidingPoint: false,
  },
  FFT3: {
    ...base,
    id: 'FFT3',
    label: 'Format 3',
    description:
      '2 sets à 6 jeux, point décisif, jeu décisif à 6/6, super jeu décisif (10 points) au 3e set',
    finalSetSuperTiebreak: true,
    decidingPoint: true,
  },
};
