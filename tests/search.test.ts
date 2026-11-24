import { describe, expect, it } from 'vitest';
import type { StoredMatch } from '../src/lib/db';
import { shortName, splitName } from '../src/lib/names';
import { filterMatches, normalize } from '../src/lib/search';

const ts = new Date(2026, 10, 23, 14, 0).getTime();
const m = (id: string, a: [string, string], b: [string, string], extra: Partial<StoredMatch> = {}): StoredMatch => ({
  id,
  createdAt: ts,
  updatedAt: ts,
  formatId: 'FFT2',
  firstServer: 'A',
  letEnabled: false,
  inputMode: 'quick',
  players: { A: { id: 1, prenom: a[0], nom: a[1] }, B: { id: 2, prenom: b[0], nom: b[1] } },
  context: {},
  events: [],
  status: 'finished',
  winner: null,
  ...extra,
});

const all = [
  m('1', ['Léo', 'Martin'], ['Hugo', 'Durand'], { context: { tournoi: 'Open du club', surface: 'terre' } }),
  m('2', ['Emma', 'Leroy'], ['Clara', 'Petit'], { status: 'in_progress' }),
  m('3', ['Léo', 'Martin'], ['Clara', 'Petit'], { createdAt: new Date(2026, 0, 5).getTime(), context: { lieu: 'Court 3' } }),
];
const ids = (r: StoredMatch[]) => r.map((x) => x.id);

describe('noms', () => {
  it('nom court avec initiale du prénom', () => {
    expect(shortName({ prenom: 'Léo', nom: 'Martin' })).toBe('L. Martin');
    expect(shortName({ prenom: 'élodie', nom: 'Roux' })).toBe('É. Roux');
    expect(shortName({ prenom: '', nom: 'Martin' })).toBe('Martin');
  });

  it('découpage prénom / nom', () => {
    expect(splitName('Léo Martin')).toEqual({ prenom: 'Léo', nom: 'Martin' });
    expect(splitName('  Jean  De La Tour ')).toEqual({ prenom: 'Jean', nom: 'De La Tour' });
    expect(splitName('Martin')).toEqual({ prenom: '', nom: 'Martin' });
  });
});

describe('recherche de matchs', () => {
  it('sans critère, tout est gardé', () => {
    expect(ids(filterMatches(all, { text: '', status: 'all' }))).toEqual(['1', '2', '3']);
  });

  it('par joueur, sans tenir compte des accents ni de la casse', () => {
    expect(ids(filterMatches(all, { text: 'leo', status: 'all' }))).toEqual(['1', '3']);
    expect(ids(filterMatches(all, { text: 'PETIT', status: 'all' }))).toEqual(['2', '3']);
  });

  it('tous les mots doivent correspondre', () => {
    expect(ids(filterMatches(all, { text: 'martin petit', status: 'all' }))).toEqual(['3']);
  });

  it('par tournoi, surface, lieu et date', () => {
    expect(ids(filterMatches(all, { text: 'open', status: 'all' }))).toEqual(['1']);
    expect(ids(filterMatches(all, { text: 'terre battue', status: 'all' }))).toEqual(['1']);
    expect(ids(filterMatches(all, { text: 'court 3', status: 'all' }))).toEqual(['3']);
    expect(ids(filterMatches(all, { text: '01/2026', status: 'all' }))).toEqual(['3']);
  });

  it('par statut', () => {
    expect(ids(filterMatches(all, { text: '', status: 'in_progress' }))).toEqual(['2']);
    expect(ids(filterMatches(all, { text: 'leroy', status: 'finished' }))).toEqual([]);
  });

  it('normalisation', () => {
    expect(normalize('Élodie CRÈME')).toBe('elodie creme');
  });
});
