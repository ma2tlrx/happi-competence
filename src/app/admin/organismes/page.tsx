import type { Metadata } from 'next';

import { FilterSelect, SearchInput } from '@/components/ui/navigation';
import { Badge, Card, EmptyState, PageHeader, Table, TableWrap, Td, Th, Tr, type BadgeVariant } from '@/components/ui/primitives';
import { ORGANIZATION_STATUS_LABELS, ORGANIZATION_TYPES, type OrganizationType } from '@/lib/auth/roles';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDate, normalizeText } from '@/lib/utils';

import { OrganizationDialog, OrganizationStatusActions } from '../admin-client';

export const metadata: Metadata = { title: 'Organismes' };
const STATUS_VARIANT: Record<string, BadgeVariant> = { pending: 'warning', active: 'success', suspended: 'danger', rejected: 'neutral' };

export default async function AdminOrganizationsPage({ searchParams }: { searchParams: Promise<{ q?: string; statut?: string }> }) {
  const { q = '', statut } = await searchParams;
  await requireRole('admin');
  const supabase = await createClient();
  const [{ data: organizations }, { data: participants }, { data: members }] = await Promise.all([
    supabase.from('organizations').select('*').order('created_at', { ascending: false }),
    supabase.from('participants').select('organization_id'),
    supabase.from('organization_members').select('organization_id, profiles ( first_name, last_name, email )'),
  ]);
  const term = normalizeText(q);
  const rows = (organizations ?? []).filter((o) => (!statut || o.status === statut) && (!term || normalizeText(`${o.name} ${o.city ?? ''}`).includes(term)));

  return (
    <>
      <PageHeader title="Organismes" description="Validez les demandes, suspendez un accès, créez une structure partenaire." actions={<OrganizationDialog />} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput placeholder="Nom ou ville" />
        <FilterSelect param="statut" label="Filtrer par statut" allLabel="Tous les statuts" options={Object.entries(ORGANIZATION_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
      </div>
      <Card>
        {rows.length > 0 ? (
          <TableWrap>
            <Table>
              <thead><tr><Th>Organisme</Th><Th>Membres</Th><Th className="text-right">Participants</Th><Th>Statut</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
              <tbody>
                {rows.map((organization) => (
                  <Tr key={organization.id}>
                    <Td>
                      <span className="font-semibold">{organization.name}</span>
                      {organization.is_demo ? <Badge variant="outline" className="ml-2">Démo</Badge> : null}
                      <span className="block text-sm text-ink-subtle">
                        {ORGANIZATION_TYPES[organization.type as OrganizationType]}{organization.city ? ` · ${organization.city}` : ''}{organization.siret ? ` · SIRET ${organization.siret}` : ''} · créé le {formatDate(organization.created_at)}
                      </span>
                    </Td>
                    <Td className="text-sm text-ink-muted">
                      {(members ?? []).filter((m) => m.organization_id === organization.id).map((m) => m.profiles ? `${m.profiles.first_name} ${m.profiles.last_name} (${m.profiles.email})` : '').join(', ') || '—'}
                    </Td>
                    <Td className="text-right tabular-nums">{(participants ?? []).filter((p) => p.organization_id === organization.id).length}</Td>
                    <Td>
                      <Badge variant={STATUS_VARIANT[organization.status] ?? 'neutral'}>{ORGANIZATION_STATUS_LABELS[organization.status as keyof typeof ORGANIZATION_STATUS_LABELS]}</Badge>
                      {organization.status_reason ? <span className="mt-1 block text-xs text-ink-subtle">{organization.status_reason}</span> : null}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <OrganizationStatusActions id={organization.id} status={organization.status} name={organization.name} />
                        <OrganizationDialog organization={organization} />
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState title="Aucun organisme" />
        )}
      </Card>
    </>
  );
}
