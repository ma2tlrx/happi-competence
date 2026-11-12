import { ArrowLeft, ListChecks } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Card, EmptyState, Notice, PageHeader } from '@/components/ui/primitives';

import { getMyPassport } from '../../data';
import { startFinalSelfAssessment } from '../actions';
import { Questionnaire } from '../questionnaire';

export const metadata: Metadata = { title: 'Auto-évaluation de fin de parcours' };

export default async function FinalSelfAssessmentPage() {
  const { passport, supabase } = await getMyPassport();
  // Terminée : figée, on la consulte dans « Mon évolution ».
  if (passport.finalSelfAssessment?.status === 'completed') redirect('/participant/evolution');

  const back = (
    <Link href="/participant/evolution" className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden />
      Mon évolution
    </Link>
  );
  const started = await startFinalSelfAssessment();
  if ('error' in started) {
    return (
      <>
        <PageHeader back={back} title="Auto-évaluation de fin de parcours" />
        <Card>
          <EmptyState icon={ListChecks} title="Pas encore disponible" description={started.error} />
        </Card>
      </>
    );
  }

  const { data: assessment } = await supabase
    .from('self_assessments')
    .select('id, questionnaire_versions ( questionnaire_scale_labels ( value, label ), questionnaire_questions ( id, position, text, help, is_active ) ), self_assessment_answers ( question_id, value )')
    .eq('id', started.id)
    .single();
  const version = assessment?.questionnaire_versions;
  if (!assessment || !version) return null;

  return (
    <>
      <PageHeader
        back={back}
        title="Auto-évaluation de fin de parcours"
        description="Les mêmes affirmations qu’au début du programme. Pour chacune, indiquez à quel point elle vous correspond aujourd’hui. Il n’y a ni bonne ni mauvaise réponse."
      />
      <Notice className="mb-5" title="Comment sont utilisées vos réponses ?">
        Elles sont présentées à côté de vos réponses de départ et des observations de vos formateurs, dans « Mon évolution ». Elles restent distinctes des observations.
      </Notice>
      <Questionnaire
        assessmentId={assessment.id}
        intro={null}
        final
        questions={version.questionnaire_questions.filter((question) => question.is_active).sort((a, b) => a.position - b.position)}
        scale={[...version.questionnaire_scale_labels].sort((a, b) => a.value - b.value)}
        initialAnswers={Object.fromEntries(assessment.self_assessment_answers.map((answer) => [answer.question_id, answer.value]))}
      />
    </>
  );
}
