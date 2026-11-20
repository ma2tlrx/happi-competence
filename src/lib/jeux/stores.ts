/**
 * États vivants des parties, stockés dans game_states (Quiz) et game_undercover_games
 * (Undercover). Ces tables n'ont aucun droit côté client : seul le client de service les lit.
 * Chaque écriture contrôle la version lue (verrou optimiste, voir state-store.ts) et renouvelle
 * l'expiration.
 */
import type { Json } from '@/lib/supabase/database.types';

import { GameDataError, type Db } from './data';
import type { QuizState } from './quiz-engine';
import { mutateState, type StateStore } from './state-store';
import type { UndercoverState } from './undercover-engine';

export const QUIZ_TTL_MS = 24 * 60 * 60 * 1000;
export const UNDERCOVER_TTL_MS = 4 * 60 * 60 * 1000;

const expiresAt = (ttl: number) => new Date(Date.now() + ttl).toISOString();
const isExpired = (value: string) => new Date(value).getTime() < Date.now();

// ── Quiz ────────────────────────────────────────────────────────────────────
export function quizStore(db: Db): StateStore<QuizState> {
  return {
    async read(id) {
      const { data, error } = await db.from('game_states').select('state, version, expires_at').eq('id', id).maybeSingle();
      if (error) throw new GameDataError(error.message, error.code);
      if (!data || isExpired(data.expires_at)) return null;
      return { state: data.state as unknown as QuizState, version: data.version };
    },
    async write(id, state, expectedVersion) {
      const { data, error } = await db
        .from('game_states')
        .update({ state: state as unknown as NonNullable<Json>, version: expectedVersion + 1, expires_at: expiresAt(QUIZ_TTL_MS) })
        .eq('id', id)
        .eq('version', expectedVersion)
        .select('id');
      if (error) throw new GameDataError(error.message, error.code);
      return (data?.length ?? 0) > 0;
    },
  };
}

export async function createQuizState(db: Db, state: QuizState): Promise<void> {
  const { error } = await db
    .from('game_states')
    .upsert({ id: state.sessionId, state: state as unknown as NonNullable<Json>, version: 1, expires_at: expiresAt(QUIZ_TTL_MS) });
  if (error) throw new GameDataError(error.message, error.code);
}

export async function getQuizState(db: Db, sessionId: string): Promise<QuizState | null> {
  return (await quizStore(db).read(sessionId))?.state ?? null;
}

export async function deleteQuizState(db: Db, sessionId: string): Promise<void> {
  await db.from('game_states').delete().eq('id', sessionId);
}

export function mutateQuiz<R, E extends string>(db: Db, sessionId: string, fn: Parameters<typeof mutateState<QuizState, R, E>>[2]) {
  return mutateState<QuizState, R, E>(quizStore(db), sessionId, fn);
}

// ── Undercover ──────────────────────────────────────────────────────────────
export function undercoverStore(db: Db): StateStore<UndercoverState> {
  return {
    async read(id) {
      const { data, error } = await db.from('game_undercover_games').select('state, version, expires_at').eq('id', id).maybeSingle();
      if (error) throw new GameDataError(error.message, error.code);
      if (!data || isExpired(data.expires_at)) return null;
      return { state: data.state as unknown as UndercoverState, version: data.version };
    },
    async write(id, state, expectedVersion) {
      const { data, error } = await db
        .from('game_undercover_games')
        .update({ state: state as unknown as NonNullable<Json>, version: expectedVersion + 1, expires_at: expiresAt(UNDERCOVER_TTL_MS) })
        .eq('id', id)
        .eq('version', expectedVersion)
        .select('id');
      if (error) throw new GameDataError(error.message, error.code);
      return (data?.length ?? 0) > 0;
    },
  };
}

/** Insère une nouvelle partie ; `false` si le code est déjà pris (collision, à retenter avec un autre). */
export async function insertUndercoverGame(db: Db, ownerId: string, state: UndercoverState): Promise<boolean> {
  const { error } = await db
    .from('game_undercover_games')
    .insert({ id: state.gameId, owner_id: ownerId, code: state.code, state: state as unknown as NonNullable<Json>, version: 1, expires_at: expiresAt(UNDERCOVER_TTL_MS) });
  if (!error) return true;
  if (error.code === '23505') return false;
  throw new GameDataError(error.message, error.code);
}

export async function getUndercoverGame(db: Db, id: string): Promise<{ state: UndercoverState; ownerId: string } | null> {
  const { data, error } = await db.from('game_undercover_games').select('state, owner_id, expires_at').eq('id', id).maybeSingle();
  if (error) throw new GameDataError(error.message, error.code);
  if (!data || isExpired(data.expires_at)) return null;
  return { state: data.state as unknown as UndercoverState, ownerId: data.owner_id };
}

export async function getUndercoverGameByCode(db: Db, code: string): Promise<UndercoverState | null> {
  const { data, error } = await db.from('game_undercover_games').select('state, expires_at').eq('code', code.toUpperCase()).maybeSingle();
  if (error) throw new GameDataError(error.message, error.code);
  if (!data || isExpired(data.expires_at)) return null;
  return data.state as unknown as UndercoverState;
}

export async function deleteUndercoverGame(db: Db, id: string): Promise<void> {
  await db.from('game_undercover_games').delete().eq('id', id);
}

export function mutateUndercover<R, E extends string>(db: Db, gameId: string, fn: Parameters<typeof mutateState<UndercoverState, R, E>>[2]) {
  return mutateState<UndercoverState, R, E>(undercoverStore(db), gameId, fn);
}
