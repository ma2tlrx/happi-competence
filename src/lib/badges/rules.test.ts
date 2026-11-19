import { describe, expect, it } from 'vitest';

import { describeCondition, EMPTY_RULE, evaluateRule, parseRule, programCompleted, ruleFromForm, type AwardRule, type MembershipFacts } from './rules';

const facts = (overrides: Partial<MembershipFacts> = {}): MembershipFacts => ({
  realisedMinutes: 15 * 60,
  plannedSessions: 6,
  completedSessions: 6,
  groupCompleted: false,
  skillScores: { 'transversal:cooperation': [2, 3, 3], 'transversal:autonomie': [1] },
  ...overrides,
});

describe('règles d’attribution', () => {
  it('une règle vide ne suggère personne', () => {
    expect(evaluateRule(EMPTY_RULE, facts())).toEqual({ configured: false, eligible: false, results: [] });
  });

  it('heures réalisées : seuil inclus', () => {
    const rule: AwardRule = { version: 1, conditions: [{ type: 'realised_hours', minHours: 15 }] };
    expect(evaluateRule(rule, facts()).eligible).toBe(true);
    expect(evaluateRule(rule, facts({ realisedMinutes: 15 * 60 - 1 })).eligible).toBe(false);
    expect(evaluateRule(rule, facts()).results[0]!.detail).toBe('15 h réalisées sur 15 h demandées');
  });

  it('programme terminé : groupe clôturé ou toutes les séances prévues terminées', () => {
    expect(programCompleted({ groupCompleted: true, plannedSessions: 6, completedSessions: 2 })).toBe(true);
    expect(programCompleted({ groupCompleted: false, plannedSessions: 6, completedSessions: 6 })).toBe(true);
    expect(programCompleted({ groupCompleted: false, plannedSessions: 6, completedSessions: 5 })).toBe(false);
    expect(programCompleted({ groupCompleted: false, plannedSessions: 0, completedSessions: 0 })).toBe(false);
  });

  it('niveau validé d’une compétence atteint au moins N fois', () => {
    const rule = (minLevel: number, minTimes: number): AwardRule => ({
      version: 1,
      conditions: [{ type: 'skill_level', frameworkCode: 'transversal', skillCode: 'cooperation', minLevel, minTimes }],
    });
    expect(evaluateRule(rule(3, 2), facts()).eligible).toBe(true);
    expect(evaluateRule(rule(3, 3), facts()).eligible).toBe(false);
    expect(evaluateRule(rule(1, 1), facts({ skillScores: {} })).eligible).toBe(false);
    expect(evaluateRule(rule(3, 2), facts(), { 'transversal:cooperation': 'Coopération' }).results[0]!.detail).toContain('Coopération');
  });

  it('toutes les conditions doivent être remplies', () => {
    const rule: AwardRule = { version: 1, conditions: [{ type: 'realised_hours', minHours: 12 }, { type: 'program_completed' }] };
    expect(evaluateRule(rule, facts()).eligible).toBe(true);
    const partial = evaluateRule(rule, facts({ completedSessions: 4 }));
    expect(partial.eligible).toBe(false);
    expect(partial.results.map((result) => result.met)).toEqual([true, false]);
  });

  it('une règle illisible en base devient une règle vide', () => {
    expect(parseRule(null)).toEqual(EMPTY_RULE);
    expect(parseRule({ version: 2, conditions: [] })).toEqual(EMPTY_RULE);
    expect(parseRule({ version: 1, conditions: [{ type: 'inconnu' }] })).toEqual(EMPTY_RULE);
  });

  it('formulaire → règle', () => {
    expect(ruleFromForm({})).toEqual({ ok: true, rule: EMPTY_RULE });
    const result = ruleFromForm({ useHours: 'on', minHours: '13,5', programCompleted: 'on', skill_0: 'transversal:cooperation', level_0: '3', times_0: '2', skill_1: '' });
    expect(result).toEqual({
      ok: true,
      rule: {
        version: 1,
        conditions: [
          { type: 'realised_hours', minHours: 13.5 },
          { type: 'program_completed' },
          { type: 'skill_level', frameworkCode: 'transversal', skillCode: 'cooperation', minLevel: 3, minTimes: 2 },
        ],
      },
    });
    expect(ruleFromForm({ useHours: 'on', minHours: '' }).ok).toBe(false);
    expect(ruleFromForm({ useHours: 'on', minHours: '500' }).ok).toBe(false);
    expect(ruleFromForm({ skill_0: 'transversal:cooperation', level_0: '3' }).ok).toBe(false);
    expect(ruleFromForm({ skill_0: 'Pas un code', level_0: '3', times_0: '1' }).ok).toBe(false);
  });

  it('décrit chaque condition en français', () => {
    expect(describeCondition({ type: 'realised_hours', minHours: 17.5 })).toBe('Au moins 17 h 30 réalisées (règle du certificat de réalisation)');
    expect(describeCondition({ type: 'program_completed' })).toMatch(/Programme terminé/);
  });
});
