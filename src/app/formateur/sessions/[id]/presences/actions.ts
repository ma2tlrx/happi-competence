'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { databaseErrorMessage } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

const STATUSES = ['present', 'absent', 'late', 'left_early', 'excused'] as const;
const schema = z.object({
  sessionId: z.string().uuid(),
  participantIds: z.array(z.string().uuid()).min(1).max(50),
  status: z.enum(STATUSES),
  comment: z.string().max(500).nullable().optional(),
});

/** Enregistre la présence d'un ou plusieurs participants (horodatage et auteur ajoutés par la base). */
export async function recordAttendance(input: z.input<typeof schema>): Promise<{ ok: boolean; message?: string; recordedAt?: string }> {
  await requireRole('formateur', 'admin');
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Saisie invalide.' };
  const supabase = await createClient();
  const rows = parsed.data.participantIds.map((participantId) => ({
    session_id: parsed.data.sessionId,
    participant_id: participantId,
    status: parsed.data.status,
    ...(parsed.data.comment !== undefined ? { comment: parsed.data.comment } : {}),
  }));
  const { data, error } = await supabase.from('attendance').upsert(rows, { onConflict: 'session_id,participant_id' }).select('recorded_at');
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  revalidatePath(`/formateur/sessions/${parsed.data.sessionId}`, 'layout');
  return { ok: true, recordedAt: data?.[0]?.recorded_at };
}

export async function saveAttendanceComment(sessionId: string, participantId: string, comment: string): Promise<{ ok: boolean; message?: string }> {
  await requireRole('formateur', 'admin');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('attendance')
    .update({ comment: comment.slice(0, 500) })
    .eq('session_id', sessionId)
    .eq('participant_id', participantId)
    .select('id');
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  if (!data?.length) return { ok: false, message: 'Indiquez d’abord le statut de présence.' };
  return { ok: true };
}
