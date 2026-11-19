/**
 * Exports CSV FSE+ (séparateur « ; », BOM UTF-8, formules neutralisées : voir src/lib/csv.ts).
 *   • fichier participants : une ligne par parcours (participant × groupe), entrée + sortie ;
 *   • tableau agrégé : une ligne par indicateur et par niveau (ensemble, cohorte, organisme).
 * Une donnée absente est écrite « Non renseigné », jamais 0.
 */
import { toCsv } from '@/lib/csv';
import { NOT_RECORDED as OUTCOME_NOT_RECORDED, dropReasonLabel, situationLabel } from '@/lib/outcomes/labels';

import {
  ANSWER_FIELDS,
  COMPLETENESS_LABELS,
  NOT_RECORDED,
  ageBandLabel,
  answerLabel,
  diplomaLabel,
  durationLabel,
  genderLabel,
  iscedFor,
  iscedLabel,
  labourStatusLabel,
} from './codes';
import { FAMILY_LABELS, GENDER_COLUMNS, type FseIndicators, type FseJourney, type FseReport } from './indicators';
import { EXIT_WINDOW_DAYS, resultFor } from './outcomes';

const WINDOW_LABELS = { within: `Oui (≤ ${EXIT_WINDOW_DAYS} jours)`, before: 'Non (avant la sortie)', after: `Non (après ${EXIT_WINDOW_DAYS} jours)`, unknown: 'Date de sortie inconnue' } as const;
const STATUS_LABELS: Record<string, string> = { active: 'Inscrit', dropped: 'Abandon' };
const yesNo = (value: boolean | null | undefined) => (value === true ? 'Oui' : value === false ? 'Non' : NOT_RECORDED);

export function fseParticipantsCsv(journeys: FseJourney[]) {
  return toCsv([
    [
      'Nom',
      'Prénom',
      'Organisme',
      'Groupe',
      'Programme',
      'Statut du parcours',
      'Motif d’abandon',
      'État de la fiche d’entrée',
      'Date d’entrée',
      'Genre',
      'Tranche d’âge',
      'Situation sur le marché du travail à l’entrée',
      'Durée de chômage',
      'Niveau de diplôme (cadre national 2019)',
      'Niveau CITE',
      ...ANSWER_FIELDS.map((field) => field.label),
      'Date de sortie',
      'Situation de sortie',
      'Observée le',
      'Dans les 4 semaines',
      'Indicateur de résultat',
      'Qualification obtenue',
      'Situation à 6 mois',
    ],
    ...journeys.map(({ participant, group, membership, profile, completeness, exit, sixMonths }) => {
      const result = exit.outcome && exit.window === 'within' ? resultFor(exit.outcome.situation) : null;
      return [
        participant.lastName,
        participant.firstName,
        participant.organizationName ?? '',
        group.name,
        group.programName,
        STATUS_LABELS[membership.status] ?? membership.status,
        membership.status === 'dropped' ? dropReasonLabel(membership.dropReason) : '',
        COMPLETENESS_LABELS[completeness],
        profile?.entryDate ?? NOT_RECORDED,
        genderLabel(profile?.gender),
        ageBandLabel(profile?.ageBand),
        labourStatusLabel(profile?.labourStatus),
        profile?.labourStatus === 'chomeur' ? durationLabel(profile.unemploymentDuration) : '',
        diplomaLabel(profile?.diplomaLevel),
        iscedLabel(iscedFor(profile?.diplomaLevel)),
        ...ANSWER_FIELDS.map((field) => answerLabel(profile?.answers[field.column])),
        exit.date ?? (exit.expected ? 'Inconnue' : 'Parcours en cours'),
        exit.outcome ? situationLabel(exit.outcome.situation) : exit.expected ? OUTCOME_NOT_RECORDED : 'Pas encore attendue',
        exit.outcome?.observedOn ?? '',
        exit.window ? WINDOW_LABELS[exit.window] : '',
        result ?? '',
        exit.outcome ? yesNo(exit.outcome.qualificationObtained) : '',
        sixMonths.outcome ? situationLabel(sixMonths.outcome.situation) : sixMonths.expected ? OUTCOME_NOT_RECORDED : 'Pas encore attendue',
      ];
    }),
  ]);
}

const HEADER = [
  'Niveau',
  'Nom',
  'Famille',
  'Code',
  'Indicateur',
  'Effectif concerné',
  ...GENDER_COLUMNS.map((column) => `dont ${column.label.toLowerCase()}`),
  'Non renseigné',
  'Ne souhaite pas répondre',
  'Ne sait pas / sans nouvelles',
  'Hors délai (sortie)',
  'Effectif de référence',
  'Remarque',
];

function indicatorLines(level: string, name: string, indicators: FseIndicators) {
  return indicators.rows.map((row) =>
    row.computed
      ? [
          level,
          name,
          FAMILY_LABELS[row.family],
          row.code ?? 'National',
          row.label,
          row.count,
          ...GENDER_COLUMNS.map((column) => row.byGender[column.key]),
          row.notRecorded,
          row.declined,
          row.unknown,
          row.outOfWindow,
          row.base,
          row.note ?? '',
        ]
      : [level, name, FAMILY_LABELS[row.family], row.code ?? 'National', row.label, 'Non calculé', ...GENDER_COLUMNS.map(() => ''), '', '', '', '', '', row.note ?? ''],
  );
}

export function fseIndicatorsCsv(report: FseReport) {
  return toCsv([
    HEADER,
    ...indicatorLines('Ensemble', 'Tous les parcours', report.total),
    ...report.cohorts.flatMap((cohort) => indicatorLines('Cohorte', cohort.group.name, cohort.indicators)),
    ...report.organizations.flatMap((organization) => indicatorLines('Organisme', organization.organizationName, organization.indicators)),
  ]);
}
