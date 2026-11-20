import { createQuiz, listQuizzes } from '@/lib/jeux/data';
import { json, readBody, requireManager, serverError } from '@/lib/jeux/http';
import { quizCreateSchema } from '@/lib/jeux/schemas';

/** Quiz du formateur connecté (l'administrateur peut ajouter ?scope=all pour voir tous les quiz). */
export async function GET(request: Request) {
  const guard = await requireManager(request);
  if (!guard.ok) return guard.response;
  const { user, db } = guard.manager;
  try {
    const all = user.role === 'admin' && new URL(request.url).searchParams.get('scope') === 'all';
    return json({ quizzes: await listQuizzes(db, all ? null : user.id) });
  } catch (cause) {
    return serverError('quizzes GET', cause);
  }
}

export async function POST(request: Request) {
  const guard = await requireManager(request);
  if (!guard.ok) return guard.response;
  const body = await readBody(request, quizCreateSchema);
  if (!body.ok) return body.response;
  try {
    const quiz = await createQuiz(guard.manager.db, { ownerId: guard.manager.user.id, ...body.data });
    return json({ quiz }, 201);
  } catch (cause) {
    return serverError('quizzes POST', cause);
  }
}
