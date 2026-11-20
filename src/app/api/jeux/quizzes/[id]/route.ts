import { deleteQuiz, getQuiz, listQuestions, saveQuestions, updateQuiz } from '@/lib/jeux/data';
import { error, json, owned, readBody, requireManager, serverError, uuidParam, type Params } from '@/lib/jeux/http';
import { quizUpdateSchema } from '@/lib/jeux/schemas';

/** Quiz du propriétaire (ou de l'administrateur) ; tout autre appelant reçoit « introuvable ». */
async function loadOwned(request: Request, context: Params<'id'>) {
  const guard = await requireManager(request);
  if (!guard.ok) return { response: guard.response } as const;
  const id = await uuidParam(context, 'id');
  const quiz = id ? await getQuiz(guard.manager.db, id) : null;
  if (!id || !quiz || !owned(guard.manager, quiz.ownerId)) return { response: error('Quiz introuvable', 404) } as const;
  return { manager: guard.manager, quiz } as const;
}

export async function GET(request: Request, context: Params<'id'>) {
  const found = await loadOwned(request, context);
  if ('response' in found) return found.response;
  try {
    return json({ quiz: found.quiz, questions: await listQuestions(found.manager.db, found.quiz.id) });
  } catch (cause) {
    return serverError('quiz GET', cause);
  }
}

export async function PUT(request: Request, context: Params<'id'>) {
  const found = await loadOwned(request, context);
  if ('response' in found) return found.response;
  const body = await readBody(request, quizUpdateSchema);
  if (!body.ok) return body.response;
  const { db } = found.manager;
  try {
    if (body.data.quiz) await updateQuiz(db, found.quiz.id, body.data.quiz);
    if (body.data.questions) await saveQuestions(db, found.quiz.id, body.data.questions);
    const [quiz, questions] = await Promise.all([getQuiz(db, found.quiz.id), listQuestions(db, found.quiz.id)]);
    return json({ quiz, questions });
  } catch (cause) {
    return serverError('quiz PUT', cause);
  }
}

export async function DELETE(request: Request, context: Params<'id'>) {
  const found = await loadOwned(request, context);
  if ('response' in found) return found.response;
  try {
    await deleteQuiz(found.manager.db, found.quiz.id);
    return json({ ok: true });
  } catch (cause) {
    return serverError('quiz DELETE', cause);
  }
}
