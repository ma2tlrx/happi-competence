import { broadcast, quizChannel } from '@/lib/jeux/broadcast';
import { error, json, limitPublic, readBody, requirePlayer, serverError, uuidParam, type Params } from '@/lib/jeux/http';
import { isPlayerOf, submitAnswer } from '@/lib/jeux/quiz-engine';
import { fail } from '@/lib/jeux/result';
import { applyQuiz } from '@/lib/jeux/routes';
import { quizAnswerSchema } from '@/lib/jeux/schemas';

/**
 * Joueur connecté : répond à la question en cours. L'identifiant `playerId` doit appartenir au compte de la session
 * (contrôlé sur l'état de la partie) : on ne peut pas répondre à la place d'un autre. Enregistré sous verrou optimiste
 * (plusieurs joueurs répondent au même instant). Si c'est la dernière réponse attendue, la question est close dans la
 * même écriture. La réponse HTTP ne révèle que le résultat de CE joueur.
 */
export async function POST(request: Request, context: Params<'sessionId'>) {
  const limited = await limitPublic('game_play');
  if (limited) return limited;
  const guard = await requirePlayer(request);
  if (!guard.ok) return guard.response;
  const sessionId = await uuidParam(context, 'sessionId');
  if (!sessionId) return error('Session introuvable', 404);
  const body = await readBody(request, quizAnswerSchema);
  if (!body.ok) return body.response;
  const { playerId, answerId } = body.data;
  const userId = guard.player.user.id;

  try {
    const applied = await applyQuiz(sessionId, (state) => {
      if (!isPlayerOf(state, playerId, userId)) return fail('forbidden');
      return submitAnswer(state, playerId, answerId, Date.now());
    });
    if (applied.kind === 'response') return applied.response;

    const { isCorrect, points, totalScore, answerCount, playerCount, ended } = applied.result;
    const channel = quizChannel(sessionId);
    await broadcast(channel, `answer:result:${playerId}`, { isCorrect, points, totalScore });
    await broadcast(channel, 'answer:received', { count: answerCount, total: playerCount });
    if (ended) await broadcast(channel, 'question:ended', ended);

    return json({ ok: true, isCorrect, points, totalScore });
  } catch (cause) {
    return serverError('quiz answer', cause);
  }
}
