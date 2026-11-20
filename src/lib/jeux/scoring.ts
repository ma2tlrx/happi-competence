/**
 * Quiz : score, classement et statistiques. Logique pure (aucune dépendance serveur),
 * portée à l'identique du jeu d'origine : 1 000 points pour une réponse immédiate, 500 au
 * dernier instant, 0 pour une mauvaise réponse.
 */

export type GamePlayer = {
  id: string;
  nickname: string;
  score: number;
  /** Compte (profil) du joueur : sert à vérifier que l'action vient bien de lui. Jamais exposé aux écrans. */
  userId?: string;
  /** Fiche participant ; absente pour un animateur en mode essai. */
  participantId?: string | null;
  /** Mode essai : aucun résultat n'est enregistré pour ce joueur. */
  trial?: boolean;
  /** Statistiques cumulées sur la partie (alimentent les résultats conservés). */
  answeredCount?: number;
  correctCount?: number;
  totalResponseMs?: number;
};

export type GameAnswer = {
  answerId: string;
  responseTime: number;
  isCorrect: boolean;
  points: number;
};

/** Marge accordée au-delà du temps de la question (latence réseau) avant de refuser une réponse. */
export const ANSWER_GRACE_MS = 2000;

export function calculatePoints(responseTime: number, timeLimit: number, isCorrect: boolean): number {
  if (!isCorrect) return 0;
  const ratio = Math.min(Math.max(responseTime, 0) / (timeLimit * 1000), 1);
  return Math.round(1000 - ratio * 500); // 500..1000
}

/** Une réponse reçue bien après la fin du chronomètre n'est plus acceptée. */
export function isWithinTime(responseTime: number, timeLimit: number): boolean {
  return responseTime <= timeLimit * 1000 + ANSWER_GRACE_MS;
}

export type LeaderboardEntry = { rank: number; id: string; nickname: string; score: number };

/** Classement par score décroissant ; les ex æquo se suivent dans l'ordre d'arrivée (tri stable), comme dans le jeu d'origine. */
export function getLeaderboard(players: Record<string, GamePlayer>): LeaderboardEntry[] {
  return Object.values(players)
    .sort((a, b) => b.score - a.score)
    .map((player, index) => ({ rank: index + 1, id: player.id, nickname: player.nickname, score: player.score }));
}

export function getQuestionStats(answers: Record<string, GameAnswer>, answerIds: string[]) {
  const counts: Record<string, number> = {};
  for (const id of answerIds) counts[id] = 0;
  for (const answer of Object.values(answers)) {
    if (counts[answer.answerId] !== undefined) counts[answer.answerId]++;
  }
  return { answerCounts: counts, totalAnswered: Object.keys(answers).length };
}
