import { CalendarDays, Clock, MapPin, Route } from 'lucide-react';
import type { Metadata } from 'next';

import { AttendanceBadge, SessionStatusBadge } from '@/components/passport/session-status';
import { Card, EmptyState, PageHeader, ProvisionalBadge } from '@/components/ui/primitives';
import { cn, formatDate, formatTimeRange } from '@/lib/utils';

import { getMyPassport } from '../data';
import { LearningNote } from './learning-note';

export const metadata: Metadata = { title: 'Mon parcours' };

function SheetList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="mt-2 space-y-1.5 text-[0.9375rem] text-ink-muted">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5">
            <span className="mt-2.5 h-1 w-2.5 shrink-0 rounded-full bg-orange-500" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function ParcoursPage() {
  const { passport, supabase } = await getMyPassport();
  const { sessions, group } = passport;
  if (!group || sessions.length === 0) {
    return (
      <>
        <PageHeader title="Mon parcours" />
        <Card>
          <EmptyState
            icon={Route}
            title="Votre parcours n’a pas encore commencé"
            description="Dès que votre formateur vous aura inscrit dans un groupe, vos six sessions apparaîtront ici."
          />
        </Card>
      </>
    );
  }

  const [sheetsResult, mappingResult, notesResult] = await Promise.all([
    supabase.from('program_sessions').select('id, number, objectives, activities, key_notions, takeaways, is_provisional, summary').in('id', sessions.map((s) => s.programSessionId)),
    supabase.from('session_skill_map').select('session_number, skills ( name, version_id )'),
    supabase.from('participant_session_notes').select('session_id, learned').eq('participant_id', passport.participant.id),
  ]);
  const sheets = new Map((sheetsResult.data ?? []).map((sheet) => [sheet.id, sheet]));
  const notes = new Map((notesResult.data ?? []).map((note) => [note.session_id, note.learned]));
  const skillsBySession = new Map<number, string[]>();
  const knownSkillNames = new Set(passport.frameworks.flatMap((framework) => framework.skills.map((skill) => skill.name)));
  for (const row of mappingResult.data ?? []) {
    if (!row.skills || !knownSkillNames.has(row.skills.name)) continue;
    skillsBySession.set(row.session_number, [...new Set([...(skillsBySession.get(row.session_number) ?? []), row.skills.name])]);
  }
  const evaluationBySession = new Map(passport.evaluations.map((evaluation) => [evaluation.sessionId, evaluation]));

  return (
    <>
      <PageHeader
        title="Mon parcours"
        description={`${group.name} · ${group.programName}${group.startDate ? ` · du ${formatDate(group.startDate)} au ${formatDate(group.endDate)}` : ''}`}
      />
      <ol className="relative space-y-5 before:absolute before:top-6 before:bottom-6 before:left-[1.375rem] before:w-px before:bg-line-strong sm:before:left-[1.625rem]">
        {sessions.map((session) => {
          const sheet = sheets.get(session.programSessionId);
          const evaluation = evaluationBySession.get(session.id);
          const done = session.status === 'completed';
          const current = passport.currentSession?.id === session.id;
          return (
            <li key={session.id} className="relative flex gap-4 sm:gap-6">
              <span
                className={cn(
                  'relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full font-display font-semibold ring-4 ring-paper sm:size-[3.25rem] sm:text-lg',
                  done ? 'bg-petrol-900 text-white' : current ? 'bg-orange-500 text-petrol-950' : 'border border-line-strong bg-white text-ink-muted',
                )}
              >
                {session.number}
              </span>
              <article className={cn('min-w-0 flex-1 rounded-lg border bg-white', current ? 'border-orange-300 shadow-sm' : 'border-line')}>
                <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
                  <div>
                    <h2 className="text-title">{session.title}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="size-4" aria-hidden />
                        {formatDate(session.date)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-4" aria-hidden />
                        {formatTimeRange(session.startTime, session.endTime)}
                      </span>
                      {session.location ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-4" aria-hidden />
                          {session.location}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {current ? <SessionStatusBadge status="in_progress" /> : <SessionStatusBadge status={session.status} />}
                    {done ? <AttendanceBadge status={session.attendance} /> : null}
                    {sheet?.is_provisional ? <ProvisionalBadge>Contenu provisoire</ProvisionalBadge> : null}
                  </div>
                </header>
                <details className="group px-5 pb-5" open={current || undefined}>
                  <summary className="mt-3 inline-flex list-none items-center gap-1 text-sm font-semibold text-petrol-700 [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">Voir la fiche de session</span>
                    <span className="hidden group-open:inline">Masquer la fiche</span>
                  </summary>
                  <div className="mt-4 grid gap-5 border-t border-line pt-4 md:grid-cols-2">
                    {sheet?.summary && !sheet.objectives.includes(sheet.summary) ? <p className="text-[0.9375rem] text-ink md:col-span-2">{sheet.summary}</p> : null}
                    <SheetList title="Objectifs pédagogiques" items={sheet?.objectives ?? []} />
                    <SheetList title="Activités réalisées" items={sheet?.activities ?? []} />
                    <SheetList title="Compétences mobilisées" items={skillsBySession.get(session.number) ?? []} />
                    <SheetList title="Notions essentielles" items={sheet?.key_notions ?? []} />
                    <SheetList title="Points à retenir" items={sheet?.takeaways ?? []} />
                    {sheet && sheet.objectives.length + sheet.activities.length + sheet.key_notions.length === 0 ? (
                      <p className="text-sm text-ink-muted md:col-span-2">Le contenu de cette session sera communiqué prochainement.</p>
                    ) : null}
                  </div>
                  {evaluation?.observation || evaluation?.advice ? (
                    <div className="mt-5 rounded-md bg-paper p-4 text-[0.9375rem]">
                      <p className="text-sm font-semibold text-ink">Retour de {evaluation.evaluator ?? 'votre formateur'}</p>
                      {evaluation.observation ? <p className="mt-1 text-ink-muted">{evaluation.observation}</p> : null}
                      {evaluation.advice ? <p className="mt-2 text-ink"><span className="font-semibold">Conseil : </span>{evaluation.advice}</p> : null}
                    </div>
                  ) : null}
                  {done || current ? (
                    <div className="mt-5">
                      <h3 className="mb-2 text-sm font-semibold text-ink">Ce que j’ai appris</h3>
                      <LearningNote sessionId={session.id} initialValue={notes.get(session.id) ?? ''} />
                    </div>
                  ) : null}
                </details>
              </article>
            </li>
          );
        })}
      </ol>
    </>
  );
}
