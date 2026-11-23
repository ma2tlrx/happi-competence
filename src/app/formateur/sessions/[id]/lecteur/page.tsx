import type { Metadata } from 'next';
import Link from 'next/link';

import { Card, EmptyState } from '@/components/ui/primitives';
import { hasPermission } from '@/lib/auth/session';
import { displayName } from '@/lib/live-marks/live-marks';
import { parseSessionScript } from '@/lib/pedagogy/parse';

import { getSessionContext } from '../context';
import { SessionHeader } from '../session-nav';
import type { LiveParticipant, LiveSkill } from './live-marks-panel';
import { SessionPlayer, type PlayerInitialState } from './player';

export const metadata: Metadata = { title: 'Lecteur pédagogique' };

type TimerJson = { elapsedMs?: number; runningSince?: number | null };
const asTimer = (value: unknown) => {
  const timer = (value ?? {}) as TimerJson;
  return { elapsedMs: Number(timer.elapsedMs ?? 0), runningSince: typeof timer.runningSince === 'number' ? timer.runningSince : null };
};

export default async function LecteurPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase, session, group, title, members } = await getSessionContext(id);

  const { data: content } = await supabase
    .from('pedagogical_contents')
    // Seule la version en cours (et non tout l'historique des supports importés).
    .select('current_version_id, current:pedagogical_content_versions!pedagogical_contents_current_version_fkey ( id, markdown, is_provisional, version_number )')
    .eq('program_session_id', session.program_session_id)
    .maybeSingle();
  const version = content?.current ?? null;

  if (!hasPermission(user, 'content.read') || !version) {
    return (
      <>
        <SessionHeader session={session} title={title} groupName={group.name} />
        <Card>
          <EmptyState
            title={version ? 'Accès au support non autorisé' : 'Aucun support pédagogique pour cette session'}
            description={
              version
                ? 'Votre compte n’a pas la permission de consulter les supports pédagogiques.'
                : 'L’administrateur peut importer le support Markdown de cette session depuis « Supports pédagogiques ».'
            }
            action={<Link href={`/formateur/sessions/${id}`} className="font-semibold text-petrol-700 underline">Revenir à la session</Link>}
          />
        </Card>
      </>
    );
  }

  const script = parseSessionScript(version.markdown);
  const hasPrep = script.info.length > 0 || Boolean(script.intro);
  const { data: frameworkLinks } = await supabase.from('program_frameworks').select('framework_version_id').eq('program_id', group.program_id);
  const versionIds = (frameworkLinks ?? []).map((link) => link.framework_version_id);
  const [{ data: state }, { data: notes }, { data: attendance }, { data: liveMarks }, { data: mapping }, { data: allSkills }] = await Promise.all([
    supabase.from('session_player_states').select('*').eq('session_id', id).eq('trainer_id', user.id).maybeSingle(),
    supabase.from('trainer_notes').select('block_key, body').eq('session_id', id).eq('trainer_id', user.id),
    supabase.from('attendance').select('participant_id, status').eq('session_id', id),
    supabase.from('session_live_marks').select('id, participant_id, skill_code, created_at').eq('session_id', id).order('created_at'),
    supabase.from('session_skill_map').select('skill_id').in('version_id', versionIds).eq('session_number', session.number),
    supabase.from('skills').select('id, code, name, position').in('version_id', versionIds).eq('is_active', true).order('position'),
  ]);
  // Compétences évaluées pour cette session ; sans correspondance définie, toutes celles des référentiels activés.
  const mappedIds = new Set((mapping ?? []).map((row) => row.skill_id));
  const liveSkills: LiveSkill[] = [];
  for (const skill of allSkills ?? []) {
    if ((mappedIds.size === 0 || mappedIds.has(skill.id)) && !liveSkills.some((item) => item.code === skill.code)) liveSkills.push({ code: skill.code, name: skill.name });
  }
  const attendanceBy = new Map((attendance ?? []).map((row) => [row.participant_id, row.status]));
  const liveParticipants: LiveParticipant[] = members.map((member) => ({
    id: member.id,
    label: displayName(member.firstName, member.lastName),
    present: ['present', 'late', 'left_early'].includes(attendanceBy.get(member.id) ?? ''),
  }));
  // Si le support a changé depuis la dernière animation, on repart du début.
  const sameVersion = state?.content_version_id === version.id;
  const initial: PlayerInitialState = {
    currentBlock: state && sameVersion ? state.current_block : hasPrep ? -1 : 0,
    completedBlocks: sameVersion ? (state?.completed_blocks ?? []) : [],
    sessionTimer: asTimer(state?.session_timer),
    blockTimers: sameVersion ? Object.fromEntries(Object.entries((state?.block_timers ?? {}) as Record<string, unknown>).map(([key, value]) => [key, asTimer(value)])) : {},
  };

  return (
    <SessionPlayer
      sessionId={id}
      sessionLabel={`Session ${session.number} · ${title}`}
      groupName={group.name}
      script={script}
      contentVersionId={version.id}
      isProvisional={version.is_provisional}
      initial={initial}
      memberCount={members.length}
      canLaunchGames={hasPermission(user, 'games.manage')}
      notes={Object.fromEntries((notes ?? []).map((note) => [note.block_key, note.body]))}
      liveParticipants={liveParticipants}
      liveSkills={liveSkills}
      liveMarks={(liveMarks ?? []).map((mark) => ({ id: mark.id, participantId: mark.participant_id, skillCode: mark.skill_code }))}
    />
  );
}
