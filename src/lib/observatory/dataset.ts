/**
 * Observatoire — assemblage des lignes lues en base en un jeu de données anonyme. Module pur.
 *
 * Une « personne » n'a ni nom ni identifiant ici : seulement ses valeurs sur les axes de découpage,
 * ses observations validées par référentiel et son auto-évaluation initiale. Les règles sont celles
 * du passeport (src/lib/passport.ts), par les mêmes fonctions (src/lib/evaluation-engine/inputs.ts).
 */
import type { Aggregation, FrameworkRules, Observation, Rounding, ScaleLevel, ScoringMode } from '@/lib/evaluation-engine';
import { referenceMembership, selfValuesBySkill, validatedObservationsByFramework, type ValidatedEvaluationRow } from '@/lib/evaluation-engine/inputs';

import { CODED_AXES, isCodedAxis, type AxisKey } from './axes';

export type ObservatoryRaw = {
  frameworks: { id: string; code: string; name: string; short_name: string; position: number }[];
  versions: {
    id: string;
    framework_id: string;
    version_number: number;
    label: string;
    status: string;
    is_provisional: boolean;
    scale_min: number;
    scale_max: number;
    scale_step: number;
    scoring_mode: string;
    aggregation: string;
    rounding: string;
  }[];
  skills: { id: string; version_id: string; code: string; name: string; description: string | null; position: number; is_active: boolean; category_id: string | null }[];
  categories: { id: string; name: string; position: number }[];
  levels: { version_id: string; value: number; label: string }[];
  participants: { id: string; organization_id: string | null }[];
  organizations: { id: string; name: string; city: string | null }[];
  memberships: { participant_id: string; group_id: string; status: string; joined_at: string }[];
  groups: { id: string; name: string; program_id: string; start_date: string | null }[];
  programs: { id: string; name: string }[];
  /** Évaluations au statut « validée » uniquement. */
  evaluations: (ValidatedEvaluationRow & { participant_id: string })[];
  /** Fiches d'entrée : colonnes non sensibles seulement. */
  profiles: {
    participant_id: string;
    entry_date: string | null;
    updated_at: string;
    gender: string | null;
    age_band: string | null;
    labour_status: string | null;
    diploma_level: string | null;
    qpv_resident: string | null;
  }[];
  /** Auto-évaluations initiales. */
  selfAssessments: { participant_id: string; questionnaire_version_id: string; status: string; started_at: string; self_assessment_answers: { question_id: string; value: number }[] }[];
  questionnaireVersions: { id: string; scale_min: number; scale_max: number }[];
  questions: { id: string; skill_code: string | null; position: number }[];
};

export type ObservatorySkill = { code: string; name: string; description: string | null; category: string | null };

export type ObservatoryFramework = {
  code: string;
  name: string;
  shortName: string;
  versionLabel: string;
  isProvisional: boolean;
  rules: FrameworkRules;
  levels: ScaleLevel[];
  skills: ObservatorySkill[];
};

export type ObservatoryPerson = {
  /** Valeur de chaque axe ; null = non renseigné. */
  axes: Record<AxisKey, string | null>;
  /** Observations validées, par code de référentiel. */
  observations: Map<string, Observation[]>;
  /** Auto-évaluation initiale la plus récente ; valeurs vides si elle n'est pas terminée. */
  self: { scaleMin: number; scaleMax: number; values: Map<string, number> } | null;
};

export type ObservatoryDataset = {
  frameworks: ObservatoryFramework[];
  persons: ObservatoryPerson[];
  /** Libellés des valeurs qui ne sont pas des codes (organismes, villes, programmes, cohortes, années). */
  labels: Partial<Record<AxisKey, Map<string, string>>>;
  /** Observations écartées car notées sur une échelle différente de celle de la version affichée. */
  excludedObservations: number;
};

/** Ordre décroissant de deux dates ISO (comparaison de chaînes, indépendante de la langue). */
const byDescending = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);

