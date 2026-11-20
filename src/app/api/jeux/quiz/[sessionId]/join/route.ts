import { getSession } from '@/lib/jeux/data';
import { error, json, limitPublic, readBody, serverError, serviceDb, uuidParam, type Params } from '@/lib/jeux/http';
import { rejoinPlayer } from '@/lib/jeux/quiz-join';
import { BUSY, refusalResponse } from '@/lib/jeux/routes';
import { quizJoinSchema } from '@/lib/jeux/schemas';

/**
 * Route publique : confirme l'entrée d'un joueur dans la salle d'une partie (le jeu d'origine l'appelait
 * depuis l'écran du lobby). Le joueur doit présenter son jeton ; l'opération est idempotente.
 */
export async function POST(request: Request, context: Params<'sessionId'>) {
  const limited = await limitPublic('game_join');
  if (limited) return limited;
  const sessionId = await uuidParam(context, 'sessionId');
  if (!sessionId) return error('Session introuvable', 404);
  const body = await readBody(request, quizJoinSchema);
  if (!body.ok) return body.response;
  try {
    const db = serviceDb();
    const session = await getSession(db, sessionId);
    if (!session || session.status === 'finished') return error('Session introuvable', 404);
    const joined = await rejoinPlayer(db, session, body.data.playerId, body.data.playerToken);
    if (!joined.ok) {
      if (joined.code === 'busy') return BUSY();
      if (joined.code === 'not_found') return error('Session introuvable', 404);
      return refusalResponse(joined.code);
    }
    return json({ ok: true });
  } catch (cause) {
    return serverError('quiz join', cause);
  }
}
