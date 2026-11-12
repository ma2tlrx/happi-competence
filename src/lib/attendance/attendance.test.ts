import { describe, expect, it } from 'vitest';

import { canonicalJson, sheetFingerprint, signatureSha256 } from './fingerprint';
import { computeRealisation, formatHours, sessionMinutes, type RealisationSession } from './hours';
import {
  isSignatureWindowOpen,
  MAX_SIGNATURE_PATH_LENGTH,
  parisDate,
  pathPoints,
  strokesToPath,
  validateSignaturePath,
  type Point,
} from './signature';

describe('heures réalisées', () => {
  it('durée réelle par les horaires, sinon la trame, sinon 3 h', () => {
    expect(sessionMinutes({ startTime: '09:00:00', endTime: '12:30:00' }, 180)).toBe(210);
    expect(sessionMinutes({ startTime: '09:00:00', endTime: null }, 150)).toBe(150);
    expect(sessionMinutes({ startTime: '12:00', endTime: '09:00' }, null)).toBe(180);
    expect(sessionMinutes({ startTime: null, endTime: null })).toBe(180);
  });

  const session = (number: number, status: string, extra: Partial<RealisationSession> = {}): RealisationSession => ({
    id: `s${number}`,
    number,
    status,
    scheduledDate: `2026-10-0${number}`,
    startTime: null,
    endTime: null,
    ...extra,
  });

  it('compte les séances terminées où le participant était présent, en retard ou parti plus tôt', () => {
    const result = computeRealisation({
      sessions: [
        session(1, 'completed'),
        session(2, 'completed', { startTime: '14:00:00', endTime: '16:30:00' }),
        session(3, 'completed'),
        session(4, 'completed'),
        session(5, 'in_progress'),
        session(6, 'cancelled'),
      ],
      attendance: new Map([
        ['s1', 'present'],
        ['s2', 'late'],
        ['s3', 'absent'],
        ['s4', 'left_early'],
        ['s5', 'present'],
      ]),
      programMinutes: 180,
      programSessionsCount: 6,
    });
    expect(result.realisedMinutes).toBe(180 + 150 + 180);
    expect(result.attendedSessions).toBe(3);
    expect(result.completedSessions).toBe(4);
    // 5 séances non annulées (180 × 4 + 150) + 1 séance de la trame non planifiée.
    expect(result.plannedMinutes).toBe(180 * 4 + 150 + 180);
    expect(result.plannedSessions).toBe(6);
    expect(result.firstDate).toBe('2026-10-01');
    expect(result.lastDate).toBe('2026-10-05');
  });

  it('formate les heures', () => {
    expect(formatHours(1080)).toBe('18 h');
    expect(formatHours(1050)).toBe('17 h 30');
    expect(formatHours(65)).toBe('1 h 05');
  });
});

describe('empreintes', () => {
  // Valeurs calculées par private.signature_sha256 sur la base locale (migration 20261113090000).
  it('reproduit l’empreinte calculée par la base', () => {
    expect(
      signatureSha256({
        sessionId: '11111111-1111-1111-1111-111111111111',
        participantId: '22222222-2222-2222-2222-222222222222',
        signedAt: '2026-11-13T09:15:30.123+00:00',
        kind: 'drawn',
        content: 'M10 10 L20 20',
      }),
    ).toBe('9284e81f76a38e393c0d5c76b2f841f37d049cb92ac63920c3fdf186faa8edc8');
    expect(
      signatureSha256({ sessionId: '11111111-1111-1111-1111-111111111111', participantId: null, signedAt: '2026-11-13T10:15:30.123+01:00', kind: 'countersign', content: 'M1 1|abc' }),
    ).toBe('89fdacbea1d25218efccc73121942a2b6c37ba902efe58edf9df08d756274bfa');
  });

  it('JSON canonique indépendant de l’ordre des clés', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: null }], c: 'x' }, u: undefined })).toBe('{"a":{"c":"x","d":[2,{"y":null,"z":1}]},"b":1}');
    expect(sheetFingerprint({ a: 1, b: 2 })).toBe(sheetFingerprint({ b: 2, a: 1 }));
    expect(sheetFingerprint({ a: 1, b: 2 })).not.toBe(sheetFingerprint({ a: 1, b: 3 }));
    expect(sheetFingerprint({})).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('validation de la signature', () => {
  const wave = (count: number, offset = 0): Point[] => Array.from({ length: count }, (_, i) => ({ x: 20 + i * 3 + offset, y: 100 + Math.sin(i / 3) * 40 }));

  it('produit un tracé valide et borné', () => {
    const path = strokesToPath([wave(60), wave(20, 10)]);
    expect(path.startsWith('M')).toBe(true);
    expect(validateSignaturePath(path)).toEqual({ ok: true });
    expect(pathPoints(path).every((point) => point.x <= 600 && point.y <= 200)).toBe(true);
  });

  it('borne les coordonnées hors cadre', () => {
    const path = strokesToPath([[{ x: -40, y: -5 }, { x: 900, y: 500 }, { x: 300, y: 100 }, { x: 310, y: 120 }, { x: 330, y: 90 }]]);
    expect(path).toBe('M0 0 L600 200 L300 100 L310 120 L330 90');
    expect(validateSignaturePath(path)).toEqual({ ok: true });
  });

  it('simplifie un tracé trop long', () => {
    const long = Array.from({ length: 400 }, (_, s) => Array.from({ length: 30 }, (_, i) => ({ x: (s + i * 7) % 600, y: (i * 13 + s) % 200 })));
    const path = strokesToPath(long);
    expect(path.length).toBeLessThanOrEqual(MAX_SIGNATURE_PATH_LENGTH);
  });

  it('refuse les contenus invalides', () => {
    expect(validateSignaturePath('')).toMatchObject({ ok: false });
    expect(validateSignaturePath(null)).toMatchObject({ ok: false });
    expect(validateSignaturePath('M10 10 L20 20 <script>')).toMatchObject({ ok: false });
    expect(validateSignaturePath('M10 10 L700 20 L30 25 L40 30 L1 1')).toMatchObject({ ok: false });
    expect(validateSignaturePath('M10 10 L11 11 L12 12 L13 10 L12 11')).toMatchObject({ ok: false, message: expect.stringMatching(/courte/) });
    expect(validateSignaturePath('M10 10 L80 20')).toMatchObject({ ok: false });
    expect(validateSignaturePath(`M1 1${' L2 2'.repeat(6000)}`)).toMatchObject({ ok: false, message: expect.stringMatching(/longue/) });
  });
});

describe('fenêtre d’émargement', () => {
  it('date de Paris et règle d’ouverture', () => {
    expect(parisDate(new Date('2026-11-12T23:30:00Z'))).toBe('2026-11-13');
    expect(isSignatureWindowOpen({ status: 'planned', scheduled_date: '2026-11-13' }, '2026-11-13')).toBe(true);
    expect(isSignatureWindowOpen({ status: 'in_progress', scheduled_date: '2026-11-01' }, '2026-11-13')).toBe(true);
    expect(isSignatureWindowOpen({ status: 'completed', scheduled_date: '2026-11-12' }, '2026-11-13')).toBe(false);
    expect(isSignatureWindowOpen({ status: 'cancelled', scheduled_date: '2026-11-13' }, '2026-11-13')).toBe(false);
  });
});
