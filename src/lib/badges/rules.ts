import { z } from 'zod';

import { formatHours } from '@/lib/attendance/hours';
import '@/lib/zod-fr';

/**
 * Règles d'attribution des badges — module pur.
 *
 * Aucun critère pédagogique n'est fixé ici : l'administrateur compose la règle de chaque
 * modèle à partir de faits déjà mesurés par la plateforme, évalués par groupe suivi :
 * - heures réalisées (règle du certificat de réalisation, src/lib/attendance/hours.ts) ;
 * - programme terminé (groupe clôturé, ou toutes les séances prévues terminées) ;
 * - niveau validé d'une compétence atteint au moins N fois (évaluations validées du groupe).
 * Toutes les conditions doivent être remplies. Une règle sans condition ne suggère personne :
 * l'émission reste alors entièrement manuelle. Rien n'est jamais émis automatiquement.
 */

const code = z.string().regex(/^[a-z0-9_]+$/).max(80);

export const conditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('realised_hours'), minHours: z.number().min(0.5).max(200) }),
  z.object({ type: z.literal('program_completed') }),
  z.object({
    type: z.literal('skill_level'),
    frameworkCode: code,
    skillCode: code,
    minLevel: z.number().min(0).max(100),
    minTimes: z.number().int().min(1).max(24),
  }),
]);
export type AwardCondition = z.infer<typeof conditionSchema>;

export const awardRuleSchema = z.object({ version: z.literal(1), conditions: z.array(conditionSchema).max(10) });
export type AwardRule = z.infer<typeof awardRuleSchema>;

export const EMPTY_RULE: AwardRule = { version: 1, conditions: [] };
export const MAX_SKILL_CONDITIONS = 3;

/** Règle lue en base ; une valeur illisible est traitée comme une règle vide (aucune suggestion). */
export function parseRule(value: unknown): AwardRule {
  const parsed = awardRuleSchema.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_RULE;
}

/** Faits mesurés pour un participant dans un groupe. */
export type MembershipFacts = {
  realisedMinutes: number;
  plannedSessions: number;
  completedSessions: number;
  groupCompleted: boolean;
  /** Notes des évaluations validées du groupe, par compétence (« référentiel:compétence »). */
  skillScores: Record<string, number[]>;
};

export const skillKey = (frameworkCode: string, skillCode: string) => `${frameworkCode}:${skillCode}`;

export function programCompleted(facts: Pick<MembershipFacts, 'groupCompleted' | 'plannedSessions' | 'completedSessions'>) {
  return facts.groupCompleted || (facts.plannedSessions > 0 && facts.completedSessions >= facts.plannedSessions);
}

export type ConditionResult = { condition: AwardCondition; met: boolean; detail: string };
export type RuleEvaluation = { configured: boolean; eligible: boolean; results: ConditionResult[] };

export function evaluateRule(rule: AwardRule, facts: MembershipFacts, skillNames: Record<string, string> = {}): RuleEvaluation {
  const results = rule.conditions.map((condition): ConditionResult => {
    switch (condition.type) {
      case 'realised_hours': {
        const met = facts.realisedMinutes >= Math.round(condition.minHours * 60);
        return { condition, met, detail: `${formatHours(facts.realisedMinutes)} réalisées sur ${formatHours(Math.round(condition.minHours * 60))} demandées` };
      }
      case 'program_completed': {
        const met = programCompleted(facts);
        return { condition, met, detail: met ? 'Programme terminé' : `${facts.completedSessions} séance(s) terminée(s) sur ${facts.plannedSessions}` };
      }
      case 'skill_level': {
        const key = skillKey(condition.frameworkCode, condition.skillCode);
        const times = (facts.skillScores[key] ?? []).filter((score) => score >= condition.minLevel).length;
        return {
          condition,
          met: times >= condition.minTimes,
          detail: `${skillNames[key] ?? condition.skillCode} : niveau ${condition.minLevel} ou plus atteint ${times} fois sur ${condition.minTimes}`,
        };
      }
    }
  });
  const configured = results.length > 0;
  return { configured, eligible: configured && results.every((result) => result.met), results };
}

export function describeCondition(condition: AwardCondition, skillNames: Record<string, string> = {}) {
  switch (condition.type) {
    case 'realised_hours':
      return `Au moins ${formatHours(Math.round(condition.minHours * 60))} réalisées (règle du certificat de réalisation)`;
    case 'program_completed':
      return 'Programme terminé (groupe clôturé ou toutes les séances prévues terminées)';
    case 'skill_level': {
      const name = skillNames[skillKey(condition.frameworkCode, condition.skillCode)] ?? condition.skillCode;
      return `${name} : niveau validé ${condition.minLevel} ou plus, au moins ${condition.minTimes} fois`;
    }
  }
}

/** Champs du formulaire de règle (Admin › Badges) → règle validée. */
export function ruleFromForm(form: Record<string, string>): { ok: true; rule: AwardRule } | { ok: false; message: string } {
  const conditions: AwardCondition[] = [];
  const number = (value: string | undefined) => (value && value.trim() !== '' ? Number(value.replace(',', '.')) : null);
  const hours = number(form.minHours);
  if (form.useHours === 'on') {
    if (hours === null || Number.isNaN(hours)) return { ok: false, message: 'Indiquez le nombre d’heures réalisées demandé.' };
    conditions.push({ type: 'realised_hours', minHours: hours });
  }
  if (form.programCompleted === 'on') conditions.push({ type: 'program_completed' });
  for (let index = 0; index < MAX_SKILL_CONDITIONS; index += 1) {
    const skill = form[`skill_${index}`]?.trim();
    if (!skill) continue;
    const [frameworkCode, skillCode] = skill.split(':');
    const minLevel = number(form[`level_${index}`]);
    const minTimes = number(form[`times_${index}`]);
    if (minLevel === null || minTimes === null) return { ok: false, message: 'Pour chaque compétence choisie, indiquez le niveau et le nombre de fois.' };
    conditions.push({ type: 'skill_level', frameworkCode: frameworkCode ?? '', skillCode: skillCode ?? '', minLevel, minTimes });
  }
  const parsed = awardRuleSchema.safeParse({ version: 1, conditions });
  if (!parsed.success) return { ok: false, message: 'Règle invalide : vérifiez les valeurs (heures de 0,5 à 200, nombre de fois de 1 à 24).' };
  return { ok: true, rule: parsed.data };
}
