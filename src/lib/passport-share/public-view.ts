import type { Passport } from '@/lib/passport';
import type { ReportContent } from '@/lib/report/content';

/**
 * Vue publique d'un passeport partagé — module pur.
 *
 * C'est une liste blanche : seuls les champs nommés ici sortent, recopiés un à un.
 * Jamais : coordonnées, organisme prescripteur, nom complet, commentaires des
 * formateurs (partagés ou privés), présences détaillées, auto-évaluation, formateurs.
 * Les niveaux viennent du passeport, qui ne lit que les évaluations validées.
 */

export const ISSUER = 'HAPPI Compétence';
export const METHOD_NOTICE =
  'Niveaux observés en situation collective par un formateur HAPPI ; non une certification. Ils décrivent des comportements observés à un moment donné, pas la valeur d’une personne.';

/** Référentiels publiables : le premier toujours, le second au choix du participant. */
export const TRANSVERSAL = 'transversal';
export const SOCIOCOGNITIVE = 'sociocognitive';

export type ShareOptions = { includeSociocognitive: boolean; includeReport: boolean };

export type PublicSkill = {
  code: string;
  name: string;
  value: number;
  levelValue: number | null;
  levelLabel: string | null;
  /** Libellé du descripteur de niveau propre à la compétence. */
  descriptor: string | null;
  /** Nombre de séances où la compétence a été observée. */
  observationCount: number;
};

export type PublicFramework = {
  code: string;
  name: string;
  isProvisional: boolean;
  scaleMin: number;
  scaleMax: number;
  levels: { value: number; label: string }[];
  skills: PublicSkill[];
  totalSkills: number;
};

export type PublicReport = {
  version: number;
  finalizedAt: string | null;
  summary: string;
  frameworks: { code: string; name: string; summary: string }[];
  conclusion: string;
  limits: string;
};

export type PublicPassport = {
  holder: { firstName: string; lastInitial: string };
  program: { name: string; startDate: string | null; endDate: string | null } | null;
  issuer: string;
  observationSessions: number;
  frameworks: PublicFramework[];
  report: PublicReport | null;
  generatedAt: string;
  expiresAt: string;
  method: string;
};

export type LatestFinalReport = { version: number; finalizedAt: string | null; content: ReportContent | null } | null;

function initial(lastName: string) {
  const letter = [...lastName.trim()][0];
  return letter ? `${letter.toLocaleUpperCase('fr-FR')}.` : '';
}

export function buildPublicPassport(
  passport: Passport,
  options: ShareOptions,
  share: { expiresAt: string },
  report: LatestFinalReport,
  now: Date = new Date(),
): PublicPassport {
  const allowed = new Set([TRANSVERSAL, ...(options.includeSociocognitive ? [SOCIOCOGNITIVE] : [])]);

  const frameworks: PublicFramework[] = passport.frameworks
    .filter((framework) => allowed.has(framework.code))
    .map((framework) => ({
      code: framework.code,
      name: framework.name,
      isProvisional: framework.isProvisional,
      scaleMin: framework.rules.scaleMin,
      scaleMax: framework.rules.scaleMax,
      levels: framework.levels.map((level) => ({ value: level.value, label: level.label })),
      totalSkills: framework.skills.length,
      skills: framework.skills
        .filter((skill) => skill.summary.value !== null)
        .map((skill) => {
          const levelValue = skill.level?.value ?? null;
          return {
            code: skill.code,
            name: skill.name,
            value: skill.summary.value as number,
            levelValue,
            levelLabel: skill.level?.label ?? null,
            descriptor: levelValue === null ? null : (skill.levels.find((descriptor) => descriptor.value === levelValue)?.description ?? null),
            observationCount: new Set(skill.summary.observations.map((observation) => observation.sessionNumber)).size,
          };
        }),
    }));

  let publicReport: PublicReport | null = null;
  if (options.includeReport && report?.content) {
    const names = new Map(frameworks.map((framework) => [framework.code, framework.name]));
    publicReport = {
      version: report.version,
      finalizedAt: report.finalizedAt,
      summary: report.content.profile.summary,
      frameworks: report.content.frameworks
        .filter((item) => names.has(item.code) && item.summary.trim())
        .map((item) => ({ code: item.code, name: names.get(item.code)!, summary: item.summary })),
      conclusion: report.content.conclusion,
      limits: report.content.limits,
    };
  }

  return {
    holder: { firstName: passport.participant.firstName.trim(), lastInitial: initial(passport.participant.lastName) },
    program: passport.group ? { name: passport.group.programName, startDate: passport.group.startDate, endDate: passport.group.endDate } : null,
    issuer: ISSUER,
    observationSessions: new Set(passport.evaluations.map((evaluation) => evaluation.sessionId)).size,
    frameworks,
    report: publicReport,
    generatedAt: now.toISOString(),
    expiresAt: share.expiresAt,
    method: METHOD_NOTICE,
  };
}
