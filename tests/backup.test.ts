import { describe, expect, it } from 'vitest';
import { backupFileName, isValidMatch, makeBackup, parseBackup, planImport } from '../src/lib/backup';
import type { StoredMatch } from '../src/lib/db';

const match = (id: string, updatedAt = 100): StoredMatch => ({
  id,
  createdAt: 1,
  updatedAt,
  formatId: 'FFT2',
  firstServer: 'A',
  letEnabled: false,
  inputMode: 'standard',
  players: { A: { id: 1, prenom: 'Léo', nom: 'Martin' }, B: { id: 2, prenom: 'Hugo', nom: 'Durand' } },
  context: {},
  events: [
    { kind: 'point', winner: 'A', ts: 5 },
    { kind: 'incident', type: 'warning', player: 'B', ts: 6 },
    { kind: 'note', text: 'Bien', ts: 7 },
  ],
  status: 'in_progress',
  winner: null,
});

describe('sauvegarde', () => {
  it('aller-retour export / import', () => {
    const b = makeBackup([{ id: 1, prenom: 'Léo', nom: 'Martin' }], [match('m1')], 42);
    const parsed = parseBackup(JSON.stringify(b));
    expect(parsed.invalid).toBe(0);
    expect(parsed.matches).toEqual([match('m1')]);
  });

  it('refuse un fichier illisible, étranger ou trop récent', () => {
    expect(() => parseBackup('pas du json')).toThrow(/pas lisible/);
    expect(() => parseBackup(JSON.stringify({ app: 'autre', matches: [] }))).toThrow(/pas une sauvegarde USPT Stats/);
    expect(() => parseBackup(JSON.stringify({ app: 'uspt-stats', version: 99, matches: [] }))).toThrow(/plus récente/);
  });

  it('ignore les matchs mal formés et compte les rejets', () => {
    const bad = { ...match('m2'), formatId: 'FFT9' };
    const badEvent = { ...match('m3'), events: [{ kind: 'point', winner: 'C', ts: 1 }] };
    const parsed = parseBackup(JSON.stringify({ app: 'uspt-stats', version: 1, matches: [match('m1'), bad, badEvent, null] }));
    expect(parsed.matches.map((m) => m.id)).toEqual(['m1']);
    expect(parsed.invalid).toBe(3);
  });

  it('complète les champs facultatifs absents des anciennes sauvegardes', () => {
    const old = { ...match('m1') } as Partial<StoredMatch>;
    delete old.inputMode;
    delete old.context;
    const parsed = parseBackup(JSON.stringify({ app: 'uspt-stats', version: 1, matches: [old] }));
    expect(parsed.matches[0].inputMode).toBe('quick');
    expect(parsed.matches[0].context).toEqual({});
  });

  it('validation d’un match', () => {
    expect(isValidMatch(match('m1'))).toBe(true);
    expect(isValidMatch({ ...match('m1'), id: '' })).toBe(false);
    expect(isValidMatch({ ...match('m1'), players: { A: { nom: 'X' } } })).toBe(false);
  });

  it('fusion : ajout, mise à jour si plus récent, sinon inchangé', () => {
    const existing = [match('m1', 100), match('m2', 100)];
    const incoming = [match('m1', 200), match('m2', 50), match('m3', 10)];
    const plan = planImport(existing, incoming);
    expect(plan.add.map((m) => m.id)).toEqual(['m3']);
    expect(plan.update.map((m) => m.id)).toEqual(['m1']);
    expect(plan.unchanged).toBe(1);
  });

  it('nom du fichier', () => {
    expect(backupFileName(new Date(2026, 10, 24, 9).getTime())).toBe('uspt-stats_sauvegarde_2026-11-24.json');
  });
});
