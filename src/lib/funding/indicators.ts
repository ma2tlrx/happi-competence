/**
 * Tableau de bord d'une convention de financement : réalisé / conventionné — module pur.
 *
 * Tout est calculé à partir des données existantes, avec les règles déjà en place :
 *   • heures réalisées : règle du certificat de réalisation (voir realisation.ts) ;
 *   • assiduité, abandons, progression, situations de sortie et suivis : tableau de bord
 *     d'impact (src/lib/outcomes/impact.ts), sur les seuls groupes de la convention ;
 *   • satisfaction : synthèses du module satisfaction (taux de réponse = réponses / invités).
 * Chaque taux est accompagné de son effectif (n). Une donnée non renseignée n'est jamais
 * comptée comme zéro : elle sort du dénominateur et son nombre est affiché à part.
 * Unité de compte : le parcours (un participant dans un groupe), comme pour l'impact.
 */
import { buildImpactReport, ratio, type ImpactIndicators, type Ratio } from '@/lib/outcomes/impact';
import type { OutcomeKind } from '@/lib/outcomes/labels';
import type { SatisfactionSummary } from '@/lib/satisfaction/aggregate';
import type { SatisfactionAudience, SatisfactionMoment } from '@/lib/satisfaction/window';

import { membershipRealisation, missingAttendance, realisationContext, restrictToGroups, sessionsWithoutTimes, type FundingDataset } from './realisation';

export type ConventionTerms = {
  plannedParticipants: number;
  plannedHoursPerParticipant: number;
  startDate: string;
  endDate: string;
};

export type ConventionParticipantRow = {
  participantId: string;
  firstName: string;
  lastName: string;
  organizationName: string | null;
  groupId: string;
  groupName: string;
  status: string;
  dropReason: string | null;
  droppedAt: string | null;
  realisedMinutes: number;
  plannedMinutes: number;
  attendedSessions: number;
  completedSessions: number;
  attendance: Ratio;
  /** Présences non saisies sur des séances terminées (non comptées comme réalisées). */
  missingAttendance: number;
  /** Code de situation ; null : attendue mais non renseignée ; undefined : pas encore attendue. */
  outcomes: Record<OutcomeKind, string | null | undefined>;
};

export type SatisfactionBlock = {
  audience: SatisfactionAudience;
  moment: SatisfactionMoment;
  invited: number;
  responses: number;
  /** Taux de réponse en % (réponses / invités), avec n = invités. */
  responseRate: Ratio;
  /** Questions notées (1 à 5) et de recommandation (0 à 10) : moyenne et nombre de réponses. */
  scores: { text: string; kind: 'rating' | 'nps'; mean: number | null; n: number; recommendationIndex: number | null }[];
};

export type EvidenceSheet = { sessionId: string; groupId: string; groupName: string; number: number; date: string | null; countersigned: boolean };

export type ConventionReport = {
  groups: { id: string; name: string; startDate: string | null; endDate: string | null; status: string; enrolled: number; sessionsCompleted: number }[];
  participants: {
    planned: number;
    /** Parcours entrés (inscriptions actives ou abandonnées ; retraits exclus). */
    entered: number;
    /** Personnes distinctes (un participant inscrit dans deux groupes de la convention compte une fois). */
    distinct: number;
    /** Entrés / conventionnés (peut dépasser 100 %). */
    entryRate: Ratio;
  };
  hours: {
    /** Heures-stagiaires conventionnées = participants × durée prévue (en minutes). */
    conventionMinutes: number;
    /** Heures-stagiaires planifiées au calendrier des parcours entrés (séances non annulées). */
    scheduledMinutes: number;
    realisedMinutes: number;
    /** Réalisé / conventionné, en % (n = minutes conventionnées). */
    realisationRate: Ratio;
    /** Réalisé / planifié, en % (n = minutes planifiées). */
    scheduleRate: Ratio;
    averageRealisedMinutes: number | null;
    missingAttendance: number;
    sessionsWithoutTimes: number;
    /** Séances terminées datées hors de la période de la convention, ou sans date. */
    sessionsOutsidePeriod: number;
  };
  indicators: ImpactIndicators;
  satisfaction: SatisfactionBlock[];
  evidence: { sheets: EvidenceSheet[]; countersignedSheets: number; certificates: number };
  rows: ConventionParticipantRow[];
};

function satisfactionBlocks(summaries: SatisfactionSummary[]): SatisfactionBlock[] {
  return summaries.map((summary) => ({
    audience: summary.audience,
    moment: summary.moment,
    invited: summary.invited,
    responses: summary.responses,
    responseRate: ratio(Math.min(summary.responses, summary.invited), summary.invited),
    scores: summary.questions
      .filter((question) => question.question.kind === 'rating' || question.question.kind === 'nps')
      .map((question) => ({
        text: question.question.text,
        kind: question.question.kind as 'rating' | 'nps',
        mean: question.mean,
        n: question.n,
        recommendationIndex: question.recommendationIndex,
      })),
  }));
}

