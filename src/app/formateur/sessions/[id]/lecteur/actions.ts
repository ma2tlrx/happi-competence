'use server';

import { z } from 'zod';

import { databaseErrorMessage } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

const timerSchema = z.object({ elapsedMs: z.number().min(0).max(864e5), runningSince: z.number().nullable() });
const stateSchema = z.object({
  sessionId: z.string().uuid(),
  contentVersionId: z.string().uuid().nullable(),
  currentBlock: z.number().int().min(0).max(500),
  completedBlocks: z.array(z.number().int().min(0).max(500)).max(500),
  sessionTimer: timerSchema,
  blockTimers: z.record(z.string().max(120), timerSchema),
});

/** Reprise de session : position, séquences terminées et chronomètres du formateur. */
export async function savePlayerState(input: z.input<typeof stateSchema>): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole('formateur', 'admin');
  const parsed = stateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'État invalide.' };
  const supabase = await createClient();
  const { error } = await supabase.from('session_player_states').upsert({
    session_id: parsed.data.sessionId,
    trainer_id: user.id,
    content_version_id: parsed.data.contentVersionId,
    current_block: parsed.data.currentBlock,
    completed_blocks: parsed.data.completedBlocks,
    session_timer: parsed.data.sessionTimer,
    block_timers: parsed.data.blockTimers,
    updated_at: new Date().toISOString(),
  });
  return error ? { ok: false, message: databaseErrorMessage(error) } : { ok: true };
}

const liveMarkSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  participantId: z.string().uuid(),
  skillCode: z.string().max(80).regex(/^[a-z0-9_]+$/).nullable(),
  blockIndex: z.number().int().min(0).max(500).nullable(),
  blockTitle: z.string().max(200).nullable(),
  elapsedSeconds: z.number().int().min(0).max(86400).nullable(),
});

/**
 * « + » en direct : aide-mémoire horodaté (horodatage serveur). `retry` = erreur temporaire, à renvoyer ;
 * sans `retry`, la donnée est refusée définitivement. L'identifiant vient du client : un renvoi est sans effet.
 * Aucun score n'est créé.
 */
export async function addLiveMark(input: z.input<typeof liveMarkSchema>): Promise<{ ok: boolean; retry?: boolean; message?: string }> {
  const user = await requireRole('formateur', 'admin');
  const parsed = liveMarkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Point invalide.' };
  const supabase = await createClient();
  const { error } = await supabase.from('session_live_marks').insert({
    id: parsed.data.id,
    session_id: parsed.data.sessionId,
    participant_id: parsed.data.participantId,
    skill_code: parsed.data.skillCode,
    block_index: parsed.data.blockIndex,
    block_title: parsed.data.blockTitle,
    elapsed_seconds: parsed.data.elapsedSeconds,
    created_by: user.id,
  });
  if (!error || error.code === '23505') return { ok: true }; // déjà enregistré lors d'un envoi précédent
  // Refus de sécurité / donnée invalide : définitif ; le reste (réseau, serveur) : à réessayer.
  const permanent = ['42501', '23503', '23514', '22P02'].includes(error.code ?? '');
  return { ok: false, retry: !permanent, message: databaseErrorMessage(error) };
}

/** Annule un « + » (le formateur de la session ou l'administrateur ; la politique RLS fait foi). */
export async function removeLiveMark(sessionId: string, id: string): Promise<{ ok: boolean; retry?: boolean }> {
  await requireRole('formateur', 'admin');
  const parsed = z.object({ sessionId: z.string().uuid(), id: z.string().uuid() }).safeParse({ sessionId, id });
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from('session_live_marks').delete().eq('id', parsed.data.id).eq('session_id', parsed.data.sessionId);
  return error ? { ok: false, retry: true } : { ok: true };
}

/** Notes privées du formateur, par séquence (clé vide : note générale). */
export async function saveTrainerNote(sessionId: string, blockKey: string, body: string): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole('formateur', 'admin');
  const parsed = z.object({ sessionId: z.string().uuid(), blockKey: z.string().max(120), body: z.string().max(8000) }).safeParse({ sessionId, blockKey, body });
  if (!parsed.success) return { ok: false, message: 'Note invalide.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('trainer_notes')
    .upsert(
      { trainer_id: user.id, session_id: parsed.data.sessionId, block_key: parsed.data.blockKey, body: parsed.data.body, updated_at: new Date().toISOString() },
      { onConflict: 'trainer_id,session_id,block_key' },
    );
  return error ? { ok: false, message: databaseErrorMessage(error) } : { ok: true };
}
