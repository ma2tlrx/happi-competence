import { describe, expect, it } from 'vitest';

import type { Observation } from '@/lib/evaluation-engine';

import { AXIS_KEYS, NOT_RECORDED_KEY, type AxisKey, type ObservatoryFilters } from './axes';
import type { ObservatoryDataset, ObservatoryFramework, ObservatoryPerson } from './dataset';
import { buildObservatoryReport } from './report';

const LEVELS = [1, 2, 3, 4, 5].map((value) => ({ value, label: `Niveau ${value}` }));
const TRANSVERSAL: ObservatoryFramework = {
  code: 'tr',
  name: 'Compétences transversales',
  shortName: 'Transversales',
  versionLabel: 'Version 1',
  isProvisional: false,
  rules: { scaleMin: 1, scaleMax: 5, scaleStep: 1, scoringMode: 'direct', aggregation: 'latest', rounding: 'none' },
  levels: LEVELS,
  skills: [
    { code: 'a', name: 'Écoute', description: 'Écouter les autres.', category: 'Communication' },
    { code: 'b', name: 'Relationnel', description: null, category: 'Communication' },
    { code: 'c', name: 'Organisation', description: null, category: null },
  ],
};
const SOCIO: ObservatoryFramework = { ...TRANSVERSAL, code: 'soc', name: 'Habiletés', shortName: 'Habiletés', rules: { ...TRANSVERSAL.rules, scaleMax: 4 }, levels: LEVELS.slice(0, 4), skills: [{ code: 'p', name: 'Planification', description: null, category: null }] };

/** Une personne : ses axes, ses notes par compétence (ordre chronologique, une session par note) et son auto-évaluation. */
function person(axes: Partial<Record<AxisKey, string>>, scores: Record<string, number[]>, self?: { values: Record<string, number>; scaleMax?: number }): ObservatoryPerson {
  const observations: Observation[] = Object.entries(scores).flatMap(([skillCode, list]) =>
    list.map((score, index) => ({ skillCode, score, sessionNumber: index + 1, date: `2026-01-0${index + 1}` })),
  );
  return {
    axes: Object.fromEntries(AXIS_KEYS.map((key) => [key, axes[key] ?? null])) as Record<AxisKey, string | null>,
    observations: new Map([['tr', observations]]),
    self: self ? { scaleMin: 1, scaleMax: self.scaleMax ?? 5, values: new Map(Object.entries(self.values)) } : null,
  };
}

const times = (count: number, make: () => ObservatoryPerson) => Array.from({ length: count }, make);

// 7 personnes de l'organisme o1 (18-29 ans, femmes) : Écoute 2 puis 4, Relationnel 3 ; auto-évaluation comparable.
const groupA = () => times(7, () => person({ organisme: 'o1', age: '18_29', genre: 'femme' }, { a: [2, 4], b: [3] }, { values: { a: 5, b: 1 } }));
// 5 personnes de l'organisme o2 (30-54 ans, hommes) : Écoute 3 ; auto-évaluation sur une autre échelle (non comparable).
const groupB = () => times(5, () => person({ organisme: 'o2', age: '30_54', genre: 'homme' }, { a: [3] }, { values: { a: 4 }, scaleMax: 4 }));
// 2 personnes sans organisme ni fiche d'entrée : Écoute 1 puis 2.
const fewUnknown = () => times(2, () => person({ genre: 'homme' }, { a: [1, 2] }));
// 3 autres personnes sans organisme ni fiche : Écoute 3.
const moreUnknown = () => times(3, () => person({ genre: 'femme' }, { a: [3] }));
// 3 personnes observées en Organisation seulement : trop peu pour être affichées.
const organisers = () => times(3, () => person({ organisme: 'o1', age: '18_29', genre: 'femme' }, { c: [5] }));

function dataset(persons: ObservatoryPerson[]): ObservatoryDataset {
  return {
    frameworks: [TRANSVERSAL, SOCIO],
    persons,
    labels: { organisme: new Map([['o1', 'Mission Locale'], ['o2', 'Horizon']]) },
    excludedObservations: 0,
  };
}

const filters = (values: ObservatoryFilters['values'] = {}, compare: AxisKey | null = null): ObservatoryFilters => ({ framework: null, values, compare });
const skill = (report: ReturnType<typeof buildObservatoryReport>, code: string) => report.skills.find((row) => row.code === code)!;

