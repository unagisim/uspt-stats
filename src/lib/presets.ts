// Notes pré-enregistrées du coach : liste de départ et fusion (sans dépendance à la base).

import type { NoteTag } from './engine';
import { NOTE_TAGS } from './labels';

export interface NotePreset {
  id?: number;
  text: string;
  tags: NoteTag[];
  /** Position dans la liste (croissante). */
  order: number;
}

/** Liste proposée au premier lancement ; le coach peut la modifier entièrement. */
export const DEFAULT_PRESETS: Omit<NotePreset, 'id' | 'order'>[] = [
  { text: 'Baisse la tête après une faute', tags: ['negative'] },
  { text: "S'énerve, parle seul", tags: ['frustration'] },
  { text: 'Geste d’humeur (raquette, balle)', tags: ['frustration', 'negative'] },
  { text: 'Bonne réaction après un point perdu', tags: ['positive'] },
  { text: 'Se motive, encourage-toi', tags: ['positive'] },
  { text: 'Perd le fil, déconcentré', tags: ['concentration'] },
  { text: 'Routine entre les points respectée', tags: ['concentration', 'positive'] },
  { text: 'Joue trop court', tags: ['tactic'] },
  { text: 'Bonne prise de filet', tags: ['tactic', 'positive'] },
  { text: 'Ne varie pas le jeu', tags: ['tactic'] },
  { text: 'Pieds lourds, placement en retard', tags: ['physical'] },
  { text: 'Fatigue visible', tags: ['physical'] },
  { text: 'Lancer de balle irrégulier', tags: ['technique'] },
];

export const defaultPresets = (): NotePreset[] =>
  DEFAULT_PRESETS.map((p, i) => ({ text: p.text, tags: [...p.tags], order: i }));

const key = (text: string) => text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr');

const isTag = (t: unknown): t is NoteTag => typeof t === 'string' && t in NOTE_TAGS;

/** Nettoie une note pré-enregistrée lue depuis un fichier ; null si inutilisable. */
export function sanitizePreset(v: unknown): Omit<NotePreset, 'id' | 'order'> | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.text !== 'string' || !o.text.trim()) return null;
  const tags = Array.isArray(o.tags) ? [...new Set(o.tags.filter(isTag))] : [];
  return { text: o.text.trim(), tags };
}

/** Notes importées absentes de la liste actuelle (comparaison du texte, sans la casse). */
export function newPresets(
  existing: readonly Pick<NotePreset, 'text'>[],
  incoming: readonly Omit<NotePreset, 'id' | 'order'>[],
): Omit<NotePreset, 'id' | 'order'>[] {
  const seen = new Set(existing.map((p) => key(p.text)));
  const out: Omit<NotePreset, 'id' | 'order'>[] = [];
  for (const p of incoming) {
    const k = key(p.text);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

/** Échange la position de la note d'index `i` avec sa voisine (-1 = monter, +1 = descendre). */
export function move<T>(list: readonly T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return [...list];
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
