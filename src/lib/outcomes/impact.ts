/**
 * Tableau de bord d'impact — agrégats purs, sans accès à la base.
 *
 * Unité de compte : un parcours = une inscription d'un participant à un groupe (cohorte).
 * Les inscriptions « retirées » (erreur d'inscription) sont exclues ; les abandons restent comptés.
 *
 * Règles de calcul (documentées dans docs/impact.md) :
 *   • assiduité : présences (présent, en retard, départ anticipé) / présences renseignées sur les
 *     séances terminées. Une présence non saisie n'est pas une absence : elle sort du dénominateur.
 *   • progression observée : au moins une compétence évaluée sur au moins deux séances du groupe,
 *     avec un niveau à la dernière observation supérieur à celui de la première (même calcul que le
 *     passeport : summarizeSkill du moteur d'évaluation). Les parcours sans compétence observée deux
 *     fois sont « non évaluables » et sortent du dénominateur.
 *   • situations : un suivi est « attendu » dès son échéance (voir schedule.ts). Le taux de suivi est
 *     le nombre de situations renseignées / attendues ; les situations manquantes sont affichées
 *     « non renseigné », jamais comptées comme zéro ni rangées dans une catégorie.
 * Chaque taux est accompagné de son effectif (n) ; un taux sans effectif vaut null (« — »).
 */
import { summarizeSkill, type Observation } from '@/lib/evaluation-engine';

import { DROP_REASON_CODES, OUTCOME_KIND_CODES, OUTCOME_SITUATION_CODES, type DropReason, type OutcomeKind, type OutcomeSituation } from './labels';
import { followupTasks, isExpected, type FollowupState } from './schedule';

export type ImpactGroup = {
  id: string;
  name: string;
  programId: string;
  programName: string;
  organizationId: string | null;
  organizationName: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
};
export type ImpactParticipant = { id: string; firstName: string; lastName: string; organizationId: string | null; organizationName: string | null };
export type ImpactMembership = { groupId: string; participantId: string; status: string; dropReason: string | null; droppedAt: string | null };
export type ImpactSession = { id: string; groupId: string; status: string; date: string | null; number: number };
export type ImpactAttendance = { sessionId: string; participantId: string; status: string };
export type ImpactObservation = { participantId: string; sessionId: string; skillId: string; score: number };
export type ImpactOutcome = { participantId: string; groupId: string | null; kind: string; situation: string };

export type ImpactDataset = {
  groups: ImpactGroup[];
  participants: ImpactParticipant[];
  memberships: ImpactMembership[];
  sessions: ImpactSession[];
  attendance: ImpactAttendance[];
  observations: ImpactObservation[];
  outcomes: ImpactOutcome[];
};

export type Ratio = { count: number; n: number; rate: number | null };
export type OutcomeBreakdown = {
  /** Situations attendues à la date du jour (échéance atteinte). */
  expected: number;
  /** Situations renseignées parmi les attendues. */
  recorded: number;
  /** Attendues mais non renseignées : affichées « non renseigné ». */
  missing: number;
  rate: number | null;
  bySituation: Record<OutcomeSituation, number>;
};
export type ImpactIndicators = {
  enrolled: number;
  active: number;
  dropped: number;
  dropRate: Ratio;
  dropReasons: Record<DropReason, number>;
  sessionsCompleted: number;
  attendance: Ratio;
  progression: Ratio & { insufficient: number };
  outcomes: Record<OutcomeKind, OutcomeBreakdown>;
};

export type ImpactFilters = { from?: string | null; to?: string | null; programId?: string | null; organizationId?: string | null };

const ATTENDED = new Set(['present', 'late', 'left_early']);

export function ratio(count: number, n: number): Ratio {
  return { count, n, rate: n > 0 ? (count / n) * 100 : null };
}

function zeroes<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

/** Filtre période (chevauchement des dates du groupe), programme et organisme du participant. */
export function filterDataset(dataset: ImpactDataset, filters: ImpactFilters): ImpactDataset {
  const { from, to, programId, organizationId } = filters;
  const groups = dataset.groups.filter((group) => {
    if (programId && group.programId !== programId) return false;
    if (from || to) {
      if (!group.startDate && !group.endDate) return false;
      if (to && (group.startDate ?? group.endDate)! > to) return false;
      if (from && (group.endDate ?? '9999-12-31') < from) return false;
    }
    return true;
  });
  const groupIds = new Set(groups.map((group) => group.id));
  const orgOf = new Map(dataset.participants.map((participant) => [participant.id, participant.organizationId]));
  const memberships = dataset.memberships.filter(
    (membership) =>
      groupIds.has(membership.groupId) && membership.status !== 'removed' && (!organizationId || orgOf.get(membership.participantId) === organizationId),
  );
  const participantIds = new Set(memberships.map((membership) => membership.participantId));
  return {
    groups: groups.filter((group) => memberships.some((membership) => membership.groupId === group.id) || !organizationId),
    participants: dataset.participants.filter((participant) => participantIds.has(participant.id)),
    memberships,
    sessions: dataset.sessions.filter((session) => groupIds.has(session.groupId)),
    attendance: dataset.attendance.filter((row) => participantIds.has(row.participantId)),
    observations: dataset.observations.filter((row) => participantIds.has(row.participantId)),
    outcomes: dataset.outcomes.filter((row) => participantIds.has(row.participantId)),
  };
}

