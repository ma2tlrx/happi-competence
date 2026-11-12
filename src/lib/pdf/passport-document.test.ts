import { join } from 'node:path';

import { renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { fixturePassport } from '@/lib/report/fixtures';

import { PassportDocument } from './passport-document';

const mascotPath = join(process.cwd(), 'public', 'brand', 'happi-mascotte.png');
const passport = fixturePassport({ ct: { relationnel: [[1, 3]] }, evaluated: [1], attended: [1] });

describe('passeport PDF', () => {
  it('se produit sans QR code par défaut et avec le QR code d’un lien choisi', async () => {
    const plain = await renderToBuffer(createElement(PassportDocument, { passport, mascotPath, generatedAt: new Date('2026-11-12') }) as never);
    const qr = await QRCode.toDataURL('http://localhost:3000/verifier/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', { margin: 2 });
    const withQr = await renderToBuffer(createElement(PassportDocument, { passport, mascotPath, generatedAt: new Date('2026-11-12'), verification: { qr } }) as never);
    expect(plain.subarray(0, 4).toString()).toBe('%PDF');
    expect(withQr.subarray(0, 4).toString()).toBe('%PDF');
    expect(withQr.length).toBeGreaterThan(plain.length);
  });
});
