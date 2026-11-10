import 'server-only';

import {
  highlights,
  levelFor,
  summarizeProfile,
  type Aggregation,
  type FrameworkRules,
  type Highlights,
  type Observation,
  type Rounding,
  type ScaleLevel,
  type ScoringMode,
  type SkillSummary,
} from '@/lib/evaluation-engine';
import type { ServerClient } from '@/lib/supabase/server';

/**
 * Passeport de compétences d'un participant : lecture unique, partagée par les
 * espaces participant, organisme, formateur et administrateur. Toutes les
 * lectures passent par la session de l'appelant ; RLS détermine ce qui est visible.
 */

export type PassportSkill = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  categoryCode: string | null;
  levels: { value: number; description: string }[];
  summary: SkillSummary;
  level: ScaleLevel | null;
  selfValue: number | null;
  selfQuestion: string | null;
  lastComment: { text: string; sessionNumber: number } | null;
};

export type PassportCategory = { code: string; name: string; description: string | null; skills: PassportSkill[] };

export type PassportFramework = {
  code: string;
  name: string;
  shortName: string;
  description: string | null;
  versionLabel: string;
  isProvisional: boolean;
  rules: FrameworkRules;
  levels: ScaleLevel[];
  categories: PassportCategory[];
  skills: PassportSkill[];
  highlights: Highlights;
  observedCount: number;
  /** L'auto-évaluation utilise la même échelle : la comparaison est affichable. */
  selfComparable: boolean;
};

export type PassportSession = {
  id: string;
  number: number;
  title: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  attendance: string | null;
  evaluated: boolean;
  programSessionId: string;
};

export type PassportEvaluation = {
  id: string;
  sessionId: string;
  sessionNumber: number;
  sessionTitle: string;
  date: string;
  validatedAt: string | null;
  evaluator: string | null;
  revision: number;
  observation: string | null;
  advice: string | null;
  scoreCount: number;
};

export type SelfAssessment = {
  id: string;
  status: 'in_progress' | 'completed';
  completedAt: string | null;
  startedAt: string;
  comment: string | null;
  scaleMin: number;
  scaleMax: number;
  scaleLabels: { value: number; label: string }[];
  versionLabel: string;
  answers: { questionId: string; position: number; text: string; skillCode: string | null; value: number; comment: string | null }[];
};

export type Passport = {
  participant: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    hasAccount: boolean;
    createdAt: string;
    organization: { id: string; name: string } | null;
  };
  group: { id: string; name: string; startDate: string | null; endDate: string | null; programName: string; sessionsCount: number; trainers: string[] } | null;
  otherGroups: { id: string; name: string; status: string }[];
  sessions: PassportSession[];
  completedSessions: number;
  attendedSessions: number;
  nextSession: PassportSession | null;
  currentSession: PassportSession | null;
  evaluations: PassportEvaluation[];
  frameworks: PassportFramework[];
  selfAssessment: SelfAssessment | null;
  lastEvaluationAt: string | null;
};

const ATTENDED = new Set(['present', 'late', 'left_early']);

type VersionRow = {
  id: string;
  label: string;
  is_provisional: boolean;
  scale_min: number;
  scale_max: number;
  scale_step: number;
  scoring_mode: string;
  aggregation: string;
  rounding: string;
  status: string;
  frameworks: { id: string; code: string; name: string; short_name: string; description: string | null; position: number } | null;
};

