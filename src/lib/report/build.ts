import { AGGREGATION_LABELS, SCORING_MODE_LABELS, levelFor } from '@/lib/evaluation-engine';
import type { Passport, PassportFramework } from '@/lib/passport';

import { activitiesFromSupport } from './activities';
import { REPORT_ENGINE_VERSION, type ReportData, type ReportFramework, type ReportSkill, type ReportSkillStatus } from './model';

const ATTENDED = new Set(['present', 'late', 'left_early']);

export function statusOf(count: number): ReportSkillStatus {
  if (count === 0) return 'not_observed';
  return count === 1 ? 'single' : 'repeated';
}

function buildFramework(framework: PassportFramework, sessionTitles: Map<number, string>, sessionDates: Map<number, string | null>): ReportFramework {
  const levels = framework.levels.map((level) => ({ value: level.value, label: level.label, description: level.description ?? null }));
  const categoryName = new Map(framework.categories.map((category) => [category.code, category.name]));
  const skills: ReportSkill[] = framework.skills.map((skill) => {
    const level = skill.level;
    const observations = skill.summary.observations.map((observation) => ({
      session: observation.sessionNumber,
      sessionTitle: sessionTitles.get(observation.sessionNumber) ?? `Session ${observation.sessionNumber}`,
      date: sessionDates.get(observation.sessionNumber) ?? (observation.date || null),
      value: observation.score,
      levelLabel: levelFor(observation.score, framework.levels)?.label ?? null,
      comment: observation.comment?.trim() ? observation.comment.trim() : null,
    }));
    const selfLabel = skill.selfValue === null ? null : (levelFor(skill.selfValue, framework.levels)?.label ?? null);
    return {
      code: skill.code,
      name: skill.name,
      description: skill.description,
      categoryCode: skill.categoryCode,
      categoryName: skill.categoryCode ? (categoryName.get(skill.categoryCode) ?? null) : null,
      value: skill.summary.value,
      levelValue: level?.value ?? null,
      levelLabel: level?.label ?? null,
      levelDescriptor: level ? (skill.levels.find((descriptor) => descriptor.value === level.value)?.description ?? null) : null,
      status: statusOf(observations.length),
      observations,
      first: skill.summary.first,
      last: skill.summary.last,
      delta: skill.summary.delta,
      trend: skill.summary.trend,
      self: framework.selfComparable && skill.selfValue !== null ? { value: skill.selfValue, label: selfLabel } : null,
    };
  });
  const observed = skills.filter((skill) => skill.levelValue !== null);
  const values = observed.map((skill) => skill.levelValue as number);
  const spread = values.length >= 2 ? Math.max(...values) - Math.min(...values) : null;
  const shape = framework.highlights.insufficient || spread === null ? 'undetermined' : spread <= 1 ? 'homogeneous' : 'contrasted';
  const scoring = SCORING_MODE_LABELS[framework.rules.scoringMode];
  const aggregation = AGGREGATION_LABELS[framework.rules.aggregation];
  return {
    code: framework.code,
    name: framework.name,
    shortName: framework.shortName,
    description: framework.description,
    versionLabel: framework.versionLabel,
    isProvisional: framework.isProvisional,
    scaleMin: framework.rules.scaleMin,
    scaleMax: framework.rules.scaleMax,
    levels,
    rules: {
      scoringMode: framework.rules.scoringMode,
      scoringLabel: scoring?.label ?? framework.rules.scoringMode,
      aggregation: framework.rules.aggregation,
      aggregationLabel: aggregation?.label ?? framework.rules.aggregation,
    },
    categories: framework.categories.map((category) => {
      const members = skills.filter((skill) => skill.categoryCode === category.code);
      return {
        code: category.code,
        name: category.name,
        description: category.description,
        skillCodes: members.map((skill) => skill.code),
        observed: members.filter((skill) => skill.levelValue !== null).length,
        total: members.length,
        distribution: levels.map((level) => ({ value: level.value, count: members.filter((skill) => skill.levelValue === level.value).length })),
      };
    }),
    skills,
    observedCount: observed.length,
    totalCount: skills.length,
    repeatedCount: skills.filter((skill) => skill.status === 'repeated').length,
    distribution: levels.map((level) => ({ value: level.value, label: level.label, count: observed.filter((skill) => skill.levelValue === level.value).length })),
    highlights: {
      strengths: framework.highlights.strengths.map((summary) => summary.skillCode),
      toDevelop: framework.highlights.toDevelop.map((summary) => summary.skillCode),
      progressions: framework.highlights.progressions.map((summary) => summary.skillCode),
      insufficient: framework.highlights.insufficient,
    },
    spread,
    shape,
    selfComparable: framework.selfComparable,
  };
}

