import { connection } from 'next/server';

import { error, json, requireViewer, serverError, serviceDb, uuidParam, type Params } from '@/lib/jeux/http';
import { publicQuizState } from '@/lib/jeux/quiz-engine';
import { canReadQuiz } from '@/lib/jeux/routes';
import { getQuizState } from '@/lib/jeux/stores';

/**
 * État de la partie pour les écrans des joueurs et de l'animateur. Réservé aux comptes connectés qui ont une place dans
 * CETTE partie (ou qui l'animent) : sinon 401 (non connecté), 403 (compte non autorisé) ou 404. Pseudos, question en cours,
 * réponses sans la mention « correcte » ; bonnes réponses et classement seulement une fois la question close.
 * Lecture seule : pas de limitation de débit (les écrans l'interrogent régulièrement derrière une même adresse).
 */
export async function GET(_request: Request, context: Params<'sessionId'>) {
  await connection();
  const sessionId = await uuidParam(context, 'sessionId');
  if (!sessionId) return error('Session introuvable', 404);
  const viewer = await requireViewer();
  if (!viewer.ok) return viewer.response;
  try {
    const state = await getQuizState(serviceDb(), sessionId);
    if (!state || !(await canReadQuiz(viewer, sessionId, state))) return error('Session introuvable', 404);
    return json(publicQuizState(state));
  } catch (cause) {
    return serverError('quiz state', cause);
  }
}
