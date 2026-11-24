// Stockage local (IndexedDB via Dexie). Un match est stocké avec sa liste d'événements ;
// le score est toujours recalculé par le moteur.

import Dexie, { type EntityTable } from 'dexie';
import { makeBackup, parseBackup, planImport, type Backup } from './backup';
import { FORMATS, replay, type FormatId, type MatchConfig, type MatchEvent, type NoteTag, type Side } from './engine';
import { fullName, splitName } from './names';
import { defaultPresets, newPresets, type NotePreset } from './presets';

export type { NotePreset } from './presets';

export interface Player {
  id?: number;
  prenom: string;
  nom: string;
}

export interface PlayerRef {
  id: number;
  prenom: string;
  nom: string;
}

export type InputMode = 'quick' | 'standard' | 'expert';

export type Surface = 'dur' | 'terre' | 'gazon' | 'moquette' | 'synthetique';

export const SURFACES: Record<Surface, string> = {
  dur: 'Dur',
  terre: 'Terre battue',
  gazon: 'Gazon',
  moquette: 'Moquette',
  synthetique: 'Gazon synthétique',
};

export interface MatchContext {
  tournoi?: string;
  tour?: string;
  lieu?: string;
  surface?: Surface;
  interieur?: boolean;
}

export interface StoredMatch {
  id: string;
  createdAt: number;
  updatedAt: number;
  formatId: FormatId;
  firstServer: Side;
  letEnabled: boolean;
  inputMode: InputMode;
  players: { A: PlayerRef; B: PlayerRef };
  context: MatchContext;
  events: MatchEvent[];
  status: 'in_progress' | 'finished';
  winner: Side | null;
}

class AppDB extends Dexie {
  players!: EntityTable<Player, 'id'>;
  matches!: EntityTable<StoredMatch, 'id'>;
  presets!: EntityTable<NotePreset, 'id'>;

  constructor() {
    super('uspt-stats');
    this.version(1).stores({
      players: '++id, nom, prenom',
      matches: 'id, updatedAt, status',
    });
    // Version 2 : notes pré-enregistrées, avec une liste de départ.
    this.version(2)
      .stores({ presets: '++id, order' })
      .upgrade((tx) => tx.table('presets').bulkAdd(defaultPresets()));
    // Base créée directement en version 2 (premier lancement).
    this.on('populate', (tx) => {
      tx.table('presets').bulkAdd(defaultPresets());
    });
  }
}

export const db = new AppDB();

// ---- Notes pré-enregistrées ----

export const listPresets = () => db.presets.orderBy('order').toArray();

/** Ajoute (sans id) ou met à jour (avec id) une note pré-enregistrée. */
export async function savePreset(p: { id?: number; text: string; tags: NoteTag[] }): Promise<void> {
  const text = p.text.trim();
  // Copie en tableau simple : un tableau réactif de Svelte ne peut pas être stocké dans IndexedDB.
  const tags = [...p.tags];
  if (p.id !== undefined) {
    await db.presets.update(p.id, { text, tags });
    return;
  }
  const last = await db.presets.orderBy('order').last();
  await db.presets.add({ text, tags, order: (last?.order ?? -1) + 1 });
}

export const deletePreset = (id: number) => db.presets.delete(id);

/** Enregistre un nouvel ordre (liste complète, dans l'ordre voulu). */
export async function reorderPresets(list: NotePreset[]): Promise<void> {
  await db.transaction('rw', db.presets, async () => {
    for (const [i, p] of list.entries()) if (p.id !== undefined) await db.presets.update(p.id, { order: i });
  });
}

export const configOf = (m: StoredMatch): MatchConfig => ({
  format: FORMATS[m.formatId],
  firstServer: m.firstServer,
  letEnabled: m.letEnabled,
});

export { fullName, shortName, splitName } from './names';

/** Sauvegarde complète : joueurs, matchs et notes pré-enregistrées de l'appareil. */
export async function exportBackup(): Promise<Backup> {
  return makeBackup(await db.players.toArray(), await db.matches.toArray(), await listPresets());
}

/** Fichier d'un seul match (même format que la sauvegarde, importable de la même façon). */
export async function exportMatch(id: string): Promise<Backup> {
  const m = await db.matches.get(id);
  if (!m) throw new Error('Ce match est introuvable.');
  const players = [m.players.A, m.players.B].map((p) => ({ id: p.id, prenom: p.prenom, nom: p.nom }));
  return makeBackup(players, [m], [], 'match');
}

export interface ImportResult {
  added: number;
  updated: number;
  unchanged: number;
  invalid: number;
  presetsAdded: number;
}

/**
 * Importe une sauvegarde sans rien effacer : les nouveaux matchs sont ajoutés, les matchs
 * déjà présents ne sont remplacés que par une version plus récente. Les joueurs sont
 * rattachés à ceux de l'appareil par leur nom (les identifiants diffèrent d'un appareil à l'autre).
 */
export async function importBackup(text: string): Promise<ImportResult> {
  const { matches, invalid, presets } = parseBackup(text);
  const plan = planImport(await db.matches.toArray(), matches);
  const toWrite = [...plan.add, ...plan.update];
  const presetsToAdd = newPresets(await listPresets(), presets);
  await db.transaction('rw', db.players, db.matches, db.presets, async () => {
    for (const m of toWrite) {
      const A = await findOrCreatePlayer(fullName(m.players.A) || m.players.A.nom);
      const B = await findOrCreatePlayer(fullName(m.players.B) || m.players.B.nom);
      const winner = replay(configOf(m), m.events).state.winner;
      await db.matches.put({ ...m, players: { A, B }, winner, status: winner ? 'finished' : 'in_progress' });
    }
    for (const p of presetsToAdd) await savePreset(p);
  });
  return {
    added: plan.add.length,
    updated: plan.update.length,
    unchanged: plan.unchanged,
    invalid,
    presetsAdded: presetsToAdd.length,
  };
}

/** Supprime définitivement un match de l'appareil. */
export async function deleteMatch(id: string): Promise<void> {
  await db.matches.delete(id);
}

/** Retrouve un joueur par son nom complet (sans tenir compte de la casse) ou le crée. */
export async function findOrCreatePlayer(input: string): Promise<PlayerRef> {
  const wanted = input.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr');
  const all = await db.players.toArray();
  const existing = all.find((p) => fullName(p).toLocaleLowerCase('fr') === wanted);
  if (existing?.id !== undefined) return { id: existing.id, prenom: existing.prenom, nom: existing.nom };
  const p = splitName(input);
  const id = (await db.players.add(p)) as number;
  return { id, ...p };
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
