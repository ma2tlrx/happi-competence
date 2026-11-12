'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { actionError, databaseErrorMessage, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

const submissionSchema = z.object({
  groupId: z.string().uuid(),
  moment: z.enum(['hot', 'cold']),
  answers: z.record(z.string().uuid(), z.union([z.number().int().min(0).max(10), z.string().max(1000)])),
});

/**
 * Réponse à une enquête de satisfaction (participant ou membre d'organisme). Le rôle, le
 * groupe, l'ouverture et le contenu sont vérifiés par la base (submit_satisfaction_response).
 */
export async function submitSatisfaction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole('participant', 'organisme');
  let answers: unknown = {};
  try {
    answers = JSON.parse(String(formData.get('answers') ?? '{}') || '{}');
  } catch {
    return actionError('Réponses illisibles. Rechargez la page et réessayez.');
  }
  const parsed = submissionSchema.safeParse({ groupId: formData.get('groupId'), moment: formData.get('moment'), answers });
  if (!parsed.success) return actionError('Certaines réponses sont invalides.');
  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_satisfaction_response', {
    p_group_id: parsed.data.groupId,
    p_moment: parsed.data.moment,
    p_answers: parsed.data.answers,
  });
  if (error) return actionError(databaseErrorMessage(error));
  const base = user.role === 'participant' ? '/participant' : '/organisme';
  revalidatePath(base, 'layout');
  redirect(`${base}/satisfaction?merci=1`);
}
