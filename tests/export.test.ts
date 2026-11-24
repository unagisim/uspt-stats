import { describe, expect, it } from 'vitest';
import type { StoredMatch } from '../src/lib/db';
import type { MatchEvent, Side } from '../src/lib/engine';
import { csvCell, pointsCsv, statsCsv } from '../src/lib/export/csv';
import { matchInfo } from '../src/lib/export/meta';

const ts0 = new Date(2026, 10, 23, 14, 30, 0).getTime();
const pts = (seq: string): MatchEvent[] =>
  [...seq].map((c, i) => ({ kind: 'point' as const, winner: c as Side, ts: ts0 + i * 30_000 }));

const match = (events: MatchEvent[]): StoredMatch => ({
  id: 'm1',
  createdAt: ts0,
  updatedAt: ts0,
  formatId: 'FFT2',
  firstServer: 'A',
  letEnabled: false,
  inputMode: 'quick',
  players: { A: { id: 1, prenom: 'Léo', nom: 'Martin' }, B: { id: 2, prenom: 'Hugo', nom: 'Durand' } },
  context: { tournoi: 'Open du club', surface: 'terre' },
  events,
  status: 'in_progress',
  winner: null,
});

const lines = (csv: string) => csv.replace(/^﻿/, '').trimEnd().split('\r\n');

describe('cellules CSV', () => {
  it('protège les points-virgules, guillemets et retours à la ligne', () => {
    expect(csvCell('simple')).toBe('simple');
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('dit "ok"')).toBe('"dit ""ok"""');
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"');
    expect(csvCell(undefined)).toBe('');
  });
});

describe('CSV des points', () => {
  const events: MatchEvent[] = [
    { kind: 'point', winner: 'A', ts: ts0, details: { serveOutcome: 'ace' } },
    ...pts('ABB'),
    { kind: 'point', winner: 'B', ts: ts0 + 200_000, details: { note: 'revers; long' } },
  ];
  const csv = pointsCsv(match(events));
  const rows = lines(csv);

  it('commence par le BOM et un en-tête', () => {
    expect(csv.startsWith('﻿')).toBe(true);
    expect(rows[0].split(';').slice(0, 9)).toEqual([
      'N°', 'Heure', 'Set', 'Jeu', 'Jeux avant', 'Score avant', 'Jeu décisif', 'Serveur', 'Gagnant',
    ]);
  });

  it('une ligne par point, avec libellés français', () => {
    expect(rows).toHaveLength(6);
    expect(rows[1].split(';').slice(0, 9)).toEqual(['1', '14:30:00', '1', '1', '0-0', '0-0', '', 'L. Martin', 'L. Martin']);
    expect(rows[1]).toContain(';Ace;');
    expect(rows[5]).toContain('"revers; long"');
  });

  it('score avant le point', () => {
    expect(rows[4].split(';')[5]).toBe('30-15');
  });
});

describe('CSV des stats', () => {
  it('match puis un bloc par set', () => {
    const rows = lines(statsCsv(match(pts('A'.repeat(24) + 'BBBB'))));
    expect(rows[0]).toBe('Match;Léo Martin contre Hugo Durand');
    // Horaires : 24 points toutes les 30 s depuis 14:30 → set 1 terminé à 14:41:30.
    expect(rows.slice(4, 8)).toEqual(['Début;14:30', 'Fin;en cours', 'Durée du set 1;12 min', 'Durée du set 2;en cours']);
    expect(rows[9]).toBe('Périmètre;Rubrique;Statistique;Léo Martin;Hugo Durand');
    expect(rows).toContain('Match;Résumé;Points gagnés;24;4');
    expect(rows).toContain('Set 2;Résumé;Points gagnés;0;4');
  });
});

describe('notes du coach dans les exports', () => {
  it('moment, joueur, thèmes, commentaire et dernier point', () => {
    const events: MatchEvent[] = [
      ...pts('AAB'),
      { kind: 'note', ts: ts0, text: 'Baisse la tête', tags: ['negative', 'concentration'], player: 'A' },
      { kind: 'note', ts: ts0, text: 'Vent fort', tags: [] },
    ];
    const rows = lines(statsCsv(match(events)));
    const i = rows.indexOf('Notes du coach');
    expect(i).toBeGreaterThan(0);
    expect(rows[i + 1]).toBe('Moment;Joueur;Thèmes;Commentaire;Dernier point');
    expect(rows[i + 2]).toBe('Set 1 · 0-0 · 30-15;L. Martin;Attitude négative, Déconcentration;Baisse la tête;Point H. Durand');
    expect(rows[i + 3]).toBe('Set 1 · 0-0 · 30-15;Match;;Vent fort;Point H. Durand');
  });
});

describe('informations du match', () => {
  it('titre, détails, score et nom de fichier', () => {
    const info = matchInfo(match(pts('A'.repeat(24))));
    expect(info.title).toBe('Léo Martin contre Hugo Durand');
    expect(info.date).toBe('23/11/2026');
    expect(info.details[0]).toBe('Open du club');
    expect(info.details[1]).toBe('Terre battue');
    expect(info.score).toBe('6-0');
    expect(info.result).toBe('Match en cours');
    expect(info.fileBase).toBe('match_Martin-Durand_2026-11-23');
  });
});
