import { CalendarDays } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { SessionStatusBadge } from '@/components/passport/session-status';
import { LinkTabs, FilterSelect } from '@/components/ui/navigation';
import { Card, EmptyState, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { listSessions, myGroupIds, todayIso } from '@/lib/trainer';
import { formatDate, formatTimeRange } from '@/lib/utils';

export const metadata: Metadata = { title: 'Sessions' };

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ vue?: string; groupe?: string }> }) {
  const { vue = 'a-venir', groupe } = await searchParams;
  const user = await requireRole('formateur', 'admin');
  const supabase = await createClient();
  const groupIds = await myGroupIds(supabase, user.id);
  const all = await listSessions(supabase, { groupIds });
  const today = todayIso();
  const groups = [...new Map(all.map((session) => [session.groupId, session.groupName])).entries()].map(([value, label]) => ({ value, label }));
  const filtered = all
    .filter((session) => !groupe || session.groupId === groupe)
    .filter((session) =>
      vue === 'passees'
        ? session.status === 'completed' || session.status === 'cancelled' || (session.date !== null && session.date < today && session.status === 'planned')
        : vue === 'toutes'
          ? true
          : session.status === 'planned' || session.status === 'in_progress',
    );
  if (vue === 'passees') filtered.reverse();
  const query = groupe ? `&groupe=${groupe}` : '';

  return (
    <>
      <PageHeader title="Sessions" description="Toutes les sessions de vos groupes. Ouvrez une session pour l’animer, saisir les présences et évaluer." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <LinkTabs
          label="Période"
          className="border-b-0"
          tabs={[
            { href: `/formateur/sessions?vue=a-venir${query}`, label: 'À venir', active: vue !== 'passees' && vue !== 'toutes' },
            { href: `/formateur/sessions?vue=passees${query}`, label: 'Passées', active: vue === 'passees' },
            { href: `/formateur/sessions?vue=toutes${query}`, label: 'Toutes', active: vue === 'toutes' },
          ]}
        />
        <FilterSelect param="groupe" label="Filtrer par groupe" allLabel="Tous les groupes" options={groups} />
      </div>
      <Card>
        {filtered.length > 0 ? (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Session</Th>
                  <Th>Groupe</Th>
                  <Th>Lieu</Th>
                  <Th>Statut</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((session) => (
                  <Tr key={session.id}>
                    <Td className="whitespace-nowrap">
                      <span className="block font-medium">{formatDate(session.date)}</span>
                      <span className="text-sm text-ink-subtle">{formatTimeRange(session.startTime, session.endTime)}</span>
                    </Td>
                    <Td>
                      <Link href={`/formateur/sessions/${session.id}`} className="font-semibold text-ink hover:text-petrol-700 hover:underline">
                        Session {session.number} · {session.title}
                      </Link>
                    </Td>
                    <Td className="text-ink-muted">{session.groupName}</Td>
                    <Td className="text-sm text-ink-muted">{session.location ?? '—'}</Td>
                    <Td><SessionStatusBadge status={session.status} /></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={CalendarDays} title="Aucune session" description="Planifiez les sessions depuis la fiche d’un groupe." />
        )}
      </Card>
    </>
  );
}
