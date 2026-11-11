import 'server-only';

import { getPassport } from '@/lib/passport';
import type { ServerClient } from '@/lib/supabase/server';

import { buildReportData } from './build';
import { reportContentSchema, reportOptionsSchema, type ReportContent, type ReportOptions } from './content';
import type { ReportData } from './model';

/** Calcule la photographie d'un bilan à partir des données actuelles (lecture sous les droits de l'appelant). */
export async function computeReportData(supabase: ServerClient, participantId: string): Promise<ReportData | null> {
  const passport = await getPassport(supabase, participantId);
  if (!passport) return null;
  const supports = new Map<number, string | null>();
  const programSessionIds = passport.sessions.map((session) => session.programSessionId);
  if (programSessionIds.length) {
    const { data: contents } = await supabase
      .from('pedagogical_contents')
      .select('program_session_id, current_version_id')
      .in('program_session_id', programSessionIds);
    const versionIds = (contents ?? []).map((row) => row.current_version_id).filter((id): id is string => Boolean(id));
    const { data: versions } = versionIds.length
      ? await supabase.from('pedagogical_content_versions').select('id, markdown').in('id', versionIds)
      : { data: [] as { id: string; markdown: string }[] };
    const markdownByVersion = new Map((versions ?? []).map((row) => [row.id, row.markdown]));
    for (const session of passport.sessions) {
      const content = (contents ?? []).find((row) => row.program_session_id === session.programSessionId);
      supports.set(session.number, content?.current_version_id ? (markdownByVersion.get(content.current_version_id) ?? null) : null);
    }
  }
  return buildReportData(passport, supports);
}

export type StoredReport = {
  id: string;
  participantId: string;
  version: number;
  status: 'draft' | 'final';
  data: ReportData;
  content: ReportContent | null;
  contentSource: 'ai' | 'ai_edited' | 'manual' | null;
  contentModel: string | null;
  contentGeneratedAt: string | null;
  options: ReportOptions;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
};

const COLUMNS = 'id, participant_id, version, status, data, content, content_source, content_model, content_generated_at, options, created_at, updated_at, finalized_at';

type Row = {
  id: string;
  participant_id: string;
  version: number;
  status: string;
  data: unknown;
  content: unknown;
  content_source: string | null;
  content_model: string | null;
  content_generated_at: string | null;
  options: unknown;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
};

function toReport(row: Row): StoredReport {
  const content = row.content ? reportContentSchema.safeParse(row.content) : null;
  const options = reportOptionsSchema.safeParse(row.options ?? {});
  return {
    id: row.id,
    participantId: row.participant_id,
    version: row.version,
    status: row.status as StoredReport['status'],
    data: row.data as ReportData,
    content: content?.success ? content.data : null,
    contentSource: row.content_source as StoredReport['contentSource'],
    contentModel: row.content_model,
    contentGeneratedAt: row.content_generated_at,
    options: options.success ? options.data : reportOptionsSchema.parse({}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finalizedAt: row.finalized_at,
  };
}

/** Bilans visibles par l'appelant (RLS : brouillons pour l'équipe, bilans validés pour le participant et son organisme). */
export async function listReports(supabase: ServerClient, participantId: string): Promise<StoredReport[]> {
  const { data } = await supabase.from('participant_reports').select(COLUMNS).eq('participant_id', participantId).order('version', { ascending: false });
  return ((data ?? []) as Row[]).map(toReport);
}

export async function getReport(supabase: ServerClient, reportId: string): Promise<StoredReport | null> {
  const { data } = await supabase.from('participant_reports').select(COLUMNS).eq('id', reportId).maybeSingle();
  return data ? toReport(data as Row) : null;
}
