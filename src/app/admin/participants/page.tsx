import { Download } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { FilterSelect, Pagination, SearchInput } from '@/components/ui/navigation';
import { Badge, Card, EmptyState, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

import { ParticipantOrganizationSelect } from '../admin-client';

export const metadata: Metadata = { title: 'Participants' };
const PAGE_SIZE = 25;

export default async function AdminParticipantsPage({ searchParams }: { searchParams: Promise<{ q?: string; organisme?: string; page?: string }> }) {
  const { q = '', organisme, page = '1' } = await searchParams;
  await requireRole('admin');
  const supabase = await createClient();
  const pageNumber = Math.max(1, Number(page) || 1);
  let query = supabase.from('participants').select('id, first_name, last_name, email, user_id, organization_id, status, is_demo, created_at, group_members ( status, groups ( name ) )', { count: 'exact' }).order('last_name');
  if (organisme === 'aucun') query = query.is('organization_id', null);
  else if (organisme) query = query.eq('organization_id', organisme);
  const term = q.trim().replace(/[%_,()]/g, ' ');
  if (term) query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`);
  const [{ data: participants, count }, { data: organizations }] = await Promise.all([
    query.range((pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE - 1),
    supabase.from('organizations').select('id, name').eq('status', 'active').order('name'),
  ]);
  return (
    <>
      <PageHeader
        title="Participants"
        description="Tous les participants, leur compte, leur groupe et leur organisme de rattachement."
        actions={<Button asChild variant="outline"><a href="/api/exports/participants" download><Download aria-hidden />Export CSV</a></Button>}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput placeholder="Nom ou adresse e-mail" />
        <FilterSelect param="organisme" label="Filtrer par organisme" allLabel="Tous les organismes" options={[{ value: 'aucun', label: 'Sans organisme' }, ...(organizations ?? []).map((o) => ({ value: o.id, label: o.name }))]} />
      </div>
      <Card>
        {(participants ?? []).length > 0 ? (
          <TableWrap>
            <Table>
              <thead><tr><Th>Participant</Th><Th>Compte</Th><Th>Groupe</Th><Th>Organisme</Th><Th>Inscription</Th></tr></thead>
              <tbody>
                {participants!.map((participant) => {
                  const name = `${participant.first_name} ${participant.last_name}`;
                  const group = participant.group_members.find((m) => m.status === 'active')?.groups?.name;
                  return (
                    <Tr key={participant.id}>
                      <Td>
                        <Link href={`/formateur/participants/${participant.id}`} className="font-semibold hover:text-petrol-700 hover:underline">{participant.last_name.toUpperCase()} {participant.first_name}</Link>
                        {participant.is_demo ? <Badge variant="outline" className="ml-2">Démo</Badge> : null}
                        <span className="block text-sm text-ink-subtle">{participant.email}</span>
                      </Td>
                      <Td>{participant.user_id ? <Badge variant="success">Créé</Badge> : <Badge variant="outline">Invité</Badge>}</Td>
                      <Td className="text-sm text-ink-muted">{group ?? '—'}</Td>
                      <Td><ParticipantOrganizationSelect participantId={participant.id} value={participant.organization_id} organizations={organizations ?? []} name={name} /></Td>
                      <Td className="text-sm whitespace-nowrap text-ink-muted">{formatDate(participant.created_at)}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState title="Aucun participant ne correspond" />
        )}
        <Pagination page={pageNumber} pageCount={Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))} total={count ?? 0} label="participants" />
      </Card>
    </>
  );
}
