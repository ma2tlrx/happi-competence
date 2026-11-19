/**
 * Correspondance entre les situations HAPPI (participant_outcomes) et les indicateurs communs de
 * résultat FSE+ (annexe I du règlement (UE) 2021/1057). Calcul pur. Sources : docs/fse-plus.md.
 *
 * PROVISOIRE — à valider avec l'autorité de gestion (DREETS, Région, organisme intermédiaire).
 *
 *   EECR01 en recherche d'emploi au terme de la participation ← recherche_emploi
 *   EECR02 suivant un enseignement ou une formation           ← formation_qualifiante, formation_autre
 *   EECR03 obtenant une qualification                         ← case « qualification obtenue » (oui)
 *   EECR04 en emploi, y compris indépendant                   ← emploi_durable, emploi_transition, creation_activite
 *   EECR05 en emploi six mois après la fin de la participation ← mêmes codes, suivi à 6 mois
 *   EECR06 situation améliorée sur le marché du travail à 6 mois : non calculé (définition à vérifier).
 *
 * Non rattachées : immersion_stage (une immersion n'est ni un emploi ni une formation — à valider),
 * autre_etape, sans_nouvelles (situation inconnue).
 *
 * « Au terme de la participation » : la situation doit être observée entre la date de sortie et
 * 4 semaines (28 jours) après (guide de la Commission, à vérifier dans la version 2021). Une situation
 * observée hors de cette fenêtre est comptée à part (« hors délai »), jamais dans l'indicateur.
 * EECR01 et EECR04 sont exclusifs : une seule situation de sortie par parcours.
 */
import type { OutcomeSituation } from '@/lib/outcomes/labels';
import { addMonths, daysBetween } from '@/lib/outcomes/schedule';

export type ResultCode = 'EECR01' | 'EECR02' | 'EECR04';

export const SITUATION_TO_RESULT: Record<OutcomeSituation, ResultCode | null> = {
  recherche_emploi: 'EECR01',
  formation_qualifiante: 'EECR02',
  formation_autre: 'EECR02',
  emploi_durable: 'EECR04',
  emploi_transition: 'EECR04',
  creation_activite: 'EECR04',
  immersion_stage: null,
  autre_etape: null,
  sans_nouvelles: null,
};

export const EMPLOYMENT_SITUATIONS = (Object.keys(SITUATION_TO_RESULT) as OutcomeSituation[]).filter((code) => SITUATION_TO_RESULT[code] === 'EECR04');

/** Fenêtre « au terme de la participation » : jusqu'à 4 semaines après la sortie. */
export const EXIT_WINDOW_DAYS = 28;

export function resultFor(situation: string | null | undefined): ResultCode | null {
  return situation && situation in SITUATION_TO_RESULT ? SITUATION_TO_RESULT[situation as OutcomeSituation] : null;
}

export function isUnknownSituation(situation: string | null | undefined) {
  return situation === 'sans_nouvelles';
}

export function isEmployed(situation: string | null | undefined) {
  return resultFor(situation) === 'EECR04';
}

/**
 * Position de l'observation par rapport à la fenêtre de sortie : « within » de la date de sortie à
 * +28 jours ; « before » / « after » sinon ; « unknown » si la date de sortie n'est pas connue.
 */
export type WindowPosition = 'within' | 'before' | 'after' | 'unknown';
export function exitWindowPosition(exitDate: string | null, observedOn: string): WindowPosition {
  if (!exitDate) return 'unknown';
  const days = daysBetween(exitDate, observedOn);
  if (days < 0) return 'before';
  return days <= EXIT_WINDOW_DAYS ? 'within' : 'after';
}

/** Date de la situation à 6 mois (pour information ; aucune fenêtre n'est imposée dans les sources lues). */
export function sixMonthsAfter(exitDate: string) {
  return addMonths(exitDate, 6);
}
