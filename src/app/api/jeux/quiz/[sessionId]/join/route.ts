import { getSession } from '@/lib/jeux/data';
import { error, json, limitPublic, readBody, requirePlayer, serverError, serviceDb, uuidParam, type Params } from '@/lib/jeux/http';
import { rejoinPlayer } from '@/lib/jeux/quiz-join';
import { BUSY, refusalResponse } from '@/lib/jeux/routes';
import { quizJoinSchema } from '@/lib/jeux/schemas';

/**
 * Joueur connecté : confirme son retour dans la salle (le jeu d'origine l'appelait depuis l'écran du lobby).
 * Le COMPTE de la session doit être celui de `playerId` ; l'opération est idempotente. Aucun jeton.
 */
export async function POST(request: Request, context: Params<'sessionId'>) {
  const limited = await limitPublic('game_join');
  if (limited) return limited;
  const guard = await requirePlayer(request);
  if (!guard.ok) return guard.response;
  const sessionId = await uuidParam(context, 'sessionId');
  if (!sessionId) return error('Session introuvable', 404);
  const body = await readBody(request, quizJoinSchema);
  if (!body.ok) return body.response;
  try {
    const db = serviceDb();
    const session = await getSession(db, sessionId);
    if (!session || session.status === 'finished') return error('Session introuvable', 404);
    const { player } = guard;
    const account = { userId: player.user.id, participantId: player.participantId, trial: player.trial };
    const joined = await rejoinPlayer(db, session, account, body.data.playerId);
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
