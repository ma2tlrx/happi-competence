'use server';

import { revalidatePath } from 'next/cache';

import { actionError, actionSuccess, databaseErrorMessage, type ActionState } from '@/lib/action-state';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { notifyAbsenceFollowup } from '@/lib/email/events';
import { rateLimit } from '@/lib/security/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

/**
 * Relance une personne absente. Contrôles serveur (rôle organisme, structure active, accès aux présences,
 * limite de débit par compte), puis public.relaunch_absent_participant avec la session de l'utilisateur :
 * la base revérifie tout (personne de la structure, inscrite, séance terminée, absence non justifiée à sa
 * dernière séance, pas déjà relancée). Ensuite seulement : e-mail et notification au participant.
 */
export async function relaunchAbsent(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole('organisme');
  if (user.organization?.status !== 'active') return actionError('Votre structure n’est pas active : la relance est impossible.');
  if (!hasPermission(user, 'org.attendance.read')) return actionError('Votre structure n’a pas accès aux présences : la relance est impossible.');
  const groupId = formData.get('groupId');
  const sessionId = formData.get('sessionId');
  const participantId = formData.get('participantId');
  if (!isUuid(groupId) || !isUuid(sessionId) || !isUuid(participantId)) return actionError('La demande est incomplète. Rechargez la page, puis réessayez.');

  const limited = await rateLimit('absence_followup', { user: user.id });
  if (limited) return actionError(limited);

  const supabase = await createClient();
  const { data: followupId, error } = await supabase.rpc('relaunch_absent_participant', { p_session_id: sessionId, p_participant_id: participantId });
  // Même en cas de refus (déjà relancée par un collègue, par exemple), la page affiche l'état à jour.
  revalidatePath(`/organisme/groupes/${groupId}`);
  revalidatePath('/organisme/dashboard');
  if (error || !followupId) return actionError(databaseErrorMessage(error, 'La relance n’a pas pu être envoyée. Réessayez dans un instant.'));

  const [{ data: person }, delivery] = await Promise.all([
    supabase.from('participants').select('first_name').eq('id', participantId).maybeSingle(),
    notifyAbsenceFollowup(followupId, user.id),
  ]);
  const firstName = person?.first_name ?? 'la personne';
  if (delivery && !delivery.reachable) {
    return actionSuccess(`Relance notée pour ${firstName}, mais aucune adresse e-mail n’est connue : contactez la personne directement.`);
  }
  return actionSuccess(`Relance envoyée à ${firstName}`);
}