describe('observatoire : vue d’ensemble', () => {
  const report = buildObservatoryReport(dataset([...groupA(), ...groupB(), ...fewUnknown()]), filters());

  it('choisit le premier référentiel et compte les personnes observées', () => {
    expect(report.state).toBe('ok');
    expect(report.framework?.code).toBe('tr');
    expect(report.filters.framework).toBe('tr');
    expect(report.summary).toMatchObject({ persons: 14, observations: 30 });
  });

  it('valeur par personne selon la règle du référentiel, distribution, moyenne et marge (n affiché)', () => {
    // Règle « dernière observation » : Écoute = 4 (×7), 3 (×5), 2 (×2).
    const overall = skill(report, 'a').overall;
    expect(overall).toMatchObject({ state: 'shown', n: 14, mean: 3.36, distribution: [0, 2, 5, 7, 0] });
    if (overall.state === 'shown') expect(overall.margin).toBeGreaterThan(0);
  });

  it('manquant ≠ zéro : seules les personnes observées comptent pour une compétence', () => {
    expect(skill(report, 'b').overall).toMatchObject({ state: 'shown', n: 7, mean: 3, distribution: [0, 0, 7, 0, 0] });
    expect(skill(report, 'c').overall).toEqual({ state: 'none' });
  });

  it('progression : dernière − première observation, pour les personnes observées au moins deux fois', () => {
    expect(skill(report, 'a').progression).toEqual({ state: 'shown', n: 9, meanDelta: 1.78, up: 9, down: 0, stable: 0 });
    expect(skill(report, 'b').progression).toEqual({ state: 'none' });
    expect(report.summary?.progression).toEqual({ state: 'shown', pairs: 9, persons: 9, upShare: 1 });
  });

  it('regard sur soi : seulement avec une échelle comparable (les autres sont écartés)', () => {
    expect(skill(report, 'a').selfGap).toEqual({ state: 'shown', n: 7, meanGap: 1, higher: 7, lower: 0, equal: 0 });
    expect(skill(report, 'b').selfGap).toEqual({ state: 'shown', n: 7, meanGap: -2, higher: 0, lower: 7, equal: 0 });
    expect(report.summary?.selfGap).toEqual({ state: 'shown', pairs: 14, persons: 7, meanGap: -0.5 });
  });

  it('courbe de la moyenne observée par numéro de session, points masqués sous 5 personnes', () => {
    expect(skill(report, 'a').sessions).toEqual([
      { session: 1, state: 'shown', n: 14, mean: 2.21 },
      { session: 2, state: 'shown', n: 9, mean: 3.56 },
    ]);
    const withOrganisers = buildObservatoryReport(dataset([...groupA(), ...groupB(), ...organisers()]), filters());
    expect(skill(withOrganisers, 'c').sessions).toEqual([{ session: 1, state: 'hidden' }, { session: 2, state: 'none' }]);
  });

  it('une compétence observée chez moins de 5 personnes est masquée, sans effectif ni valeur', () => {
    const withOrganisers = buildObservatoryReport(dataset([...groupA(), ...groupB(), ...organisers()]), filters());
    const row = skill(withOrganisers, 'c');
    expect(row.overall).toEqual({ state: 'hidden' });
    expect(row.progression).toEqual({ state: 'none' });
    expect(JSON.stringify(row)).not.toMatch(/"n":[1-4]\b/);
  });

  it('constats calculés : plus haute et plus basse moyenne, plus forte progression, plus grand écart du regard sur soi', () => {
    expect(report.findings).toEqual([
      { kind: 'highest', code: 'a', skill: 'Écoute', mean: 3.36, n: 14 },
      { kind: 'lowest', code: 'b', skill: 'Relationnel', mean: 3, n: 7 },
      { kind: 'progression', code: 'a', skill: 'Écoute', meanDelta: 1.78, n: 9, up: 9 },
      { kind: 'self_gap', code: 'b', skill: 'Relationnel', meanGap: -2, n: 7 },
    ]);
  });

  it('aucune donnée individuelle ni identifiant dans le rapport', () => {
    expect(JSON.stringify(report)).not.toMatch(/participant|firstName|lastName|"id"/i);
  });
});

