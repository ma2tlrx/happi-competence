import { connection } from 'next/server';

import { error, json, serverError, serviceDb, uuidParam, type Params } from '@/lib/jeux/http';
import { publicQuizState } from '@/lib/jeux/quiz-engine';
import { getQuizState } from '@/lib/jeux/stores';

/**
 * Route publique (écrans des joueurs et de l'animateur) : état de la partie. Pseudos, question en cours,
 * réponses sans la mention « correcte » ; bonnes réponses et classement seulement une fois la question close.
 * Lecture seule, identifiant de partie non devinable : pas de limitation de débit (les écrans l'interrogent
 * régulièrement derrière une même adresse).
 */
export async function GET(_request: Request, context: Params<'sessionId'>) {
  await connection();
  const sessionId = await uuidParam(context, 'sessionId');
  if (!sessionId) return error('Session introuvable', 404);
  try {
    const state = await getQuizState(serviceDb(), sessionId);
    if (!state) return error('Session introuvable', 404);
    return json(publicQuizState(state));
  } catch (cause) {
    return serverError('quiz state', cause);
  }
}
