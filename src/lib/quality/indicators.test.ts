import { describe, expect, it } from 'vitest';

import type { SatisfactionSummary } from '@/lib/satisfaction/aggregate';

import {
  actionsInPeriod,
  actionStats,
  complaintAge,
  complaintDelay,
  complaintStats,
  daysBetween,
  formatRate,
  isOverdue,
  parseMaxAgeMonths,
  parsePublicIndicators,
  publicIndicators,
  satisfactionRate,
  subtractMonths,
  trainerTrainingStatus,
  type QualitySnapshot,
} from './indicators';

describe('dates', () => {
  it('compte les jours et retire des mois (fin de mois ramenée)', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(subtractMonths('2026-11-16', 24)).toBe('2024-11-16');
    expect(subtractMonths('2026-03-31', 1)).toBe('2026-02-28');
    expect(subtractMonths('2024-03-31', 1)).toBe('2024-02-29');
  });
});

describe('réclamations', () => {
  it('délai de traitement : null sans réponse, jamais négatif', () => {
    expect(complaintDelay({ receivedOn: '2026-10-01', respondedOn: null })).toBeNull();
    expect(complaintDelay({ receivedOn: '2026-10-01', respondedOn: '2026-10-11' })).toBe(10);
    expect(complaintAge({ receivedOn: '2026-10-01', respondedOn: null }, '2026-10-05')).toBe(4);
    expect(complaintAge({ receivedOn: '2026-10-01', respondedOn: '2026-10-02' }, '2026-10-05')).toBeNull();
  });

  it('statistiques : délai moyen sur les seules réclamations répondues', () => {
    const stats = complaintStats([
      { status: 'resolved', source: 'participant', receivedOn: '2026-10-01', respondedOn: '2026-10-03' },
      { status: 'closed', source: 'financeur', receivedOn: '2026-10-01', respondedOn: '2026-10-06' },
      { status: 'received', source: 'participant', receivedOn: '2026-10-10', respondedOn: null },
    ]);
    expect(stats).toMatchObject({ total: 3, open: 1, answered: 2, meanDelayDays: 3.5, maxDelayDays: 5 });
    expect(stats.bySource).toEqual({ participant: 2, financeur: 1 });
  });

  it('sans réclamation : aucun délai inventé', () => {
    expect(complaintStats([])).toMatchObject({ total: 0, answered: 0, meanDelayDays: null, maxDelayDays: null });
  });
});

describe('plan d’amélioration', () => {
  it('compte ouvertes, closes, en retard et efficacité constatée', () => {
    const today = '2026-11-16';
    const actions = [
      { status: 'planned', dueOn: '2026-11-01', effectiveness: null },
      { status: 'in_progress', dueOn: '2026-12-01', effectiveness: null },
      { status: 'done', dueOn: '2026-10-01', effectiveness: 'Plus aucune réclamation sur ce point' },
      { status: 'done', dueOn: null, effectiveness: '  ' },
      { status: 'abandoned', dueOn: '2026-01-01', effectiveness: null },
    ];
    expect(isOverdue(actions[0]!, today)).toBe(true);
    expect(isOverdue(actions[4]!, today)).toBe(false);
    expect(actionStats(actions, today)).toEqual({
      total: 5,
      open: 2,
      closed: 3,
      overdue: 1,
      done: 2,
      effectivenessRecorded: { count: 1, n: 2, rate: 50 },
    });
    expect(actionStats([], today).effectivenessRecorded.rate).toBeNull();
  });
});

describe('formation des intervenants', () => {
  const today = '2026-11-16';
  it('à jour si une formation suivie date de moins de 24 mois', () => {
    const status = trainerTrainingStatus(
      [
        { kind: 'diplome', completedOn: '2026-01-01', startedOn: null, isAiTraining: false },
        { kind: 'formation', completedOn: '2025-06-01', startedOn: null, isAiTraining: true },
      ],
      today,
    );
    expect(status).toMatchObject({ state: 'up_to_date', lastTrainingOn: '2025-06-01', aiTraining: true, threshold: '2024-11-16' });
  });

  it('ancienne au-delà du seuil paramétré ; aucune si rien n’est daté', () => {
    const rows = [{ kind: 'formation', completedOn: '2024-01-10', startedOn: null, isAiTraining: false }];
    expect(trainerTrainingStatus(rows, today).state).toBe('outdated');
    expect(trainerTrainingStatus(rows, today, 36).state).toBe('up_to_date');
    expect(trainerTrainingStatus([{ kind: 'formation', completedOn: null, startedOn: null, isAiTraining: false }], today).state).toBe('none');
    expect(trainerTrainingStatus([], today)).toMatchObject({ state: 'none', aiTraining: false, lastTrainingOn: null });
  });

  it('une formation future ne compte pas encore ; la date de début sert à défaut', () => {
    expect(trainerTrainingStatus([{ kind: 'formation', completedOn: '2027-02-01', startedOn: null, isAiTraining: false }], today).state).toBe('none');
    expect(trainerTrainingStatus([{ kind: 'formation', completedOn: null, startedOn: '2026-09-01', isAiTraining: false }], today).state).toBe('up_to_date');
  });

  it('seuil paramétrable lu de façon défensive', () => {
    expect(parseMaxAgeMonths(36)).toBe(36);
    expect(parseMaxAgeMonths('18')).toBe(18);
    expect(parseMaxAgeMonths('abc')).toBe(24);
    expect(parseMaxAgeMonths(0)).toBe(24);
    expect(parseMaxAgeMonths(null)).toBe(24);
  });
});

