import { describe, expect, it } from 'vitest';

import type { Observation } from '@/lib/evaluation-engine';

import { AXIS_KEYS, type AxisKey } from './axes';
import { observatoryCsvLines } from './csv';
import type { ObservatoryDataset, ObservatoryPerson } from './dataset';
import { buildObservatoryReport } from './report';

const LEVELS = [1, 2, 3, 4, 5].map((value) => ({ value, label: `Niveau ${value}` }));

function person(axes: Partial<Record<AxisKey, string>>, scores: Record<string, number[]>): ObservatoryPerson {
  const observations: Observation[] = Object.entries(scores).flatMap(([skillCode, list]) =>
    list.map((score, index) => ({ skillCode, score, sessionNumber: index + 1, date: `2026-02-0${index + 1}` })),
  );
  return { axes: Object.fromEntries(AXIS_KEYS.map((key) => [key, axes[key] ?? null])) as Record<AxisKey, string | null>, observations: new Map([['tr', observations]]), self: null };
}
const times = (count: number, make: () => ObservatoryPerson) => Array.from({ length: count }, make);

const dataset: ObservatoryDataset = {
  frameworks: [
    {
      code: 'tr',
      name: 'Compétences transversales',
      shortName: 'Transversales',
      versionLabel: 'Version 1',
      isProvisional: false,
      rules: { scaleMin: 1, scaleMax: 5, scaleStep: 1, scoringMode: 'direct', aggregation: 'latest', rounding: 'none' },
      levels: LEVELS,
      skills: [
        { code: 'a', name: '=Écoute', description: null, category: 'Communication' },
        { code: 'c', name: 'Organisation', description: null, category: null },
      ],
    },
  ],
  persons: [
    ...times(6, () => person({ organisme: 'o1', age: '18_29' }, { a: [2, 4] })),
    ...times(5, () => person({ organisme: 'o2', age: '30_54' }, { a: [3] })),
    ...times(2, () => person({ organisme: 'o2' }, { a: [1], c: [5] })),
    ...times(2, () => person({ organisme: 'o1', age: '18_29' }, { c: [4] })),
  ],
  labels: { organisme: new Map([['o1', 'Mission Locale'], ['o2', 'Horizon']]) },
  excludedObservations: 0,
};

/** Colonne « Personnes (n) » de chaque ligne de données. */
function personsColumn(lines: (string | number | null | undefined)[][]) {
  const header = lines.findIndex((line) => line[0] === 'Compétence');
  const column = lines[header]!.indexOf('Personnes (n)');
  return lines.slice(header + 1).map((line) => line[column]);
}

describe('export CSV de l’observatoire', () => {
  it('reprend le référentiel, les filtres, l’axe de comparaison et la règle de masquage', () => {
    const report = buildObservatoryReport(dataset, { framework: null, values: { organisme: 'o2' }, compare: 'age' });
    const lines = observatoryCsvLines(report, '2026-11-21');
    const text = lines.map((line) => line.join(' | ')).join('\n');
    expect(text).toContain('Compétences transversales (Version 1)');
    expect(text).toContain('Organisme : Horizon');
    expect(text).toContain('Comparer par | Tranche d’âge');
    expect(text).toContain('moins de 5 personnes');
  });

  it('aucune case de moins de 5 personnes n’y figure : « moins de 5 » et aucune valeur', () => {
    const report = buildObservatoryReport(dataset, { framework: null, values: {}, compare: 'age' });
    const lines = observatoryCsvLines(report, '2026-11-21');
    const counts = personsColumn(lines);
    expect(counts.length).toBeGreaterThan(0);
    for (const count of counts) expect(count === 'moins de 5' || count === 0 || (typeof count === 'number' && count >= 5)).toBe(true);
    const header = lines.find((line) => line[0] === 'Compétence')!;
    const effectifs = header.flatMap((title, index) => (String(title).endsWith('(n)') ? [index] : []));
    expect(effectifs.length).toBe(3);
    for (const line of lines.slice(lines.indexOf(header) + 1)) {
      // Toute colonne d'effectif : « moins de 5 », 0, « non comparable », vide ou au moins 5.
      for (const index of effectifs) {
        const value = line[index];
        expect(value === 'moins de 5' || value === 'non comparable' || value === '' || value === 0 || (typeof value === 'number' && value >= 5)).toBe(true);
      }
      // Ligne masquée : aucune valeur, sur aucune colonne.
      if (line[header.indexOf('Personnes (n)')] === 'moins de 5') {
        expect(line.slice(header.indexOf('Moyenne')).every((cell) => cell === '' || cell === null)).toBe(true);
      }
    }
    // Organisation : 4 personnes au total, masquée y compris dans la ligne « Ensemble ».
    const organisation = lines.filter((line) => line[0] === 'Organisation');
    expect(organisation.length).toBeGreaterThan(0);
    for (const line of organisation) expect(line[header.indexOf('Personnes (n)')] === 'moins de 5' || line[header.indexOf('Personnes (n)')] === 0).toBe(true);
  });

  it('une ligne « Ensemble » puis une par segment ; les nombres restent des nombres', () => {
    const report = buildObservatoryReport(dataset, { framework: null, values: {}, compare: 'age' });
    const lines = observatoryCsvLines(report, '2026-11-21');
    const header = lines.find((line) => line[0] === 'Compétence')!;
    const listening = lines.filter((line) => line[0] === '=Écoute');
    expect(listening.map((line) => line[header.indexOf('Segment')])).toEqual(['Ensemble', 'Tranche d’âge : 18 à 29 ans', 'Tranche d’âge : 30 à 54 ans', 'Tranche d’âge : Non renseigné']);
    expect(listening[0]![header.indexOf('Personnes (n)')]).toBe(13);
    expect(typeof listening[0]![header.indexOf('Moyenne')]).toBe('number');
  });

  it('un rapport trop petit n’exporte aucune ligne de résultats', () => {
    const report = buildObservatoryReport(dataset, { framework: null, values: { organisme: 'o2', age: '18_29' }, compare: null });
    const lines = observatoryCsvLines(report, '2026-11-21');
    expect(lines.some((line) => line[0] === 'Compétence')).toBe(false);
    expect(lines.map((line) => line.join(' ')).join('\n')).toMatch(/Aucun résultat/);
  });
});
