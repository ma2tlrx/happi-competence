import { broadcast, quizChannel } from '@/lib/jeux/broadcast';
import { json, readBody, serverError, type Params } from '@/lib/jeux/http';
import { showQuestion } from '@/lib/jeux/quiz-engine';
import { applyQuiz, quizHost } from '@/lib/jeux/routes';
import { showQuestionSchema } from '@/lib/jeux/schemas';

/** Animateur : affiche l'énoncé de la question `index` (les réponses viennent avec reveal-answers). */
export async function POST(request: Request, context: Params<'sessionId'>) {
  const host = await quizHost(request, context);
  if (!host.ok) return host.response;
  const body = await readBody(request, showQuestionSchema);
  if (!body.ok) return body.response;
  try {
    const applied = await applyQuiz(host.session.id, (state) => showQuestion(state, body.data.index));
    if (applied.kind === 'response') return applied.response;
    await broadcast(quizChannel(host.session.id), 'question:show', applied.result.question);
    return json({ ok: true });
  } catch (cause) {
    return serverError('quiz show-question', cause);
  }
}
