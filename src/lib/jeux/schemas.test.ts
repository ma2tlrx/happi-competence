import { describe, expect, it } from 'vitest';

import { canManageGames, isSameOrigin, ownsOrAdmin } from './guards';
import {
  gameCodeSchema,
  nicknameSchema,
  playableProblem,
  questionSchema,
  quizAnswerSchema,
  quizUpdateSchema,
  sessionJoinSchema,
  undercoverCreateSchema,
  undercoverNextPhaseSchema,
} from './schemas';
import { hashToken, newPlayerToken, sameHash } from './tokens';
import { RATE_LIMITS, rateLimitMessage } from '@/lib/security/rate-limit-core';

const uuid = '3f0c6a52-7a39-4f1c-9a53-5d4f7f4c2b11';

describe('pseudo', () => {
  it('normalise les espaces et borne la longueur', () => {
    expect(nicknameSchema.parse('  Léa   Dupont ')).toBe('Léa Dupont');
    expect(nicknameSchema.safeParse('A').success).toBe(false);
    expect(nicknameSchema.safeParse('x'.repeat(25)).success).toBe(false);
  });
  it('refuse chevrons et caractères de contrôle', () => {
    expect(nicknameSchema.safeParse('<script>').success).toBe(false);
    expect(nicknameSchema.safeParse('ab\u0000c').success).toBe(false);
  });
  it('refuse un type inattendu', () => {
    expect(nicknameSchema.safeParse(42).success).toBe(false);
    expect(nicknameSchema.safeParse({ $ne: '' }).success).toBe(false);
  });
});

describe('code de partie', () => {
  it('met en majuscules et exige 6 caractères alphanumériques', () => {
    expect(gameCodeSchema.parse(' abc234 ')).toBe('ABC234');
    for (const bad of ['ABC23', 'ABC2345', 'ABC-23', '', "ABC23'"]) expect(gameCodeSchema.safeParse(bad).success).toBe(false);
  });
  it('est requis à l’entrée dans une partie', () => {
    expect(sessionJoinSchema.safeParse({ nickname: 'Léa' }).success).toBe(false);
    expect(sessionJoinSchema.safeParse({ code: 'abc234', nickname: 'Léa' }).success).toBe(true);
  });
});

describe('réponse d’un joueur', () => {
  it('exige des identifiants et un jeton bien formés', () => {
    expect(quizAnswerSchema.safeParse({ playerId: uuid, answerId: 'a1', playerToken: 'x'.repeat(32) }).success).toBe(true);
    expect(quizAnswerSchema.safeParse({ playerId: 'pas-un-uuid', answerId: 'a1', playerToken: 'x'.repeat(32) }).success).toBe(false);
    expect(quizAnswerSchema.safeParse({ playerId: uuid, answerId: 'a1', playerToken: 'court' }).success).toBe(false);
    expect(quizAnswerSchema.safeParse({ playerId: uuid, playerToken: 'x'.repeat(32) }).success).toBe(false);
  });
});

describe('questions', () => {
  const valid = { text: 'Q ?', type: 'multiple_choice', timeLimit: 20, answers: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }] };
  it('accepte une question complète', () => {
    expect(questionSchema.safeParse(valid).success).toBe(true);
  });
  it('refuse un type, une durée ou une image invalides', () => {
    expect(questionSchema.safeParse({ ...valid, type: 'libre' }).success).toBe(false);
    expect(questionSchema.safeParse({ ...valid, timeLimit: 1 }).success).toBe(false);
    expect(questionSchema.safeParse({ ...valid, timeLimit: 20.5 }).success).toBe(false);
    expect(questionSchema.safeParse({ ...valid, imageUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(questionSchema.safeParse({ ...valid, imageUrl: 'http://exemple.fr/a.png' }).success).toBe(false);
    expect(questionSchema.safeParse({ ...valid, imageUrl: 'https://exemple.fr/a.png' }).success).toBe(true);
  });
  it('limite le nombre de réponses et de questions', () => {
    expect(questionSchema.safeParse({ ...valid, answers: [{ text: 'A', isCorrect: true }] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...valid, answers: Array.from({ length: 9 }, () => ({ text: 'x', isCorrect: false })) }).success).toBe(false);
    expect(quizUpdateSchema.safeParse({ questions: Array.from({ length: 101 }, () => valid) }).success).toBe(false);
  });
  it('playableProblem repère une question injouable', () => {
    expect(playableProblem([{ text: 'Q', answers: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }] }])).toBeNull();
    expect(playableProblem([{ text: '', answers: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }] }])).toMatch(/énoncé/);
    expect(playableProblem([{ text: 'Q', answers: [{ text: 'A', isCorrect: true }, { text: '', isCorrect: false }] }])).toMatch(/deux réponses/);
    expect(playableProblem([{ text: 'Q', answers: [{ text: 'A', isCorrect: false }, { text: 'B', isCorrect: false }] }])).toMatch(/bonne réponse/);
    expect(playableProblem([{ text: 'Q', answers: [{ text: 'A', isCorrect: true }, { text: 'a', isCorrect: false }] }])).toMatch(/même texte/);
  });
});

