import { ListChecks } from 'lucide-react';
import type { Metadata } from 'next';

import { LevelMeter } from '@/components/ui/level-meter';
import { Badge, Card, CardBody, CardHeader, EmptyState, Notice, PageHeader } from '@/components/ui/primitives';
import { formatDateTime } from '@/lib/utils';

import { getMyPassport } from '../data';
import { startSelfAssessment } from './actions';
import { Questionnaire } from './questionnaire';

export const metadata: Metadata = { title: 'Mon auto-évaluation' };

export default async function AutoEvaluationPage({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const { bienvenue } = await searchParams;
  const { passport, supabase } = await getMyPassport();
  const existing = passport.selfAssessment;

  if (existing?.status === 'completed') {
    return (
      <>
        <PageHeader
          title="Mon auto-évaluation"
          description="Votre point de départ : la manière dont vous perceviez vos compétences au début du programme. Elle est conservée telle quelle."
        />
        <Card>
          <CardHeader
            title="Auto-évaluation initiale"
            description={`Complétée le ${formatDateTime(existing.completedAt)} · ${existing.versionLabel}`}
            action={<Badge variant="success">Terminée</Badge>}
          />
          <CardBody>
            <p className="mb-5 text-sm text-ink-muted">
              Échelle de réponse : {existing.scaleLabels.map((level) => `${level.value} = ${level.label}`).join(' · ')}
            </p>
            <ol className="divide-y divide-line">
              {existing.answers.map((answer, index) => (
                <li key={answer.questionId} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-center">
                  <p className="flex gap-3 text-ink">
                    <span className="text-ink-subtle tabular-nums">{index + 1}.</span>
                    {answer.text}
                  </p>
                  <div>
                    <LevelMeter value={answer.value} min={existing.scaleMin} max={existing.scaleMax} tone="self" label={`Réponse : ${answer.value} sur ${existing.scaleMax}`} />
                    <p className="mt-1.5 text-sm text-ink-muted">
                      <span className="font-semibold text-ink">{answer.value}</span> · {existing.scaleLabels.find((level) => level.value === answer.value)?.label}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            {existing.comment ? (
              <div className="mt-4 rounded-md bg-paper p-4">
                <p className="text-sm font-semibold text-ink">Mon commentaire</p>
                <p className="mt-1 text-ink-muted">{existing.comment}</p>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </>
    );
  }

  const started = await startSelfAssessment();
  if ('error' in started) {
    return (
      <>
        <PageHeader title="Mon auto-évaluation" />
        <Card>
          <EmptyState icon={ListChecks} title="Auto-évaluation indisponible" description={started.error} />
        </Card>
      </>
    );
  }

  const { data: assessment } = await supabase
    .from('self_assessments')
    .select('id, questionnaire_versions ( intro, questionnaire_scale_labels ( value, label ), questionnaire_questions ( id, position, text, help, is_active ) ), self_assessment_answers ( question_id, value )')
    .eq('id', started.id)
    .single();
  const version = assessment?.questionnaire_versions;
  if (!assessment || !version) return null;

  return (
    <>
      <PageHeader
        title={bienvenue ? 'Bienvenue ! Commençons par votre auto-évaluation' : 'Mon auto-évaluation'}
        description="Pour chaque affirmation, indiquez à quel point elle vous correspond aujourd’hui. Il n’y a ni bonne ni mauvaise réponse."
      />
      <Notice className="mb-5" title="Comment sont utilisées vos réponses ?">
        Elles constituent votre point de départ et restent distinctes des observations de vos formateurs. Vous pourrez les comparer tout au long du programme.
      </Notice>
      <Questionnaire
        assessmentId={assessment.id}
        intro={null}
        questions={version.questionnaire_questions.filter((question) => question.is_active).sort((a, b) => a.position - b.position)}
        scale={[...version.questionnaire_scale_labels].sort((a, b) => a.value - b.value)}
        initialAnswers={Object.fromEntries(assessment.self_assessment_answers.map((answer) => [answer.question_id, answer.value]))}
        next="/participant/dashboard?bienvenue=1"
      />
    </>
  );
}
