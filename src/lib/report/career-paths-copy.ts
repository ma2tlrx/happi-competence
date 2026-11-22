import type { CareerPath, CareerPathAnchor, CareerPaths, CareerPathsUnavailable } from '@/lib/career-paths/model';

/**
 * Textes de la section « Pistes à explorer » du bilan, partagés par le PDF et l'espace
 * de relecture. Des recommandations seulement : aucun score, rang ni pourcentage.
 */

export const CAREER_PATHS_TITLE = 'Pistes à explorer';

const COUNT_WORDS = ['Aucune', 'Une', 'Deux', 'Trois'] as const;

/** Chapeau de la section, accordé au nombre réel de pistes (le moteur peut en proposer moins de trois). */
export function careerPathsLead(count: number): string {
  const head = count === 1 ? 'Une piste de métiers' : `${COUNT_WORDS[Math.min(count, 3)]} pistes de métiers`;
  return `${head} à explorer avec votre conseiller ou votre formateur. Elles rapprochent vos points d’appui observés pendant le programme des savoir-être attendus dans les fiches métiers de France Travail. Ce ne sont ni des conseils d’orientation définitifs, ni une évaluation : d’autres métiers peuvent vous convenir, et certains demandent un diplôme ou une formation.`;
}

/** Chapeau pour trois pistes (cas habituel). */
export const CAREER_PATHS_LEAD = careerPathsLead(3);

export const EXAMPLES_LABEL = 'Exemples de métiers :';
export const ANCHORS_LABEL = 'Ce qui vous en rapproche :';

const UNAVAILABLE: Record<CareerPathsUnavailable, string> = {
  no_validated_mappings: 'Les correspondances entre les compétences HAPPI et les savoir-être de France Travail n’ont pas encore été validées : aucune piste n’est proposée.',
  no_strengths: 'Pas encore assez de compétences observées pour dégager des points d’appui : aucune piste n’est proposée pour l’instant.',
  no_anchors: 'Vos points d’appui ne sont pas encore reliés aux savoir-être de France Travail : aucune piste n’est proposée.',
  no_reference: 'Le référentiel des métiers n’est pas disponible : aucune piste n’est proposée.',
};

export function basisLabel(path: Pick<CareerPath, 'basis'>): string {
  switch (path.basis) {
    case 'declared_sector':
      return 'Dans un secteur que vous visez';
    case 'opening':
      return 'Une ouverture, hors de vos choix de départ';
    case 'strengths':
      return 'D’après vos points d’appui';
  }
}

export function anchorLine(anchor: CareerPathAnchor): string {
  return `${anchor.label} — grâce à : ${anchor.happiSkills.join(', ')}`;
}

export function ficheLabel(code: string): string {
  return `Fiche ROME ${code}`;
}

export function sourceLine(source: string): string {
  return `Source : ${source}. Pistes calculées automatiquement à partir des correspondances validées par l’équipe HAPPI ; elles ne modifient aucun niveau.`;
}

export function unavailableMessage(reason: CareerPathsUnavailable | null): string {
  return reason ? UNAVAILABLE[reason] : 'Aucune piste n’est proposée pour ce bilan.';
}

export type CareerPathsView = { kind: 'none' } | { kind: 'unavailable'; message: string } | { kind: 'paths'; paths: CareerPath[] };

/**
 * Ce que la section affiche. `review` : aperçu formateur (brouillon), où l'absence de
 * piste est expliquée ; dans le bilan remis, une section sans matière est omise.
 */
export function careerPathsView(careerPaths: CareerPaths | null | undefined, { hidden, review }: { hidden: boolean; review: boolean }): CareerPathsView {
  if (!careerPaths || hidden) return { kind: 'none' };
  if (careerPaths.status === 'ok' && careerPaths.paths.length > 0) return { kind: 'paths', paths: careerPaths.paths };
  return review ? { kind: 'unavailable', message: unavailableMessage(careerPaths.reason) } : { kind: 'none' };
}
