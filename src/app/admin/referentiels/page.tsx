import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Badge, Card, CardBody, CardHeader, Notice, PageHeader, ProvisionalBadge } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

import { VERSION_STATUS } from './labels';
import { CloneButton } from './version-client';

export const metadata: Metadata = { title: 'Référentiels' };

export default async function FrameworksPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const [{ data: frameworks }, { data: usage }, { data: questionnaires }] = await Promise.all([
    supabase.from('frameworks').select('id, code, name, description, framework_versions ( id, version_number, label, status, is_provisional, published_at, created_at, scale_min, scale_max )').order('position'),
    supabase.from('program_frameworks').select('framework_version_id, programs ( name )'),
    supabase.from('questionnaires').select('id, name, description, questionnaire_versions ( id, version_number, label, status, is_provisional, published_at )'),
  ]);
  const usedBy = (versionId: string) => (usage ?? []).filter((u) => u.framework_version_id === versionId).map((u) => u.programs?.name).filter(Boolean);

  return (
    <>
      <PageHeader title="Référentiels" description="Compétences, catégories, échelles, critères d’observation et correspondances avec les sessions, versionnés." />
      <Notice className="mb-6" title="Comment fonctionnent les versions">
        Une version publiée est figée : pour faire évoluer un référentiel, créez une nouvelle version (copie modifiable), publiez-la, puis activez-la pour un programme.
        Chaque évaluation conserve la version et les critères appliqués au moment où elle a été validée.
      </Notice>
      <div className="space-y-6">
        {(frameworks ?? []).map((framework) => {
          const versions = [...framework.framework_versions].sort((a, b) => b.version_number - a.version_number);
          const latestPublished = versions.find((v) => v.status === 'published');
          const hasDraft = versions.some((v) => v.status === 'draft');
          return (
            <Card key={framework.id}>
              <CardHeader title={framework.name} description={framework.description ?? undefined} action={latestPublished && !hasDraft ? <CloneButton versionId={latestPublished.id} /> : null} />
              <CardBody className="pt-3">
                <ul className="divide-y divide-line">
                  {versions.map((version) => (
                    <li key={version.id}>
                      <Link href={`/admin/referentiels/${version.id}`} className="group flex flex-wrap items-center justify-between gap-3 py-3">
                        <span>
                          <span className="flex flex-wrap items-center gap-2 font-semibold">
                            {version.label}
                            <Badge variant={VERSION_STATUS[version.status]!.variant}>{VERSION_STATUS[version.status]!.label}</Badge>
                            {version.is_provisional ? <ProvisionalBadge /> : null}
                          </span>
                          <span className="block text-sm text-ink-muted">
                            Version {version.version_number} · échelle {version.scale_min}–{version.scale_max} · {version.published_at ? `publiée le ${formatDate(version.published_at)}` : `créée le ${formatDate(version.created_at)}`}
                            {usedBy(version.id).length ? ` · active pour ${usedBy(version.id).join(', ')}` : ''}
                          </span>
                        </span>
                        <ArrowRight className="size-4 text-ink-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          );
        })}
        {(questionnaires ?? []).map((questionnaire) => {
          const versions = [...questionnaire.questionnaire_versions].sort((a, b) => b.version_number - a.version_number);
          const published = versions.find((v) => v.status === 'published');
          return (
            <Card key={questionnaire.id}>
              <CardHeader title={questionnaire.name} description={questionnaire.description ?? undefined} action={published && !versions.some((v) => v.status === 'draft') ? <CloneButton versionId={published.id} questionnaire /> : null} />
              <CardBody className="pt-3">
                <ul className="divide-y divide-line">
                  {versions.map((version) => (
                    <li key={version.id}>
                      <Link href={`/admin/referentiels/questionnaire/${version.id}`} className="group flex items-center justify-between gap-3 py-3">
                        <span className="flex flex-wrap items-center gap-2 font-semibold">
                          {version.label}
                          <Badge variant={VERSION_STATUS[version.status]!.variant}>{VERSION_STATUS[version.status]!.label}</Badge>
                          {version.is_provisional ? <ProvisionalBadge /> : null}
                        </span>
                        <ArrowRight className="size-4 text-ink-subtle" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}
