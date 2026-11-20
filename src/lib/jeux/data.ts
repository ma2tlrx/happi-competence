/**
 * Accès aux données des jeux (tables game_*). Chaque fonction reçoit le client à utiliser :
 *  - client de la session (RLS appliquée) pour la bibliothèque du formateur : quiz, questions,
 *    configurations, création et suppression de parties ;
 *  - client de service pour ce que le joueur déclenche sans compte (joueurs, états, scores).
 * Les formes renvoyées reprennent celles du jeu d'origine (camelCase, `adminId` = propriétaire).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/lib/supabase/database.types';

import type { GameResultInsert } from './results';
import type { QuestionInput } from './schemas';

export type Db = SupabaseClient<Database>;

export type Quiz = {
  id: string;
  /** Identifiant du propriétaire (profil). Nom d'origine conservé pour les interfaces. */
  adminId: string;
  ownerId: string;
  title: string;
  description: string;
  themeColor: string;
  createdAt: string;
  updatedAt: string;
};

export type Answer = { id: string; text: string; isCorrect: boolean };

export type Question = {
  id: string;
  quizId: string;
  text: string;
  type: 'multiple_choice' | 'true_false' | 'multiple_select';
  timeLimit: number;
  order: number;
  imageUrl?: string;
  answers: Answer[];
};

export type Session = {
  id: string;
  quizId: string;
  adminId: string;
  ownerId: string;
  code: string;
  status: 'waiting' | 'active' | 'finished';
  maxPlayers: number;
  createdAt: string;
  finishedAt?: string;
};

export type SessionPlayer = { id: string; sessionId: string; nickname: string; score: number; joinedAt: string };

export type UndercoverConfig = {
  id: string;
  name: string;
  civilWord: string;
  undercoverWord: string;
  includeMisterWhite: boolean;
  createdAt: number;
};

type QuizRow = Database['public']['Tables']['game_quizzes']['Row'];
type QuestionRow = Database['public']['Tables']['game_questions']['Row'];
type SessionRow = Database['public']['Tables']['game_sessions']['Row'];
type PlayerRow = Pick<Database['public']['Tables']['game_session_players']['Row'], 'id' | 'session_id' | 'nickname' | 'score' | 'joined_at'>;
type ConfigRow = Database['public']['Tables']['game_undercover_configs']['Row'];

export const toQuiz = (r: QuizRow): Quiz => ({
  id: r.id,
  adminId: r.owner_id,
  ownerId: r.owner_id,
  title: r.title,
  description: r.description,
  themeColor: r.theme_color,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

function toAnswers(value: Json): Answer[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const a = item as Record<string, Json | undefined>;
    return typeof a.id === 'string' && typeof a.text === 'string' ? [{ id: a.id, text: a.text, isCorrect: a.isCorrect === true }] : [];
  });
}

export const toQuestion = (r: QuestionRow): Question => ({
  id: r.id,
  quizId: r.quiz_id,
  text: r.text,
  type: r.type as Question['type'],
  timeLimit: r.time_limit,
  order: r.position,
  imageUrl: r.image_url || undefined,
  answers: toAnswers(r.answers),
});

export const toSession = (r: SessionRow): Session => ({
  id: r.id,
  quizId: r.quiz_id,
  adminId: r.owner_id,
  ownerId: r.owner_id,
  code: r.code,
  status: r.status as Session['status'],
  maxPlayers: r.max_players,
  createdAt: r.created_at,
  finishedAt: r.finished_at || undefined,
});

const toPlayer = (r: PlayerRow): SessionPlayer => ({ id: r.id, sessionId: r.session_id, nickname: r.nickname, score: r.score, joinedAt: r.joined_at });

export const toConfig = (r: ConfigRow): UndercoverConfig => ({
  id: r.id,
  name: r.name,
  civilWord: r.civil_word,
  undercoverWord: r.undercover_word,
  includeMisterWhite: r.include_mister_white,
  createdAt: new Date(r.created_at).getTime(),
});

/** Erreur de base : le message d'origine reste dans les journaux serveur, jamais dans la réponse. */
export class GameDataError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

type Failure = { message: string; code?: string } | null;

function check<T>(result: { data: T; error: Failure }): T {
  if (result.error) throw new GameDataError(result.error.message, result.error.code);
  return result.data;
}

function many<T>(result: { data: T[] | null; error: Failure }): T[] {
  return check(result) ?? [];
}

function one<T>(result: { data: T; error: Failure }): NonNullable<T> {
  const data = check(result);
  if (data === null || data === undefined) throw new GameDataError('Résultat vide.', 'empty');
  return data;
}

