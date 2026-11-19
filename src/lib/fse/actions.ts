'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { actionError, actionSuccess, databaseErrorMessage, validationError, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import type { TablesUpdate } from '@/lib/supabase/database.types';
import { createClient } from '@/lib/supabase/server';

import { AGE_BANDS, ANSWER_FIELDS, ANSWERS, DIPLOMA_LEVELS, GENDERS, LABOUR_STATUSES, UNEMPLOYMENT_DURATIONS, type AnswerColumn } from './codes';
import { canManageEntryProfiles } from './load';

/** Liste fermée ou vide (« non renseigné »). */
const choice = <T extends Record<string, unknown>>(map: T, message: string) =>
  z
    .string()
    .optional()
    .transform((value) => value ?? '')
    .refine((value) => value === '' || value in map, message)
    .transform((value) => (value === '' ? null : (value as keyof T & string)));

const isoDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => value ?? '')
  .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Date invalide.')
  .refine((value) => value === '' || value <= new Date().toISOString().slice(0, 10), 'La date ne peut pas être dans le futur.')
  .transform((value) => value || null);

const answersShape = Object.fromEntries(ANSWER_FIELDS.map((field) => [field.column, choice(ANSWERS, 'Réponse invalide.')])) as Record<
  AnswerColumn,
  ReturnType<typeof choice<typeof ANSWERS>>
>;

const profileSchema = z.object({
  groupId: z.union([z.string().uuid(), z.literal('')]).transform((value) => value || null),
  gender: choice(GENDERS, 'Choix invalide.'),
  ageBand: choice(AGE_BANDS, 'Choix invalide.'),
  labourStatus: choice(LABOUR_STATUSES, 'Choix invalide.'),
  unemploymentDuration: choice(UNEMPLOYMENT_DURATIONS, 'Choix invalide.'),
  diplomaLevel: choice(DIPLOMA_LEVELS, 'Choix invalide.'),
  ...answersShape,
});

function entries(formData: FormData) {
  return Object.fromEntries([...formData.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : '']));
}

type ProfileColumns = TablesUpdate<'participant_entry_profiles'>;

function columnsFrom(data: z.infer<typeof profileSchema>): ProfileColumns {
  return {
    gender: data.gender,
    age_band: data.ageBand,
    labour_status: data.labourStatus,
    unemployment_duration: data.labourStatus === 'chomeur' ? data.unemploymentDuration : null,
    diploma_level: data.diplomaLevel,
    ...Object.fromEntries(ANSWER_FIELDS.map((field) => [field.column, data[field.column]])),
  };
}

async function upsert(participantId: string, groupId: string | null, values: ProfileColumns) {
  const supabase = await createClient();
  let lookup = supabase.from('participant_entry_profiles').select('id').eq('participant_id', participantId);
  lookup = groupId ? lookup.eq('group_id', groupId) : lookup.is('group_id', null);
  const { data: existing } = await lookup.maybeSingle();
  const { error } = existing
    ? await supabase.from('participant_entry_profiles').update(values).eq('id', existing.id).select('id').single()
    : await supabase.from('participant_entry_profiles').insert({ participant_id: participantId, group_id: groupId, ...values }).select('id').single();
  if (error) return { error: error.code === 'PGRST116' ? 'Vous n’êtes pas autorisé à modifier cette fiche.' : databaseErrorMessage(error), created: false };
  return { error: null, created: !existing };
}

function revalidate() {
  revalidatePath('/participant', 'layout');
  revalidatePath('/organisme', 'layout');
  revalidatePath('/admin', 'layout');
}

/**
 * Saisie de la fiche d'entrée par l'organisme du participant (permission org.entry_profile.manage)
 * ou l'administrateur. Jamais par le formateur : refusé ici puis, de façon décisive, par RLS.
 */
export async function saveEntryProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole('admin', 'organisme');
  if (!canManageEntryProfiles(user)) return actionError('Vous n’êtes pas autorisé à renseigner la fiche d’entrée.');
  const raw = entries(formData);
  const participantId = z.string().uuid().safeParse(raw.participantId);
  if (!participantId.success) return actionError('Participant invalide.');
  const parsed = profileSchema.extend({ entryDate: isoDate }).safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  if (raw.informed !== 'on') return actionError('Confirmez que la personne a reçu l’information.', { informed: 'Case à cocher pour enregistrer.' });
  const result = await upsert(participantId.data, parsed.data.groupId, {
    ...columnsFrom(parsed.data),
    entry_date: parsed.data.entryDate,
    // Le déclencheur conserve la première date d'information déjà enregistrée.
    participant_informed_at: new Date().toISOString(),
  });
  if (result.error) return actionError(result.error);
  revalidate();
  return actionSuccess(result.created ? 'Fiche d’entrée enregistrée.' : 'Fiche d’entrée mise à jour.');
}

/** Le participant complète ou corrige ses propres réponses (la date d'entrée reste celle du professionnel). */
export async function saveMyEntryProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole('participant');
  if (!user.participantId) return actionError('Votre fiche participant est introuvable.');
  const raw = entries(formData);
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  if (raw.informed !== 'on') return actionError('Confirmez avoir lu l’information.', { informed: 'Case à cocher pour enregistrer.' });
  const result = await upsert(user.participantId, parsed.data.groupId, columnsFrom(parsed.data));
  if (result.error) return actionError(result.error);
  revalidate();
  return actionSuccess('Vos réponses sont enregistrées. Vous pouvez les modifier à tout moment.');
}
