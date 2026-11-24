import { describe, expect, it } from 'vitest';
import { FORMATS } from '../src/lib/engine';
import { maxSets, parseScore } from '../src/lib/scoreFix';

const f1 = FORMATS.FFT1;
const f2 = FORMATS.FFT2;
const r = (...sets: [number, number][]) => sets.map(([A, B]) => ({ A, B }));

describe('correction du score : lecture et contrôle', () => {
  it('nombre de sets du format', () => {
    expect(maxSets(f1)).toBe(3);
  });

  it('sets terminés puis set en cours', () => {
    expect(parseScore(f1, r([6, 4], [3, 2], [0, 0]))).toEqual({ sets: r([6, 4]), games: { A: 3, B: 2 } });
    expect(parseScore(f1, r([7, 6], [5, 7], [6, 6]))).toEqual({ sets: r([7, 6], [5, 7]), games: { A: 6, B: 6 } });
  });

  it('début de match', () => {
    expect(parseScore(f1, r([0, 0], [0, 0], [0, 0]))).toEqual({ sets: [], games: { A: 0, B: 0 } });
  });

  it('match terminé', () => {
    expect(parseScore(f1, r([6, 3], [6, 4], [0, 0]))).toEqual({ sets: r([6, 3], [6, 4]), games: { A: 0, B: 0 } });
  });

  it('super jeu décisif : 1-0 si terminé, 0-0 sinon', () => {
    expect(parseScore(f2, r([6, 3], [4, 6], [1, 0])).sets).toEqual(r([6, 3], [4, 6], [1, 0]));
    expect(parseScore(f2, r([6, 3], [4, 6], [0, 0]))).toEqual({ sets: r([6, 3], [4, 6]), games: { A: 0, B: 0 } });
    expect(() => parseScore(f2, r([6, 3], [4, 6], [5, 3]))).toThrow(/Super jeu décisif/);
  });

  it('scores impossibles refusés', () => {
    expect(() => parseScore(f1, r([8, 2], [0, 0], [0, 0]))).toThrow(/impossible/);
    expect(() => parseScore(f1, r([7, 3], [0, 0], [0, 0]))).toThrow(/impossible/);
    expect(() => parseScore(f1, r([6, 3.5], [0, 0], [0, 0]))).toThrow(/entiers/);
  });

  it('sets après un set non terminé ou après la fin du match refusés', () => {
    expect(() => parseScore(f1, r([4, 3], [2, 1], [0, 0]))).toThrow(/n'est pas terminé/);
    expect(() => parseScore(f1, r([6, 1], [6, 1], [2, 0]))).toThrow(/déjà gagné/);
  });
});
