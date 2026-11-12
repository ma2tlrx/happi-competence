import 'server-only';

import type { ServerClient } from '@/lib/supabase/server';

import { summarizeSatisfaction, type OverviewRow, type QuestionDef, type QuestionKind, type ResultRow } from './aggregate';
import type { SatisfactionAudience, SatisfactionMoment } from './window';

/**
 * Lecture des résultats de satisfaction. Toutes les lectures passent par la session de
 * l'appelant : la base ne renvoie que les groupes qu'il peut voir, sans auteur ni date de
 * réponse sauf pour l'administrateur, et masque les verbatims sous le seuil d'anonymat.
 */
export async function loadSatisfactionResults(
  supabase: ServerClient,
  groupIds: string[],
  period: { from?: string | null; to?: string | null } = {},
) {
  if (groupIds.length === 0) return { summaries: summarizeSatisfaction([], [], []), rows: [] as ResultRow[], overview: [] as OverviewRow[], questions: [] as QuestionDef[] };
  const [resultsResponse, overviewResponse] = await Promise.all([
    supabase.rpc('satisfaction_results', { p_group_ids: groupIds }),
    supabase.rpc('satisfaction_overview', { p_group_ids: groupIds }),
  ]);
  const filtered = Boolean(period.from || period.to);
  let rows: ResultRow[] = (resultsResponse.data ?? []).map((row) => ({
    groupId: row.group_id,
    audience: row.audience as SatisfactionAudience,
    moment: row.moment as SatisfactionMoment,
    questionId: row.question_id,
    value: row.value,
    choice: row.choice,
    textValue: row.text_value,
    textHidden: row.text_hidden,
    responseId: row.response_id,
    submittedAt: row.submitted_at,
    respondent: row.respondent,
  }));
  // Filtre de période : seul l'administrateur reçoit la date de réponse.
  if (filtered) {
    rows = rows.filter((row) => {
      const day = row.submittedAt?.slice(0, 10);
      if (!day) return false;
      return (!period.from || day >= period.from) && (!period.to || day <= period.to);
    });
  }
  const overview: OverviewRow[] = (overviewResponse.data ?? []).map((row) => ({
    groupId: row.group_id,
    audience: row.audience as SatisfactionAudience,
    moment: row.moment as SatisfactionMoment,
    invited: row.invited,
    responses: row.responses,
    isOpen: row.is_open,
    endDate: row.end_date,
  }));
  const versionIds = [...new Set((resultsResponse.data ?? []).map((row) => row.survey_version_id))];
  const questions = await loadQuestionDefs(supabase, versionIds);
  return { summaries: summarizeSatisfaction(questions, rows, overview, { responsesFromRows: filtered }), rows, overview, questions };
}

export async function loadQuestionDefs(supabase: ServerClient, versionIds: string[]): Promise<QuestionDef[]> {
  if (versionIds.length === 0) return [];
  const { data } = await supabase
    .from('satisfaction_questions')
    .select('id, version_id, position, kind, text, options, satisfaction_survey_versions ( label, version_number, rating_labels )')
    .in('version_id', versionIds);
  return (data ?? []).map((question) => ({
    id: question.id,
    versionId: question.version_id,
    versionLabel: question.satisfaction_survey_versions
      ? `Version ${question.satisfaction_survey_versions.version_number} · ${question.satisfaction_survey_versions.label}`
      : '',
    position: question.position,
    kind: question.kind as QuestionKind,
    text: question.text,
    options: question.options,
    ratingLabels: question.satisfaction_survey_versions?.rating_labels,
  }));
}

export type PendingSurvey = {
  groupId: string;
  groupName: string;
  programName: string;
  audience: SatisfactionAudience;
  moment: SatisfactionMoment;
  versionId: string;
  surveyName: string;
  endDate: string | null;
  answered: boolean;
};

/** Enquêtes ouvertes pour l'appelant (participant ou membre d'organisme). */
export async function loadMySurveys(supabase: ServerClient): Promise<PendingSurvey[]> {
  const { data } = await supabase.rpc('my_satisfaction_surveys');
  return (data ?? []).map((row) => ({
    groupId: row.group_id,
    groupName: row.group_name,
    programName: row.program_name,
    audience: row.audience as SatisfactionAudience,
    moment: row.moment as SatisfactionMoment,
    versionId: row.survey_version_id,
    surveyName: row.survey_name,
    endDate: row.end_date,
    answered: row.answered,
  }));
}

/** Enquête à remplir : intitulés, questions actives et libellés de l'échelle. */
export async function loadSurveyForm(supabase: ServerClient, versionId: string) {
  const { data } = await supabase
    .from('satisfaction_survey_versions')
    .select('id, label, intro, is_provisional, rating_labels, satisfaction_surveys ( name ), satisfaction_questions ( id, position, kind, text, help, options, is_required, is_active )')
    .eq('id', versionId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: data.satisfaction_surveys?.name ?? 'Enquête de satisfaction',
    intro: data.intro,
    isProvisional: data.is_provisional,
    ratingLabels: data.rating_labels,
    questions: data.satisfaction_questions
      .filter((question) => question.is_active)
      .sort((a, b) => a.position - b.position)
      .map((question) => ({
        id: question.id,
        kind: question.kind as QuestionKind,
        text: question.text,
        help: question.help,
        options: question.options,
        isRequired: question.is_required,
      })),
  };
}
export type SurveyForm = NonNullable<Awaited<ReturnType<typeof loadSurveyForm>>>;
