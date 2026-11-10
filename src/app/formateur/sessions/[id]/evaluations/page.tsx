import type { Metadata } from 'next';

import { Card, EmptyState, Notice } from '@/components/ui/primitives';
import { hasPermission } from '@/lib/auth/session';
import type { Aggregation, Rounding, ScoringMode } from '@/lib/evaluation-engine';

import { getSessionContext } from '../context';
import { SessionHeader } from '../session-nav';
import { EvaluationWorkspace, type EngineFramework, type ExistingEvaluation } from './workspace';

export const metadata: Metadata = { title: 'Évaluations' };

export default async function EvaluationsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ participant?: string }> }) {
  const { id } = await params;
  const { participant: requested } = await searchParams;
  const { user, supabase, session, group, title, members } = await getSessionContext(id);

  // Référentiels activés pour le programme du groupe (version publiée figée à la création de l'évaluation).
  const { data: links } = await supabase.from('program_frameworks').select('framework_version_id').eq('program_id', group.program_id);
  const versionIds = (links ?? []).map((link) => link.framework_version_id);

  const [versions, levels, skills, mapping, attendance, evaluations, staff] = await Promise.all([
    supabase.from('framework_versions').select('id, label, is_provisional, scale_min, scale_max, scale_step, scoring_mode, aggregation, rounding, frameworks ( code, name, position )').in('id', versionIds),
    supabase.from('scale_levels').select('version_id, value, label').in('version_id', versionIds),
    supabase
      .from('skills')
      .select('id, version_id, code, name, description, position, is_active, skill_categories ( name, position ), skill_level_descriptors ( level_value, description ), skill_criteria ( id, label, description, weight, position, is_active )')
      .in('version_id', versionIds)
      .eq('is_active', true),
    supabase.from('session_skill_map').select('skill_id, version_id').in('version_id', versionIds).eq('session_number', session.number),
    supabase.from('attendance').select('participant_id, status').eq('session_id', id),
    supabase
      .from('evaluations')
      .select('id, participant_id, status, revision, validated_at, evaluator_id, updated_at, evaluation_scores ( skill_id, score, score_source, comment ), evaluation_criterion_scores ( criterion_id, observed, score ), evaluation_comments ( kind, body ), evaluation_history ( id, change_type, skill_id, comment_kind, old_value, new_value, reason, changed_by, changed_at ), evaluation_frameworks ( framework_version_id )')
      .eq('session_id', id),
    supabase.from('staff_directory').select('id, first_name, last_name'),
  ]);

  const mappedByVersion = new Map<string, Set<string>>();
  for (const row of mapping.data ?? []) mappedByVersion.set(row.version_id, (mappedByVersion.get(row.version_id) ?? new Set()).add(row.skill_id));

  const frameworks: EngineFramework[] = (versions.data ?? [])
    .filter((version) => version.frameworks)
    .sort((a, b) => a.frameworks!.position - b.frameworks!.position)
    .map((version) => {
      const mapped = mappedByVersion.get(version.id);
      const versionSkills = (skills.data ?? [])
        .filter((skill) => skill.version_id === version.id && (!mapped || mapped.size === 0 || mapped.has(skill.id)))
        .sort((a, b) => a.position - b.position);
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
        skills: versionSkills.map((skill) => ({
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

  const staffName = new Map((staff.data ?? []).map((person) => [person.id, `${person.first_name} ${person.last_name}`]));
  const skillName = new Map((skills.data ?? []).map((skill) => [skill.id, skill.name]));
  const existing: Record<string, ExistingEvaluation> = Object.fromEntries(
    (evaluations.data ?? []).map((evaluation) => [
      evaluation.participant_id,
      {
        id: evaluation.id,
        status: evaluation.status as 'draft' | 'validated',
        revision: evaluation.revision,
        validatedAt: evaluation.validated_at,
        updatedAt: evaluation.updated_at,
        evaluator: evaluation.evaluator_id ? (staffName.get(evaluation.evaluator_id) ?? null) : null,
        versionIds: evaluation.evaluation_frameworks.map((link) => link.framework_version_id),
        scores: Object.fromEntries(evaluation.evaluation_scores.map((score) => [score.skill_id, { score: score.score === null ? null : Number(score.score), comment: score.comment ?? '' }])),
        criteria: Object.fromEntries(evaluation.evaluation_criterion_scores.map((c) => [c.criterion_id, { observed: c.observed, score: c.score === null ? null : Number(c.score) }])),
        comments: {
          observation: evaluation.evaluation_comments.find((c) => c.kind === 'observation')?.body ?? '',
          advice: evaluation.evaluation_comments.find((c) => c.kind === 'advice')?.body ?? '',
          private: evaluation.evaluation_comments.find((c) => c.kind === 'private')?.body ?? '',
        },
        history: [...evaluation.evaluation_history]
          .sort((a, b) => b.changed_at.localeCompare(a.changed_at))
          .map((entry) => ({
            id: entry.id,
            type: entry.change_type,
            subject: entry.skill_id ? (skillName.get(entry.skill_id) ?? 'Compétence') : entry.comment_kind ? `Commentaire (${entry.comment_kind === 'observation' ? 'observation' : entry.comment_kind === 'advice' ? 'conseil' : 'note privée'})` : null,
            oldValue: entry.old_value,
            newValue: entry.new_value,
            reason: entry.reason,
            author: entry.changed_by ? (staffName.get(entry.changed_by) ?? null) : null,
            at: entry.changed_at,
          })),
      },
    ]),
  );
  const attendanceBy = Object.fromEntries((attendance.data ?? []).map((row) => [row.participant_id, row.status]));
  const canWrite = hasPermission(user, 'evaluations.write');

  return (
    <>
      <SessionHeader session={session} title={title} groupName={group.name} />
      {!canWrite ? (
        <Notice variant="warning" className="mb-4" title="Consultation seule">Votre compte n’a pas la permission de saisir des évaluations.</Notice>
      ) : null}
      {frameworks.length === 0 ? (
        <Card>
          <EmptyState title="Aucun référentiel activé" description="L’administrateur doit activer au moins une version publiée de référentiel pour ce programme." />
        </Card>
      ) : members.length === 0 ? (
        <Card>
          <EmptyState title="Aucun participant" description="Ajoutez des participants au groupe pour les évaluer." />
        </Card>
      ) : (
        <EvaluationWorkspace
          sessionId={id}
          sessionStatus={session.status}
          members={members.map((member) => ({ id: member.id, name: `${member.firstName} ${member.lastName}`, firstName: member.firstName, lastName: member.lastName, attendance: attendanceBy[member.id] ?? null }))}
          frameworks={frameworks}
          existing={existing}
          canWrite={canWrite}
          initialParticipant={requested && members.some((member) => member.id === requested) ? requested : null}
        />
      )}
    </>
  );
}
