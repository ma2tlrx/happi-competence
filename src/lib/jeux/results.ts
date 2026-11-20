/**
 * Résultats conservés des jeux d'animation (table game_results) : construction des lignes à partir de
 * l'état final d'une partie, et indicateurs d'affichage. Logique pure, sans dépendance serveur.
 *
 * Règles :
 *  - une ligne par participant (compte HAPPI avec fiche) et par partie ; jamais pour un animateur en
 *    mode essai, jamais pour l'animateur d'Undercover, jamais de pseudo ni de mot secret ;
 *  - le rang et le nombre de joueurs sont calculés SANS les joueurs en mode essai ;
 *  - ces lignes n'alimentent ni le bilan, ni le passeport, ni le CV de compétences, ni l'impact, ni les
 *    exports financeurs (aucun de ces modules ne lit game_results).
 */
import type { QuizState } from './quiz-engine';
import type { UndercoverRole, UndercoverState } from './undercover-engine';
import { getTheme } from './words';

export type GameResultInsert = {
  participant_id: string;
  game_type: 'quiz' | 'undercover';
  game_ref: string;
  play_index: number;
  played_at: string;
  player_count: number;
  rank: number | null;
  score: number | null;
  question_count: number | null;
  answered_count: number | null;
  correct_answers: number | null;
  avg_response_ms: number | null;
  role: UndercoverRole | null;
  outcome: 'won' | 'lost' | null;
  rounds_survived: number | null;
  title: string | null;
};

const EMPTY = {
  rank: null, score: null, question_count: null, answered_count: null, correct_answers: null, avg_response_ms: null,
  role: null, outcome: null, rounds_survived: null, title: null,
} as const;

const shortTitle = (value: string | null | undefined) => (value && value.trim() ? Array.from(value.trim()).slice(0, 120).join('') : null);

/** Lignes de résultats d'une partie de Quiz terminée. */
export function quizResultRows(state: QuizState, meta: { sessionId: string; title?: string | null; now?: Date }): GameResultInsert[] {
  const real = Object.values(state.players).filter((p) => !p.trial && !!p.participantId);
  // Même tri stable que le classement affiché (les ex æquo se suivent dans l'ordre d'arrivée).
  const ranked = [...real].sort((a, b) => b.score - a.score);
  const playedAt = (meta.now ?? new Date()).toISOString();
  return ranked.map((player, index) => {
    const answered = player.answeredCount ?? 0;
    return {
      ...EMPTY,
      participant_id: player.participantId as string,
      game_type: 'quiz' as const,
      game_ref: meta.sessionId,
      play_index: 1,
      played_at: playedAt,
      player_count: ranked.length,
      rank: index + 1,
      score: player.score,
      question_count: state.questions.length,
      answered_count: answered,
      correct_answers: Math.min(player.correctCount ?? 0, answered),
      avg_response_ms: answered > 0 ? Math.round((player.totalResponseMs ?? 0) / answered) : null,
      title: shortTitle(meta.title),
    };
  });
}

function undercoverOutcome(role: UndercoverRole, winner: UndercoverState['winner']): 'won' | 'lost' {
  const winning: UndercoverRole = winner === 'civils' ? 'civil' : winner === 'undercover' ? 'undercover' : 'spy';
  return role === winning ? 'won' : 'lost';
}

/** Libellé de la partie : thème choisi, ou « Mots personnalisés ». Jamais les mots eux-mêmes. */
export function undercoverTitle(state: Pick<UndercoverState, 'themeId' | 'customWordPair'>): string {
  if (state.customWordPair || !state.themeId) return 'Mots personnalisés';
  return `Thème : ${getTheme(state.themeId).label}`;
}

