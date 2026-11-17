'use server';

import { z } from 'zod';

import { AI_QUOTA_MESSAGE, aiQuotaReached } from '@/lib/ai/quota';
import { databaseErrorMessage } from '@/lib/action-state';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { structureNotes } from '@/lib/observation/ai';
import { loadSessionCatalog } from '@/lib/observation/catalog';
import { NOTES_MAX_LENGTH, type ValidFact } from '@/lib/observation/structure';
import { aiProvider } from '@/lib/report/ai';
import { createClient } from '@/lib/supabase/server';

const inputSchema = z.object({
  sessionId: z.string().uuid(),
  participantId: z.string().uuid(),
  notes: z.string().trim().min(1, 'Saisissez ou dictez d’abord vos notes.').max(NOTES_MAX_LENGTH, `Notes trop longues (${NOTES_MAX_LENGTH} caractères au plus).`),
});

export type StructureActionResult =
  | { ok: true; facts: ValidFact[]; unattached: string[]; discarded: number }
  | { ok: false; message: string };

/**
 * Structure les notes de séance d'un participant. Les notes ne sont pas enregistrées :
 * elles transitent par le serveur (masquage des données personnelles) vers le service
 * d'IA, puis la proposition revient au formateur, qui choisit ce qu'il reprend.
 * Contrôles : rôle, droit d'évaluer, puis la base vérifie que le participant est bien
 * dans un groupe du formateur pour cette séance (public.authorize_observation_assist).
 */
export async function structureSessionNotes(input: z.input<typeof inputSchema>): Promise<StructureActionResult> {
  const user = await requireRole('formateur', 'admin');
  if (!hasPermission(user, 'evaluations.write')) return { ok: false, message: 'Votre compte n’a pas la permission de saisir des évaluations.' };
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Notes invalides.' };
  if (await aiQuotaReached(user.id)) return { ok: false, message: AI_QUOTA_MESSAGE };

  const supabase = await createClient();
  const catalog = await loadSessionCatalog(supabase, parsed.data.sessionId);
  if (!catalog) return { ok: false, message: 'Séance introuvable.' };

  // Noms des participants du groupe, masqués dans les notes avant tout envoi.
  const { data: members } = await supabase.from('group_members').select('participants ( first_name, last_name )').eq('group_id', catalog.groupId);
  const names = (members ?? []).flatMap((member) => (member.participants ? [member.participants.first_name, member.participants.last_name] : []));

  if (aiProvider()) {
    // Autorisation et journalisation (sans le texte des notes) : refus si le participant n'est pas dans un groupe du formateur.
    const { error } = await supabase.rpc('authorize_observation_assist', { p_session_id: parsed.data.sessionId, p_participant_id: parsed.data.participantId });
    if (error) return { ok: false, message: databaseErrorMessage(error) };
  }

  const result = await structureNotes(parsed.data.notes, catalog.skills, { names, levelLabels: catalog.levelLabels });
  if (!result.ok) return result;
  return { ok: true, facts: result.facts, unattached: result.unattached, discarded: result.discarded };
}

const saveSchema = z.object({ sessionId: z.string().uuid(), participantId: z.string().uuid(), notes: z.string().trim().min(1).max(NOTES_MAX_LENGTH) });

/**
 * Enregistre, à la demande du formateur, ses notes brutes dans ses notes privées de
 * séance (trainer_notes, visibles de lui seul) : ajout à la note générale de la séance.
 */
export async function saveNotesToTrainerNotes(input: z.input<typeof saveSchema>): Promise<{ ok: boolean; message: string }> {
  const user = await requireRole('formateur', 'admin');
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Notes invalides.' };
  const supabase = await createClient();
  const [{ data: participant }, { data: existing }] = await Promise.all([
    supabase.from('participants').select('first_name, last_name').eq('id', parsed.data.participantId).maybeSingle(),
    supabase.from('trainer_notes').select('body').eq('trainer_id', user.id).eq('session_id', parsed.data.sessionId).eq('block_key', '').maybeSingle(),
  ]);
  if (!participant) return { ok: false, message: 'Participant introuvable.' };
  const stamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' });
  const block = `— Notes sur ${participant.first_name} ${participant.last_name.charAt(0)}. (${stamp}) —\n${parsed.data.notes}`;
  const body = existing?.body?.trim() ? `${existing.body.trim()}\n\n${block}` : block;
  if (body.length > 8000) return { ok: false, message: 'Vos notes privées de séance sont pleines (8 000 caractères). Faites de la place dans le lecteur de séance.' };
  const { error } = await supabase
    .from('trainer_notes')
    .upsert({ trainer_id: user.id, session_id: parsed.data.sessionId, block_key: '', body, updated_at: new Date().toISOString() }, { onConflict: 'trainer_id,session_id,block_key' });
  return error ? { ok: false, message: databaseErrorMessage(error) } : { ok: true, message: 'Notes ajoutées à vos notes privées de séance.' };
}
