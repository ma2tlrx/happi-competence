import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import type { Certificate, SignatureSheet } from '@/lib/attendance/documents';
import { computeRealisation } from '@/lib/attendance/hours';

import { CertificateDocument } from './certificate-document';
import { SignatureSheetDocument } from './signature-sheet-document';

// REPORT_PDF_OUT=<dossier> : écrit les PDF pour relecture visuelle.
const out = process.env.REPORT_PDF_OUT;
const path = 'M20 120 L60 60 L100 140 L140 70 L180 130 L220 80 M260 100 L300 100';

const sheet: SignatureSheet = {
  session: { id: 's1', number: 2, title: 'Coopérer', date: '2026-11-12', startTime: '09:00:00', endTime: '12:00:00', location: 'Salle 3', status: 'in_progress' },
  groupId: 'g1',
  groupName: 'Groupe Littoral',
  organizationName: 'Mission locale',
  programName: 'Programme HAPPI',
  trainers: ['Camille Formatrice'],
  rows: [
    { participantId: 'p1', lastName: 'Martin', firstName: 'Léa', status: 'present', statusLabel: 'Présent', corrected: false, signature: { kind: 'drawn', path, reason: null, signedAt: '2026-11-12T09:05:00.000Z', method: 'own_account', sha256: 'a'.repeat(64), verified: true } },
    { participantId: 'p2', lastName: 'Durand', firstName: 'Noé', status: 'late', statusLabel: 'En retard', corrected: true, signature: { kind: 'unable', path: null, reason: 'Main blessée', signedAt: '2026-11-12T09:40:00.000Z', method: 'trainer_device', sha256: 'b'.repeat(64), verified: false } },
    { participantId: 'p3', lastName: 'Petit', firstName: 'Sam', status: 'absent', statusLabel: 'Absent', corrected: false, signature: null },
  ],
  countersignature: { trainerName: 'Camille Formatrice', signedAt: '2026-11-12T12:05:00.000Z', path, sha256: 'c'.repeat(64), signaturesSha256: 'd'.repeat(64), verified: true },
  fingerprint: 'e'.repeat(64),
};

describe('documents d’émargement (PDF)', () => {
  it('rend la feuille d’émargement', async () => {
    const buffer = await renderToBuffer(createElement(SignatureSheetDocument, { sheet, generatedAt: new Date('2026-11-12T13:00:00Z') }) as never);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    if (out) writeFileSync(join(out, 'emargement.pdf'), buffer);
  });

  it('rend le certificat de réalisation', async () => {
    const realisation = computeRealisation({
      sessions: [{ id: 's1', number: 1, status: 'completed', scheduledDate: '2026-11-05', startTime: null, endTime: null }],
      attendance: new Map([['s1', 'present']]),
      programMinutes: 180,
      programSessionsCount: 6,
    });
    const certificate: Certificate = {
      participant: { id: 'p1', firstName: 'Léa', lastName: 'Martin', organizationName: 'Mission locale' },
      group: { id: 'g1', name: 'Groupe Littoral', startDate: '2026-11-05', endDate: null, organizationName: 'Mission locale' },
      programName: 'Programme HAPPI',
      modality: 'Présentiel, en groupe',
      realisation,
      fingerprint: 'f'.repeat(64),
    };
    const buffer = await renderToBuffer(createElement(CertificateDocument, { certificate, generatedAt: new Date() }) as never);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    if (out) writeFileSync(join(out, 'certificat.pdf'), buffer);
  });
});