/** Lignes de résultats d'une partie d'Undercover terminée (aucune si elle n'a pas de vainqueur). */
export function undercoverResultRows(state: UndercoverState, now: Date = new Date()): GameResultInsert[] {
  if (state.status !== 'game_over' || !state.winner) return [];
  const players = Object.values(state.players).filter((p) => !p.isHost && !p.trial && !!p.participantId && !!p.role);
  const playedAt = new Date(state.finishedAt ?? now.getTime()).toISOString();
  return players.map((player) => ({
    ...EMPTY,
    participant_id: player.participantId as string,
    game_type: 'undercover' as const,
    game_ref: state.gameId,
    play_index: state.playNumber ?? 1,
    played_at: playedAt,
    player_count: players.length,
    role: player.role as UndercoverRole,
    outcome: undercoverOutcome(player.role as UndercoverRole, state.winner),
    rounds_survived: player.eliminatedInRound ? Math.max(player.eliminatedInRound - 1, 0) : state.roundResults.length,
    title: undercoverTitle(state),
  }));
}

// ── Indicateurs d'affichage ──────────────────────────────────────────────────
export type GameResultRow = {
  id: string;
  game_type: string;
  played_at: string;
  player_count: number;
  rank: number | null;
  score: number | null;
  question_count: number | null;
  answered_count: number | null;
  correct_answers: number | null;
  avg_response_ms: number | null;
  role: string | null;
  outcome: string | null;
  rounds_survived: number | null;
  title: string | null;
};

export type GameIndicators = {
  total: number;
  quiz: { games: number; bestScore: number | null; podiums: number; firstPlaces: number; accuracy: number | null; avgResponseMs: number | null };
  undercover: { games: number; wins: number; winRate: number | null; byRole: Record<UndercoverRole, { games: number; wins: number }> };
  lastPlayedAt: string | null;
};

/** Indicateurs de synthèse d'une liste de résultats (les siens, ou ceux d'un participant suivi). */
export function summarizeResults(rows: readonly GameResultRow[]): GameIndicators {
  const quiz = rows.filter((r) => r.game_type === 'quiz');
  const undercover = rows.filter((r) => r.game_type === 'undercover');

  const answered = quiz.reduce((sum, r) => sum + (r.answered_count ?? 0), 0);
  const correct = quiz.reduce((sum, r) => sum + (r.correct_answers ?? 0), 0);
  const timed = quiz.filter((r) => r.avg_response_ms != null && (r.answered_count ?? 0) > 0);
  const timedAnswers = timed.reduce((sum, r) => sum + (r.answered_count ?? 0), 0);
  const weightedMs = timed.reduce((sum, r) => sum + (r.avg_response_ms ?? 0) * (r.answered_count ?? 0), 0);
  const scores = quiz.map((r) => r.score).filter((v): v is number => v != null);

  const byRole: GameIndicators['undercover']['byRole'] = { civil: { games: 0, wins: 0 }, undercover: { games: 0, wins: 0 }, spy: { games: 0, wins: 0 } };
  for (const r of undercover) {
    if (r.role === 'civil' || r.role === 'undercover' || r.role === 'spy') {
      byRole[r.role].games += 1;
      if (r.outcome === 'won') byRole[r.role].wins += 1;
    }
  }
  const wins = undercover.filter((r) => r.outcome === 'won').length;
  const last = rows.reduce<string | null>((latest, r) => (!latest || r.played_at > latest ? r.played_at : latest), null);

  return {
    total: rows.length,
    quiz: {
      games: quiz.length,
      bestScore: scores.length ? Math.max(...scores) : null,
      firstPlaces: quiz.filter((r) => r.rank === 1).length,
      podiums: quiz.filter((r) => r.rank != null && r.rank <= 3 && r.player_count >= 3).length,
      accuracy: answered > 0 ? Math.round((correct / answered) * 100) : null,
      avgResponseMs: timedAnswers > 0 ? Math.round(weightedMs / timedAnswers) : null,
    },
    undercover: { games: undercover.length, wins, winRate: undercover.length ? Math.round((wins / undercover.length) * 100) : null, byRole },
    lastPlayedAt: last,
  };
}

export const ROLE_LABELS: Record<UndercoverRole, string> = { civil: 'Civil', undercover: 'Undercover', spy: 'Fourmi Caché' };
export const GAME_LABELS: Record<'quiz' | 'undercover', string> = { quiz: 'Quiz', undercover: 'Undercover' };

/** « 4,2 s » pour un temps moyen de réponse. */
export function formatSeconds(ms: number | null | undefined): string {
  return ms == null ? '—' : `${(ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} s`;
}
