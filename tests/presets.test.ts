import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESETS, defaultPresets, move, newPresets } from '../src/lib/presets';
import { NOTE_TAGS } from '../src/lib/labels';

describe('notes pré-enregistrées', () => {
  it('liste de départ ordonnée, avec des thèmes valides', () => {
    const list = defaultPresets();
    expect(list).toHaveLength(DEFAULT_PRESETS.length);
    expect(list.map((p) => p.order)).toEqual(list.map((_, i) => i));
    for (const p of list) for (const t of p.tags) expect(t in NOTE_TAGS).toBe(true);
  });

  it('import : seules les notes nouvelles sont ajoutées (casse et espaces ignorés)', () => {
    const existing = [{ text: 'Joue trop court' }];
    const incoming = [
      { text: 'joue  trop court', tags: [] },
      { text: 'Fatigue visible', tags: ['physical' as const] },
      { text: 'FATIGUE visible', tags: [] },
    ];
    expect(newPresets(existing, incoming)).toEqual([{ text: 'Fatigue visible', tags: ['physical'] }]);
  });

  it('déplacement dans la liste', () => {
    expect(move(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(move(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(move(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(move(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });
});
