import { ArrowLeft, Scale } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { SecondRatingWorkspace, type RatingEntry } from '@/components/reliability/second-rating-workspace';
import { StartSecondRatingButton } from '@/components/reliability/start-button';
import { Card, EmptyState, Notice, PageHeader } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { secondRatingFeedback } from '@/lib/reliability/actions';
import { loadSessionFrameworks } from '@/lib/reliability/load';
import { createClient } from '@/lib/supabase/server';
import { formatDate, isUuid } from '@/lib/utils';

export const metadata: Metadata = { title: 'Seconde cotation' };

export default async function SecondRatingSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) notFound();
  const user = await requireRole('formateur', 'admin');
  // La seconde cotation est réservée aux formateurs : l'administrateur voit tout et ne peut pas coter à l'aveugle.
  if (user.role === 'admin') redirect('/admin/fiabilite');
  const supabase = await createClient();
  const { data: rows } = await supabase.rpc('get_my_second_ratings', { p_session_id: sessionId });
  const ratings = rows ?? [];
  const back = (
    <Link href="/formateur/seconde-cotation" className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden />
      Secondes cotations
    </Link>
  );

  if (ratings.length === 0) {
    // Formateur du groupe sans seconde cotation ouverte : proposer de la démarrer.
    const { data: session } = await supabase.from('sessions').select('id, number, trainer_id, program_sessions ( title ), groups ( name )').eq('id', sessionId).maybeSingle();
    if (!session) notFound();
    return (
      <>
        <PageHeader back={back} title={`Session ${session.number} · ${session.program_sessions?.title ?? ''}`} description={session.groups?.name} />
        <Card>
          <EmptyState
            icon={Scale}
            title="Aucune seconde cotation ouverte"
            description={
              session.trainer_id === user.id
                ? 'Vous animez cette séance : l’évaluation officielle vous revient. La seconde cotation est faite par un autre formateur.'
                : 'Ouvrez la seconde cotation pour les participants dont l’évaluation officielle n’a pas encore commencé. L’évaluation officielle vous sera masquée jusqu’à la soumission de votre cotation.'
            }
            action={session.trainer_id === user.id ? null : <StartSecondRatingButton sessionId={sessionId} />}
          />
        </Card>
      </>
    );
  }

  const first = ratings[0]!;
  const [frameworks, { data: scores }] = await Promise.all([
    loadSessionFrameworks(supabase, first.program_id, first.session_number),
    supabase.from('calibration_scores').select('rating_id, skill_id, score, comment').in('rating_id', ratings.map((row) => row.rating_id)),
  ]);
  const entries: RatingEntry[] = await Promise.all(
    ratings.map(async (row) => ({
      id: row.rating_id,
      participantLabel: row.participant_label,
      status: row.status === 'submitted' ? 'submitted' : 'draft',
      submittedAt: row.submitted_at,
      exerciseOpen: row.exercise_id === null || row.exercise_status === 'open',
      comment: row.comment ?? '',
      criteria: (row.criteria && typeof row.criteria === 'object' && !Array.isArray(row.criteria) ? row.criteria : {}) as RatingEntry['criteria'],
      scores: Object.fromEntries(
        (scores ?? []).filter((score) => score.rating_id === row.rating_id).map((score) => [score.skill_id, { score: score.score === null ? null : Number(score.score), comment: score.comment ?? '' }]),
      ),
      feedback: row.status === 'submitted' ? await secondRatingFeedback(row.rating_id) : null,
    })),
  );
  const exercise = ratings.find((row) => row.exercise_id);

  return (
    <>
      <PageHeader
        back={back}
        title={`Seconde cotation · Session ${first.session_number} · ${first.session_title}`}
        description={`${first.group_name} · ${formatDate(first.session_date)}`}
      />
      <Notice className="mb-4" title="Cotation à l’aveugle">
        L’évaluation officielle de ces participants vous reste masquée tant que votre cotation n’est pas soumise. Après soumission, votre cotation est figée et vous voyez, compétence par
        compétence, les niveaux de l’évaluation officielle validée. Cette seconde cotation n’apparaît jamais dans le passeport ni dans le bilan du participant.
      </Notice>
      {exercise ? (
        <Notice className="mb-4" variant={exercise.exercise_status === 'open' ? 'info' : 'warning'} title={`Exercice d’étalonnage : ${exercise.exercise_title ?? ''}`}>
          {exercise.exercise_status === 'open' ? null : <p className="font-medium">Cet exercice est clos.</p>}
          {exercise.exercise_instructions ? <p className="whitespace-pre-line">{exercise.exercise_instructions}</p> : null}
        </Notice>
      ) : null}
      {frameworks.length === 0 ? (
        <Card>
          <EmptyState title="Aucun référentiel activé" description="L’administrateur doit activer au moins une version publiée de référentiel pour ce programme." />
        </Card>
      ) : (
        <SecondRatingWorkspace frameworks={frameworks} ratings={entries} />
      )}
    </>
  );
}
