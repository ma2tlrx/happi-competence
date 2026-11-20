import { connection } from 'next/server';

import { getQuiz, getSession, listPlayers, setSessionStatus } from '@/lib/jeux/data';
import { error, json, owned, ownedSession, requireManager, requireViewer, serverError, serviceDb, uuidParam, type Manager, type Params } from '@/lib/jeux/http';
import { canReadQuiz, managesQuiz } from '@/lib/jeux/routes';
import { deleteQuizState, getQuizState } from '@/lib/jeux/stores';

/**
 * Partie de Quiz. Réservée aux comptes connectés : l'animateur propriétaire (ou l'administrateur) reçoit la vue complète
 * (propriétaire, scores) ; un joueur de CETTE partie reçoit la vue réduite (code, statut, titre, pseudos, avancement).
 * Tout autre compte : 404. Aucune bonne réponse dans aucune des deux.
 */
export async function GET(_request: Request, context: Params<'id'>) {
  await connection();
  const id = await uuidParam(context, 'id');
  if (!id) return error('Session introuvable', 404);
  const viewer = await requireViewer();
  if (!viewer.ok) return viewer.response;
  try {
    const admin = serviceDb();
    const session = await getSession(admin, id);
    if (!session) return error('Session introuvable', 404);

    const state = await getQuizState(admin, id);
    const manages = await managesQuiz(viewer, id);
    if (!manages && !(await canReadQuiz(viewer, id, state))) return error('Session introuvable', 404);

    const [quiz, players] = await Promise.all([getQuiz(admin, session.quizId), listPlayers(admin, id)]);
    const liveState = state
      ? {
          status: state.status,
          playerCount: Object.keys(state.players).length,
          currentQuestionIndex: state.currentQuestionIndex,
          totalQuestions: state.questions.length,
        }
      : null;

    if (manages) return json({ session, quiz, players, liveState });
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