export function computeConventionReport({
  terms,
  groupIds,
  dataset,
  satisfaction = [],
  countersignedSessionIds = [],
  today,
}: {
  terms: ConventionTerms;
  groupIds: string[];
  dataset: FundingDataset;
  satisfaction?: SatisfactionSummary[];
  countersignedSessionIds?: string[];
  today: string;
}): ConventionReport {
  const scoped = restrictToGroups(dataset, groupIds);
  const ctx = realisationContext(scoped);
  const impact = buildImpactReport(scoped.impact, today);
  const counted = scoped.impact.memberships;
  const participantById = new Map(scoped.impact.participants.map((participant) => [participant.id, participant]));
  const groupById = new Map(scoped.impact.groups.map((group) => [group.id, group]));
  const detailByKey = new Map(impact.participants.map((row) => [`${row.membership.participantId}:${row.membership.groupId}`, row.detail]));

  const rows: ConventionParticipantRow[] = counted
    .filter((membership) => participantById.has(membership.participantId) && groupById.has(membership.groupId))
    .map((membership) => {
      const participant = participantById.get(membership.participantId)!;
      const realisation = membershipRealisation(ctx, membership);
      const detail = detailByKey.get(`${membership.participantId}:${membership.groupId}`);
      return {
        participantId: participant.id,
        firstName: participant.firstName,
        lastName: participant.lastName,
        organizationName: participant.organizationName,
        groupId: membership.groupId,
        groupName: groupById.get(membership.groupId)!.name,
        status: membership.status,
        dropReason: membership.dropReason,
        droppedAt: membership.droppedAt,
        realisedMinutes: realisation.realisedMinutes,
        plannedMinutes: realisation.plannedMinutes,
        attendedSessions: realisation.attendedSessions,
        completedSessions: realisation.completedSessions,
        attendance: detail?.attendance ?? ratio(0, 0),
        missingAttendance: missingAttendance(ctx, membership),
        outcomes: detail?.outcomes ?? { entry: null, exit: undefined, followup_3m: undefined, followup_6m: undefined },
      };
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr') || a.groupName.localeCompare(b.groupName, 'fr'));

  const conventionMinutes = Math.round(terms.plannedParticipants * terms.plannedHoursPerParticipant * 60);
  const scheduledMinutes = rows.reduce((sum, row) => sum + row.plannedMinutes, 0);
  const realisedMinutes = rows.reduce((sum, row) => sum + row.realisedMinutes, 0);
  const inPeriod = (date: string | null) => Boolean(date) && date! >= terms.startDate && date! <= terms.endDate;
  const completed = scoped.impact.sessions.filter((session) => session.status === 'completed');
  const countersigned = new Set(countersignedSessionIds);

  const sheets: EvidenceSheet[] = completed
    .map((session) => ({
      sessionId: session.id,
      groupId: session.groupId,
      groupName: groupById.get(session.groupId)?.name ?? '',
      number: session.number,
      date: session.date,
      countersigned: countersigned.has(session.id),
    }))
    .sort((a, b) => a.groupName.localeCompare(b.groupName, 'fr') || a.number - b.number);

  return {
    groups: scoped.impact.groups
      .map((group) => {
        const cohort = impact.cohorts.find((row) => row.group.id === group.id);
        return {
          id: group.id,
          name: group.name,
          startDate: group.startDate,
          endDate: group.endDate,
          status: group.status,
          enrolled: cohort?.indicators.enrolled ?? 0,
          sessionsCompleted: cohort?.indicators.sessionsCompleted ?? 0,
        };
      })
      .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '') || a.name.localeCompare(b.name, 'fr')),
    participants: {
      planned: terms.plannedParticipants,
      entered: counted.length,
      distinct: new Set(counted.map((membership) => membership.participantId)).size,
      entryRate: ratio(counted.length, terms.plannedParticipants),
    },
    hours: {
      conventionMinutes,
      scheduledMinutes,
      realisedMinutes,
      realisationRate: ratio(realisedMinutes, conventionMinutes),
      scheduleRate: ratio(realisedMinutes, scheduledMinutes),
      averageRealisedMinutes: rows.length ? realisedMinutes / rows.length : null,
      missingAttendance: rows.reduce((sum, row) => sum + row.missingAttendance, 0),
      sessionsWithoutTimes: sessionsWithoutTimes(ctx, groupIds),
      sessionsOutsidePeriod: completed.filter((session) => !inPeriod(session.date)).length,
    },
    indicators: impact.total,
    satisfaction: satisfactionBlocks(satisfaction),
    evidence: {
      sheets,
      countersignedSheets: sheets.filter((sheet) => sheet.countersigned).length,
      certificates: rows.filter((row) => row.attendedSessions > 0).length,
    },
    rows,
  };
}

/** Heures décimales (deux décimales) à partir de minutes, pour les exports tableur. */
export function hoursValue(minutes: number) {
  return Math.round((minutes / 60) * 100) / 100;
}
