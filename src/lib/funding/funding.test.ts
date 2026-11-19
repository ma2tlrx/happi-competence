import { describe, expect, it } from 'vitest';

import type { ImpactDataset } from '@/lib/outcomes/impact';
import type { SatisfactionSummary } from '@/lib/satisfaction/aggregate';

import { computeBpf } from './bpf';
import { bpfCsv, realisationCsv } from './csv';
import { computeConventionReport, hoursValue } from './indicators';
import { bpfOriginOf } from './labels';
import type { FundingDataset } from './realisation';

const TODAY = '2026-11-18';

const impact: ImpactDataset = {
  groups: [
    { id: 'g1', name: 'Groupe printemps', programId: 'prog', programName: 'HAPPI', organizationId: 'o1', organizationName: 'ML', startDate: '2026-03-01', endDate: null, status: 'active' },
    { id: 'g2', name: 'Groupe hiver', programId: 'prog', programName: 'HAPPI', organizationId: null, organizationName: null, startDate: '2025-12-01', endDate: '2026-01-31', status: 'active' },
  ],
  participants: [
    { id: 'p1', firstName: 'Inès', lastName: 'Martin', organizationId: 'o1', organizationName: 'ML' },
    { id: 'p2', firstName: 'Lucas', lastName: 'Benali', organizationId: 'o1', organizationName: 'ML' },
    { id: 'p3', firstName: 'Sarah', lastName: 'Dubois', organizationId: 'o1', organizationName: 'ML' },
    { id: 'p4', firstName: 'Yanis', lastName: 'Moreau', organizationId: 'o1', organizationName: 'ML' },
    { id: 'p5', firstName: 'Chloé', lastName: 'Laurent', organizationId: null, organizationName: null },
  ],
  memberships: [
    { groupId: 'g1', participantId: 'p1', status: 'active', dropReason: null, droppedAt: null },
    { groupId: 'g1', participantId: 'p2', status: 'active', dropReason: null, droppedAt: null },
    { groupId: 'g1', participantId: 'p3', status: 'dropped', dropReason: 'sante', droppedAt: '2026-03-05' },
    { groupId: 'g1', participantId: 'p4', status: 'removed', dropReason: null, droppedAt: null },
    { groupId: 'g2', participantId: 'p5', status: 'active', dropReason: null, droppedAt: null },
    { groupId: 'g2', participantId: 'p1', status: 'active', dropReason: null, droppedAt: null },
  ],
  sessions: [
    { id: 's1', groupId: 'g1', status: 'completed', date: '2026-03-01', number: 1 },
    { id: 's2', groupId: 'g1', status: 'completed', date: '2026-03-08', number: 2 },
    { id: 's3', groupId: 'g1', status: 'completed', date: '2026-03-15', number: 3 },
    { id: 's4', groupId: 'g1', status: 'planned', date: '2026-03-22', number: 4 },
    { id: 's5', groupId: 'g1', status: 'cancelled', date: '2026-03-29', number: 5 },
    { id: 't1', groupId: 'g2', status: 'completed', date: '2025-12-10', number: 1 },
    { id: 't2', groupId: 'g2', status: 'completed', date: '2026-01-05', number: 2 },
  ],
  attendance: [
    { sessionId: 's1', participantId: 'p1', status: 'present' },
    { sessionId: 's2', participantId: 'p1', status: 'present' },
    { sessionId: 's3', participantId: 'p1', status: 'left_early' },
    { sessionId: 's1', participantId: 'p2', status: 'present' },
    { sessionId: 's2', participantId: 'p2', status: 'absent' },
    { sessionId: 's1', participantId: 'p3', status: 'late' },
    { sessionId: 's1', participantId: 'p4', status: 'present' },
    { sessionId: 't1', participantId: 'p5', status: 'present' },
    { sessionId: 't2', participantId: 'p5', status: 'present' },
    { sessionId: 't2', participantId: 'p1', status: 'present' },
  ],
  observations: [],
  outcomes: [
    { participantId: 'p1', groupId: 'g1', kind: 'entry', situation: 'recherche_emploi' },
    { participantId: 'p3', groupId: 'g1', kind: 'exit', situation: 'autre_etape' },
  ],
};

