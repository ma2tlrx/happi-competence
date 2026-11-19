/**
 * Indicateurs FSE+ et dispositifs publics — agrégats purs, sans accès à la base.
 *
 * Unité de compte : un parcours = une inscription d'un participant à un groupe (cohorte), comme le
 * tableau de bord d'impact ; retraits exclus, abandons comptés. Fiche d'entrée d'un parcours : celle
 * du groupe, à défaut la fiche « hors groupe » du participant.
 *
 * Pour chaque indicateur : effectif concerné (« oui »), et à part, jamais comptés à zéro :
 *   • non renseigné (donnée absente, fiche absente, situation de sortie non saisie) ;
 *   • ne souhaite pas répondre ;
 *   • ne sait pas / sans nouvelles ;
 *   • hors délai (situation de sortie observée hors des 4 semaines suivant la sortie).
 * Chaque effectif est ventilé par genre (exigence FSE+). Règles détaillées : docs/fse-plus.md.
 */
import { filterDataset, type ImpactFilters, type ImpactGroup, type ImpactMembership, type ImpactParticipant } from '@/lib/outcomes/impact';
import { followupTasks, isExpected, referenceDate } from '@/lib/outcomes/schedule';

import { DECLINED, LONG_TERM_DURATIONS, completeness, iscedFor, type AnswerColumn, type EntryProfileValues, type ProfileCompleteness } from './codes';
import { exitWindowPosition, isEmployed, isUnknownSituation, resultFor, type WindowPosition } from './outcomes';

export type FseSession = { id: string; groupId: string; status: string; date: string | null; number: number };
export type FseOutcome = {
  participantId: string;
  groupId: string | null;
  kind: string;
  situation: string;
  observedOn: string;
  qualificationObtained: boolean | null;
};
export type FseProfile = EntryProfileValues & { participantId: string; groupId: string | null };

export type FseDataset = {
  groups: ImpactGroup[];
  participants: ImpactParticipant[];
  memberships: ImpactMembership[];
  sessions: FseSession[];
  outcomes: FseOutcome[];
  profiles: FseProfile[];
};
export type FseFilters = ImpactFilters;

export type GenderKey = 'femme' | 'homme' | 'non_binaire' | 'non_communique';
export const GENDER_COLUMNS: { key: GenderKey; label: string }[] = [
  { key: 'femme', label: 'Femmes' },
  { key: 'homme', label: 'Hommes' },
  { key: 'non_binaire', label: 'Non binaires' },
  { key: 'non_communique', label: 'Genre non communiqué' },
];

export type IndicatorFamily = 'realisation' | 'facultatif' | 'national' | 'resultat' | 'long_terme';
export const FAMILY_LABELS: Record<IndicatorFamily, string> = {
  realisation: 'Indicateurs communs de réalisation (participants)',
  facultatif: 'Données facultatives FSE+ (réponse libre, « ne souhaite pas répondre » possible)',
  national: 'Dispositifs français (hors nomenclature FSE+)',
  resultat: 'Indicateurs communs de résultat immédiats (au terme de la participation, dans les 4 semaines)',
  long_terme: 'Indicateurs communs de résultat à long terme (6 mois après la sortie)',
};

export type IndicatorRow = {
  /** Code FSE+ (annexe I) ; nul pour un indicateur national. */
  code: string | null;
  label: string;
  family: IndicatorFamily;
  /** Parcours concernés (réponse « oui » ou situation correspondante). */
  count: number;
  notRecorded: number;
  declined: number;
  /** « Ne sait pas » ou « sans nouvelles ». */
  unknown: number;
  /** Situation de sortie observée hors de la fenêtre de 4 semaines. */
  outOfWindow: number;
  /** Effectif de référence : tous les parcours (réalisation) ou les sorties attendues (résultat). */
  base: number;
  byGender: Record<GenderKey, number>;
  /** Faux : indicateur non calculé (définition à vérifier). */
  computed: boolean;
  note?: string;
};

export type FseJourney = {
  participant: ImpactParticipant;
  group: ImpactGroup;
  membership: ImpactMembership;
  profile: FseProfile | null;
  completeness: ProfileCompleteness;
  exit: { expected: boolean; date: string | null; outcome: FseOutcome | null; window: WindowPosition | null };
  sixMonths: { expected: boolean; outcome: FseOutcome | null };
};

export type FseSummary = { journeys: number; complete: number; partial: number; missing: number };
export type FseIndicators = { summary: FseSummary; rows: IndicatorRow[] };
export type FseReport = {
  total: FseIndicators;
  cohorts: { group: ImpactGroup; indicators: FseIndicators }[];
  organizations: { organizationId: string | null; organizationName: string; indicators: FseIndicators }[];
  journeys: FseJourney[];
};

