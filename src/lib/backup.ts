// Sauvegarde complète des matchs au format JSON : création, lecture et fusion à l'import.

import type { Player, StoredMatch } from './db';
import { FORMATS } from './engine';
import { sanitizePreset, type NotePreset } from './presets';

export const BACKUP_APP = 'uspt-stats';
export const BACKUP_VERSION = 1;

export type BackupPreset = Omit<NotePreset, 'id' | 'order'>;

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: number;
  /** "all" = sauvegarde complète, "match" = un seul match. */
  scope: 'all' | 'match';
  players: Player[];
  matches: StoredMatch[];
  /** Notes pré-enregistrées (sauvegarde complète uniquement). */
  presets: BackupPreset[];
}

export function makeBackup(
  players: Player[],
  matches: StoredMatch[],
  presets: readonly NotePreset[] = [],
  scope: Backup['scope'] = 'all',
  now = Date.now(),
): Backup {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now,
    scope,
    players,
    matches,
    presets: presets.map((p) => ({ text: p.text, tags: [...p.tags] })),
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isPlayer = (v: unknown) => isObj(v) && typeof v.nom === 'string' && typeof v.prenom === 'string';
const isEvent = (v: unknown) =>
  isObj(v) &&
  typeof v.ts === 'number' &&
  ((v.kind === 'point' && (v.winner === 'A' || v.winner === 'B')) ||
    (v.kind === 'incident' && typeof v.type === 'string') ||
    (v.kind === 'note' && typeof v.text === 'string'));

/** Vérifie la forme d'un match importé (sans faire confiance au fichier). */
export function isValidMatch(v: unknown): v is StoredMatch {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    v.id.length > 0 &&
    typeof v.createdAt === 'number' &&
    typeof v.updatedAt === 'number' &&
    typeof v.formatId === 'string' &&
    v.formatId in FORMATS &&
    (v.firstServer === 'A' || v.firstServer === 'B') &&
    isObj(v.players) &&
    isPlayer(v.players.A) &&
    isPlayer(v.players.B) &&
    Array.isArray(v.events) &&
    v.events.every(isEvent)
  );
}

export interface ParsedBackup {
  matches: StoredMatch[];
  /** Matchs du fichier ignorés car mal formés. */
  invalid: number;
  presets: BackupPreset[];
}

/** Lit un fichier de sauvegarde. Lève une erreur avec un message en français si le fichier est inutilisable. */
export function parseBackup(text: string): ParsedBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n'est pas lisible : ce n'est pas une sauvegarde JSON.");
  }
  if (!isObj(data) || data.app !== BACKUP_APP || !Array.isArray(data.matches)) {
    throw new Error("Ce fichier n'est pas une sauvegarde USPT Stats.");
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new Error("Cette sauvegarde vient d'une version plus récente de l'application. Mettez-la à jour.");
  }
  const matches = data.matches.filter(isValidMatch).map((m) => ({
    ...m,
    inputMode: m.inputMode ?? 'quick',
    letEnabled: !!m.letEnabled,
    context: isObj(m.context) ? m.context : {},
  }));
  const presets = Array.isArray(data.presets)
    ? data.presets.map(sanitizePreset).filter((p): p is BackupPreset => p !== null)
    : [];
  return { matches, invalid: data.matches.length - matches.length, presets };
}

export interface ImportPlan {
  add: StoredMatch[];
  update: StoredMatch[];
  unchanged: number;
}

/**
 * Fusion : un match absent est ajouté ; un match déjà présent n'est remplacé
 * que si la version importée est plus récente.
 */
export function planImport(existing: readonly StoredMatch[], incoming: readonly StoredMatch[]): ImportPlan {
  const byId = new Map(existing.map((m) => [m.id, m]));
  const plan: ImportPlan = { add: [], update: [], unchanged: 0 };
  for (const m of incoming) {
    const cur = byId.get(m.id);
    if (!cur) plan.add.push(m);
    else if (m.updatedAt > cur.updatedAt) plan.update.push(m);
    else plan.unchanged++;
  }
  return plan;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function backupFileName(now = Date.now()): string {
  const d = new Date(now);
  return `uspt-stats_sauvegarde_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}
