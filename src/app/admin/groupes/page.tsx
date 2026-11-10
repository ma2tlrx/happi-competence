import type { Metadata } from 'next';
import Link from 'next/link';

import { GROUP_STATUS } from '@/components/trainer/labels';
import { FilterSelect } from '@/components/ui/navigation';
import { Badge, Card, EmptyState, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

import { TrainerAssignment } from '../admin-client';

export const metadata: Metadata = { title: 'Groupes' };

export default async function AdminGroupsPage({ searchParams }: { searchParams: Promise<{ organisme?: string; programme?: string }> }) {
  const { organisme, programme } = await searchParams;
  await requireRole('admin');
  const supabase = await createClient();
  let query = supabase.from('groups').select('id, name, status, start_date, end_date, organization_id, program_id, is_demo, programs ( name ), organizations ( name ), group_trainers ( trainer_id, is_lead ), group_members ( status )').order('start_date', { ascending: false });
  if (organisme) query = query.eq('organization_id', organisme);
  if (programme) query = query.eq('program_id', programme);
  const [{ data: groups }, { data: trainers }, { data: organizations }, { data: programs }] = await Promise.all([
    query,
    supabase.from('profiles').select('id, first_name, last_name').in('role', ['formateur', 'admin']).eq('status', 'active').order('last_name'),
    supabase.from('organizations').select('id, name').order('name'),
    supabase.from('programs').select('id, name').order('name'),
  ]);
  const trainerName = new Map((trainers ?? []).map((t) => [t.id, `${t.first_name} ${t.last_name}`]));
  return (
    <>
      <PageHeader title="Groupes" description="Tous les groupes. Attribuez ou retirez les formateurs ; ouvrez un groupe pour le gérer." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <FilterSelect param="organisme" label="Filtrer par organisme" allLabel="Tous les organismes" options={(organizations ?? []).map((o) => ({ value: o.id, label: o.name }))} />
        <FilterSelect param="programme" label="Filtrer par programme" allLabel="Tous les programmes" options={(programs ?? []).map((p) => ({ value: p.id, label: p.name }))} />
      </div>
      <Card>
        {(groups ?? []).length > 0 ? (
          <TableWrap>
            <Table>
              <thead><tr><Th>Groupe</Th><Th>Organisme</Th><Th className="text-right">Participants</Th><Th>Formateurs</Th><Th>Statut</Th></tr></thead>
              <tbody>
                {groups!.map((group) => {
                  const status = GROUP_STATUS[group.status] ?? GROUP_STATUS.active!;
                  return (
                    <Tr key={group.id}>
                      <Td>
                        <Link href={`/formateur/groupes/${group.id}`} className="font-semibold hover:text-petrol-700 hover:underline">{group.name}</Link>
                        {group.is_demo ? <Badge variant="outline" className="ml-2">Démo</Badge> : null}
                        <span className="block text-sm text-ink-subtle">{group.programs?.name} · {formatDate(group.start_date, 'dates à définir')}</span>
                      </Td>
                      <Td className="text-sm text-ink-muted">{group.organizations?.name ?? '—'}</Td>
                      <Td className="text-right tabular-nums">{group.group_members.filter((m) => m.status === 'active').length}</Td>
                      <Td>
                        <TrainerAssignment
                          groupId={group.id}
                          assigned={group.group_trainers.map((t) => ({ id: t.trainer_id, name: trainerName.get(t.trainer_id) ?? 'Formateur', lead: t.is_lead }))}
                          trainers={(trainers ?? []).map((t) => ({ id: t.id, name: `${t.first_name} ${t.last_name}` }))}
                        />
                      </Td>
                      <Td><Badge variant={status.variant}>{status.label}</Badge></Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState title="Aucun groupe" />
        )}
      </Card>
    </>
  );
}