const WITHOUT_ORGANIZATION = 'Sans organisme de rattachement';

export function filterFseDataset(dataset: FseDataset, filters: FseFilters): FseDataset {
  const base = filterDataset(
    { groups: dataset.groups, participants: dataset.participants, memberships: dataset.memberships, sessions: dataset.sessions, attendance: [], observations: [], outcomes: [] },
    filters,
  );
  const participantIds = new Set(base.memberships.map((membership) => membership.participantId));
  return {
    groups: base.groups,
    participants: base.participants,
    memberships: base.memberships,
    sessions: dataset.sessions.filter((session) => base.groups.some((group) => group.id === session.groupId)),
    outcomes: dataset.outcomes.filter((outcome) => participantIds.has(outcome.participantId)),
    profiles: dataset.profiles.filter((profile) => participantIds.has(profile.participantId)),
  };
}

/** Parcours enrichis : fiche d'entrée, date de sortie, situations de sortie et à 6 mois. */
export function buildJourneys(dataset: FseDataset, today: string): FseJourney[] {
  const lastSession = new Map<string, string>();
  for (const session of dataset.sessions) {
    if (session.status === 'completed' && session.date && session.date > (lastSession.get(session.groupId) ?? '')) lastSession.set(session.groupId, session.date);
  }
  const scheduleGroups = dataset.groups.map((group) => ({
    id: group.id,
    name: group.name,
    status: group.status,
    endDate: group.endDate,
    lastCompletedSessionDate: lastSession.get(group.id) ?? null,
  }));
  const tasks = followupTasks(dataset.memberships, scheduleGroups, dataset.outcomes, today);
  const expected = new Set(tasks.filter(isExpected).map((task) => `${task.participantId}:${task.groupId}:${task.kind}`));
  const outcomeByKey = new Map(dataset.outcomes.map((outcome) => [`${outcome.participantId}:${outcome.groupId ?? ''}:${outcome.kind}`, outcome]));
  const profileByKey = new Map(dataset.profiles.map((profile) => [`${profile.participantId}:${profile.groupId ?? ''}`, profile]));
  const groupById = new Map(dataset.groups.map((group) => [group.id, group]));
  const scheduleById = new Map(scheduleGroups.map((group) => [group.id, group]));
  const participantById = new Map(dataset.participants.map((participant) => [participant.id, participant]));

  const journeys: FseJourney[] = [];
  for (const membership of dataset.memberships) {
    const group = groupById.get(membership.groupId);
    const participant = participantById.get(membership.participantId);
    if (!group || !participant || membership.status === 'removed') continue;
    const key = `${membership.participantId}:${membership.groupId}`;
    const profile = profileByKey.get(key) ?? profileByKey.get(`${membership.participantId}:`) ?? null;
    const exitDate = referenceDate(membership, scheduleById.get(group.id)!, today) ?? null;
    const exitOutcome = outcomeByKey.get(`${key}:exit`) ?? null;
    journeys.push({
      participant,
      group,
      membership,
      profile,
      completeness: completeness(profile),
      exit: {
        expected: expected.has(`${key}:exit`),
        date: exitDate,
        outcome: exitOutcome,
        window: exitOutcome ? exitWindowPosition(exitDate, exitOutcome.observedOn) : null,
      },
      sixMonths: { expected: expected.has(`${key}:followup_6m`), outcome: outcomeByKey.get(`${key}:followup_6m`) ?? null },
    });
  }
  return journeys;
}

function genderKey(profile: FseProfile | null): GenderKey {
  const gender = profile?.gender;
  return gender === 'femme' || gender === 'homme' || gender === 'non_binaire' ? gender : 'non_communique';
}

type Verdict = 'yes' | 'no' | 'notRecorded' | 'declined' | 'unknown' | 'outOfWindow' | 'excluded';
type Definition = { code: string | null; label: string; family: IndicatorFamily; computed?: boolean; note?: string; verdict: (journey: FseJourney) => Verdict };

const answer = (column: AnswerColumn) => (journey: FseJourney): Verdict => {
  const value = journey.profile?.answers[column] ?? null;
  if (value === null) return 'notRecorded';
  if (value === DECLINED) return 'declined';
  if (value === 'ne_sait_pas') return 'unknown';
  return value === 'oui' ? 'yes' : 'no';
};

