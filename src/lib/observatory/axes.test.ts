import { describe, expect, it } from 'vitest';

import { AXIS_KEYS, NOT_RECORDED_KEY, observatorySearch, parseObservatoryParams } from './axes';

const ORG = '0b7c2a4e-8f1d-4a2b-9c3d-5e6f7a8b9c0d';

describe('paramètres de l’observatoire (URL)', () => {
  it('lit les filtres valides, le référentiel, l’axe de comparaison et la compétence ouverte', () => {
    const { filters, skill } = parseObservatoryParams({
      referentiel: 'transversal',
      organisme: ORG,
      ville: '  Béziers ',
      annee: '2026',
      age: '18_29',
      genre: 'femme',
      diplome: 'niveau_4',
      situation: 'chomeur',
      qpv: 'oui',
      comparer: 'age',
      competence: 'esprit_d_equipe',
    });
    expect(filters).toEqual({
      framework: 'transversal',
      values: { organisme: ORG, ville: 'Béziers', annee: '2026', age: '18_29', genre: 'femme', diplome: 'niveau_4', situation: 'chomeur', qpv: 'oui' },
      compare: 'age',
    });
    expect(skill).toBe('esprit_d_equipe');
  });

  it('ignore toute valeur mal formée ou inconnue', () => {
    const { filters, skill } = parseObservatoryParams({
      referentiel: '<script>',
      organisme: 'pas-un-uuid',
      programme: '1; drop table',
      annee: '26',
      age: 'vieux',
      genre: 'autre',
      qpv: 'peut-etre',
      ville: 'x'.repeat(121),
      comparer: 'nom',
      competence: '../../etc',
    });
    expect(filters).toEqual({ framework: null, values: {}, compare: null });
    expect(skill).toBeNull();
  });

  it('« non renseigné » est une valeur de filtre à part entière, sur chaque axe', () => {
    const params = Object.fromEntries(AXIS_KEYS.map((key) => [key, NOT_RECORDED_KEY]));
    expect(Object.keys(parseObservatoryParams(params).filters.values)).toEqual([...AXIS_KEYS]);
  });

  it('n’accepte jamais une catégorie sensible de la fiche FSE+ comme filtre ou comme axe', () => {
    const sensitive = ['handicap', 'disability', 'rqth', 'minorite', 'minority', 'origine', 'foreign_background', 'nationalite', 'third_country_national', 'logement', 'homeless_or_housing_excl'];
    for (const key of sensitive) expect(AXIS_KEYS as readonly string[]).not.toContain(key);
    const { filters } = parseObservatoryParams({ ...Object.fromEntries(sensitive.map((key) => [key, 'oui'])), comparer: 'rqth' });
    expect(filters).toEqual({ framework: null, values: {}, compare: null });
  });

  it('prend la première valeur d’un paramètre répété', () => {
    expect(parseObservatoryParams({ age: ['30_54', '18_29'] }).filters.values).toEqual({ age: '30_54' });
  });

  it('reconstruit une adresse partageable qui redonne les mêmes filtres', () => {
    const filters = { framework: 'sociocognitive', values: { organisme: ORG, age: NOT_RECORDED_KEY, ville: 'Sète' }, compare: 'genre' as const };
    const search = observatorySearch(filters, { competence: 'planification' });
    expect(search.startsWith('?')).toBe(true);
    const params = Object.fromEntries(new URLSearchParams(search));
    expect(parseObservatoryParams(params)).toEqual({ filters, skill: 'planification' });
    expect(observatorySearch({ framework: null, values: {}, compare: null })).toBe('');
  });
});
