/**
 * Observatoire — rapport agrégé et masqué. Module pur.
 *
 * Seul ce rapport quitte le serveur (page et export) : il ne contient aucune donnée individuelle,
 * aucun identifiant de personne, et chaque case de moins de 5 personnes y est déjà masquée
 * (masquage simple, puis complémentaire dans les comparaisons). Les constats sont calculés à partir
 * des seules cases affichées : jamais rédigés, jamais tirés d'un groupe trop petit.
 */
import { summarizeProfile, type Observation, type SkillSummary } from '@/lib/evaluation-engine';
import { selfScaleComparable } from '@/lib/evaluation-engine/inputs';
import { NOT_RECORDED } from '@/lib/fse/codes';

import { AXIS_KEYS, AXIS_LABELS, CODED_AXES, isCodedAxis, MIN_PERSONS, NOT_RECORDED_KEY, type AxisKey, type ObservatoryFilters } from './axes';
import type { ObservatoryDataset, ObservatoryFramework, ObservatoryPerson } from './dataset';
import { cellView, progressionView, selfGapView, suppressSmall, type CellView, type ProgressionView, type SelfGapView } from './stats';

export type SessionPoint = { session: number; state: 'none' } | { session: number; state: 'hidden' } | { session: number; state: 'shown'; n: number; mean: number };

export type SkillReport = {
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  overall: CellView;
  progression: ProgressionView;
  selfGap: SelfGapView;
  /** Moyenne des observations de chaque numéro de session (une valeur par personne et par session). */
  sessions: SessionPoint[];
  /** Une case par segment de l'axe de comparaison (même ordre que report.segments). */
  segments: CellView[];
};

export type SegmentView = { key: string; label: string; /** Personnes du segment ; null = moins de 5. */ count: number | null };

export type AxisFacet = { key: AxisKey; label: string; selected: string | null; options: { value: string; label: string; count: number | null }[] };

export type Finding =
  | { kind: 'highest' | 'lowest'; code: string; skill: string; mean: number; n: number }
  | { kind: 'progression'; code: string; skill: string; meanDelta: number; n: number; up: number }
  | { kind: 'self_gap'; code: string; skill: string; meanGap: number; n: number }
  | {
      kind: 'segment_gap';
      code: string;
      skill: string;
      axis: string;
      high: { label: string; mean: number; n: number };
      low: { label: string; mean: number; n: number };
      gap: number;
      /** Les marges d'incertitude des deux segments se recoupent : écart à confirmer. */
      overlap: boolean;
    };

export type ObservatorySummary = {
  persons: number;
  observations: number;
  progression: { state: 'none' | 'hidden' } | { state: 'shown'; pairs: number; persons: number; upShare: number };
  selfGap: { state: 'none' | 'hidden' | 'not_comparable' } | { state: 'shown'; pairs: number; persons: number; meanGap: number };
};

