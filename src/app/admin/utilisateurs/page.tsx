import type { Metadata } from 'next';

import { FilterSelect, Pagination, SearchInput } from '@/components/ui/navigation';
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { ROLE_LABELS } from '@/lib/auth/roles';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

import { PermissionToggle, RoleSelect, UserStatusButton } from '../admin-client';

export const metadata: Metadata = { title: 'Utilisateurs' };
const PAGE_SIZE = 25;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; page?: string }> }) {
  const { q = '', role, page = '1' } = await searchParams;
  const me = await requireRole('admin');
  const supabase = await createClient();
  const pageNumber = Math.max(1, Number(page) || 1);
  let query = supabase.from('profiles').select('id, first_name, last_name, email, role, status, is_demo, created_at', { count: 'exact' }).order('created_at', { ascending: false });
  if (role) query = query.eq('role', role);
  const term = q.trim().replace(/[%_,()]/g, ' ');
  if (term) query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`);
  const [{ data: users, count }, { data: permissions }, { data: grants }] = await Promise.all([
    query.range((pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE - 1),
    supabase.from('permissions').select('code, label, description, applicable_roles').order('position'),
    supabase.from('role_permissions').select('role_code, permission_code'),
  ]);
  const granted = new Set((grants ?? []).map((g) => `${g.role_code}:${g.permission_code}`));

  return (
    <>
      <PageHeader title="Utilisateurs" description="Tous les comptes de la plateforme, leurs rôles et leur statut." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput placeholder="Nom ou adresse e-mail" />
        <FilterSelect param="role" label="Filtrer par rôle" allLabel="Tous les rôles" options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))} />
      </div>
      <Card>
        {(users ?? []).length > 0 ? (
          <TableWrap>
            <Table>
              <thead><tr><Th>Compte</Th><Th>Rôle</Th><Th>Créé le</Th><Th>Statut</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
              <tbody>
                {users!.map((user) => {
                  const name = `${user.first_name} ${user.last_name}`.trim() || user.email;
                  const self = user.id === me.id;
                  return (
                    <Tr key={user.id}>
                      <Td>
                        <span className="font-semibold">{name}</span>
                        {user.is_demo ? <Badge variant="outline" className="ml-2">Démo</Badge> : null}
                        <span className="block text-sm text-ink-subtle">{user.email}</span>
                      </Td>
                      <Td><RoleSelect userId={user.id} role={user.role} disabled={self} /></Td>
                      <Td className="text-sm whitespace-nowrap text-ink-muted">{formatDate(user.created_at)}</Td>
                      <Td>{user.status === 'active' ? <Badge variant="success">Actif</Badge> : <Badge variant="danger">Désactivé</Badge>}</Td>
                      <Td className="text-right"><UserStatusButton userId={user.id} status={user.status} name={name} disabled={self} /></Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState title="Aucun compte ne correspond" />
        )}
        <Pagination page={pageNumber} pageCount={Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))} total={count ?? 0} label="comptes" />
      </Card>

      <Card className="mt-6">
        <CardHeader title="Rôles et permissions" description="Les permissions fines de chaque rôle. L’administrateur dispose de toutes les permissions." />
        <CardBody className="px-0 sm:px-0">
          <TableWrap>
            <Table>
              <thead><tr><Th>Permission</Th><Th className="text-center">Formateur</Th><Th className="text-center">Organisme</Th></tr></thead>
              <tbody>
                {(permissions ?? []).map((permission) => (
                  <Tr key={permission.code}>
                    <Td>
                      <span className="font-medium">{permission.label}</span>
                      {permission.description ? <span className="block text-sm text-ink-subtle">{permission.description}</span> : null}
                    </Td>
                    {(['formateur', 'organisme'] as const).map((roleCode) => (
                      <Td key={roleCode} className="text-center">
                        {permission.applicable_roles.includes(roleCode) ? (
                          <PermissionToggle role={roleCode} permission={permission.code} enabled={granted.has(`${roleCode}:${permission.code}`)} label={`${permission.label} pour le rôle ${ROLE_LABELS[roleCode]}`} />
                        ) : (
                          <span className="text-ink-subtle" aria-label="Non applicable">—</span>
                        )}
                      </Td>
                    ))}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </CardBody>
      </Card>
    </>
  );
}
