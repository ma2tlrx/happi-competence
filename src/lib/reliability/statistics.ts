/**
 * Fidélité inter-observateurs — statistiques pures, sans accès à la base.
 *
 * Données : des paires (cotation officielle, seconde cotation) portant sur la même compétence,
 * le même participant et la même séance, sur l'échelle d'une même version de référentiel.
 * Les paires où l'un des deux observateurs a indiqué « non observé » ne sont jamais converties
 * en zéro : elles sortent du calcul et sont comptées à part (désaccord sur l'observabilité).
 *
 * Statistiques (références dans docs/fiabilite.md) :
 *   • accord exact et accord adjacent (au plus un cran d'écart sur l'échelle), avec intervalle
 *     de confiance à 95 % de Wilson (1927) ;
 *   • kappa de Cohen pondéré, poids quadratiques (Cohen 1968), calculé sur toutes les catégories
 *     de l'échelle, avec l'erreur type asymptotique de Fleiss, Cohen et Everitt (1969) ;
 *   • coefficient de corrélation intra-classe CCI(1,1), modèle à un facteur aléatoire (Shrout et
 *     Fleiss 1979, McGraw et Wong 1996), adapté au cas où les paires d'observateurs changent d'un
 *     participant à l'autre, avec son intervalle fondé sur la loi de Fisher.
 * Les intervalles supposent des paires indépendantes : plusieurs compétences d'un même participant
 * ne le sont pas tout à fait, l'incertitude réelle est donc plus grande (limite documentée).
 */
import { scaleValues } from '@/lib/evaluation-engine';

export type Scale = { min: number; max: number; step: number };
export type Interval = [number, number];

/** Seuil par défaut : au moins 30 paires (Koo et Li 2016, règle pratique pour une étude de fidélité). */
export const DEFAULT_MIN_PAIRS = 30;
export const MIN_PAIRS_BOUNDS = { min: 10, max: 1000 } as const;
const Z_95 = 1.959963984540054;

// ── Échelle ─────────────────────────────────────────────────────────────────
export function scaleCategories(scale: Scale): number[] {
  return scaleValues({ scaleMin: scale.min, scaleMax: scale.max, scaleStep: scale.step });
}

/** Rang d'une note sur l'échelle (0 = minimum), ou null si elle n'en fait pas partie. */
export function categoryIndex(scale: Scale, value: number): number | null {
  const step = scale.step > 0 ? scale.step : 1;
  const index = Math.round((value - scale.min) / step);
  const count = scaleCategories(scale).length;
  if (index < 0 || index >= count) return null;
  return Math.abs(scale.min + index * step - value) < 1e-6 ? index : null;
}

// ── Proportions ─────────────────────────────────────────────────────────────
export type Proportion = { count: number; n: number; rate: number | null; ci: Interval | null };

/** Intervalle de score de Wilson (95 %) : reste dans [0, 1] et se comporte bien pour les petits effectifs. */
export function wilsonInterval(count: number, n: number, z = Z_95): Interval | null {
  if (n <= 0) return null;
  const p = count / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

export function proportion(count: number, n: number): Proportion {
  return { count, n, rate: n > 0 ? count / n : null, ci: wilsonInterval(count, n) };
}

// ── Kappa pondéré ───────────────────────────────────────────────────────────
export type KappaResult = {
  value: number | null;
  se: number | null;
  ci: Interval | null;
  /** Pourquoi la valeur n'est pas calculable (aucune paire, ou une seule catégorie utilisée par les deux). */
  undefinedReason: 'no_pairs' | 'no_variability' | null;
};

/** Poids d'accord quadratiques : 1 sur la diagonale, 0 aux extrémités opposées de l'échelle. */
export function quadraticWeights(k: number): number[][] {
  return Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => (k <= 1 ? 1 : 1 - ((i - j) * (i - j)) / ((k - 1) * (k - 1)))));
}

/**
 * Kappa de Cohen pondéré à partir d'une table de contingence (lignes : observateur A, colonnes : B).
 * Erreur type « non nulle » de Fleiss, Cohen et Everitt (1969), utilisée pour l'intervalle à 95 %.
 */
export function weightedKappa(table: number[][], weights: number[][]): KappaResult {
  const k = table.length;
  const n = table.reduce((sum, row) => sum + row.reduce((s, v) => s + v, 0), 0);
  if (n === 0) return { value: null, se: null, ci: null, undefinedReason: 'no_pairs' };
  const p = table.map((row) => row.map((v) => v / n));
  const rows = p.map((row) => row.reduce((s, v) => s + v, 0));
  const cols = Array.from({ length: k }, (_, j) => p.reduce((s, row) => s + row[j]!, 0));
  let po = 0;
  let pe = 0;
  for (let i = 0; i < k; i += 1) {
    for (let j = 0; j < k; j += 1) {
      po += weights[i]![j]! * p[i]![j]!;
      pe += weights[i]![j]! * rows[i]! * cols[j]!;
    }
  }
  if (1 - pe < 1e-12) return { value: null, se: null, ci: null, undefinedReason: 'no_variability' };
  const kappa = (po - pe) / (1 - pe);
  const rowMean = Array.from({ length: k }, (_, i) => cols.reduce((s, c, j) => s + c * weights[i]![j]!, 0));
  const colMean = Array.from({ length: k }, (_, j) => rows.reduce((s, r, i) => s + r * weights[i]![j]!, 0));
  let sum = 0;
  for (let i = 0; i < k; i += 1) {
    for (let j = 0; j < k; j += 1) {
      const term = weights[i]![j]! - (rowMean[i]! + colMean[j]!) * (1 - kappa);
      sum += p[i]![j]! * term * term;
    }
  }
  const variance = (sum - (kappa - pe * (1 - kappa)) ** 2) / (n * (1 - pe) ** 2);
  const se = Math.sqrt(Math.max(0, variance));
  return { value: kappa, se, ci: [Math.max(-1, kappa - Z_95 * se), Math.min(1, kappa + Z_95 * se)], undefinedReason: null };
}

