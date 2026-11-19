/**
 * Données du bilan pédagogique et financier (BPF, cerfa n° 10443) pour une année civile —
 * module pur.
 *
 * Ce que l'application fournit réellement :
 *   • nombre de stagiaires : personnes distinctes ayant au moins une heure réalisée dans l'année ;
 *   • heures-stagiaires : heures réalisées dans l'année, séance par séance (règle du certificat
 *     de réalisation : séance terminée, participant présent, en retard ou parti plus tôt) ;
 *   • ventilation par origine du financement, d'après le type du financeur de la convention à
 *     laquelle le groupe est rattaché (aide au cadre C, qui porte sur les montants).
 * Ce qu'elle ne connaît pas reste « à compléter », jamais estimé : statut des stagiaires
 * (cadre F-1), montants (cadre C), objectif et spécialité des formations (F-3, F-4).
 * Le BPF porte sur l'exercice comptable : l'année civile n'y correspond que si l'exercice est
 * calé sur elle (point à valider).
 */
import { situationLabel } from '@/lib/outcomes/labels';

import { BPF_ORIGIN_BY_FUNDER, BPF_ORIGINS, BPF_TRAINEE_TYPES, bpfOriginOf, type BpfOrigin, type FunderKind } from './labels';
import { membershipRealisation, missingAttendance, realisationContext, sessionsWithoutTimes, type FundingDataset } from './realisation';

export type BpfConvention = { id: string; reference: string | null; title: string; funderName: string; funderKind: string };
export type BpfLink = { groupId: string; conventionId: string };

type Tally = { participants: Set<string>; minutes: number };
const tally = (): Tally => ({ participants: new Set(), minutes: 0 });
function bucketOf<K>(map: Map<K, Tally>, key: K): Tally {
  const existing = map.get(key);
  if (existing) return existing;
  const created = tally();
  map.set(key, created);
  return created;
}

export type BpfLine = { trainees: number; minutes: number };
export type BpfReport = {
  year: number;
  from: string;
  to: string;
  total: BpfLine;
  /** Cadre F-1 : le statut n'étant pas saisi, chaque type est « à compléter ». */
  traineeTypes: { code: string; label: string; trainees: null; minutes: null }[];
  origins: { origin: BpfOrigin; label: string; line: string; trainees: number; minutes: number; verify: string[] }[];
  conventions: { conventionId: string | null; reference: string | null; title: string; funderName: string | null; funderKind: string | null; origin: BpfOrigin; trainees: number; minutes: number }[];
  /** Aide à la ventilation F-1 : situation à l'entrée saisie (ne vaut pas statut BPF). */
  entrySituations: { situation: string | null; label: string; trainees: number }[];
  warnings: { missingAttendance: number; sessionsWithoutTimes: number; undatedCompletedSessions: number };
};

export function computeBpf({
  year,
  dataset,
  links,
  conventions,
}: {
  year: number;
  dataset: FundingDataset;
  links: BpfLink[];
  conventions: BpfConvention[];
}): BpfReport {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const inYear = (date: string | null) => Boolean(date) && date! >= from && date! <= to;
  const ctx = realisationContext(dataset);
  const conventionOfGroup = new Map(links.map((link) => [link.groupId, link.conventionId]));
  const conventionById = new Map(conventions.map((convention) => [convention.id, convention]));

  const total = tally();
  const byOrigin = new Map<BpfOrigin, Tally>();
  const byConvention = new Map<string, Tally>();
  const verify = new Map<BpfOrigin, Set<string>>();
  const entryByParticipant = new Map<string, string | null>();
  const entryByKey = new Map(dataset.impact.outcomes.filter((row) => row.kind === 'entry').map((row) => [`${row.participantId}:${row.groupId ?? ''}`, row.situation]));
  let missing = 0;
  const groupsInYear = new Set<string>();

  for (const membership of dataset.impact.memberships) {
    if (membership.status === 'removed') continue;
    const realisation = membershipRealisation(ctx, membership);
    const minutes = realisation.rows.filter((row) => row.counted && inYear(row.date)).reduce((sum, row) => sum + row.minutes, 0);
    missing += missingAttendance(ctx, membership, inYear);
    if (minutes <= 0) continue;
    groupsInYear.add(membership.groupId);

    const conventionId = conventionOfGroup.get(membership.groupId) ?? null;
    const convention = conventionId ? conventionById.get(conventionId) : undefined;
    const origin = convention ? bpfOriginOf(convention.funderKind) : 'sans_convention';
    const note = convention && convention.funderKind in BPF_ORIGIN_BY_FUNDER ? BPF_ORIGIN_BY_FUNDER[convention.funderKind as FunderKind].verify : undefined;
    if (note) verify.set(origin, (verify.get(origin) ?? new Set()).add(note));

    for (const bucket of [total, bucketOf(byOrigin, origin), bucketOf(byConvention, conventionId ?? '')]) {
      bucket.participants.add(membership.participantId);
      bucket.minutes += minutes;
    }
    if (!entryByParticipant.get(membership.participantId)) {
      entryByParticipant.set(membership.participantId, entryByKey.get(`${membership.participantId}:${membership.groupId}`) ?? null);
    }
  }

  const situations = new Map<string | null, number>();
  for (const situation of entryByParticipant.values()) situations.set(situation, (situations.get(situation) ?? 0) + 1);

  const undated = dataset.impact.sessions.filter((session) => session.status === 'completed' && !session.date).length;

  return {
    year,
    from,
    to,
    total: { trainees: total.participants.size, minutes: total.minutes },
    traineeTypes: BPF_TRAINEE_TYPES.map((type) => ({ code: type.code, label: type.label, trainees: null, minutes: null })),
    origins: [...byOrigin]
      .map(([origin, value]) => ({
        origin,
        label: BPF_ORIGINS[origin].label,
        line: BPF_ORIGINS[origin].line,
        trainees: value.participants.size,
        minutes: value.minutes,
        verify: [...(verify.get(origin) ?? [])],
      }))
      .sort((a, b) => Object.keys(BPF_ORIGINS).indexOf(a.origin) - Object.keys(BPF_ORIGINS).indexOf(b.origin)),
    conventions: [...byConvention]
      .map(([id, value]) => {
        const convention = id ? conventionById.get(id) : undefined;
        return {
          conventionId: convention?.id ?? null,
          reference: convention?.reference ?? null,
          title: convention?.title ?? BPF_ORIGINS.sans_convention.label,
          funderName: convention?.funderName ?? null,
          funderKind: convention?.funderKind ?? null,
          origin: convention ? bpfOriginOf(convention.funderKind) : ('sans_convention' as BpfOrigin),
          trainees: value.participants.size,
          minutes: value.minutes,
        };
      })
      .sort((a, b) => (a.conventionId === null ? 1 : 0) - (b.conventionId === null ? 1 : 0) || a.title.localeCompare(b.title, 'fr')),
    entrySituations: [...situations]
      .map(([situation, trainees]) => ({ situation, label: situationLabel(situation), trainees }))
      .sort((a, b) => (a.situation === null ? 1 : 0) - (b.situation === null ? 1 : 0) || b.trainees - a.trainees),
    warnings: {
      missingAttendance: missing,
      sessionsWithoutTimes: sessionsWithoutTimes(ctx, groupsInYear, inYear),
      undatedCompletedSessions: undated,
    },
  };
}
