/**
 * Observatoire — statistiques descriptives et règles de masquage. Module pur.
 *
 * Unité : une personne. Une personne sans observation d'une compétence n'entre pas dans le calcul
 * de cette compétence (manquant ≠ zéro). Toute case de moins de MIN_PERSONS personnes est masquée :
 * elle ne transporte alors ni effectif ni valeur, ni à l'écran ni dans l'export.
 */
import { levelFor, type ScaleLevel } from '@/lib/evaluation-engine';

import { MIN_PERSONS } from './axes';

const round2 = (value: number) => Math.round(value * 100) / 100;

export type Described = { n: number; mean: number; sd: number | null; margin: number | null };

/** Moyenne, écart-type (estimateur sans biais, n − 1) et marge à 95 % (± 1,96 × écart-type / √n, à partir de 5). */
export function describeValues(values: readonly number[]): Described | null {
  const n = values.length;
  if (n === 0) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const sd = n > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)) : null;
  return { n, mean, sd, margin: n >= MIN_PERSONS && sd !== null ? (1.96 * sd) / Math.sqrt(n) : null };
}

/** Effectifs par niveau de l'échelle (ordre croissant des niveaux), selon le niveau atteint (levelFor). */
export function levelCounts(values: readonly number[], levels: readonly ScaleLevel[]): number[] {
  const ordered = [...levels].sort((a, b) => a.value - b.value);
  const counts = ordered.map(() => 0);
  for (const value of values) {
    const level = levelFor(value, ordered);
    const index = level ? ordered.findIndex((item) => item.value === level.value) : -1;
    if (index >= 0) counts[index]! += 1;
  }
  return counts;
}

export type CellView = { state: 'none' } | { state: 'hidden' } | { state: 'shown'; n: number; mean: number; margin: number; distribution: number[] };

/** Case « compétence × groupe de personnes » : une valeur par personne observée. */
export function cellView(values: readonly number[], levels: readonly ScaleLevel[]): CellView {
  if (values.length === 0) return { state: 'none' };
  if (values.length < MIN_PERSONS) return { state: 'hidden' };
  const described = describeValues(values)!;
  return { state: 'shown', n: described.n, mean: round2(described.mean), margin: round2(described.margin ?? 0), distribution: levelCounts(values, levels) };
}

/**
 * Masquage complémentaire d'une ligne dont les cases forment une partition (les segments d'un axe) :
 * si les cases masquées réunissent de 1 à 4 personnes, on masque aussi la plus petite case visible,
 * jusqu'à ce qu'elles en réunissent au moins 5. Sinon « Ensemble − cases visibles » redonnerait le
 * résultat d'un groupe trop petit. Renvoie, pour chaque case, vrai si elle doit être masquée.
 */
export function suppressSmall(counts: readonly number[], min = MIN_PERSONS): boolean[] {
  const hidden = counts.map((count) => count > 0 && count < min);
  let total = counts.reduce((sum, count, index) => sum + (hidden[index] ? count : 0), 0);
  while (total > 0 && total < min) {
    let pick = -1;
    counts.forEach((count, index) => {
      if (!hidden[index] && count > 0 && (pick < 0 || count < counts[pick]!)) pick = index;
    });
    if (pick < 0) break;
    hidden[pick] = true;
    total += counts[pick]!;
  }
  return hidden;
}

export type ProgressionView =
  | { state: 'none' }
  | { state: 'hidden' }
  | { state: 'shown'; n: number; meanDelta: number; up: number; down: number; stable: number };

/** Écarts « dernière − première observation » des personnes observées au moins deux fois. */
export function progressionView(deltas: readonly number[]): ProgressionView {
  if (deltas.length === 0) return { state: 'none' };
  if (deltas.length < MIN_PERSONS) return { state: 'hidden' };
  return {
    state: 'shown',
    n: deltas.length,
    meanDelta: round2(deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length),
    up: deltas.filter((delta) => delta > 0).length,
    down: deltas.filter((delta) => delta < 0).length,
    stable: deltas.filter((delta) => delta === 0).length,
  };
}

export type SelfGapView =
  | { state: 'not_comparable' }
  | { state: 'none' }
  | { state: 'hidden' }
  | { state: 'shown'; n: number; meanGap: number; higher: number; lower: number; equal: number };

/** Écarts « auto-évaluation initiale − valeur observée » ; positif = la personne se voit plus haut. */
export function selfGapView(gaps: readonly number[], comparable: boolean): SelfGapView {
  if (!comparable) return { state: 'not_comparable' };
  if (gaps.length === 0) return { state: 'none' };
  if (gaps.length < MIN_PERSONS) return { state: 'hidden' };
  return {
    state: 'shown',
    n: gaps.length,
    meanGap: round2(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length),
    higher: gaps.filter((gap) => gap > 0).length,
    lower: gaps.filter((gap) => gap < 0).length,
    equal: gaps.filter((gap) => gap === 0).length,
  };
}
