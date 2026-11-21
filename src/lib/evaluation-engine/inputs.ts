/**
 * Entrées du moteur d'évaluation construites à partir des lignes lues en base. Module pur,
 * partagé par le passeport (src/lib/passport.ts) et l'observatoire (src/lib/observatory) :
 * la valeur d'une compétence pour une personne est ainsi calculée de la même façon partout.
 */
import type { FrameworkRules, Observation } from './index';

export type ValidatedEvaluationRow = {
  id: string;
  validated_at: string | null;
  sessions: { number: number; scheduled_date: string | null } | null;
  evaluation_scores: { skill_id: string; score: number | null; comment?: string | null }[];
};

/**
 * Observations validées, rattachées au code stable de la compétence et regroupées par code de
 * référentiel. Une note nulle (« non observé »), une compétence inconnue ou sans référentiel
 * n'entrent pas : un manque n'est jamais converti en zéro. Les lignes reçues sont des évaluations
 * déjà filtrées sur le statut « validée ».
 */
export function validatedObservationsByFramework(
  evaluations: readonly ValidatedEvaluationRow[],
  skillById: ReadonlyMap<string, { code: string; version_id: string }>,
  versionById: ReadonlyMap<string, { frameworks: { code: string } | null }>,
): Map<string, Observation[]> {
  const observationsByFramework = new Map<string, Observation[]>();
  for (const evaluation of evaluations) {
    const date = evaluation.sessions?.scheduled_date ?? evaluation.validated_at?.slice(0, 10) ?? '';
    for (const score of evaluation.evaluation_scores) {
      if (score.score === null) continue;
      const skill = skillById.get(score.skill_id);
      const version = skill ? versionById.get(skill.version_id) : null;
      if (!skill || !version?.frameworks) continue;
      const list = observationsByFramework.get(version.frameworks.code) ?? [];
      list.push({
        skillCode: skill.code,
        score: Number(score.score),
        sessionNumber: evaluation.sessions?.number ?? 0,
        date,
        evaluationId: evaluation.id,
        comment: score.comment,
      });
      observationsByFramework.set(version.frameworks.code, list);
    }
  }
  return observationsByFramework;
}

/**
 * Réponses d'une auto-évaluation par code de compétence, seulement si elle est terminée. Les réponses
 * sont attendues dans l'ordre des questions : pour une même compétence, la dernière l'emporte.
 */
export function selfValuesBySkill<T extends { skillCode: string | null }>(selfAssessment: { status: string; answers: readonly T[] } | null): Map<string, T> {
  const bySkill = new Map<string, T>();
  if (selfAssessment?.status !== 'completed') return bySkill;
  for (const answer of selfAssessment.answers) if (answer.skillCode) bySkill.set(answer.skillCode, answer);
  return bySkill;
}

/** L'auto-évaluation utilise la même échelle que le référentiel : la comparaison est permise. */
export function selfScaleComparable(selfAssessment: { scaleMin: number; scaleMax: number } | null, rules: Pick<FrameworkRules, 'scaleMin' | 'scaleMax'>): boolean {
  return selfAssessment !== null && selfAssessment.scaleMin === rules.scaleMin && selfAssessment.scaleMax === rules.scaleMax;
}

/**
 * Groupe de référence d'une personne : l'inscription active la plus récente ; à défaut, le dernier
 * groupe quitté par abandon. Un retrait (erreur d'inscription) ne compte pas. Lignes attendues de la
 * plus récente à la plus ancienne.
 */
export function referenceMembership<T extends { status: string }>(memberships: readonly T[]): T | null {
  return memberships.find((membership) => membership.status === 'active') ?? memberships.find((membership) => membership.status === 'dropped') ?? null;
}
