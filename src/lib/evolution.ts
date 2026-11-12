/**
 * Évolution d'un participant — module pur.
 *
 * Trois regards, présentés côte à côte et jamais additionnés :
 *   • déclaré au départ (auto-évaluation initiale, échelle du questionnaire) ;
 *   • observé par les formateurs (évaluations validées, échelle du référentiel) ;
 *   • déclaré à la fin (auto-évaluation finale, même questionnaire que l'initiale).
 * Les échelles diffèrent (accord 1–5, niveaux CT 1–5, niveaux HBS 1–4) : seules deux réponses
 * au même questionnaire se comparent entre elles. Une compétence non évaluée est « non
 * observée », jamais zéro.
 */
import { levelFor, type ScaleLevel, type Trend } from '@/lib/evaluation-engine';
import type { Passport, PassportSession, SelfAssessment } from '@/lib/passport';

export type DeclaredAnswer = { value: number; label: string | null; question: string };
export type ObservedPoint = { value: number; label: string | null; session: number };
export type ObservedSummary = { count: number; first: ObservedPoint; last: ObservedPoint; trend: Trend | null };

export type EvolutionSkill = {
  code: string;
  name: string;
  initial: DeclaredAnswer | null;
  final: DeclaredAnswer | null;
  /** Nul si la compétence n'a jamais été observée (« non observée »). */
  observed: ObservedSummary | null;
  /** Comparaison des deux réponses au même questionnaire ; nulle s'il en manque une. */
  declaredChange: 'higher' | 'same' | 'lower' | null;
};

export type EvolutionFramework = {
  code: string;
  name: string;
  shortName: string;
  versionLabel: string;
  isProvisional: boolean;
  scaleMin: number;
  scaleMax: number;
  levels: ScaleLevel[];
  skills: EvolutionSkill[];
  /** Compétences du référentiel sans question ni observation, non présentées. */
  omitted: number;
};

export type FinalStatus = 'not_open' | 'open' | 'in_progress' | 'completed' | 'no_initial';

export type Evolution = {
  questionnaire: { versionLabel: string; scaleMin: number; scaleMax: number; labels: { value: number; label: string }[] } | null;
  initialCompletedAt: string | null;
  finalCompletedAt: string | null;
  finalStatus: FinalStatus;
  frameworks: EvolutionFramework[];
  /** Au moins une donnée dans l'une des trois colonnes. */
  hasData: boolean;
};

export const DECLARED_CHANGE_LABELS: Record<NonNullable<EvolutionSkill['declaredChange']>, string> = {
  higher: 'Réponse de fin plus élevée qu’au départ',
  same: 'Même réponse qu’au départ',
  lower: 'Réponse de fin moins élevée qu’au départ',
};

export const TREND_LABELS: Record<Trend, string> = {
  up: 'Niveau observé plus élevé qu’à la première observation',
  stable: 'Même niveau qu’à la première observation',
  down: 'Niveau observé moins élevé qu’à la première observation',
};

/** Séance à partir de laquelle l'auto-évaluation finale s'ouvre (règle de la base, à valider). */
export const FINAL_FROM_SESSION = 6;

/**
 * Ouverture de l'auto-évaluation finale (reprend private.final_self_assessment_open) : groupe
 * terminé, dernière séance (hors annulées) terminée, ou séance 6 commencée ou terminée.
 */
export function finalSelfAssessmentOpen(group: { status: string } | null, sessions: Pick<PassportSession, 'number' | 'status'>[]): boolean {
  if (!group) return false;
  if (group.status === 'completed') return true;
  if (sessions.some((session) => session.number >= FINAL_FROM_SESSION && (session.status === 'in_progress' || session.status === 'completed'))) return true;
  const last = sessions.filter((session) => session.status !== 'cancelled').sort((a, b) => b.number - a.number)[0];
  return last?.status === 'completed';
}

