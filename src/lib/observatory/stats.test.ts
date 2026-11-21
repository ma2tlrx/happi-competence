import { describe, expect, it } from 'vitest';

import { cellView, describeValues, levelCounts, progressionView, selfGapView, suppressSmall } from './stats';

const LEVELS = [1, 2, 3, 4, 5].map((value) => ({ value, label: `Niveau ${value}` }));

describe('statistiques descriptives', () => {
  it('moyenne, écart-type (n − 1) et marge à 95 % : ± 1,96 × écart-type / √n', () => {
    const result = describeValues([3, 4, 5, 4, 4])!;
    expect(result.n).toBe(5);
    expect(result.mean).toBe(4);
    expect(result.sd).toBeCloseTo(Math.sqrt(0.5), 10);
    expect(result.margin).toBeCloseTo((1.96 * Math.sqrt(0.5)) / Math.sqrt(5), 10);
  });

  it('aucune valeur : rien à décrire (jamais une moyenne de zéro)', () => {
    expect(describeValues([])).toBeNull();
  });

  it('pas de marge sous 5 personnes', () => {
    expect(describeValues([2, 4])!.margin).toBeNull();
    expect(describeValues([2, 4, 3, 3])!.margin).toBeNull();
  });

  it('répartit les valeurs par niveau atteint (même règle que le passeport : arrondi à l’inférieur)', () => {
    expect(levelCounts([1, 2.5, 5, 3, 3.9], LEVELS)).toEqual([1, 1, 2, 0, 1]);
    expect(levelCounts([], LEVELS)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('cases masquées sous 5 personnes', () => {
  it('une case sans personne observée est « non observée », de 1 à 4 personnes elle est masquée', () => {
    expect(cellView([], LEVELS)).toEqual({ state: 'none' });
    expect(cellView([3, 4, 4, 5], LEVELS)).toEqual({ state: 'hidden' });
    const shown = cellView([3, 4, 4, 5, 2], LEVELS);
    expect(shown).toMatchObject({ state: 'shown', n: 5, mean: 3.6, distribution: [0, 1, 1, 2, 1] });
  });

  it('une case masquée ne transporte ni effectif ni valeur', () => {
    expect(Object.keys(cellView([1, 1, 1, 1], LEVELS))).toEqual(['state']);
  });

  it('masquage complémentaire : les cases masquées d’une ligne réunissent toujours au moins 5 personnes', () => {
    expect(suppressSmall([10, 3, 8])).toEqual([false, true, true]);
    expect(suppressSmall([10, 3, 2, 8])).toEqual([false, true, true, false]);
    expect(suppressSmall([10, 0, 8])).toEqual([false, false, false]);
    expect(suppressSmall([6, 6, 1])).toEqual([true, false, true]);
    expect(suppressSmall([4])).toEqual([true]);
    expect(suppressSmall([])).toEqual([]);
  });
});

describe('progression et regard sur soi', () => {
  it('progression : écart dernière − première observation, part en hausse, masquée sous 5', () => {
    expect(progressionView([])).toEqual({ state: 'none' });
    expect(progressionView([1, 1, 0, -1])).toEqual({ state: 'hidden' });
    expect(progressionView([1, 1, 0, -1, 2])).toEqual({ state: 'shown', n: 5, meanDelta: 0.6, up: 3, down: 1, stable: 1 });
  });

  it('regard sur soi : auto-évaluation − observé (« plus haut » si positif), masqué sous 5', () => {
    expect(selfGapView([], true)).toEqual({ state: 'none' });
    expect(selfGapView([1, 2], false)).toEqual({ state: 'not_comparable' });
    expect(selfGapView([1, -1, 2], true)).toEqual({ state: 'hidden' });
    expect(selfGapView([1, -1, 2, 0, 1], true)).toEqual({ state: 'shown', n: 5, meanGap: 0.6, higher: 3, lower: 1, equal: 1 });
  });
});