const dataset: FundingDataset = {
  impact,
  sessionDetails: [
    { id: 's1', startTime: '09:00:00', endTime: '12:30:00' },
    { id: 's2', startTime: null, endTime: null },
  ],
  programs: [
    { groupId: 'g1', sessionMinutes: 180, sessionsCount: 6 },
    { groupId: 'g2', sessionMinutes: 180, sessionsCount: null },
  ],
};

const terms = { plannedParticipants: 4, plannedHoursPerParticipant: 18, startDate: '2026-01-01', endDate: '2026-12-31' };

const satisfaction: SatisfactionSummary[] = [
  {
    audience: 'participant',
    moment: 'hot',
    invited: 3,
    responses: 2,
    rate: 2 / 3,
    groupsOpen: 1,
    questions: [
      {
        question: { id: 'q1', versionId: 'v', versionLabel: 'v1', position: 1, kind: 'rating', text: 'Satisfaction globale', options: [] },
        n: 2,
        mean: 4.5,
        distribution: [],
        recommendationIndex: null,
        verbatims: [],
        hiddenVerbatims: 0,
      },
      {
        question: { id: 'q2', versionId: 'v', versionLabel: 'v1', position: 2, kind: 'text', text: 'Commentaire', options: [] },
        n: 1,
        mean: null,
        distribution: [],
        recommendationIndex: null,
        verbatims: [],
        hiddenVerbatims: 1,
      },
    ],
  },
  { audience: 'participant', moment: 'cold', invited: 0, responses: 0, rate: null, groupsOpen: 0, questions: [] },
];

describe('tableau de bord d’une convention', () => {
  const report = computeConventionReport({ terms, groupIds: ['g1'], dataset, satisfaction, countersignedSessionIds: ['s1'], today: TODAY });

  it('compte les parcours entrés (retraits exclus) face aux participants conventionnés', () => {
    expect(report.participants).toMatchObject({ planned: 4, entered: 3, distinct: 3 });
    expect(report.participants.entryRate).toEqual({ count: 3, n: 4, rate: 75 });
  });

  it('applique la règle du certificat : séances terminées et présences comptées en entier', () => {
    const byId = new Map(report.rows.map((row) => [row.participantId, row]));
    // p1 : 3 h 30 (horaires) + 3 h + 3 h (trame) ; départ anticipé compté en entier.
    expect(byId.get('p1')?.realisedMinutes).toBe(570);
    expect(byId.get('p2')?.realisedMinutes).toBe(210);
    expect(byId.get('p3')?.realisedMinutes).toBe(210);
    expect(byId.has('p4')).toBe(false);
    // Prévu : 4 séances non annulées + 2 séances de la trame non planifiées.
    expect(byId.get('p1')?.plannedMinutes).toBe(210 + 180 * 3 + 2 * 180);
    expect(report.hours.realisedMinutes).toBe(990);
    expect(report.hours.conventionMinutes).toBe(4 * 18 * 60);
    expect(report.hours.realisationRate.rate).toBeCloseTo((990 / 4320) * 100);
    expect(report.hours.scheduleRate.n).toBe(1110 * 3);
  });

  it('signale les présences non saisies sans les compter comme absences ni comme réalisées', () => {
    // p2 n'a pas de présence en séance 3 ; p3, en abandon depuis le 5 mars, n'est plus attendu.
    expect(report.hours.missingAttendance).toBe(1);
    expect(report.indicators.attendance).toEqual({ count: 5, n: 6, rate: (5 / 6) * 100 });
    expect(report.hours.sessionsWithoutTimes).toBe(2);
    expect(report.hours.sessionsOutsidePeriod).toBe(0);
  });

  it('reprend abandons et situations du tableau d’impact, « non renseigné » hors des taux', () => {
    expect(report.indicators.dropped).toBe(1);
    expect(report.indicators.dropReasons.sante).toBe(1);
    expect(report.indicators.outcomes.entry).toMatchObject({ expected: 3, recorded: 1, missing: 2 });
    expect(report.indicators.outcomes.exit).toMatchObject({ expected: 1, recorded: 1, missing: 0 });
    expect(report.indicators.outcomes.followup_3m).toMatchObject({ expected: 1, recorded: 0, missing: 1, rate: 0 });
    expect(report.indicators.progression).toMatchObject({ n: 0, rate: null, insufficient: 3 });
  });

  it('donne le taux de réponse à la satisfaction avec son effectif, et rien sans invité', () => {
    expect(report.satisfaction[0]?.responseRate).toEqual({ count: 2, n: 3, rate: (2 / 3) * 100 });
    expect(report.satisfaction[0]?.scores).toEqual([{ text: 'Satisfaction globale', kind: 'rating', mean: 4.5, n: 2, recommendationIndex: null }]);
    expect(report.satisfaction[1]?.responseRate.rate).toBeNull();
  });

  it('liste les pièces justificatives : feuilles par séance terminée et certificats', () => {
    expect(report.evidence.sheets.map((sheet) => [sheet.number, sheet.countersigned])).toEqual([
      [1, true],
      [2, false],
      [3, false],
    ]);
    expect(report.evidence.certificates).toBe(3);
  });

  it('repère les séances hors période de la convention', () => {
    const late = computeConventionReport({ terms: { ...terms, startDate: '2026-03-10' }, groupIds: ['g1'], dataset, today: TODAY });
    expect(late.hours.sessionsOutsidePeriod).toBe(2);
  });

  it('sans groupe rattaché : aucun pourcentage inventé', () => {
    const empty = computeConventionReport({ terms, groupIds: [], dataset, today: TODAY });
    expect(empty.participants.entered).toBe(0);
    expect(empty.indicators.attendance.rate).toBeNull();
    expect(empty.hours.scheduleRate.rate).toBeNull();
    expect(empty.hours.averageRealisedMinutes).toBeNull();
    expect(empty.hours.realisationRate.rate).toBe(0);
  });

  it('exporte la réalisation par participant sans écrire 0 pour une donnée inconnue', () => {
    const csv = realisationCsv({ reference: 'FT-2026-01', title: 'Action' }, report);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain('Heures réalisées');
    const benali = lines.find((line) => line.includes('Benali'))!;
    expect(benali).toContain('"Non renseigné"');
    expect(benali).toContain('"3,5"');
  });
});

