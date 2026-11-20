import { connection } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { getQuiz, getSession, listPlayers, setSessionStatus } from '@/lib/jeux/data';
import { canManageGames } from '@/lib/jeux/guards';
import { error, json, owned, ownedSession, requireManager, serverError, serviceDb, uuidParam, type Manager, type Params } from '@/lib/jeux/http';
import { deleteQuizState, getQuizState } from '@/lib/jeux/stores';

/**
 * Partie de Quiz. Vue publique (joueurs, sans compte) : code, statut, titre du quiz, pseudos et avancement.
 * Vue complète (animateur propriétaire ou administrateur) : s'y ajoutent le propriétaire et les scores.
 * Aucune bonne réponse dans aucune des deux.
 */
export async function GET(_request: Request, context: Params<'id'>) {
  await connection();
  const id = await uuidParam(context, 'id');
  if (!id) return error('Session introuvable', 404);
  try {
    const admin = serviceDb();
    const session = await getSession(admin, id);
    if (!session) return error('Session introuvable', 404);

    const [quiz, players, state] = await Promise.all([getQuiz(admin, session.quizId), listPlayers(admin, id), getQuizState(admin, id)]);
    const liveState = state
      ? {
          status: state.status,
          playerCount: Object.keys(state.players).length,
          currentQuestionIndex: state.currentQuestionIndex,
          totalQuestions: state.questions.length,
        }
      : null;

    const user = await getCurrentUser();
    const manager = user && canManageGames({ id: user.id, role: user.role, status: user.status, permissions: user.permissions }) ? user : null;
    if (manager && (manager.role === 'admin' || session.ownerId === manager.id)) {
      return json({ session, quiz, players, liveState });
    }
    return json({
      session: { id: session.id, code: session.code, status: session.status, maxPlayers: session.maxPlayers, createdAt: session.createdAt },
      quiz: quiz ? { id: quiz.id, title: quiz.title, themeColor: quiz.themeColor } : null,
      players: players.map((p) => ({ id: p.id, nickname: p.nickname })),
      liveState,
    });
  } catch (cause) {
    return serverError('session GET', cause);
  }
}

/** Annule une partie qui n'a pas démarré (ou la clôt une fois terminée) : état supprimé, code libéré. */
export async function DELETE(request: Request, context: Params<'id'>) {
  const guard = await requireManager(request);
  if (!guard.ok) return guard.response;
  const manager: Manager = guard.manager;
  const id = await uuidParam(context, 'id');
  const session = id ? await ownedSession(manager, id) : null;
  if (!id || !session || !owned(manager, session.ownerId)) return error('Session introuvable', 404);
  if (session.status === 'active') return error('Impossible d’annuler une partie en cours', 409);
  try {
    const admin = serviceDb();
    await setSessionStatus(admin, id, 'finished');
    await deleteQuizState(admin, id);
    return json({ ok: true });
  } catch (cause) {
    return serverError('session DELETE', cause);
  }
}
