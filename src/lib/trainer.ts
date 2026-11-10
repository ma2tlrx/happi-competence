import 'server-only';

import type { ServerClient } from '@/lib/supabase/server';

export type TrainerSession = {
  id: string;
  number: number;
  title: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  groupId: string;
  groupName: string;
  organizationName: string | null;
};

/** Sessions visibles par l'utilisateur (RLS : groupes attribués, ou tout pour l'administrateur). */
export async function listSessions(supabase: ServerClient, options: { groupIds?: string[] } = {}) {
  let query = supabase
    .from('sessions')
    .select('id, number, scheduled_date, start_time, end_time, location, status, group_id, program_sessions ( title ), groups ( id, name, organizations ( name ) )')
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .order('number');
  if (options.groupIds) query = query.in('group_id', options.groupIds);
  const { data } = await query;
  return (data ?? []).map(
    (session): TrainerSession => ({
      id: session.id,
      number: session.number,
      title: session.program_sessions?.title ?? `Session ${session.number}`,
      date: session.scheduled_date,
      startTime: session.start_time,
      endTime: session.end_time,
      location: session.location,
      status: session.status as TrainerSession['status'],
      groupId: session.group_id,
      groupName: session.groups?.name ?? '',
      organizationName: session.groups?.organizations?.name ?? null,
    }),
  );
}

/** Groupes dont l'utilisateur est formateur (l'administrateur voit ses propres groupes ici). */
export async function myGroupIds(supabase: ServerClient, userId: string) {
  const { data } = await supabase.from('group_trainers').select('group_id').eq('trainer_id', userId);
  return (data ?? []).map((row) => row.group_id);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Évaluations restant à faire : participants présents (ou en retard, départ anticipé)
 * aux sessions terminées, sans évaluation validée.
 */
export async function pendingEvaluations(supabase: ServerClient, sessionIds: string[]) {
  if (sessionIds.length === 0) return [];
  const [{ data: attendance }, { data: evaluations }] = await Promise.all([
    supabase.from('attendance').select('session_id, participant_id, status').in('session_id', sessionIds).in('status', ['present', 'late', 'left_early']),
    supabase.from('evaluations').select('session_id, participant_id, status').in('session_id', sessionIds),
  ]);
  const done = new Set((evaluations ?? []).filter((row) => row.status === 'validated').map((row) => `${row.session_id}:${row.participant_id}`));
  const drafts = new Set((evaluations ?? []).filter((row) => row.status === 'draft').map((row) => `${row.session_id}:${row.participant_id}`));
  return (attendance ?? [])
    .filter((row) => !done.has(`${row.session_id}:${row.participant_id}`))
    .map((row) => ({ sessionId: row.session_id, participantId: row.participant_id, draft: drafts.has(`${row.session_id}:${row.participant_id}`) }));
}
