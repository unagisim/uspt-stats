import { describe, expect, it } from 'vitest';
import { afterWinner, back, buildDetails, emptyDraft, type Draft } from '../src/lib/pointDraft';

describe('brouillon de point', () => {
  it('étape après le gagnant selon le mode', () => {
    expect(afterWinner('standard')).toBe('ending');
    expect(afterWinner('expert')).toBe('details');
  });

  it('détails : 1re balle, champs vides retirés', () => {
    expect(buildDetails(emptyDraft(), { serveOutcome: 'ace' })).toEqual({ firstServeIn: true, serveOutcome: 'ace' });
    const d: Draft = { step: 'shot', serveNo: 2, lets: 1, winner: 'A', ending: 'winner' };
    expect(buildDetails(d, { serveOutcome: 'in', shot: 'forehand' })).toEqual({
      firstServeIn: false,
      lets: 1,
      ending: 'winner',
      shot: 'forehand',
      serveOutcome: 'in',
    });
  });

  it('montée au filet déduite de la position', () => {
    const d: Draft = { ...emptyDraft(), step: 'details', winner: 'B', position: 'net' };
    expect(buildDetails(d).netApproach).toBe(true);
    expect(buildDetails({ ...d, position: 'baseline' }).netApproach).toBe(false);
  });

  it('retour arrière étape par étape', () => {
    let d: Draft | null = { step: 'shot', serveNo: 2, lets: 1, serveZone: 'T', winner: 'A', ending: 'winner' };
    d = back(d)!;
    expect(d).toMatchObject({ step: 'ending', winner: 'A', ending: undefined });
    d = back(d)!;
    expect(d).toMatchObject({ step: 'winner', winner: undefined });
    d = back(d)!;
    expect(d.step).toBe('serve');
    d = back(d)!;
    expect(d.serveZone).toBeUndefined();
    d = back(d)!;
    expect(d.lets).toBe(0);
    d = back(d)!;
    expect(d.serveNo).toBe(1);
    expect(back(d)).toBeNull();
  });

  it('en mode expert, revenir de la fiche efface les détails mais garde le service', () => {
    const d: Draft = { step: 'details', serveNo: 2, lets: 0, serveZone: 'wide', winner: 'B', shot: 'lob', rally: '9+' };
    expect(back(d)).toEqual({ step: 'winner', serveNo: 2, lets: 0, serveZone: 'wide' });
  });
});
