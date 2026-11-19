import type { Passport } from '@/lib/passport';

import { LINK_TYPES, sourceMention } from './mappings';

/**
 * Export CSV des résultats d'un participant pour un conseiller — module pur.
 * Une ligne par compétence : niveau et valeur tels que calculés par le passeport (aucun
 * recalcul), nombre de séances observées, et correspondances VALIDÉES avec les
 * référentiels publics, chacune avec sa source et sa version. Jamais : commentaires des
 * formateurs, auto-évaluation, présences détaillées.
 */
export const RESULTS_CSV_HEADER = [
  'Nom',
  'Prénom',
  'Programme',
  'Référentiel HAPPI',
  'Compétence',
  'Niveau observé',
  'Valeur',
  'Échelle',
  'Séances observées',
  'Référentiels publics (correspondances validées)',
];

export function resultsCsvLines(passport: Passport): (string | number | null)[][] {
  const lines: (string | number | null)[][] = [RESULTS_CSV_HEADER];
  for (const framework of passport.frameworks) {
    for (const skill of framework.skills) {
      const observed = skill.summary.value;
      lines.push([
        passport.participant.lastName,
        passport.participant.firstName,
        passport.group?.programName ?? '',
        `${framework.name}${framework.isProvisional ? ' (provisoire)' : ''}`,
        skill.name,
        observed === null ? 'Pas encore observée' : (skill.level?.label ?? ''),
        observed,
        `${framework.rules.scaleMin} à ${framework.rules.scaleMax}`,
        new Set(skill.summary.observations.map((observation) => observation.sessionNumber)).size,
        skill.publicMappings
          .map((mapping) => `${mapping.label} [${LINK_TYPES[mapping.linkType].label.toLowerCase()} ; ${sourceMention(mapping.source)} ; ${mapping.code}]`)
          .join(' | '),
      ]);
    }
  }
  return lines;
}
