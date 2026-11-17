import 'server-only';

import { filterDataset, computeIndicators } from '@/lib/outcomes/impact';
import { loadImpactDataset } from '@/lib/outcomes/load';
import { loadSatisfactionResults } from '@/lib/satisfaction/load';
import type { ServerClient } from '@/lib/supabase/server';
import { firstOf, isUuid } from '@/lib/utils';

import {
  actionsInPeriod,
  actionStats,
  complaintStats,
  parseMaxAgeMonths,
  rate,
  satisfactionRate,
  subtractMonths,
  trainerTrainingStatus,
  type ActionStats,
  type ComplaintStats,
  type QualitySnapshot,
  type Rate,
  type TrainerTrainingStatus,
} from './indicators';

/**
 * Lectures du module qualité. Tout passe par la session de l'appelant : RLS réserve les
 * registres à l'administrateur, le registre de qualifications à son formateur, les
 * signalements à leur auteur.
 */

export type Period = { from: string; to: string };

const isoDate = (value: unknown) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);

/** Période ?du=…&au=… ; par défaut les 12 derniers mois. */
export function parsePeriod(params: Record<string, string | string[] | undefined>, today: string): Period {
  const one = (key: string) => (Array.isArray(params[key]) ? params[key][0] : params[key]);
  const from = isoDate(one('du')) ?? subtractMonths(today, 12);
  const to = isoDate(one('au')) ?? today;
  return from <= to ? { from, to } : { from: to, to: from };
}

export type ComplaintRecord = {
  id: string;
  source: string;
  channel: string;
  receivedOn: string;
  subject: string;
  description: string;
  reporterName: string | null;
  participantName: string | null;
  organizationName: string | null;
  status: string;
  response: string | null;
  respondedOn: string | null;
  createdAt: string;
};

export async function loadComplaints(supabase: ServerClient, period?: Period): Promise<ComplaintRecord[]> {
  let query = supabase
    .from('quality_complaints')
    .select('id, source, channel, received_on, subject, description, reporter_name, status, response, responded_on, created_at, participants ( first_name, last_name ), organizations ( name )')
    .order('received_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000);
  if (period) query = query.gte('received_on', period.from).lte('received_on', period.to);
  const { data } = await query;
  return (data ?? []).map((row) => {
    const participant = firstOf(row.participants);
    return {
      id: row.id,
      source: row.source,
      channel: row.channel,
      receivedOn: row.received_on,
      subject: row.subject,
      description: row.description,
      reporterName: row.reporter_name,
      participantName: participant ? `${participant.first_name} ${participant.last_name}`.trim() : null,
      organizationName: firstOf(row.organizations)?.name ?? null,
      status: row.status,
      response: row.response,
      respondedOn: row.responded_on,
      createdAt: row.created_at,
    };
  });
}

export type MyComplaint = Pick<ComplaintRecord, 'id' | 'subject' | 'description' | 'receivedOn' | 'status' | 'response' | 'respondedOn'>;

export async function loadMyComplaints(supabase: ServerClient, userId: string): Promise<MyComplaint[]> {
  const { data } = await supabase
    .from('quality_complaints')
    .select('id, subject, description, received_on, status, response, responded_on')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  return (data ?? []).map((row) => ({
    id: row.id,
    subject: row.subject,
    description: row.description,
    receivedOn: row.received_on,
    status: row.status,
    response: row.response,
    respondedOn: row.responded_on,
  }));
}

export type ImprovementAction = {
  id: string;
  origin: string;
  originDetails: string | null;
  title: string;
  description: string | null;
  ownerName: string | null;
  dueOn: string | null;
  status: string;
  closedOn: string | null;
  effectiveness: string | null;
  complaintId: string | null;
  complaintSubject: string | null;
  watchEntryId: string | null;
  watchSource: string | null;
  createdAt: string;
};

export async function loadImprovementActions(supabase: ServerClient): Promise<ImprovementAction[]> {
  const { data } = await supabase
    .from('quality_improvement_actions')
    .select('*, quality_complaints ( subject ), quality_watch_entries ( source )')
    .order('created_at', { ascending: false })
    .limit(1000);
  return (data ?? []).map((row) => ({
    id: row.id,
    origin: row.origin,
    originDetails: row.origin_details,
    title: row.title,
    description: row.description,
    ownerName: row.owner_name,
    dueOn: row.due_on,
    status: row.status,
    closedOn: row.closed_on,
    effectiveness: row.effectiveness,
    complaintId: row.complaint_id,
    complaintSubject: firstOf(row.quality_complaints)?.subject ?? null,
    watchEntryId: row.watch_entry_id,
    watchSource: firstOf(row.quality_watch_entries)?.source ?? null,
    createdAt: row.created_at,
  }));
}

export type WatchEntry = { id: string; kind: string; source: string; observedOn: string; summary: string; impact: string | null; decision: string | null };

export async function loadWatchEntries(supabase: ServerClient): Promise<WatchEntry[]> {
  const { data } = await supabase.from('quality_watch_entries').select('*').order('observed_on', { ascending: false }).limit(1000);
  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    source: row.source,
    observedOn: row.observed_on,
    summary: row.summary,
    impact: row.impact,
    decision: row.decision,
  }));
}

