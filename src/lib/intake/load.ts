import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';

export type IntakeRow = Database['public']['Tables']['participant_intakes']['Row'];

/**
 * Questionnaire d'accueil d'un participant, lu avec la session de l'appelant : la RLS ne l'ouvre qu'à la
 * personne elle-même, à ses formateurs et à l'administration (jamais à l'organisme).
 */
export async function loadIntake(supabase: SupabaseClient<Database>, participantId: string): Promise<IntakeRow | null> {
  const { data } = await supabase.from('participant_intakes').select('*').eq('participant_id', participantId).maybeSingle();
  return data ?? null;
}

/** Où en est la personne : rien commencé, en cours (dernière étape enregistrée), terminé. */
export function intakeProgress(row: Pick<IntakeRow, 'last_step' | 'completed_at'> | null) {
  if (!row) return { status: 'not_started' as const, lastStep: 0 };
  if (row.completed_at) return { status: 'completed' as const, lastStep: 5 };
  return { status: 'in_progress' as const, lastStep: row.last_step };
}