// ── Corrélation intra-classe CCI(1,1) ───────────────────────────────────────
export type IccResult = { value: number | null; ci: Interval | null };

/** CCI(1,1) pour deux cotations par sujet (modèle à un facteur, observateurs différents selon les sujets). */
export function icc1(pairs: { a: number; b: number }[]): IccResult {
  const n = pairs.length;
  const k = 2;
  if (n < 2) return { value: null, ci: null };
  const grand = pairs.reduce((s, pair) => s + pair.a + pair.b, 0) / (n * k);
  let between = 0;
  let within = 0;
  for (const { a, b } of pairs) {
    const mean = (a + b) / 2;
    between += k * (mean - grand) ** 2;
    within += (a - mean) ** 2 + (b - mean) ** 2;
  }
  const msb = between / (n - 1);
  const msw = within / (n * (k - 1));
  if (msb + (k - 1) * msw === 0) return { value: null, ci: null };
  const value = (msb - msw) / (msb + (k - 1) * msw);
  if (msw === 0) return { value, ci: null };
  const f = msb / msw;
  const df1 = n - 1;
  const df2 = n * (k - 1);
  const fl = f / fQuantile(0.975, df1, df2);
  const fu = f * fQuantile(0.975, df2, df1);
  return { value, ci: [Math.max(-1, (fl - 1) / (fl + k - 1)), Math.min(1, (fu - 1) / (fu + k - 1))] };
}

// Fonction bêta incomplète régularisée (fraction continue de Lentz) et quantile de la loi F par dichotomie.
function logGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let series = 1.000000000190015;
  for (const value of c) series += value / ++y;
  return -tmp + Math.log((2.5066282746310005 * series) / x);
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const tiny = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return h;
}

export function regularizedBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (front * betaContinuedFraction(a, b, x)) / a : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

export function fCdf(value: number, df1: number, df2: number): number {
  if (value <= 0) return 0;
  return regularizedBeta((df1 * value) / (df1 * value + df2), df1 / 2, df2 / 2);
}

export function fQuantile(probability: number, df1: number, df2: number): number {
  let low = 0;
  let high = 1;
  while (fCdf(high, df1, df2) < probability) high *= 2;
  for (let i = 0; i < 200; i += 1) {
    const mid = (low + high) / 2;
    if (fCdf(mid, df1, df2) < probability) low = mid;
    else high = mid;
    if (high - low < 1e-12 * Math.max(1, high)) break;
  }
  return (low + high) / 2;
}

// ── Synthèse d'un ensemble de paires ────────────────────────────────────────
export type ScoredPair = { official: number; second: number };

export type AgreementStats = {
  /** Paires utilisées (les deux observateurs ont coté la compétence, sur l'échelle). */
  n: number;
  exact: Proportion;
  adjacent: Proportion;
  kappa: KappaResult;
  icc: IccResult;
  /** Écart moyen seconde − officielle, en crans d'échelle (tendance d'un observateur à coter plus haut ou plus bas). */
  meanDifference: number | null;
  /** n atteint le minimum fixé par l'administrateur : en dessous, « effectif insuffisant pour conclure ». */
  sufficient: boolean;
  minPairs: number;
};

export function agreementStats(scale: Scale, pairs: ScoredPair[], minPairs = DEFAULT_MIN_PAIRS): AgreementStats {
  const k = scaleCategories(scale).length;
  const table = Array.from({ length: k }, () => Array<number>(k).fill(0));
  const ranks: { a: number; b: number }[] = [];
  for (const pair of pairs) {
    const a = categoryIndex(scale, pair.official);
    const b = categoryIndex(scale, pair.second);
    if (a === null || b === null) continue;
    table[a]![b]! += 1;
    ranks.push({ a, b });
  }
  const n = ranks.length;
  const exact = ranks.filter((r) => r.a === r.b).length;
  const adjacent = ranks.filter((r) => Math.abs(r.a - r.b) <= 1).length;
  return {
    n,
    exact: proportion(exact, n),
    adjacent: proportion(adjacent, n),
    kappa: weightedKappa(table, quadraticWeights(k)),
    icc: icc1(ranks),
    meanDifference: n > 0 ? ranks.reduce((s, r) => s + (r.b - r.a), 0) / n : null,
    sufficient: n >= minPairs,
    minPairs,
  };
}

/** Borne le seuil saisi par l'administrateur. */
export function normalizeMinPairs(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return DEFAULT_MIN_PAIRS;
  return Math.min(MIN_PAIRS_BOUNDS.max, Math.max(MIN_PAIRS_BOUNDS.min, Math.round(number)));
}