const field = <K extends 'labourStatus' | 'ageBand'>(key: K, ...values: string[]) => (journey: FseJourney): Verdict => {
  const value = journey.profile?.[key] ?? null;
  if (value === null) return 'notRecorded';
  return values.includes(value) ? 'yes' : 'no';
};

const isced = (band: string) => (journey: FseJourney): Verdict => {
  const value = iscedFor(journey.profile?.diplomaLevel);
  if (value === null) return 'notRecorded';
  return value === band ? 'yes' : 'no';
};

/** Situation de sortie : seules les sorties attendues entrent dans la base. */
const exitResult = (test: (outcome: FseOutcome) => Verdict) => (journey: FseJourney): Verdict => {
  if (!journey.exit.expected) return 'excluded';
  const outcome = journey.exit.outcome;
  if (!outcome) return 'notRecorded';
  if (journey.exit.window !== 'within') return 'outOfWindow';
  return test(outcome);
};
const exitSituation = (code: 'EECR01' | 'EECR02' | 'EECR04') =>
  exitResult((outcome) => (isUnknownSituation(outcome.situation) ? 'unknown' : resultFor(outcome.situation) === code ? 'yes' : 'no'));

export const DEFINITIONS: Definition[] = [
  { code: 'EECO01', label: 'Nombre total de participants', family: 'realisation', verdict: () => 'yes' },
  { code: 'EECO02', label: 'Chômeurs, y compris les chômeurs de longue durée', family: 'realisation', verdict: field('labourStatus', 'chomeur') },
  {
    code: 'EECO03',
    label: 'Chômeurs de longue durée',
    family: 'realisation',
    note: 'Chômage de 12 mois ou plus ; seuil applicable aux moins de 25 ans à vérifier.',
    verdict: (journey) => {
      const status = journey.profile?.labourStatus ?? null;
      if (status === null) return 'notRecorded';
      if (status !== 'chomeur') return 'no';
      const duration = journey.profile?.unemploymentDuration ?? null;
      if (duration === null) return 'notRecorded';
      return LONG_TERM_DURATIONS.includes(duration) ? 'yes' : 'no';
    },
  },
  { code: 'EECO04', label: 'Personnes inactives', family: 'realisation', verdict: field('labourStatus', 'inactif') },
  { code: 'EECO05', label: 'Personnes exerçant un emploi, y compris les indépendants', family: 'realisation', verdict: field('labourStatus', 'en_emploi') },
  { code: 'EECO06', label: 'Enfants âgés de moins de 18 ans', family: 'realisation', verdict: field('ageBand', 'moins_18') },
  { code: 'EECO07', label: 'Participants âgés de 18 à 29 ans', family: 'realisation', verdict: field('ageBand', '18_29') },
  { code: 'EECO08', label: 'Participants âgés de 55 ans et plus', family: 'realisation', verdict: field('ageBand', '55_plus') },
  { code: 'EECO09', label: 'Niveau d’éducation CITE 0 à 2 (premier cycle du secondaire au plus)', family: 'realisation', verdict: isced('cite_0_2') },
  { code: 'EECO10', label: 'Niveau d’éducation CITE 3 à 4 (second cycle du secondaire ou post-secondaire non supérieur)', family: 'realisation', verdict: isced('cite_3_4') },
  { code: 'EECO11', label: 'Niveau d’éducation CITE 5 à 8 (enseignement supérieur)', family: 'realisation', verdict: isced('cite_5_8') },
  { code: 'EECO12', label: 'Participants handicapés', family: 'facultatif', verdict: answer('disability') },
  { code: 'EECO13', label: 'Ressortissants de pays tiers', family: 'facultatif', verdict: answer('third_country_national') },
  { code: 'EECO14', label: 'Participants d’origine étrangère', family: 'facultatif', verdict: answer('foreign_background') },
  { code: 'EECO15', label: 'Minorités (y compris les communautés marginalisées telles que les Roms)', family: 'facultatif', verdict: answer('minority') },
  { code: 'EECO16', label: 'Personnes sans domicile fixe ou confrontées à l’exclusion de leur logement', family: 'facultatif', verdict: answer('homeless_or_housing_excl') },
  { code: 'EECO17', label: 'Personnes venant de zones rurales', family: 'facultatif', verdict: answer('rural_area') },
  { code: null, label: 'Inscrits à France Travail', family: 'national', verdict: answer('france_travail_registered') },
  { code: null, label: 'En contrat d’engagement jeune (CEJ)', family: 'national', verdict: answer('cej') },
  { code: null, label: 'Bénéficiaires du RSA', family: 'national', verdict: answer('rsa_beneficiary') },
  { code: null, label: 'Reconnus travailleurs handicapés (RQTH)', family: 'national', verdict: answer('rqth') },
  { code: null, label: 'Résidents d’un quartier prioritaire de la politique de la ville (QPV)', family: 'national', verdict: answer('qpv_resident') },
  { code: null, label: 'Résidents d’une commune France Ruralités Revitalisation (ex-ZRR)', family: 'national', verdict: answer('zrr_frr_resident') },
  { code: 'EECR01', label: 'Participants engagés dans la recherche d’un emploi au terme de leur participation', family: 'resultat', verdict: exitSituation('EECR01') },
  { code: 'EECR02', label: 'Participants suivant un enseignement ou une formation au terme de leur participation', family: 'resultat', verdict: exitSituation('EECR02') },
  {
    code: 'EECR03',
    label: 'Participants obtenant une qualification au terme de leur participation',
    family: 'resultat',
    verdict: exitResult((outcome) => (outcome.qualificationObtained === null ? 'notRecorded' : outcome.qualificationObtained ? 'yes' : 'no')),
  },
  { code: 'EECR04', label: 'Participants exerçant un emploi, y compris à titre indépendant, au terme de leur participation', family: 'resultat', verdict: exitSituation('EECR04') },
  {
    code: 'EECR05',
    label: 'Participants exerçant un emploi, y compris à titre indépendant, six mois après la fin de leur participation',
    family: 'long_terme',
    verdict: (journey) => {
      if (!journey.sixMonths.expected) return 'excluded';
      const outcome = journey.sixMonths.outcome;
      if (!outcome) return 'notRecorded';
      if (isUnknownSituation(outcome.situation)) return 'unknown';
      return isEmployed(outcome.situation) ? 'yes' : 'no';
    },
  },
  {
    code: 'EECR06',
    label: 'Participants dont la situation sur le marché du travail s’est améliorée six mois après la fin de leur participation',
    family: 'long_terme',
    computed: false,
    note: 'Non calculé : définition (population de référence, notion d’amélioration) à vérifier avant tout calcul.',
    verdict: () => 'excluded',
  },
];

