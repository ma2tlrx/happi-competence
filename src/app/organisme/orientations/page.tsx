import { Send, UserPlus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ReferralStatusBadge } from '@/components/referrals/display';
import { buttonClasses } from '@/components/ui/button';
import { FilterSelect } from '@/components/ui/navigation';
import { Card, EmptyState, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { isReferralStatus, REFERRAL_STATUS, REFERRAL_STATUSES } from '@/lib/referrals/status';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Mes orientations' };

export default async function OrganizationReferralsPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const { statut } = await searchParams;
  const user = await requireRole('organisme');
  const canRefer = hasPermission(user, 'org.referrals.write');
  const supabase = await createClient();
  let query = supabase
    .from('referrals')
    .select('id, first_name, last_name, status, created_at, status_changed_at, possible_duplicate, referent_id, programs ( name )')
    .order('created_at', { ascending: false })
    .limit(300);
  if (isReferralStatus(statut)) query = query.eq('status', statut);
  const { data: referrals } = canRefer ? await query : { data: [] };

  return (
    <>
      <PageHeader
        title="Mes orientations"
        description="Les personnes que votre structure a orientées vers HAPPI et l’avancement de chaque orientation."
        actions={
          canRefer ? (
            <Link href="/organisme/orientations/nouvelle" className={buttonClasses()}>
              <UserPlus aria-hidden />
              Orienter une personne
            </Link>
          ) : null
        }
      />
      {canRefer ? (
        <>
          <div className="mb-4">
            <FilterSelect param="statut" label="Filtrer par statut" allLabel="Tous les statuts" options={REFERRAL_STATUSES.map((value) => ({ value, label: REFERRAL_STATUS[value].label }))} />
          </div>
          <Card>
            {(referrals ?? []).length > 0 ? (
              <TableWrap label="Orientations">
                <Table>
                  <thead>
                    <tr>
                      <Th>Personne</Th>
                      <Th>Programme</Th>
                      <Th>Envoyée le</Th>
                      <Th>Statut</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals!.map((referral) => (
                      <Tr key={referral.id}>
                        <Td>
                          <Link href={`/organisme/orientations/${referral.id}`} className="font-semibold hover:text-petrol-700 hover:underline">
                            {referral.first_name} {referral.last_name}
                          </Link>
                          {referral.referent_id === user.id ? <span className="block text-sm text-ink-subtle">Vous êtes référent(e)</span> : null}
                        </Td>
                        <Td className="text-sm text-ink-muted">{referral.programs?.name ?? 'À définir'}</Td>
                        <Td className="text-sm whitespace-nowrap">{formatDate(referral.created_at)}</Td>
                        <Td>
                          <ReferralStatusBadge status={referral.status} />
                          <span className="block text-xs text-ink-subtle">depuis le {formatDate(referral.status_changed_at)}</span>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            ) : (
              <EmptyState
                icon={Send}
                title={statut ? 'Aucune orientation avec ce statut' : 'Aucune orientation pour le moment'}
                description="Orientez une personne en quelques minutes : l’équipe HAPPI vous tient informé(e) à chaque étape."
              />
            )}
          </Card>
        </>
      ) : (
        <Card>
          <EmptyState title="Accès non ouvert" description="Votre compte ne permet pas d’orienter des personnes. Contactez l’équipe HAPPI." />
        </Card>
      )}
    </>
  );
}