function summary(distribution: number[], responses: number, kind: 'rating' | 'nps' = 'rating'): SatisfactionSummary {
  return {
    audience: 'participant',
    moment: 'hot',
    invited: 20,
    responses,
    rate: responses / 20,
    groupsOpen: 0,
    questions: [
      {
        question: { id: 'q', versionId: 'v', versionLabel: 'V1', position: 1, kind, text: 'Q', options: [] },
        n: distribution.reduce((a, b) => a + b, 0),
        mean: null,
        distribution: distribution.map((count, index) => ({ key: String(index + 1), label: String(index + 1), count })),
        recommendationIndex: null,
        verbatims: [],
        hiddenVerbatims: 0,
      },
    ],
  };
}

describe('taux de satisfaction', () => {
  it('part des notes 4 et 5 sur les questions notées', () => {
    expect(satisfactionRate([summary([1, 1, 2, 3, 3], 10)])).toEqual({ count: 6, n: 10, rate: 60, respondents: 10, invited: 20 });
  });
  it('ignore la recommandation (0–10) et ne renvoie pas zéro sans réponse', () => {
    expect(satisfactionRate([summary([0, 0, 0, 5, 5], 10, 'nps')]).rate).toBeNull();
    expect(satisfactionRate([]).rate).toBeNull();
  });
});

describe('publication des résultats', () => {
  const snapshot = (enrolled: number, respondents: number, attendanceN = 50): QualitySnapshot => ({
    satisfaction: { count: 8, n: 10, rate: 80, respondents, invited: 12 },
    impact: { enrolled, dropped: 2, dropRate: { count: 2, n: enrolled, rate: null }, attendance: { count: 40, n: attendanceN, rate: 80 } },
  });

  it('publie au-delà de 10, avec effectif', () => {
    expect(publicIndicators(snapshot(12, 10))).toEqual({
      participants: { status: 'published', value: 12, n: 12 },
      completion: { status: 'published', value: 83, n: 12 },
      attendance: { status: 'published', value: 80, n: 12 },
      satisfaction: { status: 'published', value: 80, n: 10 },
    });
  });

  it('sous le seuil : rien n’est conservé (ni valeur, ni effectif)', () => {
    const result = publicIndicators(snapshot(9, 9));
    expect(result.participants).toEqual({ status: 'insufficient' });
    expect(result.completion).toEqual({ status: 'insufficient' });
    expect(result.satisfaction).toEqual({ status: 'insufficient' });
    expect(publicIndicators(snapshot(12, 10, 5)).attendance).toEqual({ status: 'insufficient' });
  });

  it('relit un instantané stocké en refusant tout effectif sous le seuil', () => {
    expect(parsePublicIndicators({ participants: { status: 'published', value: 5, n: 5 } })?.participants).toEqual({ status: 'insufficient' });
    expect(parsePublicIndicators({ satisfaction: { status: 'published', value: 90, n: 14 } })?.satisfaction).toEqual({ status: 'published', value: 90, n: 14 });
    expect(parsePublicIndicators(null)).toBeNull();
  });

  it('format lisible', () => {
    expect(formatRate({ rate: 66.6, n: 3 })).toBe('67 % (n = 3)');
    expect(formatRate({ rate: null, n: 0 })).toBe('— (n = 0)');
  });
});

describe('actions d’une période', () => {
  it('garde les actions créées dans la période ou encore ouvertes à son début', () => {
    const period = { from: '2026-06-01', to: '2026-06-30' };
    const rows = [
      { id: 'dans', createdAt: '2026-06-10T08:00:00Z', closedOn: null },
      { id: 'ouverte-avant', createdAt: '2026-01-10T08:00:00Z', closedOn: null },
      { id: 'close-avant', createdAt: '2026-01-10T08:00:00Z', closedOn: '2026-05-01' },
      { id: 'apres', createdAt: '2026-07-10T08:00:00Z', closedOn: null },
    ];
    expect(actionsInPeriod(rows, period).map((row) => row.id)).toEqual(['dans', 'ouverte-avant']);
  });
});