export async function getPassport(supabase: ServerClient, participantId: string): Promise<Passport | null> {
  const { data: participant } = await supabase
    .from('participants')
    .select('id, first_name, last_name, email, user_id, created_at, organization_id, organizations ( id, name )')
    .eq('id', participantId)
    .maybeSingle();
  if (!participant) return null;

  const [membershipsResult, attendanceResult, evaluationsResult, selfResult, staffResult] = await Promise.all([
    supabase
      .from('group_members')
      .select('status, joined_at, groups ( id, name, start_date, end_date, status, program_id, programs ( id, name, sessions_count ) )')
      .eq('participant_id', participantId)
      .order('joined_at', { ascending: false }),
    supabase.from('attendance').select('session_id, status').eq('participant_id', participantId),
    supabase
      .from('evaluations')
      .select(
        'id, session_id, evaluator_id, validated_at, revision, sessions ( number, scheduled_date, program_sessions ( title ) ), evaluation_scores ( skill_id, score, comment ), evaluation_comments ( kind, body ), evaluation_frameworks ( framework_version_id )',
      )
      .eq('participant_id', participantId)
      .eq('status', 'validated'),
    supabase
      .from('self_assessments')
      .select(
        'id, status, comment, started_at, completed_at, questionnaire_versions ( id, label, scale_min, scale_max, questionnaire_scale_labels ( value, label ), questionnaire_questions ( id, position, text, skill_code ) ), self_assessment_answers ( question_id, value, comment )',
      )
      .eq('participant_id', participantId)
      .eq('kind', 'initial')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('staff_directory').select('id, first_name, last_name'),
  ]);

  const staffName = new Map((staffResult.data ?? []).map((person) => [person.id, `${person.first_name} ${person.last_name}`.trim()]));

  // Groupe de référence : le groupe actif le plus récent.
  const memberships = (membershipsResult.data ?? []).filter((membership) => membership.groups);
  const active = memberships.find((membership) => membership.status === 'active') ?? null;
  const groupRow = active?.groups ?? null;

  let sessions: PassportSession[] = [];
  let trainers: string[] = [];
  if (groupRow) {
    const [sessionsResult, trainersResult] = await Promise.all([
      supabase
        .from('sessions')
        .select('id, number, scheduled_date, start_time, end_time, location, status, program_session_id, program_sessions ( title )')
        .eq('group_id', groupRow.id)
        .order('number'),
      supabase.from('group_trainers').select('trainer_id, is_lead').eq('group_id', groupRow.id),
    ]);
    const attendanceBySession = new Map((attendanceResult.data ?? []).map((row) => [row.session_id, row.status]));
    const evaluatedSessions = new Set((evaluationsResult.data ?? []).map((row) => row.session_id));
    sessions = (sessionsResult.data ?? []).map((session) => ({
      id: session.id,
      number: session.number,
      title: session.program_sessions?.title ?? `Session ${session.number}`,
      date: session.scheduled_date,
      startTime: session.start_time,
      endTime: session.end_time,
      location: session.location,
      status: session.status as PassportSession['status'],
      attendance: attendanceBySession.get(session.id) ?? null,
      evaluated: evaluatedSessions.has(session.id),
      programSessionId: session.program_session_id,
    }));
    trainers = (trainersResult.data ?? [])
      .sort((a, b) => Number(b.is_lead) - Number(a.is_lead))
      .map((row) => staffName.get(row.trainer_id))
      .filter((value): value is string => Boolean(value));
  }

  // Versions de référentiel : celles des évaluations, à défaut celles du programme.
  const versionIds = new Set<string>();
  for (const evaluation of evaluationsResult.data ?? []) for (const link of evaluation.evaluation_frameworks) versionIds.add(link.framework_version_id);
  if (groupRow) {
    const { data: programFrameworks } = await supabase.from('program_frameworks').select('framework_version_id').eq('program_id', groupRow.program_id);
    for (const row of programFrameworks ?? []) versionIds.add(row.framework_version_id);
  }
  if (versionIds.size === 0) {
    const { data: published } = await supabase.from('framework_versions').select('id, framework_id, version_number').eq('status', 'published').order('version_number', { ascending: false });
    const seen = new Set<string>();
    for (const row of published ?? []) if (!seen.has(row.framework_id)) (seen.add(row.framework_id), versionIds.add(row.id));
  }

  const [versionsResult, skillsResult, categoriesResult, levelsResult] = await Promise.all([
    supabase
      .from('framework_versions')
      .select('id, label, is_provisional, scale_min, scale_max, scale_step, scoring_mode, aggregation, rounding, status, frameworks ( id, code, name, short_name, description, position )')
      .in('id', [...versionIds]),
    supabase.from('skills').select('id, version_id, code, name, description, position, category_id, is_active, skill_level_descriptors ( level_value, description )').in('version_id', [...versionIds]),
    supabase.from('skill_categories').select('id, version_id, code, name, description, position').in('version_id', [...versionIds]),
    supabase.from('scale_levels').select('version_id, value, label, description').in('version_id', [...versionIds]),
  ]);

  // Une version par référentiel pour l'affichage : la plus récente utilisée.
  const versions = ((versionsResult.data ?? []) as unknown as VersionRow[]).filter((version) => version.frameworks);
  const displayVersion = new Map<string, VersionRow>();
  for (const version of versions) {
    const current = displayVersion.get(version.frameworks!.code);
    if (!current || version.label.localeCompare(current.label, 'fr', { numeric: true }) > 0) displayVersion.set(version.frameworks!.code, version);
  }

  const skillById = new Map((skillsResult.data ?? []).map((skill) => [skill.id, skill]));
  const versionById = new Map(versions.map((version) => [version.id, version]));

  // Observations validées, rattachées au code stable de la compétence.
  const observationsByFramework = new Map<string, Observation[]>();
  for (const evaluation of evaluationsResult.data ?? []) {
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

  // Auto-évaluation
  let selfAssessment: SelfAssessment | null = null;
  const selfRow = selfResult.data;
  if (selfRow?.questionnaire_versions) {
    const questions = new Map(selfRow.questionnaire_versions.questionnaire_questions.map((question) => [question.id, question]));
    selfAssessment = {
      id: selfRow.id,
      status: selfRow.status as SelfAssessment['status'],
      completedAt: selfRow.completed_at,
      startedAt: selfRow.started_at,
      comment: selfRow.comment,
      scaleMin: selfRow.questionnaire_versions.scale_min,
      scaleMax: selfRow.questionnaire_versions.scale_max,
      scaleLabels: [...selfRow.questionnaire_versions.questionnaire_scale_labels].sort((a, b) => a.value - b.value),
      versionLabel: selfRow.questionnaire_versions.label,
      answers: selfRow.self_assessment_answers
        .map((answer) => {
          const question = questions.get(answer.question_id);
          return {
            questionId: answer.question_id,
            position: question?.position ?? 0,
            text: question?.text ?? '',
            skillCode: question?.skill_code ?? null,
            value: answer.value,
            comment: answer.comment,
          };
        })
        .sort((a, b) => a.position - b.position),
    };
  }
  const selfBySkill = new Map<string, { value: number; text: string }>();
  if (selfAssessment?.status === 'completed') {
    for (const answer of selfAssessment.answers) if (answer.skillCode) selfBySkill.set(answer.skillCode, { value: answer.value, text: answer.text });
  }

  const frameworks: PassportFramework[] = [...displayVersion.values()]
    .sort((a, b) => a.frameworks!.position - b.frameworks!.position)
    .map((version) => {
      const framework = version.frameworks!;
      const rules: FrameworkRules = {
        scaleMin: version.scale_min,
        scaleMax: version.scale_max,
        scaleStep: Number(version.scale_step),
        scoringMode: version.scoring_mode as ScoringMode,
        aggregation: version.aggregation as Aggregation,
        rounding: version.rounding as Rounding,
      };
      const levels = (levelsResult.data ?? [])
        .filter((level) => level.version_id === version.id)
        .map((level) => ({ value: level.value, label: level.label, description: level.description }))
        .sort((a, b) => a.value - b.value);
      const versionSkills = (skillsResult.data ?? []).filter((skill) => skill.version_id === version.id && skill.is_active).sort((a, b) => a.position - b.position);
      const observations = observationsByFramework.get(framework.code) ?? [];
      const summaries = summarizeProfile(versionSkills.map((skill) => skill.code), observations, rules);
      const comparable = selfAssessment !== null && selfAssessment.scaleMin === rules.scaleMin && selfAssessment.scaleMax === rules.scaleMax;

      const skills: PassportSkill[] = versionSkills.map((skill) => {
        const summary = summaries.get(skill.code)!;
        const commented = [...summary.observations].reverse().find((observation) => observation.comment);
        const self = comparable ? selfBySkill.get(skill.code) : undefined;
        return {
          id: skill.id,
          code: skill.code,
          name: skill.name,
          description: skill.description,
          categoryCode: (categoriesResult.data ?? []).find((category) => category.id === skill.category_id)?.code ?? null,
          levels: [...skill.skill_level_descriptors].map((d) => ({ value: d.level_value, description: d.description })).sort((a, b) => a.value - b.value),
          summary,
          level: levelFor(summary.value, levels),
          selfValue: self?.value ?? null,
          selfQuestion: self?.text ?? null,
          lastComment: commented?.comment ? { text: commented.comment, sessionNumber: commented.sessionNumber } : null,
        };
      });
      const categories = (categoriesResult.data ?? [])
        .filter((category) => category.version_id === version.id)
        .sort((a, b) => a.position - b.position)
        .map((category) => ({
          code: category.code,
          name: category.name,
          description: category.description,
          skills: skills.filter((skill) => skill.categoryCode === category.code),
        }));
      return {
        code: framework.code,
        name: framework.name,
        shortName: framework.short_name,
        description: framework.description,
        versionLabel: version.label,
        isProvisional: version.is_provisional,
        rules,
        levels,
        categories,
        skills,
        highlights: highlights(skills.map((skill) => skill.summary)),
        observedCount: skills.filter((skill) => skill.summary.value !== null).length,
        selfComparable: comparable && skills.some((skill) => skill.selfValue !== null),
      };
    });

  const evaluations: PassportEvaluation[] = (evaluationsResult.data ?? [])
    .map((evaluation) => ({
      id: evaluation.id,
      sessionId: evaluation.session_id,
      sessionNumber: evaluation.sessions?.number ?? 0,
      sessionTitle: evaluation.sessions?.program_sessions?.title ?? '',
      date: evaluation.sessions?.scheduled_date ?? evaluation.validated_at ?? '',
      validatedAt: evaluation.validated_at,
      evaluator: evaluation.evaluator_id ? (staffName.get(evaluation.evaluator_id) ?? null) : null,
      revision: evaluation.revision,
      observation: evaluation.evaluation_comments.find((comment) => comment.kind === 'observation')?.body ?? null,
      advice: evaluation.evaluation_comments.find((comment) => comment.kind === 'advice')?.body ?? null,
      scoreCount: evaluation.evaluation_scores.filter((score) => score.score !== null).length,
    }))
    .sort((a, b) => a.sessionNumber - b.sessionNumber);

  const completedSessions = sessions.filter((session) => session.status === 'completed').length;
  const attendedSessions = sessions.filter((session) => session.status === 'completed' && session.attendance && ATTENDED.has(session.attendance)).length;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = sessions.filter((session) => session.status === 'planned' || session.status === 'in_progress');
  const currentSession = sessions.find((session) => session.status === 'in_progress') ?? upcoming.find((session) => session.date === today) ?? null;
  const nextSession = upcoming.find((session) => session !== currentSession && (!session.date || session.date >= today)) ?? null;

  return {
    participant: {
      id: participant.id,
      firstName: participant.first_name,
      lastName: participant.last_name,
      email: participant.email,
      hasAccount: Boolean(participant.user_id),
      createdAt: participant.created_at,
      organization: participant.organizations ? { id: participant.organizations.id, name: participant.organizations.name } : null,
    },
    group: groupRow
      ? {
          id: groupRow.id,
          name: groupRow.name,
          startDate: groupRow.start_date,
          endDate: groupRow.end_date,
          programName: groupRow.programs?.name ?? 'Programme HAPPI',
          sessionsCount: groupRow.programs?.sessions_count ?? sessions.length,
          trainers,
        }
      : null,
    otherGroups: memberships.filter((membership) => membership !== active).map((membership) => ({ id: membership.groups!.id, name: membership.groups!.name, status: membership.status })),
    sessions,
    completedSessions,
    attendedSessions,
    nextSession,
    currentSession,
    evaluations,
    frameworks,
    selfAssessment,
    lastEvaluationAt: evaluations.reduce<string | null>((latest, evaluation) => (!latest || (evaluation.validatedAt ?? '') > latest ? evaluation.validatedAt : latest), null),
  };
}

export function frameworkOf(passport: Passport, code: string) {
  return passport.frameworks.find((framework) => framework.code === code) ?? null;
}