function emptyGender(): Record<GenderKey, number> {
  return { femme: 0, homme: 0, non_binaire: 0, non_communique: 0 };
}

export function computeFseIndicators(journeys: FseJourney[]): FseIndicators {
  const summary: FseSummary = { journeys: journeys.length, complete: 0, partial: 0, missing: 0 };
  for (const journey of journeys) summary[journey.completeness]++;
  const rows = DEFINITIONS.map((definition): IndicatorRow => {
    const row: IndicatorRow = {
      code: definition.code,
      label: definition.label,
      family: definition.family,
      count: 0,
      notRecorded: 0,
      declined: 0,
      unknown: 0,
      outOfWindow: 0,
      base: 0,
      byGender: emptyGender(),
      computed: definition.computed ?? true,
      note: definition.note,
    };
    if (!row.computed) return row;
    for (const journey of journeys) {
      const verdict = definition.verdict(journey);
      if (verdict === 'excluded') continue;
      row.base++;
      if (verdict === 'yes') {
        row.count++;
        row.byGender[genderKey(journey.profile)]++;
      } else if (verdict !== 'no') {
        row[verdict]++;
      }
    }
    return row;
  });
  return { summary, rows };
}

export function buildFseReport(dataset: FseDataset, filters: FseFilters, today: string): FseReport {
  const journeys = buildJourneys(filterFseDataset(dataset, filters), today);
  const byGroup = new Map<string, FseJourney[]>();
  const byOrganization = new Map<string, { id: string | null; name: string; journeys: FseJourney[] }>();
  for (const journey of journeys) {
    byGroup.set(journey.group.id, [...(byGroup.get(journey.group.id) ?? []), journey]);
    const key = journey.participant.organizationId ?? '';
    const entry = byOrganization.get(key) ?? { id: journey.participant.organizationId, name: journey.participant.organizationName ?? WITHOUT_ORGANIZATION, journeys: [] };
    entry.journeys.push(journey);
    byOrganization.set(key, entry);
  }
  const groups = new Map(journeys.map((journey) => [journey.group.id, journey.group]));
  return {
    total: computeFseIndicators(journeys),
    cohorts: [...byGroup].map(([groupId, items]) => ({ group: groups.get(groupId)!, indicators: computeFseIndicators(items) })),
    organizations: [...byOrganization.values()]
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .map((entry) => ({ organizationId: entry.id, organizationName: entry.name, indicators: computeFseIndicators(entry.journeys) })),
    journeys,
  };
}
