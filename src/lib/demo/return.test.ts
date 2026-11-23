import { describe, expect, it } from 'vitest';

import { DEMO_RETURN_TTL_SECONDS, signDemoReturn, verifyDemoReturn } from './return';

const SECRET = 'cle-de-test-longue-et-secrete';
const ADMIN = '3b50d85a-7050-4b56-9dec-41a9dbc01fa8';
const DEMO = '10bffc62-5bb0-4b05-b2f9-5691bd0d7153';
const OTHER = '99999999-9999-4999-8999-999999999999';
const NOW = 1_800_000_000_000;

describe('retour de la démonstration vers l’administrateur', () => {
  it('rend l’administrateur pour un témoin authentique lié à la session démo en cours', () => {
    expect(verifyDemoReturn(SECRET, signDemoReturn(SECRET, ADMIN, DEMO, NOW), DEMO, NOW + 1000)).toBe(ADMIN);
  });

  it('refuse un témoin lié à un autre compte (session en cours différente)', () => {
    expect(verifyDemoReturn(SECRET, signDemoReturn(SECRET, ADMIN, DEMO, NOW), OTHER, NOW)).toBeNull();
  });

  it('refuse un témoin expiré', () => {
    const value = signDemoReturn(SECRET, ADMIN, DEMO, NOW);
    expect(verifyDemoReturn(SECRET, value, DEMO, NOW + (DEMO_RETURN_TTL_SECONDS + 5) * 1000)).toBeNull();
  });

  it('refuse un témoin falsifié (autre administrateur, autre signature, autre clé)', () => {
    const value = signDemoReturn(SECRET, ADMIN, DEMO, NOW);
    expect(verifyDemoReturn(SECRET, value.replace(ADMIN, OTHER), DEMO, NOW)).toBeNull();
    expect(verifyDemoReturn(SECRET, `${value.slice(0, -2)}xx`, DEMO, NOW)).toBeNull();
    expect(verifyDemoReturn('autre-cle', value, DEMO, NOW)).toBeNull();
  });

  it('refuse les valeurs absentes ou mal formées, et une clé vide', () => {
    for (const value of [undefined, '', 'abc', 'a.b.c.d', `${ADMIN}.${DEMO}.pas-un-nombre.x`]) expect(verifyDemoReturn(SECRET, value, DEMO, NOW)).toBeNull();
    expect(verifyDemoReturn('', signDemoReturn('', ADMIN, DEMO, NOW), DEMO, NOW)).toBeNull();
  });
});
