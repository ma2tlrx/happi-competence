import type { Metadata } from 'next';

import { Badge, Card, CardBody, CardHeader, EmptyState, Notice, PageHeader, Table, TableWrap, Td, Th, Tr, type BadgeVariant } from '@/components/ui/primitives';
import { ROLE_LABELS, type Role } from '@/lib/auth/roles';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatDateTime } from '@/lib/utils';

import { AccessCodeForm, RevokeCodeButton } from '../admin-client';

export const metadata: Metadata = { title: 'Codes d’accès' };

function statusOf(code: { used_at: string | null; revoked_at: string | null; expires_at: string | null }): { label: string; variant: BadgeVariant; available: boolean } {
  if (code.revoked_at) return { label: 'Révoqué', variant: 'neutral', available: false };
  if (code.used_at) return { label: 'Utilisé', variant: 'petrol', available: false };
  if (code.expires_at && new Date(code.expires_at) < new Date()) return { label: 'Expiré', variant: 'warning', available: false };
  return { label: 'Disponible', variant: 'success', available: true };
}

export default async function AccessCodesPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const [{ data: codes }, { data: organizations }, { data: staff }] = await Promise.all([
    supabase.from('invitation_codes').select('id, code_hint, role, organization_id, label, expires_at, created_at, created_by, used_at, used_by, revoked_at, organizations ( name )').order('created_at', { ascending: false }),
    supabase.from('organizations').select('id, name').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id, first_name, last_name, email'),
  ]);
  const who = new Map((staff ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`.trim() || p.email]));
  return (
    <>
      <PageHeader title="Codes d’accès" description="Codes à usage unique pour créer les comptes formateur, administrateur ou membre d’un organisme." />
      <Card className="mb-6">
        <CardHeader title="Générer un code" />
        <CardBody>
          <AccessCodeForm organizations={organizations ?? []} />
        </CardBody>
      </Card>
      <Notice className="mb-6" title="Sécurité">
        Les codes ne sont jamais stockés en clair : seule une empreinte SHA-256 est conservée et vérifiée côté serveur. Transmettez chaque code par un canal sûr ; la personne l’utilise sur la page « Activer un accès professionnel ».
      </Notice>
      <Card>
        {(codes ?? []).length > 0 ? (
          <TableWrap>
            <Table>
              <thead><tr><Th>Code</Th><Th>Rôle</Th><Th>Créé</Th><Th>Expiration</Th><Th>Statut</Th><Th>Utilisation</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
              <tbody>
                {codes!.map((code) => {
                  const status = statusOf(code);
                  return (
                    <Tr key={code.id}>
                      <Td>
                        <span className="font-mono text-sm">HAPPI-…{code.code_hint}</span>
                        {code.label ? <span className="block text-sm text-ink-subtle">{code.label}</span> : null}
                      </Td>
                      <Td className="text-sm">{ROLE_LABELS[code.role as Role]}{code.organizations ? <span className="block text-ink-subtle">{code.organizations.name}</span> : null}</Td>
                      <Td className="text-sm text-ink-muted">{formatDate(code.created_at)}{code.created_by ? <span className="block">{who.get(code.created_by)}</span> : null}</Td>
                      <Td className="text-sm text-ink-muted">{formatDate(code.expires_at, 'Sans expiration')}</Td>
                      <Td><Badge variant={status.variant}>{status.label}</Badge></Td>
                      <Td className="text-sm text-ink-muted">{code.used_at ? `${formatDateTime(code.used_at)}${code.used_by ? ` · ${who.get(code.used_by) ?? ''}` : ''}` : code.revoked_at ? `Révoqué le ${formatDate(code.revoked_at)}` : '—'}</Td>
                      <Td className="text-right">{status.available ? <RevokeCodeButton id={code.id} /> : null}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState title="Aucun code généré" />
        )}
      </Card>
    </>
  );
}
