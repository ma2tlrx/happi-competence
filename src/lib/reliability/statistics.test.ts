import { describe, expect, it } from 'vitest';

import { agreementStats, categoryIndex, fCdf, fQuantile, icc1, normalizeMinPairs, proportion, quadraticWeights, weightedKappa, wilsonInterval } from './statistics';

/*
 * Cas de référence vérifiables à la main. Les valeurs à plusieurs décimales (erreurs types,
 * intervalles) ont été recoupées avec statsmodels 0.15 (cohens_kappa, proportion_confint
 * méthode « wilson ») et scipy 1.18 (loi F) : voir docs/fiabilite.md.
 */
const SCALE_1_4 = { min: 1, max: 4, step: 1 };
const OFFICIAL = [1, 1, 2, 2, 3, 3, 4, 4, 2, 3];
const SECOND = [1, 2, 2, 2, 3, 4, 4, 3, 2, 1];
const PAIRS = OFFICIAL.map((official, index) => ({ official, second: SECOND[index]! }));

describe('échelle', () => {
  it('donne le rang d’une note et rejette ce qui n’est pas sur l’échelle', () => {
    expect(categoryIndex(SCALE_1_4, 1)).toBe(0);
    expect(categoryIndex(SCALE_1_4, 4)).toBe(3);
    expect(categoryIndex(SCALE_1_4, 2.5)).toBeNull();
    expect(categoryIndex(SCALE_1_4, 5)).toBeNull();
    expect(categoryIndex({ min: 1, max: 3, step: 0.5 }, 2.5)).toBe(3);
  });
});

describe('proportions et intervalle de Wilson', () => {
  it('6 accords sur 10 : 60 %, IC95 % [0,3127 ; 0,8318]', () => {
    const result = proportion(6, 10);
    expect(result.rate).toBe(0.6);
    expect(result.ci![0]).toBeCloseTo(0.312674, 5);
    expect(result.ci![1]).toBeCloseTo(0.831820, 5);
  });

  it('reste dans [0, 1] aux extrêmes et ne calcule rien sans effectif', () => {
    expect(wilsonInterval(10, 10)![1]).toBeCloseTo(1, 12);
    expect(wilsonInterval(0, 10)![0]).toBe(0);
    expect(proportion(0, 0)).toEqual({ count: 0, n: 0, rate: null, ci: null });
  });
});

describe('kappa de Cohen', () => {
  it('deux catégories : poids quadratiques = kappa simple ; table [[20,5],[10,15]] → 0,40', () => {
    // po = 35/50 = 0,70 ; pe = 0,5 × 0,6 + 0,5 × 0,4 = 0,50 ; kappa = (0,70 − 0,50) / 0,50 = 0,40.
    const result = weightedKappa([[20, 5], [10, 15]], quadraticWeights(2));
    expect(result.value).toBeCloseTo(0.4, 10);
    expect(result.se).toBeCloseTo(0.126996, 5);
  });

  it('quadratique sur 1–4 : 2/3 pour le cas de référence', () => {
    // Écarts² observés : 0,1,0,0,0,1,0,1,0,4 → moyenne 0,7. Attendu sous indépendance des marges :
    // E[i²] − 2 E[i] E[j] + E[j²] = 3,3 − 2 × 1,5 × 1,4 + 3,0 = 2,1. Kappa = 1 − 0,7 / 2,1 = 2/3.
    const stats = agreementStats(SCALE_1_4, PAIRS, 30);
    expect(stats.kappa.value).toBeCloseTo(2 / 3, 10);
    expect(stats.kappa.se).toBeCloseTo(0.181481, 5);
    expect(stats.kappa.ci![0]).toBeCloseTo(0.310971, 5);
    expect(stats.kappa.ci![1]).toBe(1); // borne supérieure ramenée à 1
  });

  it('accord parfait : 1 ; une seule catégorie utilisée par les deux : non calculable (jamais 0 ni 1 arbitraire)', () => {
    expect(agreementStats(SCALE_1_4, [{ official: 1, second: 1 }, { official: 3, second: 3 }]).kappa.value).toBeCloseTo(1, 10);
    const flat = agreementStats(SCALE_1_4, [{ official: 2, second: 2 }, { official: 2, second: 2 }]);
    expect(flat.kappa).toMatchObject({ value: null, undefinedReason: 'no_variability' });
    expect(flat.exact.rate).toBe(1);
  });

  it('aucune paire : rien n’est calculé', () => {
    const empty = agreementStats(SCALE_1_4, []);
    expect(empty.n).toBe(0);
    expect(empty.kappa.undefinedReason).toBe('no_pairs');
    expect(empty.exact.rate).toBeNull();
    expect(empty.meanDifference).toBeNull();
  });
});