describe('observatoire : filtres', () => {
  const all = dataset([...groupA(), ...groupB(), ...fewUnknown()]);

  it('filtres combinés (organisme et tranche d’âge)', () => {
    expect(buildObservatoryReport(all, filters({ organisme: 'o1', age: '18_29' })).summary?.persons).toBe(7);
    expect(buildObservatoryReport(all, filters({ organisme: 'o1', age: '30_54' })).state).toBe('empty');
  });

  it('un filtre qui laisse moins de 5 personnes donne un état vide explicite, sans aucun chiffre', () => {
    const report = buildObservatoryReport(all, filters({ organisme: NOT_RECORDED_KEY }));
    expect(report.state).toBe('too_small');
    expect(report.summary).toBeNull();
    expect(report.skills).toEqual([]);
    expect(report.findings).toEqual([]);
  });

  it('« non renseigné » est une catégorie de filtre à part entière', () => {
    const report = buildObservatoryReport(dataset([...groupA(), ...groupB(), ...fewUnknown(), ...moreUnknown()]), filters({ age: NOT_RECORDED_KEY }));
    expect(report.summary?.persons).toBe(5);
  });

  it('auto-évaluations sur une autre échelle : regard sur soi « non comparable »', () => {
    const report = buildObservatoryReport(all, filters({ organisme: 'o2' }));
    expect(skill(report, 'a').selfGap).toEqual({ state: 'not_comparable' });
    expect(report.summary?.selfGap).toEqual({ state: 'not_comparable' });
  });

  it('chaque filtre propose ses valeurs avec leur effectif, « moins de 5 » sous le seuil, « non renseigné » en dernier', () => {
    const report = buildObservatoryReport(all, filters({ organisme: 'o1' }));
    const age = report.axes.find((axis) => axis.key === 'age')!;
    // Les effectifs d'un axe tiennent compte des autres filtres (ici : organisme o1).
    expect(age.options).toEqual([{ value: '18_29', label: '18 à 29 ans', count: 7 }]);
    const organisation = report.axes.find((axis) => axis.key === 'organisme')!;
    expect(organisation.selected).toBe('o1');
    expect(organisation.options).toEqual([
      { value: 'o2', label: 'Horizon', count: 5 },
      { value: 'o1', label: 'Mission Locale', count: 7 },
      { value: NOT_RECORDED_KEY, label: 'Non renseigné', count: null },
    ]);
  });

  it('change de référentiel ; un référentiel inconnu revient au premier', () => {
    expect(buildObservatoryReport(all, { ...filters(), framework: 'soc' }).framework?.code).toBe('soc');
    expect(buildObservatoryReport(all, { ...filters(), framework: 'inconnu' }).framework?.code).toBe('tr');
  });
});

describe('observatoire : comparer par un axe', () => {
  it('segments dans l’ordre des codes, « non renseigné » en dernier, colonne « Ensemble » = vue d’ensemble', () => {
    const report = buildObservatoryReport(dataset([...groupA(), ...groupB(), ...fewUnknown()]), filters({}, 'age'));
    expect(report.compare).toEqual({ key: 'age', label: 'Tranche d’âge' });
    expect(report.segments).toEqual([
      { key: '18_29', label: '18 à 29 ans', count: 7 },
      { key: '30_54', label: '30 à 54 ans', count: 5 },
      { key: NOT_RECORDED_KEY, label: 'Non renseigné', count: null },
    ]);
    expect(skill(report, 'a').overall).toMatchObject({ n: 14 });
  });

  it('masquage complémentaire : la case « non renseigné » (2 personnes) entraîne le masquage de la plus petite case visible', () => {
    const report = buildObservatoryReport(dataset([...groupA(), ...groupB(), ...fewUnknown()]), filters({}, 'age'));
    expect(skill(report, 'a').segments).toEqual([expect.objectContaining({ state: 'shown', n: 7, mean: 4 }), { state: 'hidden' }, { state: 'hidden' }]);
    expect(skill(report, 'b').segments).toEqual([expect.objectContaining({ state: 'shown', n: 7 }), { state: 'none' }, { state: 'none' }]);
    // Aucun constat sur un segment masqué ni sur « non renseigné ».
    expect(report.findings.some((finding) => finding.kind === 'segment_gap')).toBe(false);
  });

  it('plus grand écart entre deux segments d’au moins 5 personnes, « non renseigné » exclu, formulé avec n', () => {
    const report = buildObservatoryReport(dataset([...groupA(), ...groupB(), ...fewUnknown(), ...moreUnknown()]), filters({}, 'age'));
    expect(skill(report, 'a').segments.map((cell) => cell.state)).toEqual(['shown', 'shown', 'shown']);
    const finding = report.findings[0]!;
    expect(finding).toMatchObject({
      kind: 'segment_gap',
      code: 'a',
      axis: 'Tranche d’âge',
      high: { label: '18 à 29 ans', mean: 4, n: 7 },
      low: { label: '30 à 54 ans', mean: 3, n: 5 },
      gap: 1,
    });
    expect(report.findings).toHaveLength(4);
  });
});
