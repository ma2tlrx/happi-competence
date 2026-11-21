'use server';

import { revalidatePath } from 'next/cache';

import { databaseErrorMessage, fieldErrorsFrom } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import { isIntakeStep, parseStep } from '@/lib/intake/schema';
import { createClient } from '@/lib/supabase/server';

export type IntakeStepResult = { ok: true; next: string | null } | { ok: false; message: string; fieldErrors?: Record<string, string> };

/**
 * Enregistre une étape du questionnaire d'accueil (les étapes déjà remplies restent acquises si la personne
 * s'arrête en route). Seul le participant connecté écrit sa propre ligne : contrôle ici ET par la RLS.
 * À la dernière étape, renvoie la page suivante : l'auto-évaluation (étape 6), l'accueil ou le profil.
 */
export async function saveIntakeStep(step: number, values: unknown, mode: 'accueil' | 'modifier'): Promise<IntakeStepResult> {
  const user = await requireRole('participant');
  if (!user.participantId) return { ok: false, message: 'Votre compte n’est pas encore relié à une fiche participant.' };
  if (!isIntakeStep(step)) return { ok: false, message: 'Étape inconnue.' };
  const parsed = parseStep(step, values);
  if (!parsed.ok) return { ok: false, message: 'Certaines réponses sont à compléter.', fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const participantId = user.participantId;
  const { data: existing } = await supabase.from('participant_intakes').select('last_step, completed_at').eq('participant_id', participantId).maybeSingle();

  if (parsed.phone !== undefined) {
    // Le téléphone reste sur la fiche participant (la personne peut le modifier elle-même).
    const { error } = await supabase.from('participants').update({ phone: parsed.phone }).eq('id', participantId);
    if (error) return { ok: false, message: databaseErrorMessage(error) };
  }

  const { error } = await supabase.from('participant_intakes').upsert(
    {
      participant_id: participantId,
      ...parsed.columns,
      last_step: Math.max(existing?.last_step ?? 0, step),
      completed_at: existing?.completed_at ?? (step === 5 ? new Date().toISOString() : null),
    },
    { onConflict: 'participant_id' },
  );
  if (error) return { ok: false, message: databaseErrorMessage(error) };

  if (step < 5) return { ok: true, next: null };
  revalidatePath('/participant/dashboard');
  revalidatePath('/participant/profil');
  if (mode === 'modifier') return { ok: true, next: '/participant/profil?questionnaire=enregistre' };
  const { data: self } = await supabase
    .from('self_assessments')
    .select('status')
    .eq('participant_id', participantId)
    .eq('kind', 'initial')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return { ok: true, next: self?.status === 'completed' ? '/participant/dashboard?bienvenue=1' : '/participant/auto-evaluation?bienvenue=1&etape=6' };
}
