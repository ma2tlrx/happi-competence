import { describe, expect, it } from 'vitest';

import { buildCsp, createNonce } from './csp';

describe('CSP à nonce', () => {
  it('produit un nonce aléatoire en base64', () => {
    const a = createNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(createNonce()).not.toBe(a);
  });

  it('interdit les scripts sans nonce en production', () => {
    const csp = buildCsp({ nonce: 'abc', supabaseUrl: 'https://projet.supabase.co/' });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("connect-src 'self' https://projet.supabase.co wss://projet.supabase.co");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('autorise eval et websocket en développement uniquement', () => {
    const csp = buildCsp({ nonce: 'abc', isDev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain('ws:');
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('n’ouvre pas de WebSocket pour une pile locale en http', () => {
    const csp = buildCsp({ nonce: 'n', supabaseUrl: 'http://127.0.0.1:54321' });
    expect(csp).toContain("connect-src 'self' http://127.0.0.1:54321;");
    expect(csp).not.toContain('wss:');
  });

  it('ignore une URL Supabase invalide', () => {
    expect(buildCsp({ nonce: 'n', supabaseUrl: 'pas une url' })).toContain("connect-src 'self';");
  });
});
