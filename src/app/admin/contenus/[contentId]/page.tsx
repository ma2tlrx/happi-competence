import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Markdown } from '@/components/markdown';
import { Badge, Card, CardBody, CardHeader, PageHeader, ProvisionalBadge } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { parseSessionScript, SEQUENCE_TYPE_LABELS } from '@/lib/pedagogy/parse';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime, isUuid } from '@/lib/utils';

import { ImportForm, PublishVersionButton } from '../content-client';

export const metadata: Metadata = { title: 'Support pédagogique' };

/** contentId = identifiant de la session de la trame (program_sessions.id). */
export default async function ContentPage({ params, searchParams }: { params: Promise<{ contentId: string }>; searchParams: Promise<{ version?: string }> }) {
  const { contentId } = await params;
  const { version: requested } = await searchParams;
  if (!isUuid(contentId)) notFound();
  await requireRole('admin');
  const supabase = await createClient();
  const { data: sheet } = await supabase
    .from('program_sessions')
    .select('id, number, title, programs ( name ), pedagogical_contents ( id, current_version_id, pedagogical_content_versions!pedagogical_content_versions_content_id_fkey ( id, version_number, markdown, source_filename, change_note, is_provisional, created_at, published_at, created_by ) )')
    .eq('id', contentId)
    .maybeSingle();
  if (!sheet) notFound();
  const content = sheet.pedagogical_contents[0];
  const versions = [...(content?.pedagogical_content_versions ?? [])].sort((a, b) => b.version_number - a.version_number);
  const shown = versions.find((v) => v.id === requested) ?? versions.find((v) => v.id === content?.current_version_id) ?? versions[0];
  const script = shown ? parseSessionScript(shown.markdown) : null;

  return (
    <>
      <PageHeader
        back={<Link href="/admin/contenus" className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />Supports pédagogiques</Link>}
        title={`Session ${sheet.number} · ${sheet.title}`}
        description={sheet.programs?.name}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {shown && script ? (
            <Card>
              <CardHeader
                title={<span className="flex flex-wrap items-center gap-2">Aperçu · version {shown.version_number}{shown.id === content?.current_version_id ? <Badge variant="success">Publiée</Badge> : null}{shown.is_provisional ? <ProvisionalBadge /> : null}</span>}
                description={`${script.sequences.length} séquences reconnues · ${script.totalMinutes} min`}
                action={shown.id !== content?.current_version_id ? <PublishVersionButton versionId={shown.id} /> : null}
              />
              <CardBody>
                <ol className="mb-6 space-y-1.5 rounded-md bg-paper p-4 text-sm">
                  {script.sequences.map((sequence) => (
                    <li key={sequence.key} className="flex justify-between gap-3">
                      <span>{sequence.index + 1}. {sequence.title} <span className="text-ink-subtle">· {SEQUENCE_TYPE_LABELS[sequence.type]} · {sequence.parts.length} bloc(s)</span></span>
                      <span className="text-ink-muted tabular-nums">{sequence.durationMinutes ? `${sequence.durationMinutes} min` : 'durée ?'}</span>
                    </li>
                  ))}
                </ol>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-petrol-700">Afficher le document complet</summary>
                  <Markdown className="mt-4">{shown.markdown}</Markdown>
                </details>
              </CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Importer une nouvelle version" description="Les versions précédentes restent conservées et peuvent être republiées." />
            <CardBody><ImportForm programSessionId={sheet.id} /></CardBody>
          </Card>
        </div>
        <Card className="lg:self-start">
          <CardHeader title="Historique des versions" />
          <CardBody className="pt-3">
            <ol className="space-y-3">
              {versions.map((version) => (
                <li key={version.id}>
                  <Link href={`/admin/contenus/${sheet.id}?version=${version.id}`} className={`block rounded-md border p-3 ${version.id === shown?.id ? 'border-petrol-400 bg-petrol-50' : 'border-line hover:border-petrol-300'}`}>
                    <span className="flex items-center gap-2 font-semibold">Version {version.version_number}{version.id === content?.current_version_id ? <Badge variant="success">Publiée</Badge> : null}</span>
                    <span className="block text-sm text-ink-muted">{formatDateTime(version.created_at)}</span>
                    {version.source_filename ? <span className="block text-sm text-ink-subtle">{version.source_filename}</span> : null}
                    {version.change_note ? <span className="block text-sm text-ink-subtle">{version.change_note}</span> : null}
                  </Link>
                </li>
              ))}
              {versions.length === 0 ? <li className="text-sm text-ink-muted">Aucune version.</li> : null}
            </ol>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
