import { CalendarDays } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { SessionStatusBadge } from '@/components/passport/session-status';
import { FilterSelect } from '@/components/ui/navigation';
import { Card, EmptyState, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { getOrganizationOverview } from '@/lib/organization';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatTimeRange } from '@/lib/utils';

export const metadata: Metadata = { title: 'Sessions' };

export default async function OrganizationSessionsPage({ searchParams }: { searchParams: Promise<{ groupe?: string; statut?: string }> }) {
  const { groupe, statut } = await searchParams;
  await requireRole('organisme');
  const supabase = await createClient();
  const overview = await getOrganizationOverview(supabase);
  const rows = overview.sessions.filter((session) => (!groupe || session.groupId === groupe) && (!statut || (statut === 'realisees' ? session.status === 'completed' : session.status !== 'completed' && session.status !== 'cancelled')));
  return (
    <>
      <PageHeader title="Sessions" description="Les sessions planifiées et réalisées pour les groupes de vos participants." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <FilterSelect param="statut" label="Filtrer par statut" allLabel="Toutes les sessions" options={[{ value: 'a-venir', label: 'À venir' }, { value: 'realisees', label: 'Réalisées' }]} />
        <FilterSelect param="groupe" label="Filtrer par groupe" allLabel="Tous les groupes" options={overview.groups.map((g) => ({ value: g.id, label: g.name }))} />
      </div>
      <Card>
        {rows.length > 0 ? (
          <TableWrap>
            <Table>
              <thead>
                <tr><Th>Date</Th><Th>Session</Th><Th>Groupe</Th><Th>Lieu</Th><Th>Statut</Th><Th><span className="sr-only">Présences</span></Th></tr>
              </thead>
              <tbody>
                {rows.map((session) => (
                  <Tr key={session.id}>
                    <Td className="whitespace-nowrap"><span className="block font-medium">{formatDate(session.date)}</span><span className="text-sm text-ink-subtle">{formatTimeRange(session.startTime, session.endTime)}</span></Td>
                    <Td className="font-medium">Session {session.number} · {session.title}</Td>
                    <Td className="text-ink-muted">{session.groupName}</Td>
                    <Td className="text-sm text-ink-muted">{session.location ?? '—'}</Td>
                    <Td><SessionStatusBadge status={session.status} /></Td>
                    <Td className="text-right">{session.status === 'completed' ? <Link href={`/organisme/presences?session=${session.id}`} className="text-sm font-semibold text-petrol-700 hover:underline">Présences</Link> : null}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={CalendarDays} title="Aucune session" />
        )}
      </Card>
    </>
  );
}