export type Qualification = {
  id: string;
  trainerId: string;
  kind: string;
  title: string;
  provider: string | null;
  description: string | null;
  startedOn: string | null;
  completedOn: string | null;
  isAiTraining: boolean;
  evidence: string | null;
};

const toQualification = (row: {
  id: string;
  trainer_id: string;
  kind: string;
  title: string;
  provider: string | null;
  description: string | null;
  started_on: string | null;
  completed_on: string | null;
  is_ai_training: boolean;
  evidence: string | null;
}): Qualification => ({
  id: row.id,
  trainerId: row.trainer_id,
  kind: row.kind,
  title: row.title,
  provider: row.provider,
  description: row.description,
  startedOn: row.started_on,
  completedOn: row.completed_on,
  isAiTraining: row.is_ai_training,
  evidence: row.evidence,
});

export async function loadTrainingMaxAge(supabase: ServerClient): Promise<number> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'quality.training_max_age_months').maybeSingle();
  return parseMaxAgeMonths(data?.value);
}

export type TrainerRegistry = {
  trainer: { id: string; firstName: string; lastName: string; email: string; role: string; status: string };
  qualifications: Qualification[];
  training: TrainerTrainingStatus;
};

/** Registre de tous les intervenants (administrateur) : formateurs actifs ou non, avec leurs lignes. */
export async function loadTrainerRegistry(supabase: ServerClient, today: string, maxAgeMonths: number): Promise<TrainerRegistry[]> {
  const [{ data: trainers }, { data: rows }] = await Promise.all([
    supabase.from('profiles').select('id, first_name, last_name, email, role, status').eq('role', 'formateur').order('last_name'),
    supabase.from('trainer_qualifications').select('*').order('completed_on', { ascending: false, nullsFirst: false }).limit(5000),
  ]);
  const byTrainer = new Map<string, Qualification[]>();
  for (const row of rows ?? []) byTrainer.set(row.trainer_id, [...(byTrainer.get(row.trainer_id) ?? []), toQualification(row)]);
  return (trainers ?? []).map((trainer) => {
    const qualifications = byTrainer.get(trainer.id) ?? [];
    return {
      trainer: { id: trainer.id, firstName: trainer.first_name, lastName: trainer.last_name, email: trainer.email, role: trainer.role, status: trainer.status },
      qualifications,
      training: trainerTrainingStatus(qualifications, today, maxAgeMonths),
    };
  });
}

export async function loadMyQualifications(supabase: ServerClient, userId: string): Promise<Qualification[]> {
  const { data } = await supabase
    .from('trainer_qualifications')
    .select('*')
    .eq('trainer_id', userId)
    .order('completed_on', { ascending: false, nullsFirst: false });
  return (data ?? []).map(toQualification);
}

export type NeedsAssessment = {
  assessedOn: string;
  expectations: string | null;
  constraintsNotes: string | null;
  prerequisites: string | null;
  prerequisitesMet: string | null;
  adaptationNeeded: boolean;
  adaptationPlanned: string | null;
  disabilityReferent: string | null;
  recordedRole: string | null;
  updatedAt: string;
};