describe('synthèse d’un ensemble de paires', () => {
  it('accord exact 6/10, adjacent 9/10, écart moyen −0,1 cran', () => {
    const stats = agreementStats(SCALE_1_4, PAIRS, 30);
    expect(stats.n).toBe(10);
    expect(stats.exact).toMatchObject({ count: 6, n: 10, rate: 0.6 });
    expect(stats.adjacent).toMatchObject({ count: 9, n: 10, rate: 0.9 });
    // Écarts seconde − officielle : 0,1,0,0,0,1,0,−1,0,−2 → somme −1.
    expect(stats.meanDifference).toBeCloseTo(-0.1, 10);
  });

  it('signale l’effectif insuffisant sous le seuil fixé', () => {
    expect(agreementStats(SCALE_1_4, PAIRS, 30).sufficient).toBe(false);
    expect(agreementStats(SCALE_1_4, PAIRS, 10).sufficient).toBe(true);
  });

  it('écarte les notes hors échelle au lieu de les arrondir', () => {
    const stats = agreementStats(SCALE_1_4, [...PAIRS, { official: 2.5, second: 2 }]);
    expect(stats.n).toBe(10);
  });

  it('accord adjacent sur une échelle au demi-point : un cran = 0,5', () => {
    const stats = agreementStats({ min: 1, max: 3, step: 0.5 }, [{ official: 2, second: 2.5 }, { official: 2, second: 3 }]);
    expect(stats.adjacent).toMatchObject({ count: 1, n: 2 });
  });
});

describe('corrélation intra-classe CCI(1,1)', () => {
  it('cas de référence : 0,6942, IC95 % [0,1889 ; 0,9129]', () => {
    const ranks = PAIRS.map((pair) => ({ a: pair.official - 1, b: pair.second - 1 }));
    const result = icc1(ranks);
    expect(result.value).toBeCloseTo(0.694175, 5);
    expect(result.ci![0]).toBeCloseTo(0.188946, 4);
    expect(result.ci![1]).toBeCloseTo(0.912887, 4);
  });

  it('loi F : fonction de répartition et quantiles conformes aux tables', () => {
    expect(fCdf(2.5, 3, 7)).toBeCloseTo(0.856491, 5);
    expect(fQuantile(0.975, 9, 10)).toBeCloseTo(3.778963, 4);
    expect(fQuantile(0.975, 10, 9)).toBeCloseTo(3.963865, 4);
  });

  it('accord parfait : pas d’intervalle (variance intra nulle) ; moins de deux paires : rien', () => {
    expect(icc1([{ a: 0, b: 0 }, { a: 2, b: 2 }]).value).toBe(1);
    expect(icc1([{ a: 0, b: 0 }]).value).toBeNull();
  });
});

describe('seuil modifiable', () => {
  it('borne la valeur saisie', () => {
    expect(normalizeMinPairs('45')).toBe(45);
    expect(normalizeMinPairs(3)).toBe(10);
    expect(normalizeMinPairs('abc')).toBe(30);
    expect(normalizeMinPairs(99999)).toBe(1000);
  });
});
