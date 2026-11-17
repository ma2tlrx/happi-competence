import { ArrowLeft, Inbox } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { FilterSelect } from '@/components/ui/navigation';
import { Badge, Card, CardBody, CardHeader, EmptyState, Notice, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { hasPermission, type CurrentUser } from '@/lib/auth/session';
import { compatibility } from '@/lib/referrals/compatibility';
import { formatParisDateTime } from '@/lib/referrals/dates';
import { AGE_BANDS, DAYS, labelsOf, PRACTICAL_CONSTRAINTS, SLOTS } from '@/lib/referrals/fields';
import { allowedTargets, isReferralStatus, OPEN_STATUSES, REFERRAL_STATUS, REFERRAL_STATUSES } from '@/lib/referrals/status';
import { createClient } from '@/lib/supabase/server';
import { formatDate, isUuid } from '@/lib/utils';

import { DefinitionList, ReferralStatusBadge, ReferralTimeline } from './display';
import { AssignForm, StatusForm, type GroupChoice } from './staff-actions';

type Filters = { statut?: string; programme?: string; organisme?: string; tri?: string };

const SORTS = [
  { value: 'ancien', label: 'Plus anciennes d’abord' },
  { value: 'programme', label: 'Par programme' },
  { value: 'demarrage', label: 'Par date de démarrage souhaitée' },
];

function NotAllowed() {
  return (
    <Card>
      <EmptyState title="Accès non ouvert" description="Le traitement des orientations n’est pas activé pour votre compte. Contactez un administrateur." />
    </Card>
  );
}

/** File des orientations (administrateur et formateurs habilités). */
export async function ReferralQueue({ user, basePath, filters }: { user: CurrentUser; basePath: string; filters: Filters }) {
  const header = <PageHeader title="Orientations" description="Personnes orientées par les prescripteurs. Traitez-les dans l’ordre d’arrivée et affectez-les à un groupe." />;
  if (!hasPermission(user, 'referrals.manage')) return <>{header}<NotAllowed /></>;
  const supabase = await createClient();
  let query = supabase
    .from('referrals')
    .select('id, first_name, last_name, email, status, created_at, desired_start_date, possible_duplicate, needs_accommodation, program_id, organization_id, programs ( name ), organizations ( name )')
    .limit(500);
  if (filters.statut === 'toutes') {
    // Aucun filtre.
  } else if (isReferralStatus(filters.statut)) query = query.eq('status', filters.statut);
  else query = query.in('status', [...OPEN_STATUSES]);
  if (isUuid(filters.programme)) query = query.eq('program_id', filters.programme);
  if (isUuid(filters.organisme)) query = query.eq('organization_id', filters.organisme);
  if (filters.tri === 'demarrage') query = query.order('desired_start_date', { ascending: true, nullsFirst: false }).order('created_at');
  else query = query.order('created_at', { ascending: filters.tri === 'ancien' || filters.tri === 'programme' });

  const [{ data: referrals }, { data: programs }, { data: organizations }] = await Promise.all([
    query,
    supabase.from('programs').select('id, name').order('name'),
    supabase.from('organizations').select('id, name').eq('status', 'active').order('name'),
  ]);
  let rows = referrals ?? [];
  if (filters.tri === 'programme') rows = [...rows].sort((a, b) => (a.programs?.name ?? '~').localeCompare(b.programs?.name ?? '~', 'fr'));

  return (
    <>
      {header}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <FilterSelect
          param="statut"
          label="Filtrer par statut"
          allLabel="À traiter (ouvertes)"
          options={[{ value: 'toutes', label: 'Toutes' }, ...REFERRAL_STATUSES.map((value) => ({ value, label: REFERRAL_STATUS[value].label }))]}
        />
        <FilterSelect param="programme" label="Filtrer par programme" allLabel="Tous les programmes" options={(programs ?? []).map((p) => ({ value: p.id, label: p.name }))} />
        <FilterSelect param="organisme" label="Filtrer par prescripteur" allLabel="Tous les prescripteurs" options={(organizations ?? []).map((o) => ({ value: o.id, label: o.name }))} />
        <FilterSelect param="tri" label="Trier" allLabel="Plus récentes d’abord" options={SORTS} />
      </div>
      <Card>
        {rows.length > 0 ? (
          <TableWrap label="File des orientations">
            <Table>
              <thead>
                <tr>
                  <Th>Personne</Th>
                  <Th>Prescripteur</Th>
                  <Th>Programme</Th>
                  <Th>Reçue le</Th>
                  <Th>Démarrage souhaité</Th>
                  <Th>Statut</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((referral) => (
                  <Tr key={referral.id}>
                    <Td>
                      <Link href={`${basePath}/${referral.id}`} className="font-semibold hover:text-petrol-700 hover:underline">
                        {referral.first_name} {referral.last_name}
                      </Link>
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        {referral.possible_duplicate ? <Badge variant="warning">Doublon possible</Badge> : null}
                        {referral.needs_accommodation ? <Badge variant="outline">Adaptation</Badge> : null}
                      </span>
                    </Td>
                    <Td className="text-sm text-ink-muted">{referral.organizations?.name ?? '—'}</Td>
                    <Td className="text-sm text-ink-muted">{referral.programs?.name ?? 'Non précisé'}</Td>
                    <Td className="text-sm whitespace-nowrap">{formatDate(referral.created_at)}</Td>
                    <Td className="text-sm whitespace-nowrap">{referral.desired_start_date ? formatDate(referral.desired_start_date) : '—'}</Td>
                    <Td>
                      <ReferralStatusBadge status={referral.status} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={Inbox} title="Aucune orientation" description="Aucune orientation ne correspond à ces filtres." />
        )}
      </Card>
    </>
  );
}

/** Fiche d'une orientation côté équipe HAPPI : traitement et affectation. */
export async function StaffReferralDetail({ user, basePath, id }: { user: CurrentUser; basePath: string; id: string }) {
  if (!isUuid(id)) notFound();
  if (!hasPermission(user, 'referrals.manage')) return <NotAllowed />;
  const supabase = await createClient();
  const { data: referral } = await supabase.from('referrals').select('*, programs ( name ), organizations ( name, type ), groups ( id, name )').eq('id', id).maybeSingle();
  if (!referral) notFound();
  const status = isReferralStatus(referral.status) ? referral.status : 'sent';
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: events }, { data: existing }, { data: groups }] = await Promise.all([
    supabase.from('referral_events').select('id, kind, from_status, to_status, consent_kind, consent_value, source, reason, created_at').eq('referral_id', id).order('id'),
    // Fiche existante (visible seulement si l'équipe y a déjà accès).
    supabase.from('participants').select('id, first_name, last_name, status').eq('email', referral.email).maybeSingle(),
    supabase
      .from('groups')
      .select('id, name, status, start_date, end_date, program_id, capacity, is_demo, programs ( name, max_group_size ), group_members ( status ), group_trainers ( trainer_id ), sessions ( scheduled_date, start_time, status )')
      .in('status', ['planned', 'active'])
      .eq('is_demo', user.isDemo)
      .order('start_date', { ascending: true, nullsFirst: false }),
  ]);

  const choices: GroupChoice[] = (groups ?? [])
    .filter((group) => user.role === 'admin' || group.group_trainers.some((trainer) => trainer.trainer_id === user.id))
    .map((group) => {
      const max = group.programs?.max_group_size ?? 8;
      const active = group.group_members.filter((member) => member.status === 'active').length;
      const seats = Math.max(0, Math.min(group.capacity ?? max, max) - active);
      const match = compatibility(
        { programId: referral.program_id, availabilityDays: referral.availability_days, availabilitySlots: referral.availability_slots, desiredStartDate: referral.desired_start_date },
        { programId: group.program_id, startDate: group.start_date, endDate: group.end_date, sessions: group.sessions.map((s) => ({ date: s.scheduled_date, startTime: s.start_time, status: s.status })) },
        today,
      );
      const seatsLabel = seats === 0 ? 'complet' : `${seats} place${seats > 1 ? 's' : ''}`;
      return {
        id: group.id,
        label: `${group.name} · ${group.programs?.name ?? ''} · ${seatsLabel}${match.compatible ? '' : ` · ${match.reasons.filter((r) => r !== 'Programme non précisé').join(', ')}`}`,
        disabled: seats === 0,
      };
    });
  const canProcess = allowedTargets(status, 'staff');
  const yesNo = (value: boolean) => (value ? 'Oui' : 'Non');

  return (
    <>
      <PageHeader
        back={
          <Link href={basePath} className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden />
            Orientations
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {referral.first_name} {referral.last_name}
            <ReferralStatusBadge status={referral.status} />
          </span>
        }
        description={`Orientée par ${referral.organizations?.name ?? 'un prescripteur'} le ${formatDate(referral.created_at)}.`}
      />
      <div className="space-y-6">
        {referral.possible_duplicate || existing ? (
          <Notice variant="warning" title="Doublon possible">
            {existing ? (
              <>
                Une fiche participant existe avec cette adresse :{' '}
                <Link href={`/formateur/participants/${existing.id}`} className="font-semibold underline">
                  {existing.first_name} {existing.last_name}
                </Link>
                . L’affectation ajoutera cette fiche au groupe, sans en créer une nouvelle.
              </>
            ) : (
              'Une fiche ou une autre orientation en cours existe peut-être pour cette adresse, hors de votre périmètre. Vérifiez avec un administrateur avant d’affecter la personne.'
            )}
          </Notice>
        ) : null}
        {status === 'accepted' && referral.groups ? (
          <Notice variant="success" title="Affectée">
            Groupe{' '}
            <Link href={`/formateur/groupes/${referral.groups.id}`} className="font-semibold underline">
              {referral.groups.name}
            </Link>
            .
          </Notice>
        ) : null}
        {referral.status_reason ? <Notice title={status === 'refused' ? 'Motif du refus' : 'Motif'}>{referral.status_reason}</Notice> : null}
        {status === 'interview_scheduled' && referral.interview_at ? <Notice title="Entretien planifié">{formatParisDateTime(referral.interview_at)}</Notice> : null}

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader title="Fiche d’orientation" />
            <CardBody>
              <DefinitionList
                rows={[
                  ['Adresse e-mail', referral.email],
                  ['Téléphone', referral.phone ?? '—'],
                  ['Tranche d’âge', referral.age_band ? (AGE_BANDS[referral.age_band as keyof typeof AGE_BANDS] ?? '—') : 'Non précisée'],
                  ['Motif', <span key="reason" className="whitespace-pre-line">{referral.reason}</span>],
                  ['Objectifs', <span key="objectives" className="whitespace-pre-line">{referral.objectives ?? '—'}</span>],
                  ['Programme souhaité', referral.programs?.name ?? 'Non précisé'],
                  ['Démarrage souhaité', referral.desired_start_date ? `À partir du ${formatDate(referral.desired_start_date)}` : '—'],
                  ['Jours possibles', labelsOf(referral.availability_days, DAYS).join(', ') || '—'],
                  ['Créneaux', labelsOf(referral.availability_slots, SLOTS).join(', ') || '—'],
                  ['Contraintes', [...labelsOf(referral.practical_constraints, PRACTICAL_CONSTRAINTS), referral.constraints_details].filter(Boolean).join(' · ') || '—'],
                  ['Besoin d’adaptation', yesNo(referral.needs_accommodation)],
                  ['Droit à l’image', yesNo(referral.consent_image)],
                  ['Partage des résultats', yesNo(referral.consent_share_results)],
                  ['Confirmés par la personne', referral.participant_confirmed_at ? formatParisDateTime(referral.participant_confirmed_at) : 'Pas encore'],
                ]}
              />
            </CardBody>
          </Card>
          <div className="space-y-6">
            {canProcess.length > 0 ? (
              <>
                <Card>
                  <CardHeader title="Affecter au groupe" description="Places restantes et compatibilité (programme, créneaux, date) indiquées pour chaque groupe." />
                  <CardBody>
                    {hasPermission(user, 'groups.manage') ? <AssignForm referralId={referral.id} groups={choices} /> : <p className="text-sm text-ink-muted">Vous n’êtes pas autorisé à gérer les groupes.</p>}
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Changer le statut" description="Le prescripteur reçoit une notification et un e-mail." />
                  <CardBody>
                    <StatusForm referralId={referral.id} targets={canProcess} />
                  </CardBody>
                </Card>
              </>
            ) : null}
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
