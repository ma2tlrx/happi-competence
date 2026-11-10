import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge, Card, CardBody, Notice, PageHeader } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

import { VERSION_STATUS } from '../../labels';
import { CloneButton, PublishQuestionnaireButton, QuestionnaireForm } from '../../version-client';

export const metadata: Metadata = { title: 'Questionnaire d’auto-évaluation' };

export default async function QuestionnaireVersionPage({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  if (!isUuid(versionId)) notFound();
  await requireRole('admin');
  const supabase = await createClient();
  const { data: version } = await supabase
    .from('questionnaire_versions')
    .select('*, questionnaires ( name ), questionnaire_scale_labels ( value, label ), questionnaire_questions ( text, skill_code, position, is_active )')
    .eq('id', versionId)
    .maybeSingle();
  if (!version) notFound();
  const { count } = await supabase.from('self_assessments').select('id', { count: 'exact', head: true }).eq('questionnaire_version_id', versionId);
  const status = VERSION_STATUS[version.status]!;
  return (
    <>
      <PageHeader
        back={<Link href="/admin/referentiels" className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />Référentiels</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{version.questionnaires?.name}<Badge variant={status.variant}>{status.label}</Badge></span>}
        description={`${version.label} · ${count ?? 0} auto-évaluation(s) réalisée(s) avec cette version`}
        actions={version.status === 'draft' ? <PublishQuestionnaireButton versionId={versionId} /> : version.status === 'published' ? <CloneButton versionId={versionId} questionnaire /> : null}
      />
      {version.status !== 'draft' ? <Notice className="mb-6" title="Version figée">Les questions d’une version publiée ne changent plus, pour que les auto-évaluations restent comparables. Créez une nouvelle version pour les modifier.</Notice> : null}
      <Card>
        <CardBody>
          <QuestionnaireForm
            versionId={versionId}
            label={version.label}
            intro={version.intro}
            isProvisional={version.is_provisional}
            disabled={version.status !== 'draft'}
            scale={{ min: version.scale_min, max: version.scale_max, labels: Object.fromEntries(version.questionnaire_scale_labels.map((l) => [l.value, l.label])) }}
            questions={[...version.questionnaire_questions].filter((q) => q.is_active).sort((a, b) => a.position - b.position)}
          />
        </CardBody>
      </Card>
    </>
  );
}
