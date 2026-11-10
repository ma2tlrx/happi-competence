import { BookOpen } from 'lucide-react';
import type { Metadata } from 'next';

import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, ProvisionalBadge } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { AGGREGATION_LABELS, SCORING_MODE_LABELS, type Aggregation, type ScoringMode } from '@/lib/evaluation-engine';
import { createClient } from '@/lib/supabase/server';
import { formatDuration } from '@/lib/utils';

export const metadata: Metadata = { title: 'Programmes' };

export default async function TrainerProgramsPage() {
  await requireRole('formateur', 'admin');
  const supabase = await createClient();
  const { data: programs } = await supabase
    .from('programs')
    .select('id, name, description, sessions_count, session_duration_minutes, min_group_size, max_group_size, status, program_sessions ( number, title, summary, is_provisional ), program_frameworks ( framework_versions ( label, is_provisional, scale_min, scale_max, scoring_mode, aggregation, frameworks ( name ) ) )')
    .eq('status', 'active')
    .order('name');

  return (
    <>
      <PageHeader title="Programmes" description="Les programmes disponibles, leur trame de sessions et les référentiels utilisés pour évaluer." />
      {(programs ?? []).length === 0 ? (
        <Card><EmptyState icon={BookOpen} title="Aucun programme actif" /></Card>
      ) : (
        <div className="space-y-6">
          {programs!.map((program) => (
            <Card key={program.id}>
              <CardHeader
                title={program.name}
                description={`${program.sessions_count} sessions de ${formatDuration(program.session_duration_minutes)} · groupes de ${program.min_group_size} à ${program.max_group_size} participants`}
              />
              <CardBody className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
                <div>
                  {program.description ? <p className="mb-4 text-[0.9375rem] text-ink-muted">{program.description}</p> : null}
                  <ol className="space-y-2">
                    {[...program.program_sessions].sort((a, b) => a.number - b.number).map((session) => (
                      <li key={session.number} className="flex gap-3 rounded-md bg-paper p-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-petrol-900 text-sm font-semibold text-white">{session.number}</span>
                        <span>
                          <span className="flex flex-wrap items-center gap-2 font-semibold">{session.title}{session.is_provisional ? <ProvisionalBadge /> : null}</span>
                          {session.summary ? <span className="block text-sm text-ink-muted">{session.summary}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <p className="mb-3 text-sm font-semibold text-ink-muted">Référentiels activés</p>
                  <ul className="space-y-3">
                    {program.program_frameworks.map((link, index) => {
                      const version = link.framework_versions;
                      if (!version) return null;
                      return (
                        <li key={index} className="rounded-md border border-line p-4">
                          <p className="flex flex-wrap items-center gap-2 font-semibold">{version.frameworks?.name}{version.is_provisional ? <ProvisionalBadge /> : <Badge variant="success">Validé</Badge>}</p>
                          <p className="text-sm text-ink-muted">{version.label}</p>
                          <p className="mt-2 text-sm text-ink-muted">
                            Échelle {version.scale_min}–{version.scale_max} · {SCORING_MODE_LABELS[version.scoring_mode as ScoringMode].label} · {AGGREGATION_LABELS[version.aggregation as Aggregation].label}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
