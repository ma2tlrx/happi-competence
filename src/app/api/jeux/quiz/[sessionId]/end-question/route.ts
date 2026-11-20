import { broadcast, quizChannel } from '@/lib/jeux/broadcast';
import { json, serverError, type Params } from '@/lib/jeux/http';
import { endQuestion } from '@/lib/jeux/quiz-engine';
import { applyQuiz, quizHost } from '@/lib/jeux/routes';

/** Animateur : clôt la question (fin du temps ou décision) : bonnes réponses, classement et statistiques sont alors diffusés. */
export async function POST(request: Request, context: Params<'sessionId'>) {
  const host = await quizHost(request, context);
  if (!host.ok) return host.response;
  try {
    const applied = await applyQuiz(host.session.id, (state) => endQuestion(state));
    if (applied.kind === 'response') return applied.response;
    await broadcast(quizChannel(host.session.id), 'question:ended', applied.result);
    return json({ ok: true });
  } catch (cause) {
    return serverError('quiz end-question', cause);
  }
}
