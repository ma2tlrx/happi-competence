import type { Metadata } from 'next';
import Link from 'next/link';

import { SessionStatusBadge } from '@/components/passport/session-status';
import { FilterSelect } from '@/components/ui/navigation';
import { Card, EmptyState, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { listSessions } from '@/lib/trainer';
import { formatDate, formatTimeRange } from '@/lib/utils';

export const metadata: Metadata = { title: 'Sessions' };

export default async function AdminSessionsPage({ searchParams }: { searchParams: Promise<{ statut?: string; groupe?: string }> }) {
  const { statut, groupe } = await searchParams;
  await requireRole('admin');
  const supabase = await createClient();
  const all = await listSessions(supabase);
  const groups = [...new Map(all.map((s) => [s.groupId, s.groupName])).entries()].map(([value, label]) => ({ value, label }));
  const rows = all.filter((s) => (!statut || s.status === statut) && (!groupe || s.groupId === groupe));
  return (
    <>
      <PageHeader title="Sessions" description="Toutes les sessions de la plateforme. Ouvrez une session pour consulter présences, évaluations et lecteur." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <FilterSelect param="statut" label="Filtrer par statut" allLabel="Tous les statuts" options={[{ value: 'planned', label: 'À venir' }, { value: 'in_progress', label: 'En cours' }, { value: 'completed', label: 'Terminées' }, { value: 'cancelled', label: 'Annulées' }]} />
        <FilterSelect param="groupe" label="Filtrer par groupe" allLabel="Tous les groupes" options={groups} />
      </div>
      <Card>
        {rows.length > 0 ? (
          <TableWrap>
            <Table>
              <thead><tr><Th>Date</Th><Th>Session</Th><Th>Groupe</Th><Th>Organisme</Th><Th>Statut</Th></tr></thead>
              <tbody>
                {rows.map((session) => (
                  <Tr key={session.id}>
                    <Td className="whitespace-nowrap"><span className="block font-medium">{formatDate(session.date)}</span><span className="text-sm text-ink-subtle">{formatTimeRange(session.startTime, session.endTime)}</span></Td>
                    <Td><Link href={`/formateur/sessions/${session.id}`} className="font-semibold hover:text-petrol-700 hover:underline">Session {session.number} · {session.title}</Link></Td>
                    <Td className="text-ink-muted">{session.groupName}</Td>
                    <Td className="text-sm text-ink-muted">{session.organizationName ?? '—'}</Td>
                    <Td><SessionStatusBadge status={session.status} /></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState title="Aucune session" />
        )}
      </Card>
    </>
  );
}