describe('bilan pédagogique et financier', () => {
  const links = [{ groupId: 'g1', conventionId: 'c1' }];
  const conventions = [{ id: 'c1', reference: 'FT-2026-01', title: 'Action', funderName: 'France Travail Occitanie', funderKind: 'france_travail' }];

  it('compte les stagiaires distincts et les heures réalisées dans l’année civile', () => {
    const bpf = computeBpf({ year: 2026, dataset, links, conventions });
    // p1 (g1 et g2), p2, p3, p5 ; heures de 2026 uniquement (t1 date de 2025).
    expect(bpf.total).toEqual({ trainees: 4, minutes: 990 + 180 + 180 });
    expect(bpf.origins.map((row) => [row.origin, row.trainees, row.minutes])).toEqual([
      ['france_travail', 3, 990],
      ['sans_convention', 2, 360],
    ]);
    expect(bpf.conventions[0]).toMatchObject({ reference: 'FT-2026-01', trainees: 3 });
    expect(bpf.traineeTypes.every((type) => type.trainees === null && type.minutes === null)).toBe(true);
    expect(bpf.entrySituations).toEqual([
      { situation: 'recherche_emploi', label: 'Recherche active d’emploi', trainees: 1 },
      { situation: null, label: 'Non renseigné', trainees: 3 },
    ]);
    expect(bpf.warnings.missingAttendance).toBe(1);
  });

  it('ne retient que les séances de l’année demandée', () => {
    const bpf = computeBpf({ year: 2025, dataset, links, conventions });
    expect(bpf.total).toEqual({ trainees: 1, minutes: 180 });
    expect(computeBpf({ year: 2024, dataset, links, conventions }).total).toEqual({ trainees: 0, minutes: 0 });
  });

  it('écrit « À compléter » pour les montants et les types de stagiaires', () => {
    const csv = bpfCsv(computeBpf({ year: 2026, dataset, links, conventions }));
    expect(csv).toContain('"Personnes en recherche d’emploi formées par votre organisme";"À compléter";"À compléter"');
    expect(csv).toContain('"Total des stagiaires";"4";"22,5"');
    expect(csv).not.toMatch(/Montant HT[^\r]*\r\n[^\r]*"0"/);
  });

  it('associe chaque type de financeur à une famille du cadre C', () => {
    expect(bpfOriginOf('region')).toBe('region');
    expect(bpfOriginOf('fse_plus')).toBe('europe');
    expect(bpfOriginOf('departement')).toBe('autres_publics');
    expect(bpfOriginOf(null)).toBe('sans_convention');
    expect(hoursValue(90)).toBe(1.5);
  });
});
