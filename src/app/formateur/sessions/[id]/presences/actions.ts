'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { databaseErrorMessage } from '@/lib/action-state';
import { insertCountersignature, insertSignature, signatureInputSchema, type SignResult } from '@/lib/attendance/sign';
import { MAX_SIGNATURE_PATH_LENGTH } from '@/lib/attendance/signature';
import { hasPermission, requireRole } from '@/lib/auth/session';
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

/** Émargement sur la tablette du formateur : signature tracée ou mention « signature impossible » (motif). */
export async function signOnTrainerDevice(input: z.input<typeof signatureInputSchema>): Promise<SignResult> {
  const user = await requireRole('formateur', 'admin');
  if (!hasPermission(user, 'attendance.write')) return { ok: false, message: 'Vous n’êtes pas autorisé à recueillir les signatures.' };
  const parsed = signatureInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Saisie invalide.' };
  const result = await insertSignature(await createClient(), parsed.data);
  if (result.ok) revalidatePath(`/formateur/sessions/${parsed.data.sessionId}`, 'layout');
  return result;
}

const countersignSchema = z.object({
  sessionId: z.uuid(),
  path: z.string().max(MAX_SIGNATURE_PATH_LENGTH),
  attest: z.literal(true, { message: 'Cochez l’attestation avant de contre-signer.' }),
});

/** Contre-signature du formateur : la feuille est ensuite figée. */
export async function countersignAttendance(input: z.input<typeof countersignSchema>): Promise<SignResult> {
  const user = await requireRole('formateur', 'admin');
  if (!hasPermission(user, 'attendance.write')) return { ok: false, message: 'Vous n’êtes pas autorisé à contre-signer.' };
  const parsed = countersignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Saisie invalide.' };
  const result = await insertCountersignature(await createClient(), parsed.data.sessionId, parsed.data.path);
  if (result.ok) revalidatePath(`/formateur/sessions/${parsed.data.sessionId}`, 'layout');
  return result;
}
