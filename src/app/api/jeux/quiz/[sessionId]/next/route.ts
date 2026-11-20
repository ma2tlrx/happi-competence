import { broadcast, quizChannel } from '@/lib/jeux/broadcast';
import { json, serverError, type Params } from '@/lib/jeux/http';
import { nextQuestion } from '@/lib/jeux/quiz-engine';
import { applyQuiz, persistEnd, quizHost } from '@/lib/jeux/routes';

/** Animateur : question suivante, ou fin de partie après la dernière (scores enregistrés). */
export async function POST(request: Request, context: Params<'sessionId'>) {
  const host = await quizHost(request, context);
  if (!host.ok) return host.response;
  try {
    const applied = await applyQuiz(host.session.id, (state) => nextQuestion(state));
    if (applied.kind === 'response') return applied.response;
    const channel = quizChannel(host.session.id);
    if (applied.result.finished) {
      await persistEnd(host.session, applied.state, applied.result.finalScores);
      await broadcast(channel, 'game:ended', { finalScores: applied.result.finalScores });
      return json({ ok: true, finished: true });
    }
    await broadcast(channel, 'question:show', applied.result.question);
    return json({ ok: true, finished: false });
  } catch (cause) {
    return serverError('quiz next', cause);
  }
}
