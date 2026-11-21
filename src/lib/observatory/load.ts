import 'server-only';

import type { CurrentUser } from '@/lib/auth/session';
import { fetchAll } from '@/lib/outcomes/load';
import { createClient, type ServerClient } from '@/lib/supabase/server';

import type { ObservatoryFilters } from './axes';
import { assembleDataset, type ObservatoryRaw } from './dataset';
import { buildObservatoryReport, type ObservatoryReport } from './report';

/**
 * Lectures de l'observatoire, sous la session de l'administrateur (RLS lui ouvre tout) : une seule
 * vague de requêtes en parallèle, lues par pages de 1 000 lignes (ordre stable par identifiant).
 * Ne sont jamais lus : les noms des personnes, les commentaires, ni aucune colonne sensible de la
 * fiche d'entrée FSE+ (handicap, RQTH, origine, minorité, nationalité, logement…).
 */

/** L'observatoire est réservé à l'administration : contrôle côté serveur, en plus de la page et de RLS. */
export function canReadObservatory(user: CurrentUser) {
  return user.role === 'admin' && user.status === 'active';
}

/**
 * Données réelles pour un compte réel ; données de démonstration pour un compte de démonstration
 * (les deux ne se mélangent jamais).
 */
export async function loadObservatoryRaw(supabase: ServerClient, { demo }: { demo: boolean }): Promise<ObservatoryRaw> {
  const [frameworks, versions, skills, categories, levels, participants, organizations, memberships, groups, programs, evaluations, profiles, selfAssessments, questionnaireVersions, questions] =
    await Promise.all([
      fetchAll((from, to) => supabase.from('frameworks').select('id, code, name, short_name, position').order('id').range(from, to)),
      fetchAll((from, to) =>
        supabase
          .from('framework_versions')
          .select('id, framework_id, version_number, label, status, is_provisional, scale_min, scale_max, scale_step, scoring_mode, aggregation, rounding')
          .order('id')
          .range(from, to),
      ),
      fetchAll((from, to) => supabase.from('skills').select('id, version_id, code, name, description, position, is_active, category_id').order('id').range(from, to)),
      fetchAll((from, to) => supabase.from('skill_categories').select('id, name, position').order('id').range(from, to)),
      fetchAll((from, to) => supabase.from('scale_levels').select('version_id, value, label').order('id').range(from, to)),
      fetchAll((from, to) => supabase.from('participants').select('id, organization_id').eq('is_demo', demo).order('id').range(from, to)),
      fetchAll((from, to) => supabase.from('organizations').select('id, name, city').order('id').range(from, to)),
      fetchAll((from, to) => supabase.from('group_members').select('participant_id, group_id, status, joined_at').in('status', ['active', 'dropped']).order('id').range(from, to)),
      fetchAll((from, to) => supabase.from('groups').select('id, name, program_id, start_date').order('id').range(from, to)),
      fetchAll((from, to) => supabase.from('programs').select('id, name').order('id').range(from, to)),
      fetchAll((from, to) =>
        supabase
          .from('evaluations')
          .select('id, participant_id, validated_at, sessions ( number, scheduled_date ), evaluation_scores ( skill_id, score )')
          .eq('status', 'validated')
          .order('id')
          .range(from, to),
      ),
      fetchAll((from, to) =>
        supabase
          .from('participant_entry_profiles')
          .select('participant_id, entry_date, updated_at, gender, age_band, labour_status, diploma_level, qpv_resident')
          .order('id')
          .range(from, to),
      ),
      fetchAll((from, to) =>
        supabase
          .from('self_assessments')
          .select('participant_id, questionnaire_version_id, status, started_at, self_assessment_answers ( question_id, value )')
          .eq('kind', 'initial')
          .order('id')
          .range(from, to),
      ),
      fetchAll((from, to) => supabase.from('questionnaire_versions').select('id, scale_min, scale_max').order('id').range(from, to)),
      fetchAll((from, to) => supabase.from('questionnaire_questions').select('id, skill_code, position').order('id').range(from, to)),
    ]);
  return {
    frameworks,
    versions: versions.map((version) => ({ ...version, scale_step: Number(version.scale_step) })),
    skills,
    categories,
    levels,
    participants,
    organizations,
    memberships,
    groups,
    programs,
    evaluations,
    profiles,
    selfAssessments,
    questionnaireVersions,
    questions,
  };
}

/** Rapport de l'observatoire pour l'utilisateur ; null s'il n'est pas administrateur actif. */
export async function loadObservatoryFor(user: CurrentUser, filters: ObservatoryFilters): Promise<ObservatoryReport | null> {
  if (!canReadObservatory(user)) return null;
  const supabase = await createClient();
  const raw = await loadObservatoryRaw(supabase, { demo: user.isDemo });
  return buildObservatoryReport(assembleDataset(raw), filters);
}
