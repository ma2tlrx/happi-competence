/**
 * Heures réalisées par parcours, pour les conventions et le BPF — module pur.
 *
 * Règle unique, celle du certificat de réalisation (src/lib/attendance/hours.ts,
 * computeRealisation) : une séance terminée compte en entier si le participant y était
 * présent, en retard ou parti plus tôt ; durée selon les horaires renseignés, sinon selon
 * la trame du programme, sinon 3 h. Aucune autre règle n'est appliquée ici.
 */
import { computeRealisation, type Realisation } from '@/lib/attendance/hours';
import type { ImpactDataset, ImpactMembership, ImpactSession } from '@/lib/outcomes/impact';

export type FundingSessionDetail = { id: string; startTime: string | null; endTime: string | null };
export type FundingGroupProgram = { groupId: string; sessionMinutes: number | null; sessionsCount: number | null };

/** Données lues en base (avec les droits de l'utilisateur) : celles du tableau d'impact, plus les horaires. */
export type FundingDataset = {
  impact: ImpactDataset;
  sessionDetails: FundingSessionDetail[];
  programs: FundingGroupProgram[];
};

export type RealisationContext = {
  sessionsByGroup: Map<string, ImpactSession[]>;
  detailById: Map<string, FundingSessionDetail>;
  programByGroup: Map<string, FundingGroupProgram>;
  attendanceByKey: Map<string, string>;
};

export function realisationContext(dataset: FundingDataset): RealisationContext {
  const sessionsByGroup = new Map<string, ImpactSession[]>();
  for (const session of dataset.impact.sessions) sessionsByGroup.set(session.groupId, [...(sessionsByGroup.get(session.groupId) ?? []), session]);
  return {
    sessionsByGroup,
    detailById: new Map(dataset.sessionDetails.map((detail) => [detail.id, detail])),
    programByGroup: new Map(dataset.programs.map((program) => [program.groupId, program])),
    attendanceByKey: new Map(dataset.impact.attendance.map((row) => [`${row.participantId}:${row.sessionId}`, row.status])),
  };
}

/** Réalisation d'un parcours (participant × groupe), exactement comme sur son certificat. */
export function membershipRealisation(ctx: RealisationContext, membership: Pick<ImpactMembership, 'groupId' | 'participantId'>): Realisation {
  const sessions = ctx.sessionsByGroup.get(membership.groupId) ?? [];
  const program = ctx.programByGroup.get(membership.groupId);
  const attendance = new Map<string, string>();
  for (const session of sessions) {
    const status = ctx.attendanceByKey.get(`${membership.participantId}:${session.id}`);
    if (status !== undefined) attendance.set(session.id, status);
  }
  return computeRealisation({
    sessions: sessions.map((session) => ({
      id: session.id,
      number: session.number,
      status: session.status,
      scheduledDate: session.date,
      startTime: ctx.detailById.get(session.id)?.startTime ?? null,
      endTime: ctx.detailById.get(session.id)?.endTime ?? null,
    })),
    attendance,
    programMinutes: program?.sessionMinutes ?? null,
    programSessionsCount: program?.sessionsCount ?? null,
  });
}

/**
 * Présences attendues mais non saisies : séance terminée, parcours non abandonné à cette date,
 * aucune présence enregistrée. Ces séances ne sont pas comptées comme réalisées (règle du
 * certificat) : le nombre est affiché pour que l'écart soit corrigé, jamais masqué.
 */
export function missingAttendance(ctx: RealisationContext, membership: ImpactMembership, inRange: (date: string | null) => boolean = () => true) {
  let missing = 0;
  for (const session of ctx.sessionsByGroup.get(membership.groupId) ?? []) {
    if (session.status !== 'completed' || !inRange(session.date)) continue;
    if (membership.status === 'dropped' && membership.droppedAt && session.date && session.date > membership.droppedAt) continue;
    if (!ctx.attendanceByKey.has(`${membership.participantId}:${session.id}`)) missing += 1;
  }
  return missing;
}

/** Séances terminées sans horaires : leur durée vient de la trame du programme (ou 3 h par défaut). */
export function sessionsWithoutTimes(ctx: RealisationContext, groupIds: Iterable<string>, inRange: (date: string | null) => boolean = () => true) {
  let count = 0;
  for (const groupId of groupIds) {
    for (const session of ctx.sessionsByGroup.get(groupId) ?? []) {
      if (session.status !== 'completed' || !inRange(session.date)) continue;
      const detail = ctx.detailById.get(session.id);
      if (!detail?.startTime || !detail?.endTime) count += 1;
    }
  }
  return count;
}

/** Restreint le jeu de données aux groupes donnés (inscriptions retirées exclues). */
export function restrictToGroups(dataset: FundingDataset, groupIds: Iterable<string>): FundingDataset {
  const ids = new Set(groupIds);
  const memberships = dataset.impact.memberships.filter((membership) => ids.has(membership.groupId) && membership.status !== 'removed');
  const participantIds = new Set(memberships.map((membership) => membership.participantId));
  const sessions = dataset.impact.sessions.filter((session) => ids.has(session.groupId));
  const sessionIds = new Set(sessions.map((session) => session.id));
  return {
    impact: {
      groups: dataset.impact.groups.filter((group) => ids.has(group.id)),
      participants: dataset.impact.participants.filter((participant) => participantIds.has(participant.id)),
      memberships,
      sessions,
      attendance: dataset.impact.attendance.filter((row) => sessionIds.has(row.sessionId) && participantIds.has(row.participantId)),
      observations: dataset.impact.observations.filter((row) => sessionIds.has(row.sessionId) && participantIds.has(row.participantId)),
      outcomes: dataset.impact.outcomes.filter((row) => row.groupId !== null && ids.has(row.groupId) && participantIds.has(row.participantId)),
    },
    sessionDetails: dataset.sessionDetails.filter((detail) => sessionIds.has(detail.id)),
    programs: dataset.programs.filter((program) => ids.has(program.groupId)),
  };
}
