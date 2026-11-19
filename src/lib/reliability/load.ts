import 'server-only';

import type { EngineFramework } from '@/app/formateur/sessions/[id]/evaluations/workspace';
import type { Aggregation, Rounding, ScoringMode } from '@/lib/evaluation-engine';
import type { createClient } from '@/lib/supabase/server';

import type { ReliabilityDataset } from './report';
import { DEFAULT_MIN_PAIRS, normalizeMinPairs } from './statistics';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Référentiels proposés pour une séance (versions activées du programme, compétences de la
 * correspondance séance ↔ compétences). Même construction que la page d'évaluation officielle,
 * pour que la seconde cotation présente exactement les mêmes compétences et descripteurs.
 */
export async function loadSessionFrameworks(supabase: Supabase, programId: string, sessionNumber: number): Promise<EngineFramework[]> {
  const { data: links } = await supabase.from('program_frameworks').select('framework_version_id').eq('program_id', programId);
  const versionIds = (links ?? []).map((link) => link.framework_version_id);
  if (versionIds.length === 0) return [];
  const [versions, levels, skills, mapping] = await Promise.all([
    supabase.from('framework_versions').select('id, label, is_provisional, scale_min, scale_max, scale_step, scoring_mode, aggregation, rounding, frameworks ( code, name, position )').in('id', versionIds),
    supabase.from('scale_levels').select('version_id, value, label').in('version_id', versionIds),
    supabase
      .from('skills')
      .select('id, version_id, code, name, description, position, is_active, skill_categories ( name, position ), skill_level_descriptors ( level_value, description ), skill_criteria ( id, label, description, weight, position, is_active )')
      .in('version_id', versionIds)
      .eq('is_active', true),
    supabase.from('session_skill_map').select('skill_id, version_id').in('version_id', versionIds).eq('session_number', sessionNumber),
  ]);
  const mappedByVersion = new Map<string, Set<string>>();
  for (const row of mapping.data ?? []) mappedByVersion.set(row.version_id, (mappedByVersion.get(row.version_id) ?? new Set()).add(row.skill_id));
  return (versions.data ?? [])
    .filter((version) => version.frameworks)
    .sort((a, b) => a.frameworks!.position - b.frameworks!.position)
    .map((version) => {
      const mapped = mappedByVersion.get(version.id);
      return {
        versionId: version.id,
        code: version.frameworks!.code,
        name: version.frameworks!.name,
        versionLabel: version.label,
        isProvisional: version.is_provisional,
        mappingDefined: Boolean(mapped && mapped.size > 0),
        rules: {
          scaleMin: version.scale_min,
          scaleMax: version.scale_max,
          scaleStep: Number(version.scale_step),
          scoringMode: version.scoring_mode as ScoringMode,
          aggregation: version.aggregation as Aggregation,
          rounding: version.rounding as Rounding,
        },
        levels: (levels.data ?? []).filter((level) => level.version_id === version.id).sort((a, b) => a.value - b.value).map(({ value, label }) => ({ value, label })),
        skills: (skills.data ?? [])
          .filter((skill) => skill.version_id === version.id && (!mapped || mapped.size === 0 || mapped.has(skill.id)))
          .sort((a, b) => a.position - b.position)
          .map((skill) => ({
            id: skill.id,
            name: skill.name,
            description: skill.description,
            category: skill.skill_categories?.name ?? null,
            descriptors: Object.fromEntries(skill.skill_level_descriptors.map((d) => [d.level_value, d.description])),
            criteria: skill.skill_criteria
              .filter((criterion) => criterion.is_active)
              .sort((a, b) => a.position - b.position)
              .map((criterion) => ({ id: criterion.id, label: criterion.label, description: criterion.description, weight: Number(criterion.weight) })),
          })),
      };
    })
    .filter((framework) => framework.skills.length > 0);
}

export type ReliabilitySettings = { minPairs: number; publish: boolean; computedAt: string | null };

export async function loadReliabilitySettings(supabase: Supabase): Promise<ReliabilitySettings> {
  const { data } = await supabase.from('reliability_settings').select('min_pairs, publish, computed_at').maybeSingle();
  return { minPairs: data ? normalizeMinPairs(data.min_pairs) : DEFAULT_MIN_PAIRS, publish: data?.publish ?? false, computedAt: data?.computed_at ?? null };
}

function chunks<T>(values: T[], size = 200): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

