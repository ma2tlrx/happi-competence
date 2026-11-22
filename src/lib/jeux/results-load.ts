import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';

import type { GameResultRow } from './results';

/**
 * Résultats de jeux d'un participant, avec la session de l'appelant : la RLS limite aux siens (participant), aux
 * participants qu'il suit (formateur) ou à tous (administrateur). L'organisme n'y a pas accès.
 * Ce module n'est appelé que par les pages « Mes jeux », la fiche participant, l'export des données personnelles et
 * les défis du participant (src/lib/engagement/load.ts, qui ne lit que l'existence d'une partie, jamais un score) :
 * aucun bilan, passeport, CV de compétences, indicateur d'impact ni export financeur ne le lit.
 */
export async function loadGameResults(supabase: SupabaseClient<Database>, participantId: string, limit = 200): Promise<GameResultRow[]> {
  const { data } = await supabase
    .from('game_results')
    .select('id, game_type, played_at, player_count, rank, score, question_count, answered_count, correct_answers, avg_response_ms, role, outcome, rounds_survived, title')
    .eq('participant_id', participantId)
    .order('played_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** A-t-il joué au moins une partie ? Pour les défis seulement : aucune colonne lue, ni score ni rang (RLS de l'appelant). */
export async function hasPlayedGame(supabase: SupabaseClient<Database>, participantId: string): Promise<boolean> {
  const { count } = await supabase.from('game_results').select('id', { count: 'exact', head: true }).eq('participant_id', participantId);
  return (count ?? 0) > 0;
}
