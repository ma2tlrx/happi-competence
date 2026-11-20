import { setSessionStatus } from '@/lib/jeux/data';
import { broadcast, quizChannel } from '@/lib/jeux/broadcast';
import { json, serverError, serviceDb, type Params } from '@/lib/jeux/http';
import { startGame } from '@/lib/jeux/quiz-engine';
import { applyQuiz, quizHost } from '@/lib/jeux/routes';

/** Animateur : lance le décompte de départ (la salle doit avoir au moins un joueur). */
export async function POST(request: Request, context: Params<'sessionId'>) {
  const host = await quizHost(request, context);
  if (!host.ok) return host.response;
  try {
    const applied = await applyQuiz(host.session.id, (state) => startGame(state));
    if (applied.kind === 'response') return applied.response;
    await setSessionStatus(serviceDb(), host.session.id, 'active');
    await broadcast(quizChannel(host.session.id), 'game:starting', { countdown: applied.result.countdown });
    return json({ ok: true });
  } catch (cause) {
    return serverError('quiz start', cause);
  }
}
