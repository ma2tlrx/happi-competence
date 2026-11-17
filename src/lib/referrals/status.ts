/**
 * Statuts d'une orientation et transitions autorisées. Miroir de la fonction SQL
 * private.referral_transition_allowed (migration 20261116100000_referrals.sql) : la base
 * reste seule juge, ce module sert à n'afficher que les actions possibles.
 */
import type { BadgeVariant } from '@/components/ui/primitives';

export const REFERRAL_STATUSES = ['sent', 'received', 'interview_scheduled', 'accepted', 'waitlisted', 'refused', 'cancelled'] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export const REFERRAL_STATUS: Record<ReferralStatus, { label: string; variant: BadgeVariant; description: string }> = {
  sent: { label: 'Envoyée', variant: 'outline', description: 'L’orientation a été transmise à l’équipe HAPPI.' },
  received: { label: 'Reçue', variant: 'petrol', description: 'L’équipe HAPPI a pris connaissance de l’orientation.' },
  interview_scheduled: { label: 'Entretien planifié', variant: 'petrol', description: 'Un entretien est prévu avec la personne.' },
  accepted: { label: 'Acceptée', variant: 'success', description: 'La personne est inscrite dans un groupe.' },
  waitlisted: { label: 'Liste d’attente', variant: 'warning', description: 'La personne sera proposée dès qu’une place compatible se libère.' },
  refused: { label: 'Refusée', variant: 'danger', description: 'L’orientation n’a pas été retenue (motif indiqué).' },
  cancelled: { label: 'Annulée', variant: 'neutral', description: 'L’orientation a été annulée par le prescripteur.' },
};

const TRANSITIONS: Record<ReferralStatus, readonly ReferralStatus[]> = {
  sent: ['received', 'interview_scheduled', 'accepted', 'waitlisted', 'refused', 'cancelled'],
  received: ['interview_scheduled', 'accepted', 'waitlisted', 'refused', 'cancelled'],
  // Un entretien peut être replanifié (nouvelle date).
  interview_scheduled: ['interview_scheduled', 'accepted', 'waitlisted', 'refused', 'cancelled'],
  waitlisted: ['interview_scheduled', 'accepted', 'refused', 'cancelled'],
  accepted: [],
  refused: [],
  cancelled: [],
};

export type ReferralActor = 'prescriber' | 'staff';

/** Statuts que chaque acteur peut poser lui-même (l'acceptation passe par l'affectation à un groupe). */
const ACTOR_TARGETS: Record<ReferralActor, readonly ReferralStatus[]> = {
  prescriber: ['cancelled'],
  staff: ['received', 'interview_scheduled', 'waitlisted', 'refused', 'accepted'],
};

export function isReferralStatus(value: unknown): value is ReferralStatus {
  return typeof value === 'string' && (REFERRAL_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: ReferralStatus, to: ReferralStatus, actor?: ReferralActor): boolean {
  if (!TRANSITIONS[from].includes(to)) return false;
  return actor ? ACTOR_TARGETS[actor].includes(to) : true;
}

export function allowedTargets(from: ReferralStatus, actor: ReferralActor): ReferralStatus[] {
  return TRANSITIONS[from].filter((to) => ACTOR_TARGETS[actor].includes(to));
}

export function isClosed(status: ReferralStatus) {
  return TRANSITIONS[status].length === 0;
}

/** Motif obligatoire (refus par l'équipe, annulation par le prescripteur). */
export function requiresReason(status: ReferralStatus) {
  return status === 'refused' || status === 'cancelled';
}

/** Orientations encore à traiter, dans la file de l'équipe HAPPI. */
export const OPEN_STATUSES: readonly ReferralStatus[] = ['sent', 'received', 'interview_scheduled', 'waitlisted'];

/** Personnes proposables pour une place : orientations ouvertes. */
export function isWaiting(status: ReferralStatus) {
  return OPEN_STATUSES.includes(status);
}

export type ReferralBuckets = { pending: number; inProgress: number; accepted: number; closed: number };

/** Répartition affichée sur le tableau de bord de l'organisme. */
export function referralBuckets(statuses: readonly string[]): ReferralBuckets {
  const buckets: ReferralBuckets = { pending: 0, inProgress: 0, accepted: 0, closed: 0 };
  for (const status of statuses) {
    if (status === 'sent' || status === 'received') buckets.pending += 1;
    else if (status === 'interview_scheduled' || status === 'waitlisted') buckets.inProgress += 1;
    else if (status === 'accepted') buckets.accepted += 1;
    else buckets.closed += 1;
  }
  return buckets;
}
