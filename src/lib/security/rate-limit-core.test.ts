import { describe, expect, it, vi } from 'vitest';

import {
  clientIp,
  evaluateRateLimits,
  formatDelay,
  RATE_LIMITS,
  rateLimitMessage,
  subjectFingerprint,
  type RateLimitHit,
} from './rate-limit-core';

const headers = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });

describe('adresse IP du visiteur', () => {
  it('prend la première adresse de x-forwarded-for, puis x-real-ip', () => {
    expect(clientIp(headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
    expect(clientIp(headers({ 'x-real-ip': '2001:db8::1' }))).toBe('2001:db8::1');
    expect(clientIp(headers({}))).toBe('inconnue');
  });

  it('refuse une valeur fantaisiste', () => {
    expect(clientIp(headers({ 'x-forwarded-for': '<script>' }))).toBe('inconnue');
  });
});

describe('empreintes', () => {
  it('sont stables, normalisées et dépendent de la clé', () => {
    const a = subjectFingerprint('secret', 'email', ' Lea@Exemple.fr ');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(subjectFingerprint('secret', 'email', 'lea@exemple.fr')).toBe(a);
    expect(subjectFingerprint('autre', 'email', 'lea@exemple.fr')).not.toBe(a);
    // Une IP et un e-mail identiques en texte ne partagent pas de compteur.
    expect(subjectFingerprint('secret', 'ip', 'x')).not.toBe(subjectFingerprint('secret', 'email', 'x'));
  });

  it('ne contiennent pas la valeur en clair', () => {
    expect(subjectFingerprint('secret', 'ip', '203.0.113.7')).not.toContain('203');
  });
});

describe('messages', () => {
  it('donnent un délai lisible', () => {
    expect(formatDelay(5)).toBe('1 minute');
    expect(formatDelay(14 * 60 + 1)).toBe('15 minutes');
    expect(formatDelay(3600)).toBe('1 heure');
    expect(formatDelay(7200)).toBe('2 heures');
  });

  it('ne révèlent pas l’existence d’un compte', () => {
    const message = rateLimitMessage('login', 600);
    expect(message).toBe('Trop de tentatives de connexion. Pour protéger les comptes, patientez 10 minutes avant de réessayer.');
    expect(rateLimitMessage('password_reset', 600)).not.toMatch(/compte (existe|inconnu)|adresse inconnue/i);
  });
});

describe('évaluation des limites', () => {
  it('compte chaque sujet fourni avec sa règle', async () => {
    const hit = vi.fn<RateLimitHit>(async () => ({ allowed: true, retryAfterSeconds: 0 }));
    expect(await evaluateRateLimits('login', { ip: '1.2.3.4', email: 'a@b.fr', user: 'ignoré' }, 's', hit)).toEqual({ ok: true });
    expect(hit).toHaveBeenCalledTimes(2);
    expect(hit.mock.calls.map(([action]) => action).sort()).toEqual(['login.email', 'login.ip']);
    expect(hit.mock.calls.find(([action]) => action === 'login.email')![2]).toEqual(RATE_LIMITS['login.email']);
  });

  it('renvoie le refus au délai le plus long', async () => {
    const hit: RateLimitHit = async (action) =>
      action === 'login.ip' ? { allowed: false, retryAfterSeconds: 60 } : { allowed: false, retryAfterSeconds: 600 };
    expect(await evaluateRateLimits('login', { ip: '1.2.3.4', email: 'a@b.fr' }, 's', hit)).toEqual({ ok: false, retryAfterSeconds: 600, action: 'login.email' });
  });

  it('laisse passer quand le compteur est indisponible', async () => {
    expect(await evaluateRateLimits('contact', { ip: '1.2.3.4' }, 's', async () => null)).toEqual({ ok: true });
  });

  it('ignore les sujets absents', async () => {
    const hit = vi.fn<RateLimitHit>(async () => ({ allowed: true, retryAfterSeconds: 0 }));
    await evaluateRateLimits('password_reset', { ip: '', email: null }, 's', hit);
    expect(hit).not.toHaveBeenCalled();
  });

  it('utilise des actions acceptées par la base', () => {
    for (const [action, rule] of Object.entries(RATE_LIMITS)) {
      expect(action).toMatch(/^[a-z_]+(\.[a-z_]+)*$/);
      expect(rule.limit).toBeGreaterThanOrEqual(1);
      expect(rule.windowSeconds).toBeLessThanOrEqual(86400);
    }
  });
});