type Context = {
  dataset: ImpactDataset;
  today: string;
  sessionsByGroup: Map<string, ImpactSession[]>;
  attendanceByKey: Map<string, string>;
  observationsByParticipant: Map<string, ImpactObservation[]>;
  outcomesByKey: Map<string, ImpactOutcome>;
  followupStates: Map<string, FollowupState>;
};

function context(dataset: ImpactDataset, today: string): Context {
  const sessionsByGroup = new Map<string, ImpactSession[]>();
  for (const session of dataset.sessions) sessionsByGroup.set(session.groupId, [...(sessionsByGroup.get(session.groupId) ?? []), session]);
  const observationsByParticipant = new Map<string, ImpactObservation[]>();
  for (const row of dataset.observations) observationsByParticipant.set(row.participantId, [...(observationsByParticipant.get(row.participantId) ?? []), row]);
  const groups = dataset.groups.map((group) => {
    const completed = (sessionsByGroup.get(group.id) ?? []).filter((session) => session.status === 'completed' && session.date);
    const last = completed.map((session) => session.date!).sort().at(-1) ?? null;
    return { id: group.id, name: group.name, status: group.status, endDate: group.endDate, lastCompletedSessionDate: last };
  });
  const tasks = followupTasks(dataset.memberships, groups, dataset.outcomes, today);
  return {
    dataset,
    today,
    sessionsByGroup,
    attendanceByKey: new Map(dataset.attendance.map((row) => [`${row.participantId}:${row.sessionId}`, row.status])),
    observationsByParticipant,
    outcomesByKey: new Map(dataset.outcomes.map((row) => [`${row.participantId}:${row.groupId ?? ''}:${row.kind}`, row])),
    followupStates: new Map(tasks.map((task) => [`${task.participantId}:${task.groupId}:${task.kind}`, task.state])),
  };
}

export type JourneyDetail = {
  attendance: Ratio;
  /** true : progression observée ; false : pas de progression ; null : non évaluable. */
  progressed: boolean | null;
  /** Situation par moment : code, null si attendue mais non renseignée, undefined si pas encore attendue. */
  outcomes: Record<OutcomeKind, string | null | undefined>;
};

function journey(ctx: Context, membership: ImpactMembership): JourneyDetail {
  const sessions = ctx.sessionsByGroup.get(membership.groupId) ?? [];
  const completed = sessions.filter((session) => session.status === 'completed');
  const statuses = completed
    .map((session) => ctx.attendanceByKey.get(`${membership.participantId}:${session.id}`))
    .filter((status): status is string => status !== undefined);
  const attended = statuses.filter((status) => ATTENDED.has(status)).length;

  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const bySkill = new Map<string, Observation[]>();
  for (const row of ctx.observationsByParticipant.get(membership.participantId) ?? []) {
    const session = sessionById.get(row.sessionId);
    if (!session) continue;
    const observation: Observation = { skillCode: row.skillId, score: row.score, sessionNumber: session.number, date: session.date ?? '' };
    bySkill.set(row.skillId, [...(bySkill.get(row.skillId) ?? []), observation]);
  }
  const deltas = [...bySkill].map(([skill, observations]) => summarizeSkill(skill, observations, { aggregation: 'latest', rounding: 'none' }).delta);
  const evaluable = deltas.filter((delta): delta is number => delta !== null);
  const progressed = evaluable.length === 0 ? null : evaluable.some((delta) => delta > 0);

  const outcomes = {} as Record<OutcomeKind, string | null | undefined>;
  for (const kind of OUTCOME_KIND_CODES) {
    const recorded = ctx.outcomesByKey.get(`${membership.participantId}:${membership.groupId}:${kind}`);
    const expected = kind === 'entry' ? true : (() => {
      const state = ctx.followupStates.get(`${membership.participantId}:${membership.groupId}:${kind}`);
      return state !== undefined && isExpected({ state });
    })();
    outcomes[kind] = recorded ? recorded.situation : expected ? null : undefined;
  }
  return { attendance: ratio(attended, statuses.length), progressed, outcomes };
}

