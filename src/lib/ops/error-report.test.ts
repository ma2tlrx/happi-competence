import { describe, expect, it } from 'vitest';

import { buildErrorLog, parseSentryDsn, scrub, sentryRequest } from './error-report';

const context = { routerKind: 'App Router', routePath: '/verifier/[token]', routeType: 'render', renderSource: 'server-rendering' };

describe('journal des erreurs serveur', () => {
  it('masque e-mails et jetons', () => {
    const text = scrub(`Key (email)=(jean.dupont@example.fr) Bearer abc.def eyJhbGciOi.eyJzdWIi.c2lnbmF0dXJl ${'x'.repeat(48)}`);
    expect(text).not.toContain('jean.dupont');
    expect(text).toContain('[e-mail]');
    expect(text).not.toContain('eyJhbGciOi');
    expect(text).not.toContain('x'.repeat(48));
  });

  it('ne garde que le gabarit de route, jamais l’adresse réelle ni les en-têtes', () => {
    const error = Object.assign(new Error('échec pour marie@exemple.org'), { digest: '123' });
    const log = buildErrorLog(error, { path: '/verifier/SECRET-TOKEN?x=1', method: 'GET' }, context, new Date('2026-11-16T10:00:00Z'), 'abc');
    const line = JSON.stringify(log);
    expect(line).not.toContain('SECRET-TOKEN');
    expect(line).not.toContain('marie@');
    expect(log).toMatchObject({ level: 'error', route: '/verifier/[token]', digest: '123', method: 'GET', commit: 'abc', time: '2026-11-16T10:00:00.000Z' });
  });

  it('accepte une valeur non Error', () => {
    expect(buildErrorLog('boom', { path: '/', method: 'POST' }, {}).message).toBe('boom');
    expect(buildErrorLog(42, { path: '/', method: 'POST' }, {}).message).toBe('Erreur non typée');
  });
});

describe('envoi Sentry sans SDK', () => {
  it('lit un DSN', () => {
    expect(parseSentryDsn('https://cle123@o42.ingest.de.sentry.io/4507')).toEqual({
      publicKey: 'cle123',
      endpoint: 'https://o42.ingest.de.sentry.io/api/4507/envelope/',
      dsn: 'https://cle123@o42.ingest.de.sentry.io/4507',
    });
    expect(parseSentryDsn('https://o42.ingest.sentry.io/4507')).toBeNull();
    expect(parseSentryDsn('nimporte quoi')).toBeNull();
  });

  it('construit une enveloppe sans donnée de requête', () => {
    const log = buildErrorLog(new Error('x'), { path: '/admin', method: 'GET' }, context);
    const request = sentryRequest('https://cle@sentry.example/12', log, null, 'e'.repeat(32));
    expect(request?.url).toBe('https://sentry.example/api/12/envelope/');
    const [header, item, event] = (request?.init.body ?? '').split('\n').map((line) => JSON.parse(line));
    expect(header.event_id).toBe('e'.repeat(32));
    expect(item.type).toBe('event');
    expect(event.exception.values[0]).toEqual({ type: 'Error', value: 'x' });
    expect(event.user).toBeUndefined();
    expect(event.request).toBeUndefined();
    expect(sentryRequest('invalide', log, null, 'e')).toBeNull();
  });
});
