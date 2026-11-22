import 'server-only';

import { loadCareerPaths } from '@/lib/career-paths/load';
import { getPassport } from '@/lib/passport';
import type { ServerClient } from '@/lib/supabase/server';

import { buildReportData } from './build';
import { reportContentSchema, reportOptionsSchema, type ReportContent, type ReportOptions } from './content';
import { easyReadSchema, type EasyReadContent } from './easy-read';
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
  const data = buildReportData(passport, supports);
  // Pistes métiers (recommandations ROME) : figées avec le reste du bilan ; absentes si la lecture échoue.
  data.careerPaths = await loadCareerPaths(supabase, participantId, data);
  return data;
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

// ── Version facile à lire ───────────────────────────────────────────────────

export type StoredEasyRead = {
  id: string;
  reportId: string;
  version: number;
  status: 'draft' | 'validated';
  content: EasyReadContent | null;
  contentSource: 'ai' | 'ai_edited' | 'manual';
  createdAt: string;
  updatedAt: string;
  validatedAt: string | null;
};

const EASY_COLUMNS = 'id, report_id, version, status, content, content_source, created_at, updated_at, validated_at';

type EasyRow = { id: string; report_id: string; version: number; status: string; content: unknown; content_source: string; created_at: string; updated_at: string; validated_at: string | null };

function toEasyRead(row: EasyRow): StoredEasyRead {
  const content = easyReadSchema.safeParse(row.content);
  return {
    id: row.id,
    reportId: row.report_id,
    version: row.version,
    status: row.status as StoredEasyRead['status'],
    content: content.success ? content.data : null,
    contentSource: row.content_source as StoredEasyRead['contentSource'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    validatedAt: row.validated_at,
  };
}

/** Versions faciles à lire d'un bilan visibles par l'appelant (RLS : versions validées seulement pour le participant et son organisme). */
export async function listEasyReads(supabase: ServerClient, reportId: string): Promise<StoredEasyRead[]> {
  const { data } = await supabase.from('participant_report_easy_reads').select(EASY_COLUMNS).eq('report_id', reportId).order('version', { ascending: false });
  return ((data ?? []) as EasyRow[]).map(toEasyRead);
}

export async function getEasyRead(supabase: ServerClient, id: string): Promise<StoredEasyRead | null> {
  const { data } = await supabase.from('participant_report_easy_reads').select(EASY_COLUMNS).eq('id', id).maybeSingle();
  return data ? toEasyRead(data as EasyRow) : null;
}

/**
 * Dernière version validée (jamais un brouillon, quel que soit le rôle de l'appelant) :
 * c'est la seule qui figure dans le PDF et dans l'espace du participant.
 */
export async function latestValidatedEasyRead(supabase: ServerClient, reportId: string): Promise<StoredEasyRead | null> {
  const { data } = await supabase
    .from('participant_report_easy_reads')
    .select(EASY_COLUMNS)
    .eq('report_id', reportId)
    .eq('status', 'validated')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  const easyRead = data ? toEasyRead(data as EasyRow) : null;
  return easyRead?.content ? easyRead : null;
}
