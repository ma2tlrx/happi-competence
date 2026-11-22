import 'server-only';

import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import { effectiveProgramKind, type ProgramKind } from './kind';

/**
 * Programme d'un participant : celui de son groupe actif (le plus récent), sinon son choix à l'inscription.
 * Lecture avec la session de l'appelant (RLS) : une personne ne lit que sa propre fiche.
 */
export const getParticipantProgramKind = cache(async (participantId: string): Promise<ProgramKind> => {
  const supabase = await createClient();
  const [{ data: participant }, { data: membership }] = await Promise.all([
    supabase.from('participants').select('program_kind').eq('id', participantId).maybeSingle(),
    supabase
      .from('group_members')
      .select('joined_at, groups ( programs ( kind ) )')
      .eq('participant_id', participantId)
      .eq('status', 'active')
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return effectiveProgramKind(membership?.groups?.programs?.kind, participant?.program_kind);
});
