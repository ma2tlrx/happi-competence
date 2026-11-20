import 'server-only';

import type { NextResponse } from 'next/server';

import { getPlayerByProfile, getQuiz, getSession, saveFinalScores, saveGameResults, setSessionStatus, type Session } from './data';
import { error, owned, ownedSession, requireManager, serviceDb, uuidParam, type Manager, type Params } from './http';
import type { CurrentUser } from '@/lib/auth/session';
import { findPlayerByUser as findQuizPlayer, type QuizState } from './quiz-engine';
import type { EngineResult } from './result';
import { quizResultRows, undercoverResultRows } from './results';
import { getUndercoverGame, mutateQuiz, mutateUndercover } from './stores';
import { findPlayerByUser as findUndercoverPlayer, type UndercoverState } from './undercover-engine';

/** Motifs de refus des moteurs → statut HTTP et message (français). */
const REFUSALS: Record<string, { status: number; message: string }> = {
  bad_phase: { status: 409, message: 'Action impossible à ce stade de la partie.' },
  not_found: { status: 404, message: 'Question introuvable' },
  no_players: { status: 400, message: 'Aucun joueur connecté' },
  not_enough_players: { status: 400, message: 'Il faut au moins 3 joueurs (hors animateur) pour commencer.' },
  already_started: { status: 409, message: 'La partie a déjà commencé' },
  full: { status: 409, message: 'La salle est complète' },
  nickname_taken: { status: 409, message: 'Ce pseudo est déjà pris' },
  forbidden: { status: 403, message: 'Non autorisé' },
  not_answering: { status: 409, message: 'Les réponses ne sont pas ouvertes.' },
  unknown_player: { status: 403, message: 'Joueur inconnu dans cette partie.' },
  already_answered: { status: 409, message: 'Déjà répondu' },
  invalid_answer: { status: 400, message: 'Réponse invalide.' },
  too_late: { status: 409, message: 'Temps écoulé' },
  invalid_vote: { status: 400, message: 'Vote impossible' },
  no_role: { status: 400, message: 'Rôle non assigné' },
};

export function refusalResponse(code: string): NextResponse {
  const refusal = REFUSALS[code] ?? { status: 400, message: 'Action impossible' };
  return error(refusal.message, refusal.status);
}

export const BUSY = () => error('La partie est très sollicitée : réessayez dans un instant.', 503);

type Outcome<S, R> = { kind: 'ok'; state: S; result: R } | { kind: 'response'; response: NextResponse };

/** Applique un moteur à l'état vivant (verrou optimiste) et traduit refus, absence et conflit en réponses HTTP. */
export async function applyQuiz<R>(sessionId: string, run: (state: QuizState) => EngineResult<R, string>): Promise<Outcome<QuizState, R>> {
  const outcome = await mutateQuiz<R, string>(serviceDb(), sessionId, (state) => {
    const result = run(state);
    return result.ok ? { state, result: result.result } : { reject: result.code };
  });
  if (outcome.kind === 'missing') return { kind: 'response', response: error('Session introuvable', 404) };
  if (outcome.kind === 'conflict') return { kind: 'response', response: BUSY() };
  if (outcome.kind === 'rejected') return { kind: 'response', response: refusalResponse(outcome.reason) };
  return { kind: 'ok', state: outcome.state, result: outcome.result };
}

export async function applyUndercover<R>(gameId: string, run: (state: UndercoverState) => EngineResult<R, string>): Promise<Outcome<UndercoverState, R>> {
  const outcome = await mutateUndercover<R, string>(serviceDb(), gameId, (state) => {
    const result = run(state);
    return result.ok ? { state, result: result.result } : { reject: result.code };
  });
  if (outcome.kind === 'missing') return { kind: 'response', response: error('Partie introuvable', 404) };
  if (outcome.kind === 'conflict') return { kind: 'response', response: BUSY() };
  if (outcome.kind === 'rejected') return { kind: 'response', response: refusalResponse(outcome.reason) };
  return { kind: 'ok', state: outcome.state, result: outcome.result };
}

