/**
 * Exports CSV du tableau de bord d'impact (séparateur « ; », BOM UTF-8 pour Excel).
 * Les cellules qui commencent par = + - @ (ou une tabulation / un retour chariot) sont préfixées
 * d'une apostrophe : un tableur ne les interprète pas comme des formules (injection CSV).
 * Une donnée manquante reste une cellule « Non renseigné », jamais « 0 ».
 */
import { DROP_REASON_CODES, DROP_REASONS, NOT_RECORDED, OUTCOME_KIND_CODES, OUTCOME_KINDS, OUTCOME_SITUATION_CODES, OUTCOME_SITUATIONS, dropReasonLabel, situationLabel } from './labels';
import type { ImpactIndicators, ImpactReport, Ratio } from './impact';

export function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function toCsv(lines: (string | number | null | undefined)[][]) {
  return `﻿${lines.map((line) => line.map(csvCell).join(';')).join('\r\n')}\r\n`;
}

const percent = (value: Ratio | { rate: number | null }) => (value.rate === null ? NOT_RECORDED : `${Math.round(value.rate)} %`);

function indicatorColumns(indicators: ImpactIndicators) {
  return [
    indicators.enrolled,
    indicators.active,
    indicators.dropped,
    percent(indicators.dropRate),
    ...DROP_REASON_CODES.map((code) => indicators.dropReasons[code]),
    indicators.sessionsCompleted,
    percent(indicators.attendance),
    indicators.attendance.n,
    indicators.progression.count,
    indicators.progression.n,
    indicators.progression.insufficient,
    ...OUTCOME_KIND_CODES.flatMap((kind) => {
      const breakdown = indicators.outcomes[kind];
      return [breakdown.expected, breakdown.recorded, breakdown.missing, percent(breakdown), ...OUTCOME_SITUATION_CODES.map((code) => breakdown.bySituation[code])];
    }),
  ];
}

const INDICATOR_HEADER = [
  'Inscrits',
  'Actifs',
  'Abandons',
  'Taux d’abandon',
  ...DROP_REASON_CODES.map((code) => `Abandon : ${DROP_REASONS[code]}`),
  'Séances réalisées',
  'Taux d’assiduité',
  'Présences renseignées (n)',
  'Parcours avec progression observée',
  'Parcours évaluables (n)',
  'Parcours non évaluables',
  ...OUTCOME_KIND_CODES.flatMap((kind) => [
    `${OUTCOME_KINDS[kind]} : attendues`,
    `${OUTCOME_KINDS[kind]} : renseignées`,
    `${OUTCOME_KINDS[kind]} : non renseignées`,
    `${OUTCOME_KINDS[kind]} : taux de suivi`,
    ...OUTCOME_SITUATION_CODES.map((code) => `${OUTCOME_KINDS[kind]} : ${OUTCOME_SITUATIONS[code].label}`),
  ]),
];

/** Indicateurs : une ligne pour l'ensemble, une par cohorte, une par organisme. */
export function indicatorsCsv(report: ImpactReport) {
  return toCsv([
    ['Niveau', 'Nom', 'Programme', 'Début', 'Fin', ...INDICATOR_HEADER],
    ['Ensemble', 'Tous les parcours', '', '', '', ...indicatorColumns(report.total)],
    ...report.cohorts.map((row) => ['Cohorte', row.group.name, row.group.programName, row.group.startDate ?? '', row.group.endDate ?? '', ...indicatorColumns(row.indicators)]),
    ...report.organizations.map((row) => ['Organisme', row.organizationName, '', '', '', ...indicatorColumns(row.indicators)]),
  ]);
}

const STATUS_LABELS: Record<string, string> = { active: 'Inscrit', dropped: 'Abandon' };

/** Détail par parcours (participant × groupe). */
export function participantsCsv(report: ImpactReport) {
  return toCsv([
    [
      'Nom',
      'Prénom',
      'Organisme',
      'Groupe',
      'Programme',
      'Statut',
      'Motif d’abandon',
      'Date d’abandon',
      'Présences',
      'Présences renseignées (n)',
      'Progression observée',
      ...OUTCOME_KIND_CODES.map((kind) => `Situation : ${OUTCOME_KINDS[kind]}`),
    ],
    ...report.participants.map(({ participant, group, membership, detail }) => [
      participant.lastName,
      participant.firstName,
      participant.organizationName ?? '',
      group.name,
      group.programName,
      STATUS_LABELS[membership.status] ?? membership.status,
      membership.status === 'dropped' ? dropReasonLabel(membership.dropReason) : '',
      membership.droppedAt ?? '',
      detail.attendance.count,
      detail.attendance.n,
      detail.progressed === null ? 'Non évaluable' : detail.progressed ? 'Oui' : 'Non',
      ...OUTCOME_KIND_CODES.map((kind) => {
        const value = detail.outcomes[kind];
        return value === undefined ? 'Pas encore attendu' : situationLabel(value);
      }),
    ]),
  ]);
}
