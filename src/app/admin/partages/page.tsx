import type { Metadata } from 'next';

import { Badge, Card, EmptyState, Notice, PageHeader, StatTile, Table, TableWrap, Td, Th, Tr, type BadgeVariant } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { SHARE_STATUS_LABELS, shareStatus, type ShareStatus } from '@/lib/passport-share/rules';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatDateTime } from '@/lib/utils';

import { RevokePassportShareButton } from '../admin-client';

export const metadata: Metadata = { title: 'Liens de partage' };

const STATUS_VARIANT: Record<ShareStatus, BadgeVariant> = { active: 'success', expired: 'warning', revoked: 'neutral' };

/**
 * Modération des liens de partage du passeport. L'administrateur voit qui partage,
 * combien de liens et leur usage ; il ne voit ni les jetons ni le libellé personnel du participant.
 */
export default async function AdminSharesPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const { data } = await supabase
    .from('passport_shares')
    .select('id, participant_id, created_at, expires_at, revoked_at, revoked_reason, view_count, last_viewed_at, include_sociocognitive, include_report, participants ( first_name, last_name )')
    .order('created_at', { ascending: false })
    .limit(300);
  const now = new Date();
  const shares = (data ?? []).map((row) => ({ ...row, status: shareStatus({ revokedAt: row.revoked_at, expiresAt: row.expires_at }, now) }));
  const count = (status: ShareStatus) => shares.filter((share) => share.status === status).length;
  const participants = new Set(shares.filter((share) => share.status === 'active').map((share) => share.participant_id)).size;

  return (
    <>
      <PageHeader title="Liens de partage" description="Passeports partagés par les participants avec un employeur ou un organisme (300 liens les plus récents)." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Liens actifs" value={count('active')} />
        <StatTile label="Participants qui partagent" value={participants} />
        <StatTile label="Liens expirés" value={count('expired')} />
        <StatTile label="Liens révoqués" value={count('revoked')} />
      </div>
      <Notice className="mb-6" title="Modération">
        Les jetons ne sont jamais affichés ni stockés en clair. Révoquer un lien le rend immédiatement inutilisable ; le participant en est informé dans son espace.
      </Notice>
      <Card>
        {shares.length > 0 ? (
          <TableWrap label="Liens de partage">
            <Table>
              <thead>
                <tr><Th>Participant</Th><Th>Contenu</Th><Th>Validité</Th><Th>Statut</Th><Th>Consultations</Th><Th><span className="sr-only">Actions</span></Th></tr>
              </thead>
              <tbody>
                {shares.map((share) => (
                  <Tr key={share.id}>
                    <Td className="font-semibold">{share.participants ? `${share.participants.last_name.toUpperCase()} ${share.participants.first_name}` : '—'}</Td>
                    <Td className="text-sm text-ink-muted">
                      Compétences transversales
                      {share.include_sociocognitive ? <span className="block">Habiletés socio-cognitives</span> : null}
                      {share.include_report ? <span className="block">Bilan validé</span> : null}
                    </Td>
                    <Td className="text-sm whitespace-nowrap text-ink-muted">
                      Créé le {formatDate(share.created_at)}
                      <span className="block">Expire le {formatDate(share.expires_at)}</span>
                    </Td>
                    <Td>
                      <Badge variant={STATUS_VARIANT[share.status]}>{SHARE_STATUS_LABELS[share.status]}</Badge>
                      {share.revoked_reason ? <span className="mt-1 block text-xs text-ink-subtle">{share.revoked_reason === 'moderation' ? 'par modération' : 'par le participant'}</span> : null}
                    </Td>
                    <Td className="text-sm text-ink-muted">
                      {share.view_count}
                      {share.last_viewed_at ? <span className="block">Dernière : {formatDateTime(share.last_viewed_at)}</span> : null}
                    </Td>
                    <Td className="text-right">{share.status === 'active' ? <RevokePassportShareButton id={share.id} /> : null}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState title="Aucun lien de partage" />
        )}
      </Card>
    </>
  );
}