export type ObservatoryReport = {
  frameworks: { code: string; name: string; shortName: string }[];
  framework: { code: string; name: string; shortName: string; versionLabel: string; isProvisional: boolean; scaleMin: number; scaleMax: number; levels: { value: number; label: string }[] } | null;
  filters: ObservatoryFilters;
  /** ok ; empty : personne d'observé ; too_small : moins de 5 personnes ; no_framework : aucun référentiel publié. */
  state: 'ok' | 'empty' | 'too_small' | 'no_framework';
  summary: ObservatorySummary | null;
  axes: AxisFacet[];
  compare: { key: AxisKey; label: string } | null;
  segments: SegmentView[];
  skills: SkillReport[];
  findings: Finding[];
  excludedObservations: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const segmentKey = (value: string | null) => value ?? NOT_RECORDED_KEY;

function valueLabel(dataset: ObservatoryDataset, axis: AxisKey, key: string) {
  if (key === NOT_RECORDED_KEY) return NOT_RECORDED;
  if (isCodedAxis(axis)) return CODED_AXES[axis][key] ?? key;
  return dataset.labels[axis]?.get(key) ?? key;
}

/** Ordre d'affichage des valeurs d'un axe : ordre des codes, années croissantes, sinon alphabétique ; « non renseigné » en dernier. */
function sortKeys(dataset: ObservatoryDataset, axis: AxisKey, keys: Iterable<string>): string[] {
  const codes = isCodedAxis(axis) ? Object.keys(CODED_AXES[axis]) : null;
  return [...new Set(keys)].sort((a, b) => {
    if (a === NOT_RECORDED_KEY || b === NOT_RECORDED_KEY) return a === b ? 0 : a === NOT_RECORDED_KEY ? 1 : -1;
    if (codes) return codes.indexOf(a) - codes.indexOf(b);
    if (axis === 'annee') return a.localeCompare(b);
    return valueLabel(dataset, axis, a).localeCompare(valueLabel(dataset, axis, b), 'fr', { sensitivity: 'base' }) || a.localeCompare(b);
  });
}

const countOrHidden = (count: number) => (count < MIN_PERSONS ? null : count);

type Row = { person: ObservatoryPerson; observations: Observation[]; summaries: Map<string, SkillSummary> };

/** Au-delà, un numéro de session est jugé aberrant et n'est pas tracé (les programmes en comptent 6). */
const MAX_SESSION = 30;

/**
 * Valeurs par compétence et par numéro de session : une par personne (moyenne si une personne a
 * plusieurs notes pour ce numéro). Un seul passage sur les observations.
 */
function valuesBySession(rows: Row[]): Map<string, Map<number, number[]>> {
  const result = new Map<string, Map<number, number[]>>();
  for (const row of rows) {
    const sums = new Map<string, Map<number, { sum: number; count: number }>>();
    for (const observation of row.observations) {
      if (observation.sessionNumber < 1 || observation.sessionNumber > MAX_SESSION) continue;
      const bySession = sums.get(observation.skillCode) ?? new Map<number, { sum: number; count: number }>();
      const current = bySession.get(observation.sessionNumber) ?? { sum: 0, count: 0 };
      bySession.set(observation.sessionNumber, { sum: current.sum + observation.score, count: current.count + 1 });
      sums.set(observation.skillCode, bySession);
    }
    for (const [code, bySession] of sums) {
      const target = result.get(code) ?? new Map<number, number[]>();
      for (const [session, { sum, count }] of bySession) {
        const values = target.get(session);
        if (values) values.push(sum / count);
        else target.set(session, [sum / count]);
      }
      result.set(code, target);
    }
  }
  return result;
}

function sessionPoints(bySession: Map<number, number[]> | undefined, maxSession: number): SessionPoint[] {
  const points: SessionPoint[] = [];
  for (let session = 1; session <= maxSession; session += 1) {
    const values = bySession?.get(session) ?? [];
    if (values.length === 0) points.push({ session, state: 'none' });
    else if (values.length < MIN_PERSONS) points.push({ session, state: 'hidden' });
    else points.push({ session, state: 'shown', n: values.length, mean: round2(values.reduce((sum, value) => sum + value, 0) / values.length) });
  }
  return points;
}

/** Meilleur élément selon un score ; à égalité, le plus grand effectif puis l'ordre du référentiel. */
function best<T>(items: T[], score: (item: T) => number, n: (item: T) => number): T | undefined {
  let chosen: T | undefined;
  for (const item of items) {
    if (chosen === undefined || score(item) > score(chosen) || (score(item) === score(chosen) && n(item) > n(chosen))) chosen = item;
  }
  return chosen;
}

function findingsOf(skills: SkillReport[], segments: SegmentView[], compare: ObservatoryReport['compare']): Finding[] {
  const shown = skills.flatMap((skill) => (skill.overall.state === 'shown' ? [{ skill, cell: skill.overall }] : []));
  const highest = best(shown, (item) => item.cell.mean, (item) => item.cell.n);
  const lowest = best(shown, (item) => -item.cell.mean, (item) => item.cell.n);
  const progressions = skills.flatMap((skill) => (skill.progression.state === 'shown' && skill.progression.meanDelta > 0 ? [{ skill, view: skill.progression }] : []));
  const progression = best(progressions, (item) => item.view.meanDelta, (item) => item.view.n);
  const gaps = skills.flatMap((skill) => (skill.selfGap.state === 'shown' && skill.selfGap.meanGap !== 0 ? [{ skill, view: skill.selfGap }] : []));
  const selfGap = best(gaps, (item) => Math.abs(item.view.meanGap), (item) => item.view.n);

  let segmentGap: Finding | undefined;
  if (compare) {
    const candidates = skills.flatMap((skill) => {
      const cells = skill.segments.flatMap((cell, index) => (cell.state === 'shown' && segments[index]!.key !== NOT_RECORDED_KEY ? [{ cell, label: segments[index]!.label }] : []));
      if (cells.length < 2) return [];
      const high = best(cells, (item) => item.cell.mean, (item) => item.cell.n)!;
      const low = best(cells, (item) => -item.cell.mean, (item) => item.cell.n)!;
      const gap = round2(high.cell.mean - low.cell.mean);
      return gap > 0 ? [{ skill, high, low, gap }] : [];
    });
    const widest = best(candidates, (item) => item.gap, () => 0);
    if (widest) {
      segmentGap = {
        kind: 'segment_gap',
        code: widest.skill.code,
        skill: widest.skill.name,
        axis: compare.label,
        high: { label: widest.high.label, mean: widest.high.cell.mean, n: widest.high.cell.n },
        low: { label: widest.low.label, mean: widest.low.cell.mean, n: widest.low.cell.n },
        gap: widest.gap,
        overlap: widest.high.cell.mean - widest.high.cell.margin <= widest.low.cell.mean + widest.low.cell.margin,
      };
    }
  }

  const findings: (Finding | undefined)[] = [
    segmentGap,
    highest && { kind: 'highest', code: highest.skill.code, skill: highest.skill.name, mean: highest.cell.mean, n: highest.cell.n },
    lowest && lowest.skill !== highest?.skill && lowest.cell.mean < highest!.cell.mean
      ? { kind: 'lowest', code: lowest.skill.code, skill: lowest.skill.name, mean: lowest.cell.mean, n: lowest.cell.n }
      : undefined,
    progression && { kind: 'progression', code: progression.skill.code, skill: progression.skill.name, meanDelta: progression.view.meanDelta, n: progression.view.n, up: progression.view.up },
    selfGap && { kind: 'self_gap', code: selfGap.skill.code, skill: selfGap.skill.name, meanGap: selfGap.view.meanGap, n: selfGap.view.n },
  ];
  return findings.filter((finding): finding is Finding => finding !== undefined).slice(0, 4);
}

export function buildObservatoryReport(dataset: ObservatoryDataset, rawFilters: ObservatoryFilters): ObservatoryReport {
  const framework: ObservatoryFramework | null = dataset.frameworks.find((item) => item.code === rawFilters.framework) ?? dataset.frameworks[0] ?? null;
  const filters: ObservatoryFilters = { ...rawFilters, framework: framework?.code ?? null };
  const compare = filters.compare ? { key: filters.compare, label: AXIS_LABELS[filters.compare] } : null;
  const base: ObservatoryReport = {
    frameworks: dataset.frameworks.map((item) => ({ code: item.code, name: item.name, shortName: item.shortName })),
    framework: framework
      ? {
          code: framework.code,
          name: framework.name,
          shortName: framework.shortName,
          versionLabel: framework.versionLabel,
          isProvisional: framework.isProvisional,
          scaleMin: framework.rules.scaleMin,
          scaleMax: framework.rules.scaleMax,
          levels: framework.levels.map((level) => ({ value: level.value, label: level.label })),
        }
      : null,
    filters,
    state: 'no_framework',
    summary: null,
    axes: [],
    compare,
    segments: [],
    skills: [],
    findings: [],
    excludedObservations: dataset.excludedObservations,
  };
  if (!framework) return base;

  // Population du référentiel : les personnes qui ont au moins une observation validée d'une compétence affichée.
  const codes = framework.skills.map((skill) => skill.code);
  const displayed = new Set(codes);
  const population = dataset.persons.flatMap((person) => {
    const observations = (person.observations.get(framework.code) ?? []).filter((observation) => displayed.has(observation.skillCode));
    return observations.length ? [{ person, observations }] : [];
  });
  const matches = (person: ObservatoryPerson, except?: AxisKey) =>
    AXIS_KEYS.every((key) => key === except || filters.values[key] === undefined || segmentKey(person.axes[key]) === filters.values[key]);

  // Effectifs proposés par chaque filtre, compte tenu des autres filtres.
  const axes: AxisFacet[] = AXIS_KEYS.map((key) => {
    const counts = new Map<string, number>();
    for (const entry of population) if (matches(entry.person, key)) counts.set(segmentKey(entry.person.axes[key]), (counts.get(segmentKey(entry.person.axes[key])) ?? 0) + 1);
    const selected = filters.values[key] ?? null;
    const keys = sortKeys(dataset, key, [...counts.keys(), ...(selected ? [selected] : [])]);
    return { key, label: AXIS_LABELS[key], selected, options: keys.map((value) => ({ value, label: valueLabel(dataset, key, value), count: countOrHidden(counts.get(value) ?? 0) })) };
  });

  const selected = population.filter((entry) => matches(entry.person));
  if (selected.length === 0) return { ...base, state: 'empty', axes };
  if (selected.length < MIN_PERSONS) return { ...base, state: 'too_small', axes };

  const rows: Row[] = selected.map((entry) => ({ ...entry, summaries: summarizeProfile(codes, entry.observations, framework.rules) }));
  const bySession = valuesBySession(rows);
  const maxSession = [...bySession.values()].reduce((max, sessions) => Math.max(max, ...sessions.keys()), 1);

  // Regard sur soi : seulement avec une auto-évaluation terminée sur la même échelle (règle du passeport).
  const hasSelf = (person: ObservatoryPerson) => Boolean(person.self && person.self.values.size > 0);
  const comparableSelf = (person: ObservatoryPerson) => hasSelf(person) && selfScaleComparable(person.self, framework.rules);
  const comparable = !rows.some((row) => hasSelf(row.person)) || rows.some((row) => comparableSelf(row.person));
  const gapsOf = (code: string) =>
    rows.flatMap((row) => {
      const self = comparableSelf(row.person) ? row.person.self!.values.get(code) : undefined;
      const value = row.summaries.get(code)!.value;
      return self === undefined || value === null ? [] : [self - value];
    });
  const valuesOf = (list: Row[], code: string) => list.flatMap((row) => (row.summaries.get(code)!.value === null ? [] : [row.summaries.get(code)!.value as number]));

  // Comparaison : partition des personnes selon l'axe choisi (chaque personne dans un seul segment).
  const grouped = new Map<string, Row[]>();
  if (compare) {
    for (const row of rows) {
      const key = segmentKey(row.person.axes[compare.key]);
      const list = grouped.get(key);
      if (list) list.push(row);
      else grouped.set(key, [row]);
    }
  }
  const segmentKeys = compare ? sortKeys(dataset, compare.key, grouped.keys()) : [];
  const rowsBySegment = segmentKeys.map((key) => grouped.get(key)!);
  const segments: SegmentView[] = segmentKeys.map((key, index) => ({ key, label: valueLabel(dataset, compare!.key, key), count: countOrHidden(rowsBySegment[index]!.length) }));

  const skills: SkillReport[] = framework.skills.map((skill) => {
    const deltas = rows.flatMap((row) => {
      const delta = row.summaries.get(skill.code)!.delta;
      return delta === null ? [] : [delta];
    });
    const segmentValues = rowsBySegment.map((list) => valuesOf(list, skill.code));
    const hidden = suppressSmall(segmentValues.map((values) => values.length));
    return {
      code: skill.code,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      overall: cellView(valuesOf(rows, skill.code), framework.levels),
      progression: progressionView(deltas),
      selfGap: selfGapView(gapsOf(skill.code), comparable),
      sessions: sessionPoints(bySession.get(skill.code), maxSession),
      segments: segmentValues.map((values, index): CellView => (hidden[index] ? { state: 'hidden' } : cellView(values, framework.levels))),
    };
  });

  // Chiffres clés : couples (personne × compétence), affichés seulement si au moins 5 personnes y contribuent.
  const pairs = rows.flatMap((row) => codes.flatMap((code) => (row.summaries.get(code)!.delta === null ? [] : [{ row, up: (row.summaries.get(code)!.delta as number) > 0 }])));
  const progressionPersons = new Set(pairs.map((pair) => pair.row)).size;
  const selfPairs = rows.flatMap((row) =>
    codes.flatMap((code) => {
      const self = comparableSelf(row.person) ? row.person.self!.values.get(code) : undefined;
      const value = row.summaries.get(code)!.value;
      return self === undefined || value === null ? [] : [{ row, gap: self - value }];
    }),
  );
  const selfPersons = new Set(selfPairs.map((pair) => pair.row)).size;
  const summary: ObservatorySummary = {
    persons: rows.length,
    observations: rows.reduce((sum, row) => sum + row.observations.length, 0),
    progression:
      pairs.length === 0
        ? { state: 'none' }
        : progressionPersons < MIN_PERSONS
          ? { state: 'hidden' }
          : { state: 'shown', pairs: pairs.length, persons: progressionPersons, upShare: Math.round((pairs.filter((pair) => pair.up).length / pairs.length) * 1000) / 1000 },
    selfGap: !comparable
      ? { state: 'not_comparable' }
      : selfPairs.length === 0
        ? { state: 'none' }
        : selfPersons < MIN_PERSONS
          ? { state: 'hidden' }
          : { state: 'shown', pairs: selfPairs.length, persons: selfPersons, meanGap: round2(selfPairs.reduce((sum, pair) => sum + pair.gap, 0) / selfPairs.length) },
  };

  return { ...base, state: 'ok', summary, axes, segments, skills, findings: findingsOf(skills, segments, compare) };
}