describe('Undercover', () => {
  it('exige deux mots différents, ou un thème', () => {
    expect(undercoverCreateSchema.safeParse({ civilWord: 'Chat', undercoverWord: 'Chien' }).success).toBe(true);
    expect(undercoverCreateSchema.safeParse({ themeId: 'animaux' }).success).toBe(true);
    expect(undercoverCreateSchema.safeParse({ civilWord: 'Chat' }).success).toBe(false);
    expect(undercoverCreateSchema.safeParse({}).success).toBe(false);
    expect(undercoverCreateSchema.safeParse({ civilWord: 'Chat', undercoverWord: 'chat' }).success).toBe(false);
  });
  it('n’accepte que les actions de phase connues', () => {
    expect(undercoverNextPhaseSchema.safeParse({ action: 'start_voting' }).success).toBe(true);
    expect(undercoverNextPhaseSchema.safeParse({ action: 'resolve' }).success).toBe(false);
  });
});

describe('droits', () => {
  const trainer = { id: 'u1', role: 'formateur', status: 'active', permissions: ['games.manage'] };
  it('formateur avec la permission, administrateur actif : oui', () => {
    expect(canManageGames(trainer)).toBe(true);
    expect(canManageGames({ ...trainer, role: 'admin', permissions: [] })).toBe(true);
  });
  it('sans permission, compte désactivé, autres rôles, anonyme : non', () => {
    expect(canManageGames({ ...trainer, permissions: [] })).toBe(false);
    expect(canManageGames({ ...trainer, status: 'disabled' })).toBe(false);
    for (const role of ['participant', 'organisme']) expect(canManageGames({ ...trainer, role })).toBe(false);
    expect(canManageGames(null)).toBe(false);
  });
  it('propriété : le créateur ou l’administrateur', () => {
    expect(ownsOrAdmin(trainer, 'u1')).toBe(true);
    expect(ownsOrAdmin(trainer, 'u2')).toBe(false);
    expect(ownsOrAdmin(trainer, null)).toBe(false);
    expect(ownsOrAdmin({ ...trainer, role: 'admin' }, 'u2')).toBe(true);
  });
  it('contrôle d’origine', () => {
    expect(isSameOrigin(null, 'site.fr')).toBe(true);
    expect(isSameOrigin('https://site.fr', 'site.fr')).toBe(true);
    expect(isSameOrigin('https://autre.fr', 'site.fr')).toBe(false);
    expect(isSameOrigin('pas une url', 'site.fr')).toBe(false);
  });
});

describe('jetons et limitation de débit', () => {
  it('le jeton est aléatoire et seule son empreinte se compare', () => {
    const a = newPlayerToken();
    const b = newPlayerToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(16);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(sameHash(hashToken(a), hashToken(a))).toBe(true);
    expect(sameHash(hashToken(a), hashToken(b))).toBe(false);
    expect(sameHash(undefined, hashToken(a))).toBe(false);
  });
  it('les portées de jeu sont déclarées', () => {
    expect(RATE_LIMITS['game_join.ip'].limit).toBeGreaterThan(0);
    expect(RATE_LIMITS['game_play.ip'].limit).toBeGreaterThan(RATE_LIMITS['game_join.ip'].limit);
    expect(rateLimitMessage('game_join', 60)).toContain('1 minute');
  });
});