/** Fiche plus récente : date d'entrée plus récente (une date absente est la plus ancienne), puis dernière mise à jour. */
const isNewerProfile = (a: ObservatoryRaw['profiles'][number], b: ObservatoryRaw['profiles'][number]) =>
  (a.entry_date ?? '') !== (b.entry_date ?? '') ? (a.entry_date ?? '') > (b.entry_date ?? '') : a.updated_at > b.updated_at;

export function assembleDataset(raw: ObservatoryRaw): ObservatoryDataset {
  const frameworkById = new Map(raw.frameworks.map((framework) => [framework.id, framework]));
  const categoryName = new Map(raw.categories.map((category) => [category.id, category.name]));

  // Version affichée : la plus récente publiée de chaque référentiel.
  const displayVersion = new Map<string, ObservatoryRaw['versions'][number]>();
  for (const version of raw.versions) {
    if (version.status !== 'published' || !frameworkById.has(version.framework_id)) continue;
    const current = displayVersion.get(version.framework_id);
    if (!current || version.version_number > current.version_number) displayVersion.set(version.framework_id, version);
  }
  const frameworks: ObservatoryFramework[] = [...displayVersion.values()]
    .sort((a, b) => frameworkById.get(a.framework_id)!.position - frameworkById.get(b.framework_id)!.position)
    .map((version) => {
      const framework = frameworkById.get(version.framework_id)!;
      return {
        code: framework.code,
        name: framework.name,
        shortName: framework.short_name,
        versionLabel: version.label,
        isProvisional: version.is_provisional,
        rules: {
          scaleMin: version.scale_min,
          scaleMax: version.scale_max,
          scaleStep: Number(version.scale_step),
          scoringMode: version.scoring_mode as ScoringMode,
          aggregation: version.aggregation as Aggregation,
          rounding: version.rounding as Rounding,
        },
        levels: raw.levels
          .filter((level) => level.version_id === version.id)
          .map((level) => ({ value: level.value, label: level.label }))
          .sort((a, b) => a.value - b.value),
        skills: raw.skills
          .filter((skill) => skill.version_id === version.id && skill.is_active)
          .sort((a, b) => a.position - b.position)
          .map((skill) => ({ code: skill.code, name: skill.name, description: skill.description, category: skill.category_id ? (categoryName.get(skill.category_id) ?? null) : null })),
      };
    });
  const shownByCode = new Map(frameworks.map((framework) => [framework.code, framework]));

  const versionById = new Map(raw.versions.map((version) => [version.id, version]));
  const skillById = new Map(raw.skills.map((skill) => [skill.id, skill]));
  const versionRefs = new Map(
    raw.versions.map((version) => {
      const framework = frameworkById.get(version.framework_id);
      return [version.id, { frameworks: framework ? { code: framework.code } : null }];
    }),
  );

  // Évaluations des personnes du périmètre ; une note d'une échelle différente de celle affichée est écartée (et comptée).
  const inScope = new Set(raw.participants.map((participant) => participant.id));
  let excludedObservations = 0;
  const evaluationsByPerson = new Map<string, ValidatedEvaluationRow[]>();
  for (const evaluation of raw.evaluations) {
    if (!inScope.has(evaluation.participant_id)) continue;
    const scores = evaluation.evaluation_scores.filter((score) => {
      if (score.score === null) return true;
      const version = versionById.get(skillById.get(score.skill_id)?.version_id ?? '');
      const shown = version ? shownByCode.get(frameworkById.get(version.framework_id)?.code ?? '') : undefined;
      if (!version || !shown || (version.scale_min === shown.rules.scaleMin && version.scale_max === shown.rules.scaleMax)) return true;
      excludedObservations += 1;
      return false;
    });
    const list = evaluationsByPerson.get(evaluation.participant_id) ?? [];
    list.push({ ...evaluation, evaluation_scores: scores });
    evaluationsByPerson.set(evaluation.participant_id, list);
  }

  // Groupe de référence : même règle que le passeport (inscriptions de la plus récente à la plus ancienne).
  const membershipsByPerson = new Map<string, ObservatoryRaw['memberships']>();
  for (const membership of raw.memberships) {
    const list = membershipsByPerson.get(membership.participant_id);
    if (list) list.push(membership);
    else membershipsByPerson.set(membership.participant_id, [membership]);
  }
  for (const list of membershipsByPerson.values()) list.sort((a, b) => byDescending(a.joined_at, b.joined_at));

  // Fiche d'entrée la plus récente : date d'entrée la plus récente, puis dernière mise à jour.
  const profileByPerson = new Map<string, ObservatoryRaw['profiles'][number]>();
  for (const profile of raw.profiles) {
    const current = profileByPerson.get(profile.participant_id);
    if (!current || isNewerProfile(profile, current)) profileByPerson.set(profile.participant_id, profile);
  }

  // Auto-évaluation initiale la plus récente (date de début), comme le passeport.
  const selfByPerson = new Map<string, ObservatoryRaw['selfAssessments'][number]>();
  for (const self of raw.selfAssessments) {
    const current = selfByPerson.get(self.participant_id);
    if (!current || self.started_at > current.started_at) selfByPerson.set(self.participant_id, self);
  }
  const questionnaireById = new Map(raw.questionnaireVersions.map((version) => [version.id, version]));
  const questionById = new Map(raw.questions.map((question) => [question.id, question]));

  const organizationById = new Map(raw.organizations.map((organization) => [organization.id, organization]));
  const groupById = new Map(raw.groups.map((group) => [group.id, group]));
  const coded = (axis: AxisKey, value: string | null | undefined) => (value && isCodedAxis(axis) && Object.hasOwn(CODED_AXES[axis], value) ? value : null);

  const persons: ObservatoryPerson[] = raw.participants.map((participant) => {
    const organization = participant.organization_id ? organizationById.get(participant.organization_id) : undefined;
    const reference = referenceMembership(membershipsByPerson.get(participant.id) ?? []);
    const group = reference ? groupById.get(reference.group_id) : undefined;
    const year = group?.start_date?.slice(0, 4) ?? null;
    const profile = profileByPerson.get(participant.id);
    const self = selfByPerson.get(participant.id);
    const questionnaire = self ? questionnaireById.get(self.questionnaire_version_id) : undefined;
    const answers = (self?.self_assessment_answers ?? [])
      .map((answer) => ({ skillCode: questionById.get(answer.question_id)?.skill_code ?? null, value: answer.value, position: questionById.get(answer.question_id)?.position ?? 0 }))
      .sort((a, b) => a.position - b.position);
    return {
      axes: {
        organisme: participant.organization_id ?? null,
        ville: organization?.city?.trim() || null,
        programme: group?.program_id ?? null,
        cohorte: group?.id ?? null,
        annee: year && /^\d{4}$/.test(year) ? year : null,
        age: coded('age', profile?.age_band),
        genre: coded('genre', profile?.gender),
        diplome: coded('diplome', profile?.diploma_level),
        situation: coded('situation', profile?.labour_status),
        qpv: coded('qpv', profile?.qpv_resident),
      },
      observations: validatedObservationsByFramework(evaluationsByPerson.get(participant.id) ?? [], skillById, versionRefs),
      self:
        self && questionnaire
          ? {
              scaleMin: questionnaire.scale_min,
              scaleMax: questionnaire.scale_max,
              values: new Map([...selfValuesBySkill({ status: self.status, answers })].map(([code, answer]) => [code, answer.value])),
            }
          : null,
    };
  });

  const cities = new Map(persons.flatMap((person) => (person.axes.ville ? [[person.axes.ville, person.axes.ville] as const] : [])));
  const years = new Map(persons.flatMap((person) => (person.axes.annee ? [[person.axes.annee, person.axes.annee] as const] : [])));
  return {
    frameworks,
    persons,
    labels: {
      organisme: new Map(raw.organizations.map((organization) => [organization.id, organization.name])),
      ville: cities,
      programme: new Map(raw.programs.map((program) => [program.id, program.name])),
      cohorte: new Map(raw.groups.map((group) => [group.id, group.name])),
      annee: years,
    },
    excludedObservations,
  };
}
