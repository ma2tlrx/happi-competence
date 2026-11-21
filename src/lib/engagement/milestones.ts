/**
 * Jalons d'une structure (organisme) : des caps collectifs, jamais un classement entre structures
 * ni entre personnes. Les seuils sont des choix d'animation, sans lien avec les barèmes pédagogiques :
 * ils se règlent ici (voir docs/gamification.md).
 */

export type MilestoneId = 'personnes' | 'sessions' | 'parcours' | 'orientations';

export const MILESTONE_TIERS: Record<MilestoneId, readonly number[]> = {
  personnes: [1, 10, 25, 50, 100, 250],
  sessions: [5, 10, 25, 50, 100, 250],
  parcours: [1, 10, 25, 50, 100],
  orientations: [1, 5, 10, 25, 50],
};

export type MilestoneProgress = {
  value: number;
  /** Nombre de jalons franchis. */
  reached: number;
  tiers: number;
  /** Jalon précédent (0 au départ) et suivant (null quand tout est franchi). */
  previous: number;
  next: number | null;
};

export function milestoneProgress(value: number, tiers: readonly number[]): MilestoneProgress {
  const safe = Math.max(0, Math.floor(value));
  const reached = tiers.filter((tier) => safe >= tier).length;
  return {
    value: safe,
    reached,
    tiers: tiers.length,
    previous: reached > 0 ? tiers[reached - 1]! : 0,
    next: reached < tiers.length ? tiers[reached]! : null,
  };
}

/** Parcours menés à terme : personne non sortie en cours de route, toutes les sessions de son groupe terminées. */
export function completedJourneys(participants: readonly { dropped: boolean; completedSessions: number; totalSessions: number; groupId: string | null }[]) {
  return participants.filter((row) => row.groupId && !row.dropped && row.totalSessions > 0 && row.completedSessions >= row.totalSessions).length;
}
