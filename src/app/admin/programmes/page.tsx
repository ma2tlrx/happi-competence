import type { Metadata } from 'next';

import { Badge, Card, CardBody, CardHeader, PageHeader, ProvisionalBadge } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDuration } from '@/lib/utils';

import { FrameworkVersionSelect, ProgramDialog, ProgramSessionDialog, PublicButton } from './program-client';

export const metadata: Metadata = { title: 'Programmes' };

export default async function AdminProgramsPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const [{ data: programs }, { data: frameworks }, { data: versions }] = await Promise.all([
    supabase.from('programs').select('*, program_sessions ( * ), program_frameworks ( framework_id, framework_version_id )').order('created_at'),
    supabase.from('frameworks').select('id, name').order('position'),
    supabase.from('framework_versions').select('id, framework_id, label, version_number').eq('status', 'published').order('version_number', { ascending: false }),
  ]);
  return (
    <>
      <PageHeader title="Programmes" description="Trame des sessions, taille des groupes et version des référentiels utilisée pour évaluer." actions={<ProgramDialog />} />
      <div className="space-y-6">
        {(programs ?? []).map((program) => (
          <Card key={program.id}>
            <CardHeader
              title={<span className="flex flex-wrap items-center gap-2">{program.name}{program.is_public ? <Badge variant="orange">Présenté sur le site</Badge> : null}</span>}
              description={`${program.sessions_count} sessions de ${formatDuration(program.session_duration_minutes)} · groupes de ${program.min_group_size} à ${program.max_group_size}`}
              action={<>{!program.is_public ? <PublicButton programId={program.id} /> : null}<ProgramDialog program={program} /></>}
            />
            <CardBody className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <ol className="space-y-2">
                {[...program.program_sessions].sort((a, b) => a.number - b.number).map((sheet) => (
                  <li key={sheet.id} className="flex items-start justify-between gap-3 rounded-md bg-paper p-3">
                    <span>
                      <span className="flex flex-wrap items-center gap-2 font-semibold">{sheet.number}. {sheet.title}{sheet.is_provisional ? <ProvisionalBadge /> : null}</span>
                      <span className="block text-sm text-ink-muted">{sheet.objectives.length} objectif(s) · {sheet.activities.length} activité(s) · {sheet.key_notions.length} notion(s)</span>
                    </span>
                    <ProgramSessionDialog sheet={sheet} />
                  </li>
                ))}
              </ol>
              <div>
                <p className="mb-3 text-sm font-semibold text-ink-muted">Référentiels utilisés pour évaluer</p>
                <ul className="space-y-3">
                  {(frameworks ?? []).map((framework) => (
                    <li key={framework.id}>
                      <p className="mb-1 font-medium">{framework.name}</p>
                      <FrameworkVersionSelect
                        programId={program.id}
                        frameworkId={framework.id}
                        frameworkName={framework.name}
                        current={program.program_frameworks.find((link) => link.framework_id === framework.id)?.framework_version_id ?? null}
                        versions={(versions ?? []).filter((v) => v.framework_id === framework.id)}
                      />
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-ink-subtle">Changer de version n’affecte jamais les évaluations déjà enregistrées : chacune conserve la version utilisée.</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
