import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { finalStatusOf } from '@/lib/evolution';
import { hasPlayedGame } from '@/lib/jeux/results-load';
import type { Passport } from '@/lib/passport';
import type { PendingSurvey } from '@/lib/satisfaction/load';
import type { Database } from '@/lib/supabase/database.types';

import { buildChallenges, nextChallenge, starsOf, type EngagementFacts } from './challenges';
import { buildCollection, buildJourney } from './journey';

/**
 * Faits utiles aux défis du participant connecté. Toutes les lectures passent par sa session (RLS) :
 * il ne lit que ses propres partages et, pour les jeux, seulement l'existence d'une partie jouée
 * (aucun score ni rang n'entre dans les défis).
 */
export async function loadParticipantEngagement(supabase: SupabaseClient<Database>, passport: Passport, surveys: readonly PendingSurvey[]) {
  const participantId = passport.participant.id;
  const [shares, games] = await Promise.all([
    supabase.from('passport_shares').select('id', { count: 'exact', head: true }).eq('participant_id', participantId),
    // Existence d'une partie jouée seulement (aucun score n'entre dans les défis).
    hasPlayedGame(supabase, participantId),
  ]);
  const collection = buildCollection(passport.frameworks);
  const total = passport.group?.sessionsCount ?? 6;
  const facts: EngagementFacts = {
    hasGroup: Boolean(passport.group),
    dropped: Boolean(passport.group?.dropped),
    totalSessions: total,
    completedSessions: passport.completedSessions,
    attendedSessions: passport.attendedSessions,
    selfAssessmentDone: passport.selfAssessment?.status === 'completed',
    finalSelfAssessment: finalStatusOf(passport),
    observedSkills: collection.revealed,
    skillsTotal: collection.total,
    progressions: collection.progressions,
    surveysAvailable: surveys.length,
    surveysAnswered: surveys.filter((survey) => survey.answered).length,
    sharesCreated: shares.count ?? 0,
    gamesPlayed: games ? 1 : 0,
  };
  const challenges = buildChallenges(facts);
  return {
    facts,
    challenges,
    stars: starsOf(challenges),
    // Une enquête en attente a déjà sa propre carte, avec ses liens : elle n'est pas répétée en « prochaine étape ».
    next: nextChallenge(challenges, surveys.some((survey) => !survey.answered) ? ['mon-avis-compte'] : []),
    collection,
    journey: buildJourney(passport.sessions, total),
  };
}

export type ParticipantEngagement = Awaited<ReturnType<typeof loadParticipantEngagement>>;
