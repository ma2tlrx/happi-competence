/**
 * Défis du participant : la couche « jeu » de l'espace participant.
 *
 * Règles de conception (voir docs/gamification.md) :
 * - Chaque défi se calcule à partir de données qui existent déjà (présences, évaluations validées,
 *   auto-évaluations, enquêtes, partages, jeux). Aucun nouveau suivi de comportement.
 * - Aucun défi ne touche aux barèmes ni aux niveaux : une compétence est « révélée » dès qu'elle a
 *   été observée, quel que soit son niveau. Une compétence non observée est « à découvrir », jamais zéro.
 * - Pas de classement entre participants, pas de série à entretenir, rien ne se perd : une absence
 *   ralentit un défi, elle ne le rend jamais impossible.
 * - Les consentements et la fiche d'entrée ne sont jamais des défis : ils doivent rester libres.
 *
 * Module pur, utilisable côté serveur et navigateur.
 */

export type FinalSelfAssessmentStatus = 'no_initial' | 'not_open' | 'open' | 'in_progress' | 'completed';

export type EngagementFacts = {
  hasGroup: boolean;
  /** Parcours interrompu : les défis de parcours restent visibles, sans relance. */
  dropped: boolean;
  /** Nombre de sessions du programme (6 pour HAPPI). */
  totalSessions: number;
  /** Sessions terminées du groupe (avancement collectif). */
  completedSessions: number;
  /** Sessions où la personne était présente (retards et départs anticipés compris). */
  attendedSessions: number;
  selfAssessmentDone: boolean;
  finalSelfAssessment: FinalSelfAssessmentStatus;
  /** Compétences ayant au moins une observation validée. */
  observedSkills: number;
  skillsTotal: number;
  /** Compétences dont la dernière observation dépasse la première (règle du moteur d'évaluation). */
  progressions: number;
  /** Enquêtes de satisfaction proposées à la personne, et celles déjà remplies. */
  surveysAvailable: number;
  surveysAnswered: number;
  sharesCreated: number;
  gamesPlayed: number;
};

export type ChallengeFamily = 'parcours' | 'competences' | 'participation';

export type ChallengeId =
  | 'point-de-depart'
  | 'premier-rendez-vous'
  | 'a-mi-chemin'
  | 'ligne-d-arrivee'
  | 'regard-final'
  | 'premiere-revelee'
  | 'collection-en-marche'
  | 'belle-collection'
  | 'ca-progresse'
  | 'mon-avis-compte'
  | 'montrer-mes-competences'
  | 'esprit-d-equipe';

export type Challenge = {
  id: ChallengeId;
  family: ChallengeFamily;
  title: string;
  /** Ce qu'il faut faire, en une phrase. */
  goal: string;
  /** Étoiles gagnées une fois le défi réussi (1 à 3, selon l'effort demandé). */
  stars: 1 | 2 | 3;
  current: number;
  target: number;
  done: boolean;
  /**
   * Faisable maintenant par la personne. Faux quand le défi dépend d'une étape à venir
   * (enquête pas encore proposée, auto-évaluation finale pas encore ouverte…).
   */
  available: boolean;
  /** Pourquoi le défi n'est pas encore disponible. */
  lockedReason: string | null;
  /** Lien pour agir (null quand l'action ne dépend pas de la personne : observation des formateurs, avancement du groupe). */
  href: string | null;
  action: string | null;
};

export const FAMILY_LABELS: Record<ChallengeFamily, string> = {
  parcours: 'Mon parcours',
  competences: 'Mes compétences',
  participation: 'Ma participation',
};

/** Paliers de la collection de compétences révélées (nombre de compétences observées). */
export const COLLECTION_STEPS = { first: 1, second: 10, third: 20 } as const;

function clampProgress(current: number, target: number) {
  return Math.max(0, Math.min(current, target));
}

function challenge(input: Omit<Challenge, 'current' | 'done' | 'available' | 'lockedReason'> & { current: number; available?: boolean; lockedReason?: string | null }): Challenge {
  const current = clampProgress(input.current, input.target);
  const done = current >= input.target;
  const available = done || (input.available ?? true);
  return { ...input, current, done, available, lockedReason: available ? null : (input.lockedReason ?? null) };
}

