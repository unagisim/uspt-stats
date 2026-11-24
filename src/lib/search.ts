// Recherche dans la liste des matchs : joueurs, tournoi, lieu, surface, date, format.

import type { StoredMatch } from './db';
import { FORMATS } from './engine';
import { formatDate } from './export/meta';
import { SURFACE_LABELS } from './labels';
import { fullName } from './names';

export type StatusFilter = 'all' | 'in_progress' | 'finished';

export interface MatchFilter {
  text: string;
  status: StatusFilter;
}

/** Minuscules, sans accents. */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('fr');

/** Texte dans lequel la recherche s'effectue pour un match. */
export function searchText(m: StoredMatch): string {
  const c = m.context;
  return normalize(
    [
      fullName(m.players.A),
      fullName(m.players.B),
      c.tournoi,
      c.tour,
      c.lieu,
      c.surface ? SURFACE_LABELS[c.surface] : '',
      formatDate(m.createdAt),
      FORMATS[m.formatId].label,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

/** Garde les matchs qui contiennent tous les mots recherchés et correspondent au statut. */
export function filterMatches(matches: readonly StoredMatch[], f: MatchFilter): StoredMatch[] {
  const words = normalize(f.text).split(/\s+/).filter(Boolean);
  return matches.filter((m) => {
    if (f.status !== 'all' && m.status !== f.status) return false;
    if (!words.length) return true;
    const hay = searchText(m);
    return words.every((w) => hay.includes(w));
  });
}