export function finalStatusOf(passport: Pick<Passport, 'selfAssessment' | 'finalSelfAssessment' | 'group' | 'sessions'>): FinalStatus {
  if (passport.finalSelfAssessment?.status === 'completed') return 'completed';
  if (passport.finalSelfAssessment) return 'in_progress';
  if (passport.selfAssessment?.status !== 'completed') return 'no_initial';
  return finalSelfAssessmentOpen(passport.group, passport.sessions) ? 'open' : 'not_open';
}

function answersBySkill(assessment: SelfAssessment | null) {
  const map = new Map<string, DeclaredAnswer & { frameworkCode: string | null }>();
  if (assessment?.status !== 'completed') return map;
  for (const answer of assessment.answers) {
    if (!answer.skillCode) continue;
    const label = assessment.scaleLabels.find((level) => level.value === answer.value)?.label ?? null;
    map.set(`${answer.frameworkCode ?? '*'}:${answer.skillCode}`, { value: answer.value, label, question: answer.text, frameworkCode: answer.frameworkCode });
  }
  return map;
}

function lookup(map: ReturnType<typeof answersBySkill>, frameworkCode: string, skillCode: string): DeclaredAnswer | null {
  const found = map.get(`${frameworkCode}:${skillCode}`) ?? map.get(`*:${skillCode}`);
  return found ? { value: found.value, label: found.label, question: found.question } : null;
}

export function buildEvolution(passport: Pick<Passport, 'selfAssessment' | 'finalSelfAssessment' | 'frameworks' | 'group' | 'sessions'>): Evolution {
  const initial = passport.selfAssessment?.status === 'completed' ? passport.selfAssessment : null;
  const final = passport.finalSelfAssessment?.status === 'completed' ? passport.finalSelfAssessment : null;
  const initialMap = answersBySkill(initial);
  const finalMap = answersBySkill(final);
  const reference = initial ?? final;

  const frameworks: EvolutionFramework[] = passport.frameworks.map((framework) => {
    const skills: EvolutionSkill[] = [];
    let omitted = 0;
    for (const skill of framework.skills) {
      const start = lookup(initialMap, framework.code, skill.code);
      const end = lookup(finalMap, framework.code, skill.code);
      const observations = skill.summary.observations;
      const firstObservation = observations[0];
      const lastObservation = observations.at(-1);
      const observed: ObservedSummary | null =
        firstObservation && lastObservation
          ? {
              count: observations.length,
              first: { value: firstObservation.score, label: levelFor(firstObservation.score, framework.levels)?.label ?? null, session: firstObservation.sessionNumber },
              last: { value: lastObservation.score, label: levelFor(lastObservation.score, framework.levels)?.label ?? null, session: lastObservation.sessionNumber },
              trend: skill.summary.trend,
            }
          : null;
      if (!start && !end && !observed) {
        omitted += 1;
        continue;
      }
      skills.push({
        code: skill.code,
        name: skill.name,
        initial: start,
        final: end,
        observed,
        declaredChange: start && end ? (end.value > start.value ? 'higher' : end.value < start.value ? 'lower' : 'same') : null,
      });
    }
    return {
      code: framework.code,
      name: framework.name,
      shortName: framework.shortName,
      versionLabel: framework.versionLabel,
      isProvisional: framework.isProvisional,
      scaleMin: framework.rules.scaleMin,
      scaleMax: framework.rules.scaleMax,
      levels: framework.levels,
      skills,
      omitted,
    };
  });

  return {
    questionnaire: reference
      ? { versionLabel: reference.versionLabel, scaleMin: reference.scaleMin, scaleMax: reference.scaleMax, labels: reference.scaleLabels }
      : null,
    initialCompletedAt: initial?.completedAt ?? null,
    finalCompletedAt: final?.completedAt ?? null,
    finalStatus: finalStatusOf(passport),
    frameworks,
    hasData: frameworks.some((framework) => framework.skills.length > 0),
  };
}
