import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CancelReferralDialog } from '@/components/referrals/cancel-form';
import { DefinitionList, ReferralStatusBadge, ReferralTimeline } from '@/components/referrals/display';
import { Card, CardBody, CardHeader, Notice, PageHeader } from '@/components/ui/primitives';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { formatParisDateTime } from '@/lib/referrals/dates';
import { AGE_BANDS, DAYS, labelsOf, PRACTICAL_CONSTRAINTS, SLOTS } from '@/lib/referrals/fields';
import { allowedTargets, isReferralStatus, REFERRAL_STATUS } from '@/lib/referrals/status';
import { createClient } from '@/lib/supabase/server';
import { formatDate, isUuid } from '@/lib/utils';

import { cancelReferral } from '../actions';

export const metadata: Metadata = { title: 'Orientation' };

export default async function OrganizationReferralPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ envoyee?: string }> }) {
  const { id } = await params;
  const { envoyee } = await searchParams;
  if (!isUuid(id)) notFound();
  const user = await requireRole('organisme');
  if (!hasPermission(user, 'org.referrals.write')) notFound();
  const supabase = await createClient();
  const { data: referral } = await supabase
    .from('referrals')
    .select('*, programs ( name ), groups ( name, start_date )')
    .eq('id', id)
    .maybeSingle();
  if (!referral) notFound();
  const { data: events } = await supabase
    .from('referral_events')
    .select('id, kind, from_status, to_status, consent_kind, consent_value, source, reason, created_at')
    .eq('referral_id', id)
    .order('id');
  const status = isReferralStatus(referral.status) ? referral.status : 'sent';
  const canCancel = allowedTargets(status, 'prescriber').includes('cancelled');
  const yesNo = (value: boolean) => (value ? 'Oui' : 'Non');

  return (
    <>
      <PageHeader
        back={
          <Link href="/organisme/orientations" className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden />
            Mes orientations
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {referral.first_name} {referral.last_name}
            <ReferralStatusBadge status={referral.status} />
          </span>
        }
        description={`Orientation envoyée le ${formatDate(referral.created_at)}. ${REFERRAL_STATUS[status].description}`}
        actions={canCancel ? <CancelReferralDialog action={cancelReferral.bind(null, referral.id)} /> : null}
      />
      <div className="space-y-6">
        {envoyee ? (
          <Notice variant="success" title="Orientation envoyée">
            L’équipe HAPPI va l’étudier. Vous recevrez une notification et un e-mail à chaque étape.
          </Notice>
        ) : null}
        {referral.possible_duplicate && !['accepted', 'refused', 'cancelled'].includes(status) ? (
          <Notice variant="info" title="Une fiche existe peut-être déjà">
            L’équipe HAPPI vérifiera et rapprochera les informations si besoin. Vous n’avez rien à faire.
          </Notice>
        ) : null}
        {status === 'refused' || status === 'cancelled' ? (
          <Notice variant={status === 'refused' ? 'warning' : 'info'} title={status === 'refused' ? 'Motif du refus' : 'Motif de l’annulation'}>
            {referral.status_reason}
          </Notice>
        ) : null}
        {status === 'interview_scheduled' && referral.interview_at ? (
          <Notice title="Entretien planifié">{formatParisDateTime(referral.interview_at)}</Notice>
        ) : null}
        {status === 'accepted' ? (
          <Notice variant="success" title="Personne inscrite dans un groupe">
            {referral.groups?.name ? `Groupe « ${referral.groups.name} »${referral.groups.start_date ? `, à partir du ${formatDate(referral.groups.start_date)}` : ''}. ` : ''}
            {referral.consent_share_results
              ? 'Vous pourrez suivre ses présences et ses résultats depuis « Participants ».'
              : 'La personne n’a pas accepté le partage de ses résultats : vous voyez seulement l’état de l’orientation.'}
          </Notice>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader title="Fiche d’orientation" description="Données transmises à l’équipe HAPPI. Une fiche envoyée n’est plus modifiable." />
            <CardBody>
              <DefinitionList
                rows={[
                  ['Adresse e-mail', referral.email],
                  ['Téléphone', referral.phone ?? '—'],
                  ['Tranche d’âge', referral.age_band ? (AGE_BANDS[referral.age_band as keyof typeof AGE_BANDS] ?? '—') : 'Non précisée'],
                  ['Motif', <span key="reason" className="whitespace-pre-line">{referral.reason}</span>],
                  ['Objectifs', <span key="objectives" className="whitespace-pre-line">{referral.objectives ?? '—'}</span>],
                  ['Programme souhaité', referral.programs?.name ?? 'À définir'],
                  ['Démarrage souhaité', referral.desired_start_date ? `À partir du ${formatDate(referral.desired_start_date)}` : '—'],
                  ['Jours possibles', labelsOf(referral.availability_days, DAYS).join(', ') || '—'],
                  ['Créneaux', labelsOf(referral.availability_slots, SLOTS).join(', ') || '—'],
                  ['Contraintes', [...labelsOf(referral.practical_constraints, PRACTICAL_CONSTRAINTS), referral.constraints_details].filter(Boolean).join(' · ') || '—'],
                  ['Besoin d’adaptation', yesNo(referral.needs_accommodation)],
                ]}
              />
            </CardBody>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader title="Consentements" />
              <CardBody>
                <DefinitionList
                  rows={[
                    ['Information donnée', `Oui, le ${formatParisDateTime(referral.information_acknowledged_at)}`],
                    ['Droit à l’image', yesNo(referral.consent_image)],
                    ['Partage des résultats', yesNo(referral.consent_share_results)],
                    ['Confirmés par la personne', referral.participant_confirmed_at ? formatParisDateTime(referral.participant_confirmed_at) : 'Pas encore (à la création de son compte)'],
                  ]}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Historique" />
              <CardBody>
                <ReferralTimeline events={events ?? []} />
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
