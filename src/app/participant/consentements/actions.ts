'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { actionError, actionSuccess, databaseErrorMessage, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

const answer = z.enum(['oui', 'non'], { message: 'Répondez par oui ou par non.' });

/** La personne orientée confirme ou modifie elle-même ses consentements (historisés en base). */
export async function confirmConsents(referralId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('participant');
  if (!z.string().uuid().safeParse(referralId).success) return actionError('Orientation invalide.');
  const image = answer.safeParse(formData.get('consentImage'));
  const share = answer.safeParse(formData.get('consentShareResults'));
  if (!image.success || !share.success) {
    return actionError('Répondez à chacune des questions.', {
      ...(image.success ? {} : { consentImage: 'Répondez par oui ou par non.' }),
      ...(share.success ? {} : { consentShareResults: 'Répondez par oui ou par non.' }),
    });
  }
  if (formData.get('informed') !== 'on') return actionError('Confirmez avoir pris connaissance de l’information.', { informed: 'Case à cocher pour continuer.' });
  const supabase = await createClient();
  const { error } = await supabase.rpc('confirm_referral_consents', {
    p_referral_id: referralId,
    p_image: image.data === 'oui',
    p_share_results: share.data === 'oui',
  });
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath('/participant', 'layout');
  return actionSuccess('Vos choix sont enregistrés. Vous pouvez les modifier à tout moment.');
}
