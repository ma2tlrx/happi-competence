/**
 * Exports CSV des financements (module pur) : réalisation par participant d'une convention
 * et données du BPF. Cellules protégées contre l'injection de formules (src/lib/csv.ts).
 * Une donnée inconnue est écrite « Non renseigné » ou « À compléter », jamais 0.
 */
import { formatHours } from '@/lib/attendance/hours';
import { toCsv } from '@/lib/csv';
import { dropReasonLabel, NOT_RECORDED, situationLabel } from '@/lib/outcomes/labels';

import type { BpfReport } from './bpf';
import { hoursValue, type ConventionReport } from './indicators';
import { TO_COMPLETE } from './labels';

const MEMBER_STATUS: Record<string, string> = { active: 'Inscrit', dropped: 'Abandon' };

function outcomeCell(value: string | null | undefined) {
  if (value === undefined) return 'Pas encore attendu';
  return value === null ? NOT_RECORDED : situationLabel(value);
}

export function realisationCsv(convention: { reference: string | null; title: string }, report: ConventionReport) {
  const header = [
    'Convention',
    'Nom',
    'Prénom',
    'Structure',
    'Groupe',
    'Statut',
    'Motif d’abandon',
    'Date d’abandon',
    'Heures réalisées',
    'Heures réalisées (décimal)',
    'Heures planifiées (décimal)',
    'Séances suivies',
    'Séances réalisées du groupe',
    'Assiduité (%)',
    'Présences renseignées (n)',
    'Présences non saisies',
    'Situation à l’entrée',
    'Situation de sortie',
    'Suivi à 3 mois',
    'Suivi à 6 mois',
  ];
  const label = convention.reference ? `${convention.reference} — ${convention.title}` : convention.title;
  const lines = report.rows.map((row) => [
    label,
    row.lastName,
    row.firstName,
    row.organizationName ?? '',
    row.groupName,
    MEMBER_STATUS[row.status] ?? row.status,
    row.status === 'dropped' ? dropReasonLabel(row.dropReason) : '',
    row.droppedAt ?? '',
    formatHours(row.realisedMinutes),
    hoursValue(row.realisedMinutes),
    hoursValue(row.plannedMinutes),
    row.attendedSessions,
    row.completedSessions,
    row.attendance.rate === null ? NOT_RECORDED : Math.round(row.attendance.rate),
    row.attendance.n,
    row.missingAttendance,
    outcomeCell(row.outcomes.entry),
    outcomeCell(row.outcomes.exit),
    outcomeCell(row.outcomes.followup_3m),
    outcomeCell(row.outcomes.followup_6m),
  ]);
  return toCsv([header, ...lines]);
}

export function bpfCsv(report: BpfReport) {
  const lines: (string | number | null)[][] = [
    ['Bilan pédagogique et financier — données disponibles dans HAPPI', `Année civile ${report.year} (du ${report.from} au ${report.to})`],
    ['Cadre', 'Rubrique', 'Nombre de stagiaires', 'Nombre d’heures-stagiaires (décimal)', 'Montant HT (€)', 'Remarque'],
    ['F-1', 'Total des stagiaires', report.total.trainees, hoursValue(report.total.minutes), '', 'Heures réalisées selon la règle du certificat de réalisation'],
    ...report.traineeTypes.map((type) => ['F-1', type.label, TO_COMPLETE, TO_COMPLETE, '', 'Statut des stagiaires non saisi dans HAPPI']),
    ...report.origins.map((origin) => [
      `C (${origin.line})`,
      origin.label,
      origin.trainees,
      hoursValue(origin.minutes),
      TO_COMPLETE,
      origin.verify.join(' ') || 'Ligne à vérifier dans la notice de l’année',
    ]),
    ...report.conventions.map((convention) => [
      'Détail par convention',
      convention.reference ? `${convention.reference} — ${convention.title}` : convention.title,
      convention.trainees,
      hoursValue(convention.minutes),
      TO_COMPLETE,
      convention.funderName ?? '',
    ]),
    ...report.entrySituations.map((row) => ['Aide F-1', `Situation à l’entrée : ${row.label}`, row.trainees, '', '', 'Indicatif : ne vaut pas statut BPF']),
    ['F-3', 'Objectif général des prestations', TO_COMPLETE, TO_COMPLETE, '', 'Non connu de l’application'],
    ['F-4', 'Spécialités de formation', TO_COMPLETE, TO_COMPLETE, '', 'Non connu de l’application'],
    ['Contrôle', 'Présences non saisies sur des séances terminées', report.warnings.missingAttendance, '', '', 'Non comptées comme réalisées : à régulariser'],
    ['Contrôle', 'Séances terminées sans horaires (durée de la trame)', report.warnings.sessionsWithoutTimes, '', '', ''],
    ['Contrôle', 'Séances terminées sans date (exclues)', report.warnings.undatedCompletedSessions, '', '', ''],
  ];
  return toCsv(lines);
}
