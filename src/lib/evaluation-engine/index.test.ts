import { describe, expect, it } from 'vitest';

import {
  aggregate,
  applyRounding,
  attendanceRate,
  deriveSkillScore,
  highlights,
  levelFor,
  scaleValues,
  summarizeProfile,
  summarizeSkill,
  type FrameworkRules,
  type Observation,
} from './index';

const rules: FrameworkRules = { scaleMin: 1, scaleMax: 5, scaleStep: 1, scoringMode: 'direct', aggregation: 'latest', rounding: 'none' };
const obs = (skillCode: string, score: number, sessionNumber: number, weight = 1): Observation => ({
  skillCode,
  score,
  sessionNumber,
  date: `2026-01-${String(sessionNumber * 7).padStart(2, '0')}`,
  weight,
});

describe('échelle', () => {
  it('liste les valeurs sélectionnables selon le pas', () => {
    expect(scaleValues({ scaleMin: 1, scaleMax: 4, scaleStep: 1 })).toEqual([1, 2, 3, 4]);
    expect(scaleValues({ scaleMin: 1, scaleMax: 3, scaleStep: 0.5 })).toEqual([1, 1.5, 2, 2.5, 3]);
  });

  it('arrondit selon la règle', () => {
    expect(applyRounding(3.26, 'none')).toBe(3.26);
    expect(applyRounding(3.26, 'half')).toBe(3.5);
    expect(applyRounding(3.24, 'half')).toBe(3);
    expect(applyRounding(3.5, 'integer')).toBe(4);
  });

  it('associe une valeur au niveau atteint', () => {
    const levels = [
      { value: 1, label: 'Aptitude' },
      { value: 2, label: 'Acquisition' },
      { value: 3, label: 'Maîtrise' },
      { value: 4, label: 'Excellence' },
    ];
    expect(levelFor(3, levels)?.label).toBe('Maîtrise');
    expect(levelFor(3.7, levels)?.label).toBe('Maîtrise');
    expect(levelFor(4, levels)?.label).toBe('Excellence');
    expect(levelFor(null, levels)).toBeNull();
  });
});

describe('note dérivée des critères', () => {
  it('ne calcule rien en mode direct', () => {
    expect(deriveSkillScore(rules, [{ weight: 1, observed: true }])).toBeNull();
  });

  it('compte les critères observés et borne à l’échelle', () => {
    const counting = { ...rules, scoringMode: 'criteria_count' as const };
    const criteria = (n: number) => Array.from({ length: 5 }, (_, i) => ({ weight: 1, observed: i < n }));
    expect(deriveSkillScore(counting, criteria(3))).toBe(3);
    expect(deriveSkillScore(counting, criteria(5))).toBe(5);
    // Aucun critère observé : la compétence reste « non observée » plutôt que notée au minimum.
    expect(deriveSkillScore(counting, criteria(0))).toBeNull();
    expect(deriveSkillScore({ ...counting, scaleMax: 4 }, criteria(5))).toBe(4);
  });

  it('fait la moyenne pondérée des critères notés', () => {
    const average = { ...rules, scoringMode: 'criteria_average' as const };
    expect(deriveSkillScore(average, [{ weight: 1, score: 4 }, { weight: 1, score: 2 }])).toBe(3);
    expect(deriveSkillScore(average, [{ weight: 3, score: 5 }, { weight: 1, score: 1 }])).toBe(4);
    expect(deriveSkillScore(average, [{ weight: 1, score: null }, { weight: 1 }])).toBeNull();
    expect(deriveSkillScore({ ...average, rounding: 'half' }, [{ weight: 1, score: 4 }, { weight: 1, score: 3 }, { weight: 1, score: 3 }])).toBe(3.5);
  });
});

describe('synthèse entre sessions', () => {
  const series = [obs('cooperation', 2, 1), obs('cooperation', 4, 3), obs('cooperation', 3, 4)];

  it('retient la dernière observation par défaut', () => {
    expect(aggregate(series, { aggregation: 'latest', rounding: 'none' })).toBe(3);
  });

  it('applique la règle active', () => {
    expect(aggregate(series, { aggregation: 'max', rounding: 'none' })).toBe(4);
    expect(aggregate(series, { aggregation: 'mean', rounding: 'none' })).toBe(3);
    expect(aggregate([obs('a', 2, 1, 1), obs('a', 4, 2, 3)], { aggregation: 'weighted_mean', rounding: 'none' })).toBe(3.5);
    expect(aggregate([], { aggregation: 'mean', rounding: 'none' })).toBeNull();
  });

  it('ordonne les observations dans le temps, quel que soit l’ordre d’entrée', () => {
    const summary = summarizeSkill('cooperation', [series[2]!, series[0]!, series[1]!], rules);
    expect(summary.observations.map((o) => o.sessionNumber)).toEqual([1, 3, 4]);
    expect(summary.first).toBe(2);
    expect(summary.last).toBe(3);
    expect(summary.delta).toBe(1);
    expect(summary.trend).toBe('up');
  });

  it('n’invente pas d’évolution avec une seule observation', () => {
    const summary = summarizeSkill('arbitrage', [obs('arbitrage', 3, 2)], rules);
    expect(summary.value).toBe(3);
    expect(summary.delta).toBeNull();
    expect(summary.trend).toBeNull();
  });

  it('couvre toutes les compétences du référentiel, observées ou non', () => {
    const profile = summarizeProfile(['cooperation', 'arbitrage'], series, rules);
    expect(profile.get('cooperation')?.value).toBe(3);
    expect(profile.get('arbitrage')?.value).toBeNull();
    expect(profile.get('arbitrage')?.observations).toEqual([]);
  });
});

describe('points saillants du bilan', () => {
  const profile = (values: Record<string, number[]>) =>
    Object.entries(values).map(([code, scores]) => summarizeSkill(code, scores.map((score, i) => obs(code, score, i + 1)), rules));

  it('ne propose rien tant que trop peu de compétences sont observées', () => {
    const result = highlights(profile({ a: [4], b: [2] }));
    expect(result.insufficient).toBe(true);
    expect(result.strengths).toEqual([]);
    expect(result.toDevelop).toEqual([]);
  });

  it('distingue forces, pistes et progressions', () => {
    const result = highlights(profile({ a: [2, 5], b: [4], c: [3, 4], d: [2], e: [1, 2], f: [3] }));
    expect(result.insufficient).toBe(false);
    expect(result.strengths.map((s) => s.skillCode)).toEqual(['a', 'c', 'b']);
    expect(result.toDevelop.map((s) => s.skillCode)).toEqual(['d', 'e', 'f']);
    expect(result.progressions.map((s) => s.skillCode)).toEqual(['a', 'c', 'e']);
  });

  it('ne classe pas en « à développer » une compétence au même niveau que les forces', () => {
    const result = highlights(profile({ a: [4], b: [4], c: [4], d: [4], e: [4] }));
    expect(result.strengths).toHaveLength(3);
    expect(result.toDevelop).toEqual([]);
  });
});

describe('taux de présence', () => {
  it('compte les retards et départs anticipés comme des présences', () => {
    expect(attendanceRate(['present', 'late', 'left_early', 'absent'])).toBe(75);
    expect(attendanceRate(['absent', 'excused'])).toBe(0);
    expect(attendanceRate([])).toBeNull();
  });
});
