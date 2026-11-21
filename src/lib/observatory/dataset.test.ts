import { describe, expect, it } from 'vitest';

import { assembleDataset, type ObservatoryRaw } from './dataset';

const P1 = 'p1';
const P2 = 'p2';

function raw(overrides: Partial<ObservatoryRaw> = {}): ObservatoryRaw {
  return {
    frameworks: [
      { id: 'f-soc', code: 'sociocognitive', name: 'Habiletés socio-cognitives', short_name: 'Habiletés', position: 2 },
      { id: 'f-tr', code: 'transversal', name: 'Compétences transversales', short_name: 'Transversales', position: 1 },
    ],
    versions: [
      { id: 'v-tr-1', framework_id: 'f-tr', version_number: 1, label: 'Version 1', status: 'archived', is_provisional: false, scale_min: 1, scale_max: 5, scale_step: 1, scoring_mode: 'direct', aggregation: 'latest', rounding: 'none' },
      { id: 'v-tr-2', framework_id: 'f-tr', version_number: 2, label: 'Version 2', status: 'published', is_provisional: true, scale_min: 1, scale_max: 5, scale_step: 1, scoring_mode: 'direct', aggregation: 'mean', rounding: 'half' },
      { id: 'v-tr-3', framework_id: 'f-tr', version_number: 3, label: 'Version 3 (brouillon)', status: 'draft', is_provisional: true, scale_min: 1, scale_max: 4, scale_step: 1, scoring_mode: 'direct', aggregation: 'latest', rounding: 'none' },
      { id: 'v-soc-1', framework_id: 'f-soc', version_number: 1, label: 'Version 1', status: 'published', is_provisional: false, scale_min: 1, scale_max: 4, scale_step: 1, scoring_mode: 'direct', aggregation: 'latest', rounding: 'none' },
      { id: 'v-soc-0', framework_id: 'f-soc', version_number: 0, label: 'Ancienne échelle', status: 'archived', is_provisional: false, scale_min: 1, scale_max: 6, scale_step: 1, scoring_mode: 'direct', aggregation: 'latest', rounding: 'none' },
    ],
    skills: [
      { id: 'k-tr2-b', version_id: 'v-tr-2', code: 'b_relation', name: 'Relationnel', description: null, position: 2, is_active: true, category_id: 'c-com' },
      { id: 'k-tr2-a', version_id: 'v-tr-2', code: 'a_ecoute', name: 'Écoute', description: 'Écouter les autres.', position: 1, is_active: true, category_id: 'c-com' },
      { id: 'k-tr2-x', version_id: 'v-tr-2', code: 'x_retiree', name: 'Retirée', description: null, position: 3, is_active: false, category_id: null },
      { id: 'k-tr1-a', version_id: 'v-tr-1', code: 'a_ecoute', name: 'Écoute (v1)', description: null, position: 1, is_active: true, category_id: null },
      { id: 'k-soc-a', version_id: 'v-soc-1', code: 'planification', name: 'Planification', description: null, position: 1, is_active: true, category_id: null },
      { id: 'k-soc0-a', version_id: 'v-soc-0', code: 'planification', name: 'Planification (ancienne)', description: null, position: 1, is_active: true, category_id: null },
    ],
    categories: [{ id: 'c-com', name: 'Communication', position: 1 }],
    levels: [
      { version_id: 'v-tr-2', value: 2, label: 'Deux' },
      { version_id: 'v-tr-2', value: 1, label: 'Un' },
      { version_id: 'v-soc-1', value: 1, label: 'Aptitude' },
    ],
    participants: [
      { id: P1, organization_id: 'o1' },
      { id: P2, organization_id: null },
    ],
    organizations: [{ id: 'o1', name: 'Mission Locale', city: ' Béziers ' }],
    memberships: [
      { participant_id: P1, group_id: 'g-old', status: 'active', joined_at: '2025-01-10T00:00:00Z' },
      { participant_id: P1, group_id: 'g-new', status: 'active', joined_at: '2026-03-01T00:00:00Z' },
      { participant_id: P2, group_id: 'g-new', status: 'removed', joined_at: '2026-03-01T00:00:00Z' },
    ],
    groups: [
      { id: 'g-old', name: 'Groupe 2025', program_id: 'prog', start_date: '2025-01-15' },
      { id: 'g-new', name: 'Groupe 2026', program_id: 'prog', start_date: '2026-03-02' },
    ],
    programs: [{ id: 'prog', name: 'Programme HAPPI' }],
    evaluations: [
      {
        id: 'e1',
        participant_id: P1,
        validated_at: '2026-03-10T10:00:00Z',
        sessions: { number: 1, scheduled_date: '2026-03-09' },
        evaluation_scores: [
          { skill_id: 'k-tr1-a', score: 2 },
          { skill_id: 'k-soc0-a', score: 6 },
          { skill_id: 'k-soc-a', score: 3 },
          { skill_id: 'k-tr2-b', score: null },
        ],
      },
      { id: 'e-inconnu', participant_id: 'p-demo', validated_at: null, sessions: { number: 1, scheduled_date: '2026-03-09' }, evaluation_scores: [{ skill_id: 'k-tr2-a', score: 5 }] },
    ],
    profiles: [
      { participant_id: P1, entry_date: '2025-01-15', updated_at: '2026-04-01T00:00:00Z', gender: 'homme', age_band: '30_54', labour_status: 'chomeur', diploma_level: 'niveau_3', qpv_resident: 'non' },
      { participant_id: P1, entry_date: '2026-03-02', updated_at: '2026-03-02T00:00:00Z', gender: 'homme', age_band: '18_29', labour_status: 'en_emploi', diploma_level: 'code_inconnu', qpv_resident: null },
    ],
    selfAssessments: [
      { participant_id: P1, questionnaire_version_id: 'q1', status: 'completed', started_at: '2026-03-01T09:00:00Z', self_assessment_answers: [{ question_id: 'qq2', value: 4 }, { question_id: 'qq1', value: 2 }] },
      { participant_id: P2, questionnaire_version_id: 'q1', status: 'in_progress', started_at: '2026-03-01T09:00:00Z', self_assessment_answers: [{ question_id: 'qq1', value: 5 }] },
    ],
    questionnaireVersions: [{ id: 'q1', scale_min: 1, scale_max: 5 }],
    questions: [
      { id: 'qq1', skill_code: 'a_ecoute', position: 1 },
      { id: 'qq2', skill_code: 'a_ecoute', position: 2 },
    ],
    ...overrides,
  };
}