// ── Quiz ────────────────────────────────────────────────────────────────────
/** Quiz de l'appelant (ou de tous, pour l'administrateur qui le demande), avec le nombre de questions. */
export async function listQuizzes(db: Db, ownerId: string | null): Promise<(Quiz & { questionCount: number })[]> {
  let query = db.from('game_quizzes').select('*, game_questions(count)').order('created_at', { ascending: false });
  if (ownerId) query = query.eq('owner_id', ownerId);
  const rows = many(await query);
  return rows.map((row) => {
    const counted = (row as unknown as { game_questions?: { count: number }[] }).game_questions;
    return { ...toQuiz(row), questionCount: counted?.[0]?.count ?? 0 };
  });
}

export async function getQuiz(db: Db, id: string): Promise<Quiz | null> {
  const row = check(await db.from('game_quizzes').select('*').eq('id', id).maybeSingle());
  return row ? toQuiz(row) : null;
}

export async function createQuiz(db: Db, input: { ownerId: string; title: string; description: string; themeColor?: string }): Promise<Quiz> {
  const row = one(
    await db
      .from('game_quizzes')
      .insert({ owner_id: input.ownerId, title: input.title, description: input.description, ...(input.themeColor ? { theme_color: input.themeColor } : {}) })
      .select('*')
      .single(),
  );
  return toQuiz(row);
}

export async function updateQuiz(db: Db, id: string, patch: { title?: string; description?: string; themeColor?: string }): Promise<void> {
  const update: Database['public']['Tables']['game_quizzes']['Update'] = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.themeColor !== undefined) update.theme_color = patch.themeColor;
  if (Object.keys(update).length === 0) return;
  check(await db.from('game_quizzes').update(update).eq('id', id).select('id'));
}

export async function deleteQuiz(db: Db, id: string): Promise<void> {
  check(await db.from('game_quizzes').delete().eq('id', id).select('id'));
}

export async function listQuestions(db: Db, quizId: string): Promise<Question[]> {
  const rows = many(await db.from('game_questions').select('*').eq('quiz_id', quizId).order('position', { ascending: true }));
  return rows.map(toQuestion);
}

/** Remplace toutes les questions du quiz en une seule transaction. Identifiants de réponse créés au besoin. */
export async function saveQuestions(db: Db, quizId: string, questions: QuestionInput[]): Promise<void> {
  const payload: Json = questions.map((q) => ({
    text: q.text,
    type: q.type,
    timeLimit: q.timeLimit,
    imageUrl: q.imageUrl || null,
    answers: q.answers.map((a) => ({ id: a.id || crypto.randomUUID(), text: a.text, isCorrect: a.isCorrect })),
  }));
  check(await db.rpc('save_game_questions', { p_quiz_id: quizId, p_questions: payload }));
}

// ── Parties ─────────────────────────────────────────────────────────────────
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateSessionCode(random: () => number = Math.random): string {
  return Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(random() * CODE_CHARS.length)]).join('');
}

/** Crée la partie avec un code libre (unique parmi les parties en cours) ; nouvel essai en cas de collision. */
export async function createSession(db: Db, input: { quizId: string; ownerId: string; maxPlayers: number }): Promise<Session> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data, error } = await db
      .from('game_sessions')
      .insert({ quiz_id: input.quizId, owner_id: input.ownerId, code: generateSessionCode(), max_players: input.maxPlayers })
      .select('*')
      .single();
    if (!error) return toSession(data);
    if (error.code !== '23505') throw new GameDataError(error.message, error.code);
  }
  throw new GameDataError('Aucun code de partie disponible.', 'no_code');
}

export async function getSession(db: Db, id: string): Promise<Session | null> {
  const row = check(await db.from('game_sessions').select('*').eq('id', id).maybeSingle());
  return row ? toSession(row) : null;
}

/** Partie la plus récente portant ce code (un code de partie terminée peut avoir été réutilisé). */
export async function getSessionByCode(db: Db, code: string): Promise<Session | null> {
  const rows = many(await db.from('game_sessions').select('*').eq('code', code.toUpperCase()).order('created_at', { ascending: false }).limit(1));
  return rows[0] ? toSession(rows[0]) : null;
}

export async function listSessions(db: Db, ownerId: string | null): Promise<Session[]> {
  let query = db.from('game_sessions').select('*').order('created_at', { ascending: false });
  if (ownerId) query = query.eq('owner_id', ownerId);
  return many(await query).map(toSession);
}

export async function setSessionStatus(db: Db, id: string, status: Session['status']): Promise<void> {
  check(
    await db
      .from('game_sessions')
      .update({ status, finished_at: status === 'finished' ? new Date().toISOString() : null })
      .eq('id', id)
      .select('id'),
  );
}