export async function loadNeedsAssessment(supabase: ServerClient, participantId: string): Promise<NeedsAssessment | null> {
  if (!isUuid(participantId)) return null;
  const { data } = await supabase.from('participant_needs_assessments').select('*').eq('participant_id', participantId).maybeSingle();
  if (!data) return null;
  return {
    assessedOn: data.assessed_on,
    expectations: data.expectations,
    constraintsNotes: data.constraints_notes,
    prerequisites: data.prerequisites,
    prerequisitesMet: data.prerequisites_met,
    adaptationNeeded: data.adaptation_needed,
    adaptationPlanned: data.adaptation_planned,
    disabilityReferent: data.disability_referent,
    recordedRole: data.recorded_role,
    updatedAt: data.updated_at,
  };
}

export type QualityDashboard = {
  period: Period;
  snapshot: QualitySnapshot;
  complaints: ComplaintStats;
  actions: ActionStats;
  trainers: { total: number; upToDate: number; outdated: number; none: number; aiTrained: number; maxAgeMonths: number };
  needs: Rate & { adaptation: number };
};

/**
 * Indicateurs qualité d'une période. Réutilise les calculs existants : satisfaction
 * (src/lib/satisfaction), abandons et assiduité (src/lib/outcomes).
 */
export async function loadQualityDashboard(supabase: ServerClient, period: Period, today: string): Promise<QualityDashboard> {
  const [dataset, { data: groups }, complaints, actions, maxAgeMonths] = await Promise.all([
    loadImpactDataset(supabase),
    supabase.from('groups').select('id'),
    loadComplaints(supabase, period),
    loadImprovementActions(supabase),
    loadTrainingMaxAge(supabase),
  ]);
  const scoped = filterDataset(dataset, { from: period.from, to: period.to });
  const impact = computeIndicators(scoped, today);
  const { summaries } = await loadSatisfactionResults(supabase, (groups ?? []).map((group) => group.id), period);
  const registry = await loadTrainerRegistry(supabase, today, maxAgeMonths);
  const activeTrainers = registry.filter((entry) => entry.trainer.status === 'active');

  const participantIds = [...new Set(scoped.memberships.map((membership) => membership.participantId))];
  const assessed = new Map<string, boolean>();
  for (let index = 0; index < participantIds.length; index += 150) {
    const { data } = await supabase
      .from('participant_needs_assessments')
      .select('participant_id, adaptation_needed')
      .in('participant_id', participantIds.slice(index, index + 150));
    for (const row of data ?? []) assessed.set(row.participant_id, row.adaptation_needed);
  }

  const periodActions = actionsInPeriod(actions, period);

  return {
    period,
    snapshot: {
      satisfaction: satisfactionRate(summaries, 'participant', 'hot'),
      impact: { enrolled: impact.enrolled, dropped: impact.dropped, dropRate: impact.dropRate, attendance: impact.attendance },
    },
    complaints: complaintStats(complaints),
    actions: actionStats(periodActions, today),
    trainers: {
      total: activeTrainers.length,
      upToDate: activeTrainers.filter((entry) => entry.training.state === 'up_to_date').length,
      outdated: activeTrainers.filter((entry) => entry.training.state === 'outdated').length,
      none: activeTrainers.filter((entry) => entry.training.state === 'none').length,
      aiTrained: activeTrainers.filter((entry) => entry.training.aiTraining).length,
      maxAgeMonths,
    },
    needs: { ...rate(assessed.size, participantIds.length), adaptation: [...assessed.values()].filter(Boolean).length },
  };
}

export type PublicResultsState = { enabled: boolean; periodFrom: string | null; periodTo: string | null; computedAt: string | null; indicators: unknown };

export async function loadPublicResultsState(supabase: ServerClient): Promise<PublicResultsState> {
  const { data } = await supabase.from('quality_public_results').select('enabled, period_from, period_to, computed_at, indicators').maybeSingle();
  return {
    enabled: data?.enabled ?? false,
    periodFrom: data?.period_from ?? null,
    periodTo: data?.period_to ?? null,
    computedAt: data?.computed_at ?? null,
    indicators: data?.indicators ?? null,
  };
}