/** Contexte d'une route d'animation du Quiz : animateur autorisé, propriétaire de la partie. */
export async function quizHost(request: Request, context: Params<'sessionId'>): Promise<{ ok: true; manager: Manager; session: Session } | { ok: false; response: NextResponse }> {
  const guard = await requireManager(request);
  if (!guard.ok) return guard;
  const sessionId = await uuidParam(context, 'sessionId');
  const session = sessionId ? await ownedSession(guard.manager, sessionId) : null;
  if (!session) return { ok: false, response: error('Session introuvable', 404) };
  if (session.status === 'finished') return { ok: false, response: error('Cette partie est terminée', 410) };
  return { ok: true, manager: guard.manager, session };
}

/** Contexte d'une route d'animation d'Undercover : animateur autorisé, propriétaire de la partie. */
export async function undercoverHost(request: Request, context: Params<'id'>): Promise<{ ok: true; manager: Manager; gameId: string; state: UndercoverState } | { ok: false; response: NextResponse }> {
  const guard = await requireManager(request);
  if (!guard.ok) return guard;
  const gameId = await uuidParam(context, 'id');
  const game = gameId ? await getUndercoverGame(serviceDb(), gameId) : null;
  if (!gameId || !game || !owned(guard.manager, game.ownerId)) return { ok: false, response: error('Partie introuvable', 404) };
  return { ok: true, manager: guard.manager, gameId, state: game.state };
}

/** Écriture avec une seconde chance : un incident passager ne doit pas faire perdre les résultats. */
async function withRetry(label: string, run: () => Promise<void>): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await run();
      return;
    } catch (cause) {
      console.error(`[jeux] ${label} impossible (essai ${attempt})`, cause instanceof Error ? cause.message : cause);
    }
  }
}

/**
 * Partie de Quiz close en base, scores finaux conservés, puis résultats des participants (jamais ceux d'un animateur
 * en mode essai). L'état fait foi : un échec est journalisé sans bloquer la fin de la partie.
 */
export async function persistEnd(session: Session, state: QuizState, finalScores: { id: string; score: number }[]) {
  const db = serviceDb();
  await withRetry('enregistrement des scores finaux', async () => {
    await setSessionStatus(db, session.id, 'finished');
    await saveFinalScores(db, session.id, finalScores);
  });
  await withRetry('enregistrement des résultats du quiz', async () => {
    const quiz = await getQuiz(db, session.quizId);
    await saveGameResults(db, quizResultRows(state, { sessionId: session.id, title: quiz?.title }));
  });
}

/** Résultats d'une partie d'Undercover terminée (idempotent : une manche de jeu = une ligne par participant). */
export async function persistUndercoverEnd(state: UndercoverState) {
  if (state.status !== 'game_over') return;
  await withRetry('enregistrement des résultats d’Undercover', async () => {
    await saveGameResults(serviceDb(), undercoverResultRows(state));
  });
}

export type Viewer = { user: CurrentUser; manager: boolean };

/** Animateur propriétaire de la partie de Quiz, ou administrateur. */
export async function managesQuiz(viewer: Viewer, sessionId: string): Promise<boolean> {
  if (!viewer.manager) return false;
  if (viewer.user.role === 'admin') return true;
  const session = await getSession(serviceDb(), sessionId);
  return !!session && session.ownerId === viewer.user.id;
}

/**
 * Lecture d'une partie de Quiz (état, vue publique) : seulement pour un joueur de CETTE partie (son compte y a une place)
 * ou son animateur. Sinon 404 : on ne révèle pas l'existence de la partie.
 */
export async function canReadQuiz(viewer: Viewer, sessionId: string, state: QuizState | null): Promise<boolean> {
  if (state && findQuizPlayer(state, viewer.user.id)) return true;
  if (!state && (await getPlayerByProfile(serviceDb(), sessionId, viewer.user.id))) return true;
  return managesQuiz(viewer, sessionId);
}

/** Lecture d'une partie d'Undercover : joueur de la partie, ou animateur propriétaire / administrateur. */
export function canReadUndercover(viewer: Viewer, game: { state: UndercoverState; ownerId: string }): boolean {
  if (findUndercoverPlayer(game.state, viewer.user.id)) return true;
  return viewer.manager && (viewer.user.role === 'admin' || game.ownerId === viewer.user.id);
}
