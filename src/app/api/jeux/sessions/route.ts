import { createSession, getQuiz, listQuestions, listSessions } from '@/lib/jeux/data';
import { error, json, owned, purgeExpired, readBody, requireManager, serverError, serviceDb } from '@/lib/jeux/http';
import { newQuizState, type QuizQuestion } from '@/lib/jeux/quiz-engine';
import { playableProblem, sessionCreateSchema } from '@/lib/jeux/schemas';
import { createQuizState } from '@/lib/jeux/stores';

/** Parties de l'animateur connecté, avec leur quiz. */
export async function GET(request: Request) {
  const guard = await requireManager(request);
  if (!guard.ok) return guard.response;
  const { user, db } = guard.manager;
  try {
    const all = user.role === 'admin' && new URL(request.url).searchParams.get('scope') === 'all';
    const sessions = await listSessions(db, all ? null : user.id);
    const quizzes = new Map<string, Awaited<ReturnType<typeof getQuiz>>>();
    for (const quizId of new Set(sessions.map((s) => s.quizId))) quizzes.set(quizId, await getQuiz(db, quizId));
    return json({ sessions: sessions.map((s) => ({ ...s, quiz: quizzes.get(s.quizId) ?? null })) });
  } catch (cause) {
    return serverError('sessions GET', cause);
  }
}

/** Crée une partie sur un quiz de l'animateur : code de salle, puis état vivant (lobby) copiant les questions. */
export async function POST(request: Request) {
  const guard = await requireManager(request);
  if (!guard.ok) return guard.response;
  const body = await readBody(request, sessionCreateSchema);
  if (!body.ok) return body.response;
  const { user, db } = guard.manager;
  try {
    const quiz = await getQuiz(db, body.data.quizId);
    if (!quiz || !owned(guard.manager, quiz.ownerId)) return error('Quiz introuvable', 404);

    const questions = await listQuestions(db, quiz.id);
    if (questions.length === 0) return error('Le quiz doit avoir au moins une question', 400);
    const problem = playableProblem(questions);
    if (problem) return error(problem, 400);

    await purgeExpired();
    const maxPlayers = Math.min(Math.max(body.data.maxPlayers, 2), 50);
    const session = await createSession(db, { quizId: quiz.id, ownerId: user.id, maxPlayers });

    const snapshot: QuizQuestion[] = questions.map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      timeLimit: q.timeLimit,
      imageUrl: q.imageUrl ?? null,
      answers: q.answers.filter((a) => a.text.trim()),
    }));
    try {
      await createQuizState(serviceDb(), newQuizState(session.id, snapshot, session.maxPlayers));
    } catch (cause) {
      await db.from('game_sessions').delete().eq('id', session.id);
      console.error('[jeux] état de partie non créé', cause);
      return error('Impossible de préparer la partie. Réessayez.', 503);
    }
    return json({ session }, 201);
  } catch (cause) {
    return serverError('sessions POST', cause);
  }
}