// ── Joueurs du Quiz (client de service) ─────────────────────────────────────
export type NewPlayerResult = { player: SessionPlayer } | { nicknameTaken: true };

export type PlayerIdentity = { id: string; nickname: string; participantId: string | null; trial: boolean };

export async function createPlayer(
  db: Db,
  input: { sessionId: string; nickname: string; profileId: string; participantId: string | null; trial: boolean },
): Promise<NewPlayerResult> {
  const { data, error } = await db
    .from('game_session_players')
    .insert({
      session_id: input.sessionId,
      nickname: input.nickname,
      profile_id: input.profileId,
      participant_id: input.participantId,
      is_trial: input.trial,
    })
    .select('id, session_id, nickname, score, joined_at')
    .single();
  if (error) {
    if (error.code === '23505') return { nicknameTaken: true };
    throw new GameDataError(error.message, error.code);
  }
  return { player: toPlayer(data) };
}

/** Place déjà prise dans cette partie par ce compte (reprise après déconnexion). */
export async function getPlayerByProfile(db: Db, sessionId: string, profileId: string): Promise<PlayerIdentity | null> {
  const row = check(
    await db.from('game_session_players').select('id, nickname, participant_id, is_trial').eq('session_id', sessionId).eq('profile_id', profileId).maybeSingle(),
  );
  return row ? { id: row.id, nickname: row.nickname, participantId: row.participant_id, trial: row.is_trial } : null;
}

/** Identités des joueurs d'une partie (client de service) : sert à enregistrer les résultats. */
export async function listPlayerIdentities(db: Db, sessionId: string): Promise<PlayerIdentity[]> {
  const rows = many(await db.from('game_session_players').select('id, nickname, participant_id, is_trial').eq('session_id', sessionId));
  return rows.map((row) => ({ id: row.id, nickname: row.nickname, participantId: row.participant_id, trial: row.is_trial }));
}

export async function countPlayers(db: Db, sessionId: string): Promise<number> {
  const { count, error } = await db.from('game_session_players').select('id', { count: 'exact', head: true }).eq('session_id', sessionId);
  if (error) throw new GameDataError(error.message, error.code);
  return count ?? 0;
}

export async function deletePlayer(db: Db, sessionId: string, playerId: string): Promise<void> {
  check(await db.from('game_session_players').delete().eq('session_id', sessionId).eq('id', playerId).select('id'));
}

export async function listPlayers(db: Db, sessionId: string): Promise<SessionPlayer[]> {
  const rows = many(
    await db.from('game_session_players').select('id, session_id, nickname, score, joined_at').eq('session_id', sessionId).order('joined_at', { ascending: true }),
  );
  return rows.map(toPlayer);
}

export async function saveFinalScores(db: Db, sessionId: string, scores: { id: string; score: number }[]): Promise<void> {
  await Promise.all(scores.map(async (s) => check(await db.from('game_session_players').update({ score: s.score }).eq('session_id', sessionId).eq('id', s.id).select('id'))));
}

// ── Résultats conservés (client de service) ────────────────────────────────
/** Enregistre les résultats d'une partie ; rejouer l'appel ne duplique rien (clé : participant, jeu, partie, manche). */
export async function saveGameResults(db: Db, rows: GameResultInsert[]): Promise<void> {
  if (rows.length === 0) return;
  check(await db.from('game_results').upsert(rows, { onConflict: 'participant_id,game_type,game_ref,play_index', ignoreDuplicates: true }));
}

// ── Configurations Undercover ───────────────────────────────────────────────
export async function listConfigs(db: Db, ownerId: string): Promise<UndercoverConfig[]> {
  const rows = many(await db.from('game_undercover_configs').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }));
  return rows.map(toConfig);
}

export async function createConfig(
  db: Db,
  ownerId: string,
  input: { name: string; civilWord: string; undercoverWord: string; includeMisterWhite: boolean },
): Promise<UndercoverConfig> {
  const row = one(
    await db
      .from('game_undercover_configs')
      .insert({
        owner_id: ownerId,
        name: input.name,
        civil_word: input.civilWord,
        undercover_word: input.undercoverWord,
        include_mister_white: input.includeMisterWhite,
      })
      .select('*')
      .single(),
  );
  return toConfig(row);
}

/** Supprime la configuration si elle appartient à l'appelant (ou si c'est un administrateur : RLS). Renvoie `false` si rien n'a été supprimé. */
export async function deleteConfig(db: Db, id: string): Promise<boolean> {
  const rows = many(await db.from('game_undercover_configs').delete().eq('id', id).select('id'));
  return rows.length > 0;
}
