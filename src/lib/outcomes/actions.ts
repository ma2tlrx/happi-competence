'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { actionError, actionSuccess, databaseErrorMessage, validationError, type ActionState } from '@/lib/action-state';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

import { OUTCOME_DETAILS_MAX, OUTCOME_KIND_CODES, OUTCOME_SITUATION_CODES } from './labels';

const outcomeSchema = z.object({
  participantId: z.string().uuid(),
  groupId: z.union([z.string().uuid(), z.literal('')]).transform((value) => value || null),
  kind: z.enum(OUTCOME_KIND_CODES, 'Choisissez le moment du parcours.'),
  situation: z.enum(OUTCOME_SITUATION_CODES, 'Choisissez une situation.'),
  observedOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide.')
    .refine((value) => value <= new Date().toISOString().slice(0, 10), 'La date ne peut pas être dans le futur.'),
  details: z.string().trim().max(OUTCOME_DETAILS_MAX, `${OUTCOME_DETAILS_MAX} caractères au plus.`).transform((value) => value || null),
});

function entries(formData: FormData) {
  return Object.fromEntries([...formData.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : '']));
}

/**
 * Enregistre (ou corrige) la situation d'un participant à un moment de son parcours.
 * Formateur : participants de ses groupes ; organisme : participants rattachés ; administrateur : tous.
 * Les droits sont vérifiés ici puis, de façon décisive, par RLS (participant_outcomes) ;
 * chaque écriture est historisée par un déclencheur d'audit.
 */
export async function saveOutcome(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole('formateur', 'admin', 'organisme');
  const allowed =
    user.role === 'admin' ||
    (user.role === 'formateur' && hasPermission(user, 'outcomes.write')) ||
    (user.role === 'organisme' && user.organization?.status === 'active' && hasPermission(user, 'org.outcomes.write'));
  if (!allowed) return actionError('Vous n’êtes pas autorisé à renseigner les situations des participants.');
  const parsed = outcomeSchema.safeParse(entries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { participantId, groupId, kind, situation, observedOn, details } = parsed.data;

  const supabase = await createClient();
  let lookup = supabase.from('participant_outcomes').select('id').eq('participant_id', participantId).eq('kind', kind);
  lookup = groupId ? lookup.eq('group_id', groupId) : lookup.is('group_id', null);
  const { data: existing } = await lookup.maybeSingle();
  const values = { situation, observed_on: observedOn, details };
  const { error } = existing
    ? await supabase.from('participant_outcomes').update(values).eq('id', existing.id).select('id').single()
    : await supabase.from('participant_outcomes').insert({ participant_id: participantId, group_id: groupId, kind, ...values }).select('id').single();
  if (error) {
    // Une mise à jour refusée par RLS ne renvoie aucune ligne (PGRST116) : même message qu'un refus.
    return actionError(error.code === 'PGRST116' ? 'Vous n’êtes pas autorisé à modifier cette situation.' : databaseErrorMessage(error));
  }
  revalidatePath('/formateur', 'layout');
  revalidatePath('/organisme', 'layout');
  revalidatePath('/admin', 'layout');
  return actionSuccess(existing ? 'Situation mise à jour.' : 'Situation enregistrée.');
}
