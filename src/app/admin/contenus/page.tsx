import { ArrowRight, FileText } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Card, CardBody, CardHeader, EmptyState, Notice, PageHeader, ProvisionalBadge } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { parseSessionScript } from '@/lib/pedagogy/parse';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatDuration } from '@/lib/utils';

export const metadata: Metadata = { title: 'Supports pédagogiques' };

export default async function ContentsPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const { data: programs } = await supabase
    .from('programs')
    .select('id, name, program_sessions ( id, number, title, pedagogical_contents ( id, current_version_id, pedagogical_content_versions!pedagogical_content_versions_content_id_fkey ( id, version_number, markdown, is_provisional, created_at ) ) )')
    .order('created_at');
  return (
    <>
      <PageHeader title="Supports pédagogiques" description="Un support Markdown par session, versionné. Le lecteur des formateurs utilise la version publiée." />
      <Notice className="mb-6" title="Format attendu">
        Un titre « # », puis une section « ## » par séquence avec une fiche « - **Durée** : 10 min » et des sous-parties « ### À dire », « ### Consigne pour les participants », « ### À observer », « ### À retenir », « ### Questions à poser ». Le guide complet est dans <code>docs/format-supports-pedagogiques.md</code>.
      </Notice>
      {(programs ?? []).map((program) => (
        <Card key={program.id} className="mb-6">
          <CardHeader title={program.name} />
          <CardBody className="pt-3">
            {program.program_sessions.length === 0 ? <EmptyState icon={FileText} title="Aucune session dans la trame" /> : (
              <ul className="divide-y divide-line">
                {[...program.program_sessions].sort((a, b) => a.number - b.number).map((sheet) => {
                  const content = sheet.pedagogical_contents[0];
                  const current = content?.pedagogical_content_versions.find((v) => v.id === content.current_version_id);
                  const script = current ? parseSessionScript(current.markdown) : null;
                  return (
                    <li key={sheet.id}>
                      <Link href={`/admin/contenus/${sheet.id}`} className="group flex flex-wrap items-center justify-between gap-3 py-3">
                        <span>
                          <span className="flex flex-wrap items-center gap-2 font-semibold">Session {sheet.number} · {sheet.title}{current?.is_provisional ? <ProvisionalBadge /> : null}</span>
                          <span className="block text-sm text-ink-muted">
                            {current && script ? `Version ${current.version_number} du ${formatDate(current.created_at)} · ${script.sequences.length} séquences · ${formatDuration(script.totalMinutes)} · ${content!.pedagogical_content_versions.length} version(s) conservée(s)` : 'Aucun support importé'}
                          </span>
                        </span>
                        <ArrowRight className="size-4 text-ink-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      ))}
    </>
  );
}
