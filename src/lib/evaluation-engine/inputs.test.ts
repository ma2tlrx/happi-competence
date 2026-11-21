import { describe, expect, it } from 'vitest';

import { referenceMembership, selfScaleComparable, selfValuesBySkill, validatedObservationsByFramework } from './inputs';

const skills = new Map([
  ['s-comm', { code: 'communication', version_id: 'v-transversal' }],
  ['s-coop', { code: 'cooperation', version_id: 'v-socio' }],
  ['s-orphan', { code: 'orpheline', version_id: 'v-sans-referentiel' }],
]);
const versions = new Map([
  ['v-transversal', { frameworks: { code: 'transversal' } }],
  ['v-socio', { frameworks: { code: 'sociocognitive' } }],
  ['v-sans-referentiel', { frameworks: null }],
]);

describe('observations validées (construction partagée passeport / observatoire)', () => {
  it('rattache chaque note au code stable de la compétence, par référentiel', () => {
    const result = validatedObservationsByFramework(
      [
        {
          id: 'e1',
          validated_at: '2026-10-02T10:00:00Z',
          sessions: { number: 2, scheduled_date: '2026-10-01' },
          evaluation_scores: [
            { skill_id: 's-comm', score: 3, comment: 'À l’aise à l’oral' },
            { skill_id: 's-coop', score: 2, comment: null },
          ],
        },
      ],
      skills,
      versions,
    );
    expect(result.get('transversal')).toEqual([
      { skillCode: 'communication', score: 3, sessionNumber: 2, date: '2026-10-01', evaluationId: 'e1', comment: 'À l’aise à l’oral' },
    ]);
    expect(result.get('sociocognitive')).toEqual([{ skillCode: 'cooperation', score: 2, sessionNumber: 2, date: '2026-10-01', evaluationId: 'e1', comment: null }]);
  });

  it('ignore les compétences non observées (note nulle), inconnues ou sans référentiel : jamais de zéro', () => {
    const result = validatedObservationsByFramework(
      [
        {
          id: 'e1',
          validated_at: null,
          sessions: { number: 1, scheduled_date: '2026-09-01' },
          evaluation_scores: [
            { skill_id: 's-comm', score: null },
            { skill_id: 's-inconnue', score: 4 },
            { skill_id: 's-orphan', score: 4 },
          ],
        },
      ],
      skills,
      versions,
    );
    expect(result.size).toBe(0);
  });

  it('date de la session, sinon date de validation ; numéro 0 sans session', () => {
    const result = validatedObservationsByFramework(
      [{ id: 'e2', validated_at: '2026-11-03T08:30:00Z', sessions: null, evaluation_scores: [{ skill_id: 's-comm', score: '4' as unknown as number }] }],
      skills,
      versions,
    );
    expect(result.get('transversal')).toEqual([{ skillCode: 'communication', score: 4, sessionNumber: 0, date: '2026-11-03', evaluationId: 'e2', comment: undefined }]);
  });
});

describe('auto-évaluation initiale ramenée aux compétences', () => {
  const answers = [
    { skillCode: 'communication', value: 2, text: 'Q1', position: 1 },
    { skillCode: null, value: 5, text: 'Question générale', position: 2 },
    { skillCode: 'communication', value: 4, text: 'Q3', position: 3 },
    { skillCode: 'cooperation', value: 3, text: 'Q4', position: 4 },
  ];

  it('retient, pour une compétence, la dernière réponse dans l’ordre des questions', () => {
    const bySkill = selfValuesBySkill({ status: 'completed', answers });
    expect(bySkill.get('communication')?.value).toBe(4);
    expect(bySkill.get('communication')?.text).toBe('Q3');
    expect(bySkill.get('cooperation')?.value).toBe(3);
    expect(bySkill.size).toBe(2);
  });

  it('ne retient rien d’une auto-évaluation non terminée ou absente', () => {
    expect(selfValuesBySkill({ status: 'in_progress', answers }).size).toBe(0);
    expect(selfValuesBySkill(null).size).toBe(0);
  });

  it('compare seulement quand les échelles sont identiques', () => {
    expect(selfScaleComparable({ scaleMin: 1, scaleMax: 5 }, { scaleMin: 1, scaleMax: 5 })).toBe(true);
    expect(selfScaleComparable({ scaleMin: 1, scaleMax: 5 }, { scaleMin: 1, scaleMax: 4 })).toBe(false);
    expect(selfScaleComparable(null, { scaleMin: 1, scaleMax: 5 })).toBe(false);
  });
});

describe('groupe de référence (même règle que le passeport)', () => {
  it('prend l’inscription active la plus récente, sinon le dernier abandon ; jamais un retrait', () => {
    // Lignes déjà triées de la plus récente à la plus ancienne.
    expect(referenceMembership([{ status: 'dropped', id: 'b' }, { status: 'active', id: 'a' }])?.id).toBe('a');
    expect(referenceMembership([{ status: 'removed', id: 'c' }, { status: 'dropped', id: 'b' }, { status: 'dropped', id: 'd' }])?.id).toBe('b');
    expect(referenceMembership([{ status: 'removed', id: 'c' }])).toBeNull();
    expect(referenceMembership([])).toBeNull();
  });
});