/**
 * Construit la photographie d'un bilan à partir du passeport (évaluations validées
 * uniquement, commentaires partagés uniquement) et des supports des sessions.
 * Fonction pure : aucune valeur n'est inventée, une absence reste une absence.
 */
export function buildReportData(passport: Passport, supports: Map<number, string | null>, now: Date = new Date()): ReportData {
  const sessionTitles = new Map(passport.sessions.map((session) => [session.number, session.title]));
  const sessionDates = new Map(passport.sessions.map((session) => [session.number, session.date]));
  for (const evaluation of passport.evaluations) {
    if (!sessionTitles.has(evaluation.sessionNumber)) sessionTitles.set(evaluation.sessionNumber, evaluation.sessionTitle);
  }
  const sessions = passport.sessions.map((session) => {
    const attended = session.attendance !== null && ATTENDED.has(session.attendance);
    return {
      number: session.number,
      title: session.title,
      date: session.date,
      attendance: session.attendance,
      attended,
      evaluated: session.evaluated,
      activities: attended || session.evaluated ? activitiesFromSupport(supports.get(session.number)) : [],
    };
  });
  const frameworks = passport.frameworks.map((framework) => buildFramework(framework, sessionTitles, sessionDates));
  const observations = frameworks.reduce((total, framework) => total + framework.skills.reduce((sum, skill) => sum + skill.observations.length, 0), 0);
  const skillsObserved = frameworks.reduce((total, framework) => total + framework.observedCount, 0);
  const skillsTotal = frameworks.reduce((total, framework) => total + framework.totalCount, 0);
  const sessionsEvaluated = passport.evaluations.length;

  const sufficiency: ReportData['sufficiency'] =
    observations === 0 ? 'none' : sessionsEvaluated < 2 || frameworks.some((framework) => framework.highlights.insufficient) ? 'limited' : 'sufficient';

  const missing: string[] = [];
  if (!passport.group) missing.push('Le participant n’est rattaché à aucun groupe actif : les sessions suivies ne peuvent pas être listées.');
  if (sessionsEvaluated === 0) missing.push('Aucune évaluation de session n’a encore été validée par un formateur.');
  const notEvaluated = sessions.filter((session) => session.attended && !session.evaluated).map((session) => session.number);
  if (notEvaluated.length) missing.push(`Session${notEvaluated.length > 1 ? 's' : ''} suivie${notEvaluated.length > 1 ? 's' : ''} sans évaluation validée : ${notEvaluated.join(', ')}.`);
  for (const framework of frameworks) {
    const unobserved = framework.totalCount - framework.observedCount;
    if (unobserved > 0) missing.push(`${framework.name} : ${unobserved} sur ${framework.totalCount} non observée${unobserved > 1 ? 's' : ''}.`);
    if (framework.observedCount > 0 && framework.highlights.insufficient)
      missing.push(`${framework.name} : trop peu de compétences observées pour dégager des points d’appui et des pistes de progression.`);
    if (framework.isProvisional) missing.push(`${framework.name} : référentiel provisoire (${framework.versionLabel}), en attente de validation pédagogique.`);
  }
  if (!passport.selfAssessment || passport.selfAssessment.status !== 'completed') missing.push('Auto-évaluation initiale non complétée.');
  if (!passport.evaluations.some((evaluation) => evaluation.observation || evaluation.advice))
    missing.push('Aucun commentaire de session partagé par les formateurs.');

  return {
    engineVersion: REPORT_ENGINE_VERSION,
    generatedAt: now.toISOString(),
    participant: { firstName: passport.participant.firstName, lastName: passport.participant.lastName },
    organization: passport.participant.organization?.name ?? null,
    program: passport.group ? { name: passport.group.programName, sessionsCount: passport.group.sessionsCount } : null,
    group: passport.group
      ? { name: passport.group.name, startDate: passport.group.startDate, endDate: passport.group.endDate, trainers: passport.group.trainers }
      : null,
    sessions,
    counts: {
      sessionsPlanned: passport.group?.sessionsCount ?? sessions.length,
      sessionsAttended: sessions.filter((session) => session.attended).length,
      sessionsEvaluated,
      activities: new Set(sessions.flatMap((session) => session.activities)).size,
      observations,
      skillsObserved,
      skillsTotal,
    },
    frameworks,
    feedback: [...passport.evaluations]
      .sort((a, b) => a.sessionNumber - b.sessionNumber)
      .filter((evaluation) => evaluation.observation || evaluation.advice)
      .map((evaluation) => ({
        session: evaluation.sessionNumber,
        title: evaluation.sessionTitle,
        date: evaluation.date || null,
        observation: evaluation.observation,
        advice: evaluation.advice,
      })),
    selfAssessment:
      passport.selfAssessment?.status === 'completed' ? { completedAt: passport.selfAssessment.completedAt, comment: passport.selfAssessment.comment } : null,
    sufficiency,
    missing,
  };
}
