import { describe, expect, it } from 'vitest';

import { decodeJwtPayload, mfaStep, normalizeTotpCode, parseMfaStatus, qrCodeDataUri } from './mfa';

describe('étape de double authentification', () => {
  it('demande le code si un facteur est vérifié et la session en aal1', () => {
    expect(mfaStep({ aal: 'aal1', enrolled: true, required: false })).toBe('challenge');
    expect(mfaStep({ aal: 'aal1', enrolled: true, required: true })).toBe('challenge');
  });

  it('demande l’activation si elle est exigée et absente', () => {
    expect(mfaStep({ aal: 'aal1', enrolled: false, required: true })).toBe('enroll');
  });

  it('ne demande rien sinon', () => {
    expect(mfaStep({ aal: 'aal1', enrolled: false, required: false })).toBeNull();
    expect(mfaStep({ aal: 'aal2', enrolled: true, required: true })).toBeNull();
  });
});

describe('lecture de l’état', () => {
  it('est prudente quand la réponse manque', () => {
    expect(parseMfaStatus(null, 'aal1')).toEqual({ aal: 'aal1', enrolled: false, required: false });
    expect(parseMfaStatus({ aal: 'aal2', verified: true, required: true }, 'aal1')).toEqual({ aal: 'aal2', enrolled: true, required: true });
  });

  it('décode la charge utile d’un jeton', () => {
    const payload = Buffer.from(JSON.stringify({ aal: 'aal2', sub: 'é' })).toString('base64url');
    expect(decodeJwtPayload(`x.${payload}.y`)).toEqual({ aal: 'aal2', sub: 'é' });
    expect(decodeJwtPayload('pas-un-jeton')).toBeNull();
    expect(decodeJwtPayload(undefined)).toBeNull();
  });
});

describe('saisie', () => {
  it('accepte six chiffres, espaces tolérés', () => {
    expect(normalizeTotpCode('123 456')).toBe('123456');
    expect(normalizeTotpCode('12345')).toBeNull();
    expect(normalizeTotpCode('abcdef')).toBeNull();
  });

  it('réencode le QR code SVG', () => {
    const uri = qrCodeDataUri('data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>');
    expect(uri).toMatch(/^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
    expect(qrCodeDataUri('<script>alert(1)</script>')).toBeNull();
  });
});
