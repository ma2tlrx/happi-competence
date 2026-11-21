import { describe, expect, it } from 'vitest';

import { findingParts, formatPoints, formatSigned } from './format';

describe('mise en mots des constats (texte calculé, jamais rédigé)', () => {
  it('écarts signés et accord de « point » (singulier sous 2)', () => {
    expect(formatSigned(0.84)).toBe('+0,8');
    expect(formatSigned(-2)).toBe('-2');
    expect(formatSigned(0)).toBe('0');
    expect(formatPoints(1.78)).toBe('1,8 point');
    expect(formatPoints(-2)).toBe('2 points');
  });

  it('plus haute et plus basse moyenne : « observée », « en moyenne », avec n', () => {
    expect(findingParts({ kind: 'highest', code: 'a', skill: 'Écoute', mean: 3.36, n: 14 }, 5)).toEqual({
      label: 'Plus haute moyenne observée',
      skill: 'Écoute',
      figure: '3,4 / 5',
      detail: 'Moyenne observée, n = 14 personnes.',
    });
    expect(findingParts({ kind: 'lowest', code: 'b', skill: 'Relationnel', mean: 3, n: 7 }, 5).figure).toBe('3 / 5');
  });

  it('progression : un écart entre observations, jamais un « gain de formation »', () => {
    const parts = findingParts({ kind: 'progression', code: 'a', skill: 'Écoute', meanDelta: 1.78, n: 9, up: 6 }, 5);
    expect(parts).toEqual({
      label: 'Plus forte progression',
      skill: 'Écoute',
      figure: '+1,8 pt',
      detail: 'En moyenne, de la première à la dernière observation. 6 en hausse sur 9 personnes.',
    });
    expect(JSON.stringify(parts)).not.toMatch(/gain/i);
  });

  it('regard sur soi : « se voient plus haut / plus bas que ce qui est observé »', () => {
    expect(findingParts({ kind: 'self_gap', code: 'b', skill: 'Relationnel', meanGap: -2, n: 7 }, 5).detail).toBe(
      'Les personnes se voient en moyenne 2 points plus bas que ce qui est observé (n = 7).',
    );
    expect(findingParts({ kind: 'self_gap', code: 'a', skill: 'Écoute', meanGap: 0.5, n: 6 }, 5).detail).toBe(
      'Les personnes se voient en moyenne 0,5 point plus haut que ce qui est observé (n = 6).',
    );
  });

  it('écart entre segments : les deux segments avec leur moyenne et leur n, prudence si les marges se recoupent', () => {
    const finding = {
      kind: 'segment_gap' as const,
      code: 'a',
      skill: 'Écoute',
      axis: 'Tranche d’âge',
      high: { label: '18 à 29 ans', mean: 4, n: 7 },
      low: { label: '30 à 54 ans', mean: 3.25, n: 5 },
      gap: 0.75,
      overlap: true,
    };
    expect(findingParts(finding, 5)).toEqual({
      label: 'Plus grand écart entre segments',
      skill: 'Écoute',
      figure: '0,8 pt',
      detail: 'Observé, en moyenne : « 18 à 29 ans » 4 (n = 7), « 30 à 54 ans » 3,3 (n = 5). Marges qui se recoupent : écart à confirmer.',
    });
    expect(findingParts({ ...finding, overlap: false }, 5).detail).not.toMatch(/confirmer/);
  });
});
