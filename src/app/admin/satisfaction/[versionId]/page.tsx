import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge, Card, CardBody, Notice, PageHeader, ProvisionalBadge } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { serializeQuestions } from '@/lib/satisfaction/questions-format';
import { AUDIENCE_LABELS, MOMENT_LABELS, type SatisfactionAudience, type SatisfactionMoment } from '@/lib/satisfaction/window';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

import { VERSION_STATUS } from '../../referentiels/labels';
import { CloneSurveyButton, DraftActions, SurveyVersionForm } from '../survey-client';

export const metadata: Metadata = { title: 'Enquête de satisfaction' };

export default async function SurveyVersionPage({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  if (!isUuid(versionId)) notFound();
  await requireRole('admin');
  const supabase = await createClient();
  const { data: version } = await supabase
    .from('satisfaction_survey_versions')
    .select('*, satisfaction_surveys ( id, name, audience, moment ), satisfaction_questions ( kind, text, options, is_required, is_active, position )')
    .eq('id', versionId)
    .maybeSingle();
  if (!version || !version.satisfaction_surveys) notFound();
  const [{ count }, { data: siblings }] = await Promise.all([
    supabase.from('satisfaction_responses').select('id', { count: 'exact', head: true }).eq('survey_version_id', versionId),
    supabase.from('satisfaction_survey_versions').select('id, status').eq('survey_id', version.satisfaction_surveys.id),
  ]);
  const status = VERSION_STATUS[version.status]!;
  const survey = version.satisfaction_surveys;
  const hasDraft = (siblings ?? []).some((sibling) => sibling.status === 'draft');
  const questions = [...version.satisfaction_questions].filter((question) => question.is_active).sort((a, b) => a.position - b.position);

  return (
    <>
      <PageHeader
        back={
          <Link href="/admin/satisfaction" className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden />
            Satisfaction
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {survey.name}
            <Badge variant={status.variant}>{status.label}</Badge>
            {version.is_provisional ? <ProvisionalBadge /> : null}
          </span>
        }
        description={`${AUDIENCE_LABELS[survey.audience as SatisfactionAudience]} · ${MOMENT_LABELS[survey.moment as SatisfactionMoment].description} · version ${version.version_number} · ${count ?? 0} réponse(s) avec cette version`}
        actions={version.status === 'draft' ? <DraftActions versionId={versionId} /> : version.status === 'published' && !hasDraft ? <CloneSurveyButton versionId={versionId} /> : null}
      />
      {version.status !== 'draft' ? (
        <Notice className="mb-6" title="Version figée">
          Les questions d’une version publiée ne changent plus, pour que les réponses restent comparables. Créez une nouvelle version pour les modifier.
        </Notice>
      ) : null}
      <Card>
        <CardBody>
          <SurveyVersionForm
            versionId={versionId}
            label={version.label}
            intro={version.intro}
            isProvisional={version.is_provisional}
            ratingLabels={version.rating_labels}
            questions={serializeQuestions(questions)}
            disabled={version.status !== 'draft'}
          />
        </CardBody>
      </Card>
    </>
  );
}