export function buildChallenges(facts: EngagementFacts): Challenge[] {
  const total = Math.max(1, facts.totalSessions);
  const half = Math.ceil(total / 2);
  const collectionTarget = (step: number) => Math.min(step, Math.max(1, facts.skillsTotal));
  const finalDone = facts.finalSelfAssessment === 'completed';
  const finalAvailable = facts.finalSelfAssessment === 'open' || facts.finalSelfAssessment === 'in_progress';
  const finished = facts.hasGroup && !facts.dropped && facts.completedSessions >= total && facts.attendedSessions > 0;

  return [
    challenge({
      id: 'point-de-depart',
      family: 'parcours',
      title: 'Point de départ',
      goal: 'Remplir mon auto-évaluation de départ (environ cinq minutes).',
      stars: 2,
      current: facts.selfAssessmentDone ? 1 : 0,
      target: 1,
      href: '/participant/auto-evaluation',
      action: 'Répondre',
    }),
    challenge({
      id: 'premier-rendez-vous',
      family: 'parcours',
      title: 'Premier rendez-vous',
      goal: 'Participer à ma première session.',
      stars: 1,
      current: facts.attendedSessions,
      target: 1,
      available: facts.hasGroup,
      lockedReason: 'Dès votre inscription dans un groupe.',
      href: null,
      action: null,
    }),
    challenge({
      id: 'a-mi-chemin',
      family: 'parcours',
      title: 'À mi-chemin',
      goal: `Participer à ${half} sessions.`,
      stars: 2,
      current: facts.attendedSessions,
      target: half,
      available: facts.hasGroup,
      lockedReason: 'Dès votre inscription dans un groupe.',
      href: null,
      action: null,
    }),
    challenge({
      id: 'ligne-d-arrivee',
      family: 'parcours',
      title: 'Ligne d’arrivée',
      goal: 'Aller au bout du programme, jusqu’à la dernière session.',
      stars: 3,
      current: finished ? total : Math.min(facts.completedSessions, total - 1),
      target: total,
      available: facts.hasGroup && !facts.dropped,
      lockedReason: facts.dropped ? 'Votre parcours a été interrompu.' : 'Dès votre inscription dans un groupe.',
      href: null,
      action: null,
    }),
    challenge({
      id: 'regard-final',
      family: 'parcours',
      title: 'Regard final',
      goal: 'Remplir mon auto-évaluation de fin de parcours, pour mesurer le chemin parcouru.',
      stars: 2,
      current: finalDone ? 1 : 0,
      target: 1,
      available: finalAvailable,
      lockedReason: 'S’ouvre à la dernière session.',
      href: '/participant/auto-evaluation/finale',
      action: facts.finalSelfAssessment === 'in_progress' ? 'Reprendre' : 'Répondre',
    }),
    challenge({
      id: 'premiere-revelee',
      family: 'competences',
      title: 'Première révélée',
      goal: 'Une première compétence observée par vos formateurs.',
      stars: 1,
      current: facts.observedSkills,
      target: collectionTarget(COLLECTION_STEPS.first),
      href: null,
      action: null,
    }),
    challenge({
      id: 'collection-en-marche',
      family: 'competences',
      title: 'Collection en marche',
      goal: `${collectionTarget(COLLECTION_STEPS.second)} compétences révélées au fil des sessions.`,
      stars: 2,
      current: facts.observedSkills,
      target: collectionTarget(COLLECTION_STEPS.second),
      href: null,
      action: null,
    }),
    challenge({
      id: 'belle-collection',
      family: 'competences',
      title: 'Belle collection',
      goal: `${collectionTarget(COLLECTION_STEPS.third)} compétences révélées.`,
      stars: 3,
      current: facts.observedSkills,
      target: collectionTarget(COLLECTION_STEPS.third),
      href: null,
      action: null,
    }),
    challenge({
      id: 'ca-progresse',
      family: 'competences',
      title: 'Ça progresse',
      goal: 'Une compétence observée plus haut qu’à sa première observation.',
      stars: 2,
      current: facts.progressions,
      target: 1,
      href: null,
      action: null,
    }),
    challenge({
      id: 'mon-avis-compte',
      family: 'participation',
      title: 'Mon avis compte',
      goal: 'Donner mon avis sur le programme.',
      stars: 1,
      current: facts.surveysAnswered,
      target: 1,
      available: facts.surveysAvailable > 0,
      lockedReason: 'Le questionnaire est proposé en fin de programme.',
      href: '/participant/satisfaction',
      action: 'Donner mon avis',
    }),
    challenge({
      id: 'montrer-mes-competences',
      family: 'participation',
      title: 'Montrer mes compétences',
      goal: 'Créer un lien de partage de mon passeport, pour un employeur ou une structure.',
      stars: 1,
      current: facts.sharesCreated,
      target: 1,
      available: facts.observedSkills > 0,
      lockedReason: 'Dès qu’une compétence a été observée.',
      href: '/participant/partage',
      action: 'Créer un lien',
    }),
    challenge({
      id: 'esprit-d-equipe',
      family: 'participation',
      title: 'Esprit d’équipe',
      goal: 'Participer à un jeu d’animation (Quiz ou Undercover) pendant une session.',
      stars: 1,
      current: facts.gamesPlayed,
      target: 1,
      available: facts.hasGroup,
      lockedReason: 'Pendant une session, avec le code donné par votre formateur.',
      href: '/jouer',
      action: 'Rejoindre une partie',
    }),
  ];
}

export function starsOf(challenges: readonly Challenge[]) {
  return {
    earned: challenges.filter((item) => item.done).reduce((sum, item) => sum + item.stars, 0),
    total: challenges.reduce((sum, item) => sum + item.stars, 0),
    done: challenges.filter((item) => item.done).length,
    count: challenges.length,
  };
}

/**
 * Prochaine étape conseillée : le premier défi faisable tout de suite par la personne,
 * dans un ordre qui suit le parcours (départ, avis attendu, regard final, puis le reste).
 */
const NEXT_STEP_ORDER: ChallengeId[] = ['point-de-depart', 'regard-final', 'mon-avis-compte', 'montrer-mes-competences', 'esprit-d-equipe'];

export function nextChallenge(challenges: readonly Challenge[], exclude: readonly ChallengeId[] = []): Challenge | null {
  for (const id of NEXT_STEP_ORDER) {
    if (exclude.includes(id)) continue;
    const found = challenges.find((item) => item.id === id);
    if (found && !found.done && found.available && found.href) return found;
  }
  return null;
}

/** Défis réussis absents de la liste déjà célébrée : au plus un par visite, le plus « difficile » d'abord. */
export function toCelebrate<T extends Pick<Challenge, 'id' | 'done' | 'stars'>>(challenges: readonly T[], alreadySeen: ReadonlySet<string>): T | null {
  const fresh = challenges.filter((item) => item.done && !alreadySeen.has(item.id));
  if (fresh.length === 0) return null;
  return [...fresh].sort((a, b) => b.stars - a.stars)[0] ?? null;
}