/**
 * Secondes cotations soumises et évaluations officielles validées correspondantes (lecture
 * administrateur, sous RLS). Les données de démonstration sont exclues sauf demande explicite.
 */
const PAGE = 1000;

/** Lit toutes les pages d'une requête : la base ne renvoie que 1 000 lignes par appel, sans erreur au-delà. */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return { data: rows, error: null };
  }
}

export async function loadReliabilityDataset(supabase: Supabase, { includeDemo }: { includeDemo: boolean }): Promise<ReliabilityDataset> {
  const { data: ratingRows, error } = await fetchAll((from, to) =>
    supabase
      .from('calibration_ratings')
      .select('id, session_id, participant_id, rater_id, origin, official_revision, calibration_scores ( skill_id, score )')
      .eq('status', 'submitted')
      .order('id')
      .range(from, to),
  );
  if (error) throw new Error(`Secondes cotations : ${error.message}`);
  let ratings = ratingRows;

  const participantIds = [...new Set(ratings.map((row) => row.participant_id))];
  if (!includeDemo && participantIds.length) {
    const demo = new Set<string>();
    for (const part of chunks(participantIds)) {
      const { data } = await supabase.from('participants').select('id').in('id', part).eq('is_demo', true);
      for (const row of data ?? []) demo.add(row.id);
    }
    ratings = ratings.filter((row) => !demo.has(row.participant_id));
  }

  const sessionIds = [...new Set(ratings.map((row) => row.session_id))];
  const officials: ReliabilityDataset['officials'] = [];
  for (const part of chunks(sessionIds)) {
    const { data, error: officialError } = await fetchAll((from, to) =>
      supabase
        .from('evaluations')
        .select('session_id, participant_id, evaluator_id, revision, evaluation_scores ( skill_id, score )')
        .in('session_id', part)
        .eq('status', 'validated')
        .order('id')
        .range(from, to),
    );
    if (officialError) throw new Error(`Évaluations officielles : ${officialError.message}`);
    for (const row of data) {
      officials.push({
        sessionId: row.session_id,
        participantId: row.participant_id,
        evaluatorId: row.evaluator_id,
        revision: row.revision,
        scores: row.evaluation_scores.map((score) => ({ skillId: score.skill_id, score: score.score === null ? null : Number(score.score) })),
      });
    }
  }

  const skillIds = [...new Set([...ratings.flatMap((row) => row.calibration_scores.map((score) => score.skill_id)), ...officials.flatMap((row) => row.scores.map((score) => score.skillId))])];
  const skills: ReliabilityDataset['skills'] = [];
  for (const part of chunks(skillIds)) {
    const { data } = await supabase.from('skills').select('id, version_id, code, name, position').in('id', part);
    for (const row of data ?? []) skills.push({ id: row.id, versionId: row.version_id, code: row.code, name: row.name, position: row.position });
  }
  const versionIds = [...new Set(skills.map((skill) => skill.versionId))];
  const { data: versionRows } = versionIds.length
    ? await supabase.from('framework_versions').select('id, label, version_number, scale_min, scale_max, scale_step, frameworks ( code, name, position )').in('id', versionIds)
    : { data: [] };
  const versions = (versionRows ?? [])
    .sort((a, b) => (a.frameworks?.position ?? 0) - (b.frameworks?.position ?? 0) || a.version_number - b.version_number)
    .map((row) => ({
      id: row.id,
      frameworkCode: row.frameworks?.code ?? 'referentiel',
      frameworkName: row.frameworks?.name ?? 'Référentiel',
      versionNumber: row.version_number,
      label: row.label,
      scale: { min: row.scale_min, max: row.scale_max, step: Number(row.scale_step) },
    }));

  const { data: staff } = await supabase.from('staff_directory').select('id, first_name, last_name');
  const raterNames = Object.fromEntries((staff ?? []).map((person) => [person.id, `${person.first_name} ${person.last_name}`.trim()]));

  return {
    versions,
    skills,
    officials,
    raterNames,
    ratings: ratings.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      participantId: row.participant_id,
      raterId: row.rater_id,
      origin: row.origin === 'exercise' ? 'exercise' : 'co_trainer',
      officialRevision: row.official_revision,
      scores: row.calibration_scores.map((score) => ({ skillId: score.skill_id, score: score.score === null ? null : Number(score.score) })),
    })),
  };
}
