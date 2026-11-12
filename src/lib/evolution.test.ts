import { describe, expect, it } from 'vitest';

import { buildEvolution, finalSelfAssessmentOpen, finalStatusOf } from './evolution';
import type { SelfAssessment } from './passport';
import { buildReportData } from './report/build';
import { fixturePassport } from './report/fixtures';

const SCALE = ['Pas du tout d’accord', 'Plutôt pas d’accord', 'Neutre', 'Plutôt d’accord', 'Tout à fait d’accord'].map((label, index) => ({ value: index + 1, label }));

function assessment(values: Record<string, number>, status: SelfAssessment['status'] = 'completed'): SelfAssessment {
  return {
    id: `sa-${Object.values(values).join('')}`,
    status,
    completedAt: status === 'completed' ? '2026-06-12T10:00:00Z' : null,
    startedAt: '2026-01-10T10:00:00Z',
    comment: null,
    scaleMin: 1,
    scaleMax: 5,
    scaleLabels: SCALE,
    versionLabel: 'Version 1',
    versionId: 'qv1',
    answers: Object.entries(values).map(([skillCode, value], index) => ({
      questionId: `q${index}`,
      position: index + 1,
      text: `Affirmation ${skillCode}`,
      frameworkCode: 'transversal',
      skillCode,
      value,
      comment: null,
    })),
  };
}

describe('ouverture de l’auto-évaluation finale', () => {
  const sessions = (statuses: string[]) => statuses.map((status, index) => ({ number: index + 1, status: status as 'planned' }));

  it('fermée sans groupe ou en cours de parcours', () => {
    expect(finalSelfAssessmentOpen(null, [])).toBe(false);
    expect(finalSelfAssessmentOpen({ status: 'active' }, sessions(['completed', 'completed', 'planned', 'planned', 'planned', 'planned']))).toBe(false);
  });

  it('ouverte quand la dernière séance est terminée, séances annulées ignorées', () => {
    expect(finalSelfAssessmentOpen({ status: 'active' }, sessions(['completed', 'completed', 'completed']))).toBe(true);
    expect(finalSelfAssessmentOpen({ status: 'active' }, [...sessions(['completed', 'completed']), { number: 3, status: 'cancelled' }])).toBe(true);
  });

  it('ouverte à partir de la séance 6 ou quand le groupe est terminé', () => {
    expect(finalSelfAssessmentOpen({ status: 'active' }, sessions(['completed', 'completed', 'completed', 'completed', 'completed', 'in_progress', 'planned']))).toBe(true);
    expect(finalSelfAssessmentOpen({ status: 'completed' }, sessions(['planned']))).toBe(true);
  });

  it('statut : initiale requise, puis ouverte, en cours, terminée', () => {
    const passport = fixturePassport({ evaluated: [1, 2] });
    expect(finalStatusOf(passport)).toBe('no_initial');
    expect(finalStatusOf({ ...passport, selfAssessment: assessment({ relationnel: 3 }) })).toBe('open');
    const running = { ...passport, sessions: passport.sessions.map((session) => ({ ...session, status: session.number > 2 ? ('planned' as const) : session.status })) };
    expect(finalStatusOf({ ...running, selfAssessment: assessment({ relationnel: 3 }) })).toBe('not_open');
    expect(finalStatusOf({ ...passport, selfAssessment: assessment({ relationnel: 3 }), finalSelfAssessment: assessment({ relationnel: 4 }, 'in_progress') })).toBe('in_progress');
    expect(finalStatusOf({ ...passport, selfAssessment: assessment({ relationnel: 3 }), finalSelfAssessment: assessment({ relationnel: 4 }) })).toBe('completed');
  });
});

describe('évolution', () => {
  const base = fixturePassport({ ct: { relationnel: [[1, 2], [4, 3]], leadership: [[2, 4]] }, hbs: { cooperation: [[3, 2]] }, evaluated: [1, 2, 3, 4] });
  const passport = { ...base, selfAssessment: assessment({ relationnel: 2, esprit_d_equipe: 4, leadership: 3 }), finalSelfAssessment: assessment({ relationnel: 4, esprit_d_equipe: 4, leadership: 2 }) };
  const evolution = buildEvolution(passport);
  const ct = evolution.frameworks.find((framework) => framework.code === 'transversal')!;
  const skill = (code: string) => ct.skills.find((entry) => entry.code === code)!;

  it('présente côte à côte déclaré au départ, observé et déclaré à la fin, avec les libellés d’échelle', () => {
    expect(skill('relationnel')).toMatchObject({
      initial: { value: 2, label: 'Plutôt pas d’accord' },
      final: { value: 4, label: 'Plutôt d’accord' },
      observed: { count: 2, first: { value: 2, label: 'En difficulté', session: 1 }, last: { value: 3, label: 'En cours d’acquisition', session: 4 }, trend: 'up' },
      declaredChange: 'higher',
    });
    expect(skill('leadership').declaredChange).toBe('lower');
    expect(skill('esprit_d_equipe').declaredChange).toBe('same');
  });

  it('une compétence non évaluée est « non observée » (nulle), jamais zéro', () => {
    expect(skill('esprit_d_equipe').observed).toBeNull();
  });

  it('ne compare jamais déclaré et observé : aucun écart calculé entre échelles', () => {
    expect(Object.keys(skill('relationnel')).sort()).toEqual(['code', 'declaredChange', 'final', 'initial', 'name', 'observed']);
  });

  it('les habiletés gardent leur échelle propre et ne reprennent pas le questionnaire', () => {
    const hbs = evolution.frameworks.find((framework) => framework.code === 'sociocognitive')!;
    expect(hbs.scaleMax).toBe(4);
    expect(hbs.skills).toEqual([expect.objectContaining({ code: 'cooperation', initial: null, final: null })]);
    expect(hbs.omitted).toBe(15);
  });

  it('omet les compétences sans question ni observation, et ignore une auto-évaluation non terminée', () => {
    expect(ct.skills.map((entry) => entry.code).sort()).toEqual(['esprit_d_equipe', 'leadership', 'relationnel']);
    expect(ct.omitted).toBe(15);
    const unfinished = buildEvolution({ ...passport, finalSelfAssessment: assessment({ relationnel: 5 }, 'in_progress') });
    expect(unfinished.frameworks[0]!.skills.find((entry) => entry.code === 'relationnel')).toMatchObject({ final: null, declaredChange: null });
    expect(unfinished.finalCompletedAt).toBeNull();
  });

  it('sans aucune donnée : rien à présenter', () => {
    expect(buildEvolution(fixturePassport({})).hasData).toBe(false);
  });

  it('ne modifie pas la photographie du bilan', () => {
    const now = new Date('2026-07-01T00:00:00Z');
    expect(buildReportData(passport, new Map(), now)).toEqual(buildReportData({ ...passport, finalSelfAssessment: null }, new Map(), now));
  });
});