export function computeIndicators(dataset: ImpactDataset, today: string, memberships = dataset.memberships, ctx = context(dataset, today)): ImpactIndicators {
  const counted = memberships.filter((membership) => membership.status !== 'removed');
  const dropped = counted.filter((membership) => membership.status === 'dropped');
  const dropReasons = zeroes(DROP_REASON_CODES);
  for (const membership of dropped) if (membership.dropReason && membership.dropReason in dropReasons) dropReasons[membership.dropReason as DropReason] += 1;

  const groupIds = new Set(counted.map((membership) => membership.groupId));
  const sessionsCompleted = [...groupIds].reduce(
    (sum, id) => sum + (ctx.sessionsByGroup.get(id) ?? []).filter((session) => session.status === 'completed').length,
    0,
  );

  let attended = 0;
  let recordedAttendance = 0;
  let progressed = 0;
  let evaluable = 0;
  let insufficient = 0;
  const outcomes = Object.fromEntries(
    OUTCOME_KIND_CODES.map((kind) => [kind, { expected: 0, recorded: 0, missing: 0, rate: null, bySituation: zeroes(OUTCOME_SITUATION_CODES) }]),
  ) as Record<OutcomeKind, OutcomeBreakdown>;

  for (const membership of counted) {
    const detail = journey(ctx, membership);
    attended += detail.attendance.count;
    recordedAttendance += detail.attendance.n;
    if (detail.progressed === null) insufficient += 1;
    else {
      evaluable += 1;
      if (detail.progressed) progressed += 1;
    }
    for (const kind of OUTCOME_KIND_CODES) {
      const value = detail.outcomes[kind];
      if (value === undefined) continue;
      const breakdown = outcomes[kind];
      breakdown.expected += 1;
      if (value === null) breakdown.missing += 1;
      else {
        breakdown.recorded += 1;
        if (value in breakdown.bySituation) breakdown.bySituation[value as OutcomeSituation] += 1;
      }
    }
  }
  for (const kind of OUTCOME_KIND_CODES) outcomes[kind].rate = ratio(outcomes[kind].recorded, outcomes[kind].expected).rate;

  return {
    enrolled: counted.length,
    active: counted.length - dropped.length,
    dropped: dropped.length,
    dropRate: ratio(dropped.length, counted.length),
    dropReasons,
    sessionsCompleted,
    attendance: ratio(attended, recordedAttendance),
    progression: { ...ratio(progressed, evaluable), insufficient },
    outcomes,
  };
}

export type CohortRow = { group: ImpactGroup; indicators: ImpactIndicators };
export type OrganizationRow = { organizationId: string | null; organizationName: string; indicators: ImpactIndicators };
export type ParticipantRow = {
  participant: ImpactParticipant;
  group: ImpactGroup;
  membership: ImpactMembership;
  detail: JourneyDetail;
};

export type ImpactReport = {
  total: ImpactIndicators;
  cohorts: CohortRow[];
  organizations: OrganizationRow[];
  participants: ParticipantRow[];
};

export const WITHOUT_ORGANIZATION = 'Sans organisme';

/** Indicateurs globaux, par cohorte, par organisme (du participant) et détail par parcours. */
export function buildImpactReport(dataset: ImpactDataset, today: string): ImpactReport {
  const ctx = context(dataset, today);
  const participantById = new Map(dataset.participants.map((participant) => [participant.id, participant]));
  const groupById = new Map(dataset.groups.map((group) => [group.id, group]));
  const counted = dataset.memberships.filter((membership) => membership.status !== 'removed' && groupById.has(membership.groupId));

  const cohorts = dataset.groups
    .map((group) => ({ group, indicators: computeIndicators(dataset, today, counted.filter((membership) => membership.groupId === group.id), ctx) }))
    .sort((a, b) => (b.group.startDate ?? '').localeCompare(a.group.startDate ?? '') || a.group.name.localeCompare(b.group.name, 'fr'));

  const byOrganization = new Map<string, { id: string | null; name: string; memberships: ImpactMembership[] }>();
  for (const membership of counted) {
    const participant = participantById.get(membership.participantId);
    const key = participant?.organizationId ?? '';
    const entry = byOrganization.get(key) ?? { id: participant?.organizationId ?? null, name: participant?.organizationName ?? WITHOUT_ORGANIZATION, memberships: [] };
    entry.memberships.push(membership);
    byOrganization.set(key, entry);
  }
  const organizations = [...byOrganization.values()]
    .map((entry) => ({ organizationId: entry.id, organizationName: entry.name, indicators: computeIndicators(dataset, today, entry.memberships, ctx) }))
    .sort((a, b) => (a.organizationId === null ? 1 : 0) - (b.organizationId === null ? 1 : 0) || a.organizationName.localeCompare(b.organizationName, 'fr'));

  const participants = counted
    .filter((membership) => participantById.has(membership.participantId))
    .map((membership) => ({
      participant: participantById.get(membership.participantId)!,
      group: groupById.get(membership.groupId)!,
      membership,
      detail: journey(ctx, membership),
    }))
    .sort((a, b) => a.participant.lastName.localeCompare(b.participant.lastName, 'fr') || a.group.name.localeCompare(b.group.name, 'fr'));

  return { total: computeIndicators(dataset, today, counted, ctx), cohorts, organizations, participants };
}

/** Pourcentage lisible avec son effectif : « 75 % (n = 8) » ; « — (n = 0) » sans effectif. */
export function formatRatio(value: Pick<Ratio, 'rate' | 'n'>) {
  return `${value.rate === null ? '—' : `${Math.round(value.rate)} %`} (n = ${value.n})`;
}
