import type { Metadata } from 'next';

import { FilterSelect, Pagination } from '@/components/ui/navigation';
import { Card, EmptyState, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { ROLE_LABELS, type Role } from '@/lib/auth/roles';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Journal d’activité' };
const PAGE_SIZE = 50;
const FAMILIES = [
  { value: 'auth', label: 'Connexions et comptes' },
  { value: 'evaluation', label: 'Évaluations' },
  { value: 'attendance', label: 'Présences' },
  { value: 'participant', label: 'Participants' },
  { value: 'group', label: 'Groupes' },
  { value: 'session', label: 'Sessions' },
  { value: 'organization', label: 'Organismes' },
  { value: 'invitation_code', label: 'Codes d’accès' },
  { value: 'framework', label: 'Référentiels' },
  { value: 'content', label: 'Supports pédagogiques' },
  { value: 'export', label: 'Exports' },
  { value: 'data_request', label: 'Demandes RGPD' },
];

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ type?: string; page?: string }> }) {
  const { type, page = '1' } = await searchParams;
  await requireRole('admin');
  const supabase = await createClient();
  const pageNumber = Math.max(1, Number(page) || 1);
  let query = supabase.from('audit_logs').select('*', { count: 'exact' }).order('occurred_at', { ascending: false });
  if (type && FAMILIES.some((f) => f.value === type)) query = query.like('action', `${type}%`);
  const [{ data: logs, count }, { data: people }] = await Promise.all([
    query.range((pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE - 1),
    supabase.from('profiles').select('id, first_name, last_name, email'),
  ]);
  const who = new Map((people ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`.trim() || p.email]));
  return (
    <>
      <PageHeader title="Journal d’activité" description="Actions sensibles enregistrées par la base de données. Le journal est en ajout seul : il ne peut être ni modifié ni effacé." />
      <div className="mb-4"><FilterSelect param="type" label="Filtrer par type d’action" allLabel="Toutes les actions" options={FAMILIES} /></div>
      <Card>
        {(logs ?? []).length ? (
          <TableWrap>
            <Table>
              <thead><tr><Th>Date</Th><Th>Auteur</Th><Th>Action</Th><Th>Objet</Th><Th>Détails</Th></tr></thead>
              <tbody>
                {logs!.map((log) => (
                  <Tr key={log.id}>
                    <Td className="text-sm whitespace-nowrap">{formatDateTime(log.occurred_at)}</Td>
                    <Td className="text-sm">{log.actor_id ? who.get(log.actor_id) ?? 'Compte supprimé' : 'Système'}<span className="block text-xs text-ink-subtle">{ROLE_LABELS[log.actor_role as Role] ?? log.actor_role}</span></Td>
                    <Td className="font-mono text-xs">{log.action}</Td>
                    <Td className="text-xs text-ink-muted">{log.entity_type ? `${log.entity_type} ${log.entity_id?.slice(0, 8) ?? ''}` : '—'}</Td>
                    <Td className="max-w-xs truncate font-mono text-xs text-ink-muted" title={JSON.stringify(log.metadata)}>{Object.keys((log.metadata as object) ?? {}).length ? JSON.stringify(log.metadata) : ''}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : <EmptyState title="Aucune entrée" />}
        <Pagination page={pageNumber} pageCount={Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))} total={count ?? 0} label="entrées" />
      </Card>
    </>
  );
}
