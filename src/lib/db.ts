// Stockage local (IndexedDB via Dexie). Un match est stocké avec sa liste d'événements ;
// le score est toujours recalculé par le moteur.

import Dexie, { type EntityTable } from 'dexie';
import { FORMATS, type FormatId, type MatchConfig, type MatchEvent, type Side } from './engine';
import { fullName, splitName } from './names';

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

  constructor() {
    super('uspt-stats');
    this.version(1).stores({
      players: '++id, nom, prenom',
      matches: 'id, updatedAt, status',
    });
  }
}

export const db = new AppDB();

export const configOf = (m: StoredMatch): MatchConfig => ({
  format: FORMATS[m.formatId],
  firstServer: m.firstServer,
  letEnabled: m.letEnabled,
});

export { fullName, shortName, splitName } from './names';

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
