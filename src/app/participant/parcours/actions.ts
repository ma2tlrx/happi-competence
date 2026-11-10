'use server';

import { z } from 'zod';

import { databaseErrorMessage } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

/** Carnet personnel « Ce que j'ai appris » (sauvegarde automatique). */
export async function saveLearningNote(input: { sessionId: string; learned: string }): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole('participant');
  const parsed = z.object({ sessionId: z.string().uuid(), learned: z.string().max(4000) }).safeParse(input);
  if (!parsed.success || !user.participantId) return { ok: false, message: 'Note invalide.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('participant_session_notes')
    .upsert({ participant_id: user.participantId, session_id: parsed.data.sessionId, learned: parsed.data.learned, updated_at: new Date().toISOString() });
  return error ? { ok: false, message: databaseErrorMessage(error) } : { ok: true };
}
