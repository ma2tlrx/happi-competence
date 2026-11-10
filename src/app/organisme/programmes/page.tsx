import { Layers } from 'lucide-react';
import type { Metadata } from 'next';

import { GROUP_STATUS } from '@/components/trainer/labels';
import { SessionSteps } from '@/components/ui/level-meter';
import { Badge, Card, CardBody, EmptyState, PageHeader } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { getOrganizationOverview } from '@/lib/organization';
import { createClient } from '@/lib/supabase/server';
import { formatDate, pluralize } from '@/lib/utils';

export const metadata: Metadata = { title: 'Programmes' };

export default async function OrganizationProgramsPage() {
  await requireRole('organisme');
  const supabase = await createClient();
  const overview = await getOrganizationOverview(supabase);
  return (
    <>
      <PageHeader title="Programmes" description="Les groupes dans lesquels vos participants suivent un programme HAPPI." />
      {overview.groups.length === 0 ? (
        <Card><EmptyState icon={Layers} title="Aucun programme" description="Aucun de vos participants n’est encore inscrit dans un groupe." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {overview.groups.map((group) => {
            const status = GROUP_STATUS[group.status] ?? GROUP_STATUS.active!;
            const next = overview.sessions.find((session) => session.groupId === group.id && session.status !== 'completed' && session.status !== 'cancelled');
            return (
              <Card key={group.id}>
                <CardBody className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-title">{group.name}</h2>
                      <p className="text-sm text-ink-muted">{group.programName}</p>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <SessionSteps total={group.totalSessions} completed={group.completedSessions} current={next?.number} />
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-ink-muted">Période</dt><dd className="font-medium">{formatDate(group.startDate, '—')} – {formatDate(group.endDate, '…')}</dd></div>
                    <div><dt className="text-ink-muted">Vos participants</dt><dd className="font-medium">{pluralize(group.participants, 'personne', 'personnes')}</dd></div>
                    <div><dt className="text-ink-muted">Sessions réalisées</dt><dd className="font-medium">{group.completedSessions}/{group.totalSessions}</dd></div>
                    <div><dt className="text-ink-muted">Prochaine session</dt><dd className="font-medium">{next ? `${next.number} · ${formatDate(next.date)}` : '—'}</dd></div>
                  </dl>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
