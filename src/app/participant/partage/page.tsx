import { Link2 } from 'lucide-react';
import type { Metadata } from 'next';

import { Badge, Card, CardBody, CardHeader, EmptyState, Notice, PageHeader, Table, TableWrap, Td, Th, Tr, type BadgeVariant } from '@/components/ui/primitives';
import { MAX_ACTIVE_SHARES, SHARE_STATUS_LABELS, countActive, shareStatus, type ShareStatus } from '@/lib/passport-share/rules';
import { formatDate, formatDateTime } from '@/lib/utils';

import { getMyPassport } from '../data';

import { RevokeShareButton, ShareForm, ShowShareButton } from './share-client';

export const metadata: Metadata = { title: 'Partager mon passeport' };

const STATUS_VARIANT: Record<ShareStatus, BadgeVariant> = { active: 'success', expired: 'warning', revoked: 'neutral' };

export default async function PartagePage() {
  const { passport, supabase } = await getMyPassport();
  const [{ data: rows }, { count: finalReports }] = await Promise.all([
    supabase
      .from('passport_shares')
      .select('id, label, duration_days, include_sociocognitive, include_report, created_at, expires_at, revoked_at, revoked_reason, view_count, last_viewed_at')
      .eq('participant_id', passport.participant.id)
      .order('created_at', { ascending: false }),
    supabase.from('participant_reports').select('id', { count: 'exact', head: true }).eq('participant_id', passport.participant.id).eq('status', 'final'),
  ]);
  const now = new Date();
  const shares = (rows ?? []).map((row) => ({ ...row, status: shareStatus({ revokedAt: row.revoked_at, expiresAt: row.expires_at }, now) }));
  const active = countActive(shares.map((row) => ({ revokedAt: row.revoked_at, expiresAt: row.expires_at })), now);
  const hasSociocognitive = passport.frameworks.some((framework) => framework.code === 'sociocognitive');

  return (
    <>
      <PageHeader
        title="Partager mon passeport"
        description="Créez un lien, ou un QR code, pour montrer vos compétences observées à un employeur ou à un organisme. C’est vous qui décidez : vous pouvez révoquer un lien à tout moment."
      />
      <Notice className="mb-6" title="Ce que la personne verra">
        Votre prénom et l’initiale de votre nom, le programme et ses dates, les compétences observées par vos formateurs avec leur niveau validé, et le nombre de
        séances d’observation. Jamais : vos coordonnées, votre organisme, les commentaires des formateurs, le détail de vos présences ni votre auto-évaluation.
        Les niveaux affichés sont ceux du jour de la consultation.
      </Notice>

      <Card className="mb-6">
        <CardHeader title="Créer un lien" description={`${active} lien${active > 1 ? 's' : ''} actif${active > 1 ? 's' : ''} sur ${MAX_ACTIVE_SHARES} possibles.`} />
        <CardBody>
          <ShareForm hasFinalReport={(finalReports ?? 0) > 0} hasSociocognitive={hasSociocognitive} limitReached={active >= MAX_ACTIVE_SHARES} participantId={passport.participant.id} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Mes liens" />
        {shares.length > 0 ? (
          <TableWrap label="Mes liens de partage">
            <Table>
              <thead>
                <tr>
                  <Th>Pour</Th>
                  <Th>Contenu</Th>
                  <Th>Validité</Th>
                  <Th>Statut</Th>
                  <Th>Consultations</Th>
                  <Th><span className="sr-only">Actions</span></Th>
                </tr>
              </thead>
              <tbody>
                {shares.map((share) => (
                  <Tr key={share.id}>
                    <Td className="font-semibold">{share.label}</Td>
                    <Td className="text-sm text-ink-muted">
                      Compétences transversales
                      {share.include_sociocognitive ? <span className="block">Habiletés socio-cognitives</span> : null}
                      {share.include_report ? <span className="block">Bilan validé</span> : null}
                    </Td>
                    <Td className="text-sm whitespace-nowrap text-ink-muted">
                      Créé le {formatDate(share.created_at)}
                      <span className="block">
                        {share.status === 'revoked' ? `Révoqué le ${formatDate(share.revoked_at)}` : `${share.status === 'expired' ? 'Expiré' : 'Expire'} le ${formatDate(share.expires_at)}`}
                      </span>
                    </Td>
                    <Td>
                      <Badge variant={STATUS_VARIANT[share.status]}>{SHARE_STATUS_LABELS[share.status]}</Badge>
                      {share.revoked_reason === 'moderation' ? <span className="mt-1 block text-xs text-ink-subtle">par l’équipe HAPPI</span> : null}
                    </Td>
                    <Td className="text-sm text-ink-muted">
                      {share.view_count}
                      {share.last_viewed_at ? <span className="block">Dernière : {formatDateTime(share.last_viewed_at)}</span> : null}
                    </Td>
                    <Td className="text-right">
                      {share.status === 'active' ? (
                        <span className="flex flex-wrap justify-end gap-1.5">
                          <ShowShareButton shareId={share.id} label={share.label} participantId={passport.participant.id} />
                          <RevokeShareButton shareId={share.id} label={share.label} />
                        </span>
                      ) : null}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={Link2} title="Aucun lien pour le moment" description="Créez un premier lien ci-dessus : il ne sera visible que des personnes à qui vous le transmettez." />
        )}
      </Card>
    </>
  );
}
