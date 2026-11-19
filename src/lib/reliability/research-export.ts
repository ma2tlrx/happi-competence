/**
 * Export anonymisé destiné à un partenaire de recherche (étude d'accord inter-observateurs).
 *
 * Aucune donnée nominative : ni nom, ni e-mail, ni date, ni organisme, ni commentaire.
 * Participants, séances et formateurs sont remplacés par des pseudonymes : HMAC-SHA-256 de
 * l'identifiant interne avec un sel secret (variable d'environnement RELIABILITY_PSEUDONYM_SALT,
 * jamais en base ni dans le code client). Le même sel donne les mêmes pseudonymes d'un export à
 * l'autre (suivi longitudinal possible) ; changer le sel rend les exports précédents non
 * rapprochables. Sans le sel, un pseudonyme ne permet pas de retrouver l'identifiant.
 */
import { createHmac } from 'node:crypto';

import { toCsv } from '@/lib/csv';

import type { DatasetSkill, DatasetVersion, PairRecord } from './report';

export const SALT_ENV = 'RELIABILITY_PSEUDONYM_SALT';
export const MIN_SALT_LENGTH = 32;

export type PseudonymKind = 'participant' | 'seance' | 'formateur';

export function pseudonym(salt: string, kind: PseudonymKind, id: string): string {
  const prefix = { participant: 'P', seance: 'S', formateur: 'F' }[kind];
  return `${prefix}-${createHmac('sha256', salt).update(`${kind}:${id}`).digest('hex').slice(0, 16)}`;
}

/** Sel lu côté serveur ; null s'il est absent ou trop court (l'export est alors refusé). */
export function readSalt(env: Record<string, string | undefined> = process.env): string | null {
  const value = env[SALT_ENV]?.trim();
  return value && value.length >= MIN_SALT_LENGTH ? value : null;
}

const STATUS_LABEL: Record<PairRecord['status'], string> = {
  pair: 'paire',
  not_observed_official: 'non_observe_officiel',
  not_observed_second: 'non_observe_second',
};

export const RESEARCH_HEADER = [
  'participant',
  'seance',
  'observateur_officiel',
  'observateur_second',
  'origine',
  'referentiel',
  'version',
  'competence',
  'echelle_min',
  'echelle_max',
  'echelle_pas',
  'cotation_officielle',
  'cotation_seconde',
  'statut',
  'officielle_modifiee_apres',
];

export function researchCsv(records: PairRecord[], versions: DatasetVersion[], skills: DatasetSkill[], salt: string): string {
  const versionById = new Map(versions.map((version) => [version.id, version]));
  const skillById = new Map(skills.map((skill) => [skill.id, skill]));
  const lines: (string | number | null)[][] = [RESEARCH_HEADER];
  for (const record of records) {
    const version = versionById.get(record.versionId);
    const skill = skillById.get(record.skillId);
    if (!version || !skill) continue;
    lines.push([
      pseudonym(salt, 'participant', record.participantId),
      pseudonym(salt, 'seance', record.sessionId),
      record.officialRaterId ? pseudonym(salt, 'formateur', record.officialRaterId) : '',
      pseudonym(salt, 'formateur', record.secondRaterId),
      record.origin === 'exercise' ? 'exercice' : 'co_formateur',
      version.frameworkCode,
      version.versionNumber,
      skill.code,
      version.scale.min,
      version.scale.max,
      version.scale.step,
      record.official,
      record.second,
      STATUS_LABEL[record.status],
      record.amendedAfter ? 'oui' : 'non',
    ]);
  }
  return toCsv(lines);
}
