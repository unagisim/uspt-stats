// Validation d'un score saisi à la main (panneau « Corriger le score »).

import type { MatchFormat, Pair } from './engine';

export interface ParsedScore {
  sets: Pair[];
  games: Pair;
}

/** Nombre maximal de sets du format (3 pour 2 sets gagnants). */
export const maxSets = (f: MatchFormat) => f.setsToWin * 2 - 1;

/** Le set d'index `i` est-il un super jeu décisif ? */
export const isSuperSet = (f: MatchFormat, i: number) => f.finalSetSuperTiebreak && i === maxSets(f) - 1;

function setDone(g: Pair, superSet: boolean): boolean {
  if (superSet) return g.A + g.B === 1;
  const max = Math.max(g.A, g.B);
  const min = Math.min(g.A, g.B);
  return (max === 6 && min <= 4) || (max === 7 && (min === 5 || min === 6));
}

function setInProgress(g: Pair): boolean {
  const max = Math.max(g.A, g.B);
  const min = Math.min(g.A, g.B);
  return max <= 5 || (max === 6 && min >= 5);
}

/**
 * Lit les jeux saisis set par set. Les sets terminés sont gardés, le premier set non
 * terminé devient le set en cours, les suivants doivent rester à 0-0.
 * Lève une erreur (message en français) si le score est impossible.
 */
export function parseScore(f: MatchFormat, rows: Pair[]): ParsedScore {
  const sets: Pair[] = [];
  let current: { i: number; g: Pair } | null = null;
  const won = { A: 0, B: 0 };
  let finishedAt: number | null = null;

  rows.slice(0, maxSets(f)).forEach((g, i) => {
    const n = i + 1;
    if (!Number.isInteger(g.A) || !Number.isInteger(g.B) || g.A < 0 || g.B < 0) {
      throw new Error(`Set ${n} : saisissez des nombres de jeux entiers.`);
    }
    const empty = g.A === 0 && g.B === 0;
    if (current || finishedAt !== null) {
      if (!empty) {
        throw new Error(
          finishedAt !== null
            ? `Le match est déjà gagné après le set ${finishedAt} : laissez le set ${n} à 0-0.`
            : `Le set ${current!.i + 1} n'est pas terminé : laissez le set ${n} à 0-0.`,
        );
      }
      return;
    }
    const superSet = isSuperSet(f, i);
    if (setDone(g, superSet)) {
      sets.push({ ...g });
      won[g.A > g.B ? 'A' : 'B']++;
      if (won.A >= f.setsToWin || won.B >= f.setsToWin) finishedAt = n;
      return;
    }
    if (superSet) {
      if (!empty) throw new Error('Super jeu décisif : saisissez 1-0 ou 0-1 s’il est terminé, sinon laissez 0-0.');
    } else if (!setInProgress(g)) {
      throw new Error(`Set ${n} : le score ${g.A}-${g.B} est impossible.`);
    }
    current = { i, g: { ...g } };
  });

  return { sets, games: current ? (current as { g: Pair }).g : { A: 0, B: 0 } };
}
