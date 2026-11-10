import { Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Badge, Card, EmptyState, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { myGroupIds } from '@/lib/trainer';
import { formatDate } from '@/lib/utils';

import { GROUP_STATUS } from '@/components/trainer/labels';

import { NewGroupDialog } from './new-group-dialog';

export const metadata: Metadata = { title: 'Groupes' };


export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ nouveau?: string }> }) {
  const { nouveau } = await searchParams;
  const user = await requireRole('formateur', 'admin');
  const supabase = await createClient();
  const groupIds = await myGroupIds(supabase, user.id);
  const [groups, programs, organizations, members, sessions] = await Promise.all([
    supabase.from('groups').select('id, name, status, start_date, end_date, programs ( name ), organizations ( name )').in('id', groupIds).order('start_date', { ascending: false }),
    supabase.from('programs').select('id, name').eq('status', 'active').order('name'),
    supabase.from('organizations').select('id, name').eq('status', 'active').order('name'),
    supabase.from('group_members').select('group_id').in('group_id', groupIds).eq('status', 'active'),
    supabase.from('sessions').select('group_id, status').in('group_id', groupIds),
  ]);
  const count = (rows: { group_id: string }[] | null, id: string) => (rows ?? []).filter((row) => row.group_id === id).length;
  const canCreate = hasPermission(user, 'groups.manage');

  return (
    <>
      <PageHeader
        title="Groupes"
        description="Les groupes qui vous sont attribués. Un groupe réunit généralement 4 à 8 participants autour d’un programme."
        actions={canCreate ? <NewGroupDialog programs={programs.data ?? []} organizations={organizations.data ?? []} defaultOpen={nouveau === '1'} /> : null}
      />
      <Card>
        {(groups.data ?? []).length > 0 ? (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Groupe</Th>
                  <Th>Organisme</Th>
                  <Th>Période</Th>
                  <Th className="text-right">Participants</Th>
                  <Th className="text-right">Sessions</Th>
                  <Th>Statut</Th>
                </tr>
              </thead>
              <tbody>
                {groups.data!.map((group) => {
                  const status = GROUP_STATUS[group.status] ?? GROUP_STATUS.active!;
                  const groupSessions = (sessions.data ?? []).filter((row) => row.group_id === group.id);
                  return (
                    <Tr key={group.id}>
                      <Td>
                        <Link href={`/formateur/groupes/${group.id}`} className="font-semibold text-ink hover:text-petrol-700 hover:underline">
                          {group.name}
                        </Link>
                        <span className="block text-sm text-ink-subtle">{group.programs?.name}</span>
                      </Td>
                      <Td className="text-ink-muted">{group.organizations?.name ?? '—'}</Td>
                      <Td className="text-sm whitespace-nowrap text-ink-muted">
                        {group.start_date ? `${formatDate(group.start_date)} – ${formatDate(group.end_date, '…')}` : 'Dates à définir'}
                      </Td>
                      <Td className="text-right tabular-nums">{count(members.data, group.id)}</Td>
                      <Td className="text-right tabular-nums">
                        {groupSessions.filter((s) => s.status === 'completed').length}/{groupSessions.length}
                      </Td>
                      <Td>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={Users} title="Aucun groupe" description="Créez un groupe pour commencer à accompagner des participants." />
        )}
      </Card>
    </>
  );
}
