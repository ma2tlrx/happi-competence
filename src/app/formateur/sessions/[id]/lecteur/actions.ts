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
