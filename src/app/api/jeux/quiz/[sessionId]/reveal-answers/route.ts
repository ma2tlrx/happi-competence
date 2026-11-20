import { broadcast, quizChannel } from '@/lib/jeux/broadcast';
import { json, serverError, type Params } from '@/lib/jeux/http';
import { revealAnswers } from '@/lib/jeux/quiz-engine';
import { applyQuiz, quizHost } from '@/lib/jeux/routes';

/** Animateur : affiche les réponses (sans indiquer les bonnes) et démarre le chronomètre serveur. */
export async function POST(request: Request, context: Params<'sessionId'>) {
  const host = await quizHost(request, context);
  if (!host.ok) return host.response;
  try {
    const applied = await applyQuiz(host.session.id, (state) => revealAnswers(state, Date.now()));
    if (applied.kind === 'response') return applied.response;
    await broadcast(quizChannel(host.session.id), 'question:answers', { answers: applied.result.answers, remainingTime: applied.result.remainingTime });
    return json({ ok: true });
  } catch (cause) {
    return serverError('quiz reveal-answers', cause);
  }
}