describe('assemblage des données de l’observatoire', () => {
  it('affiche, par référentiel, la version publiée la plus récente, avec ses règles, niveaux et compétences actives', () => {
    const dataset = assembleDataset(raw());
    expect(dataset.frameworks.map((framework) => framework.code)).toEqual(['transversal', 'sociocognitive']);
    const transversal = dataset.frameworks[0]!;
    expect(transversal.versionLabel).toBe('Version 2');
    expect(transversal.isProvisional).toBe(true);
    expect(transversal.rules).toEqual({ scaleMin: 1, scaleMax: 5, scaleStep: 1, scoringMode: 'direct', aggregation: 'mean', rounding: 'half' });
    expect(transversal.levels).toEqual([
      { value: 1, label: 'Un' },
      { value: 2, label: 'Deux' },
    ]);
    expect(transversal.skills).toEqual([
      { code: 'a_ecoute', name: 'Écoute', description: 'Écouter les autres.', category: 'Communication' },
      { code: 'b_relation', name: 'Relationnel', description: null, category: 'Communication' },
    ]);
  });

  it('rattache les observations validées par code stable, y compris d’une version précédente de même échelle', () => {
    const person = assembleDataset(raw()).persons[0]!;
    expect(person.observations.get('transversal')).toEqual([expect.objectContaining({ skillCode: 'a_ecoute', score: 2, sessionNumber: 1, date: '2026-03-09' })]);
  });

  it('écarte et compte les observations notées sur une échelle différente de celle affichée (jamais de mélange)', () => {
    const dataset = assembleDataset(raw());
    expect(dataset.persons[0]!.observations.get('sociocognitive')).toEqual([expect.objectContaining({ skillCode: 'planification', score: 3 })]);
    expect(dataset.excludedObservations).toBe(1);
  });

  it('ignore les lignes de personnes hors du périmètre (démonstration exclue en amont)', () => {
    const dataset = assembleDataset(raw());
    expect(dataset.persons).toHaveLength(2);
    expect(dataset.persons.flatMap((person) => [...person.observations.values()].flat()).some((observation) => observation.score === 5)).toBe(false);
  });

  it('découpe chaque personne selon son groupe de référence, son organisme et sa fiche d’entrée la plus récente', () => {
    const dataset = assembleDataset(raw());
    const [first, second] = dataset.persons;
    expect(first!.axes).toEqual({
      organisme: 'o1',
      ville: 'Béziers',
      programme: 'prog',
      cohorte: 'g-new',
      annee: '2026',
      age: '18_29',
      genre: 'homme',
      diplome: null,
      situation: 'en_emploi',
      qpv: null,
    });
    // Sans organisme, sans groupe (retrait), sans fiche : tout est « non renseigné », rien n'est inventé.
    expect(Object.values(second!.axes).every((value) => value === null)).toBe(true);
    expect(dataset.labels.organisme?.get('o1')).toBe('Mission Locale');
    expect(dataset.labels.cohorte?.get('g-new')).toBe('Groupe 2026');
    expect(dataset.labels.programme?.get('prog')).toBe('Programme HAPPI');
  });

  it('auto-évaluation initiale : la plus récente, terminée, réponses dans l’ordre des questions (même règle que le passeport)', () => {
    const dataset = assembleDataset(
      raw({
        selfAssessments: [
          ...raw().selfAssessments,
          { participant_id: P1, questionnaire_version_id: 'q1', status: 'completed', started_at: '2025-01-01T09:00:00Z', self_assessment_answers: [{ question_id: 'qq1', value: 1 }] },
        ],
      }),
    );
    const [first, second] = dataset.persons;
    expect(first!.self).toEqual({ scaleMin: 1, scaleMax: 5, values: new Map([['a_ecoute', 4]]) });
    expect(second!.self).toEqual({ scaleMin: 1, scaleMax: 5, values: new Map() });
  });
});
