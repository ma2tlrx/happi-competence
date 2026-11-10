import type { Metadata } from 'next';
import Link from 'next/link';

import { Card, EmptyState } from '@/components/ui/primitives';
import { hasPermission } from '@/lib/auth/session';
import { parseSessionScript } from '@/lib/pedagogy/parse';

import { getSessionContext } from '../context';
import { SessionHeader } from '../session-nav';
import { SessionPlayer, type PlayerInitialState } from './player';

export const metadata: Metadata = { title: 'Lecteur pédagogique' };

type TimerJson = { elapsedMs?: number; runningSince?: number | null };
const asTimer = (value: unknown) => {
  const timer = (value ?? {}) as TimerJson;
  return { elapsedMs: Number(timer.elapsedMs ?? 0), runningSince: typeof timer.runningSince === 'number' ? timer.runningSince : null };
};

export default async function LecteurPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase, session, group, title } = await getSessionContext(id);

  const { data: content } = await supabase
    .from('pedagogical_contents')
    .select('current_version_id, pedagogical_content_versions!pedagogical_content_versions_content_id_fkey ( id, markdown, is_provisional, version_number )')
    .eq('program_session_id', session.program_session_id)
    .maybeSingle();
  const version = content?.pedagogical_content_versions.find((item) => item.id === content.current_version_id) ?? null;

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
  const [{ data: state }, { data: notes }] = await Promise.all([
    supabase.from('session_player_states').select('*').eq('session_id', id).eq('trainer_id', user.id).maybeSingle(),
    supabase.from('trainer_notes').select('block_key, body').eq('session_id', id).eq('trainer_id', user.id),
  ]);
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
      notes={Object.fromEntries((notes ?? []).map((note) => [note.block_key, note.body]))}
    />
  );
}
