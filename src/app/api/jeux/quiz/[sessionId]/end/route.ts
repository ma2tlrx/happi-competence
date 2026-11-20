import { broadcast, quizChannel } from '@/lib/jeux/broadcast';
import { json, serverError, type Params } from '@/lib/jeux/http';
import { endGame } from '@/lib/jeux/quiz-engine';
import { applyQuiz, persistEnd, quizHost } from '@/lib/jeux/routes';

/** Ajout par rapport au jeu d'origine — animateur : termine la partie tout de suite, quelle que soit la question en cours. */
export async function POST(request: Request, context: Params<'sessionId'>) {
  const host = await quizHost(request, context);
  if (!host.ok) return host.response;
  try {
    const applied = await applyQuiz(host.session.id, (state) => endGame(state));
    if (applied.kind === 'response') return applied.response;
    if (!applied.result.finished) return json({ ok: true, finished: false });
    await persistEnd(host.session.id, applied.result.finalScores);
    await broadcast(quizChannel(host.session.id), 'game:ended', { finalScores: applied.result.finalScores });
    return json({ ok: true, finished: true });
  } catch (cause) {
    return serverError('quiz end', cause);
  }
}
