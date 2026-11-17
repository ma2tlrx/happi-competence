import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { QualityEvidenceDocument, type QualityEvidence } from './quality-evidence-document';

const out = process.env.REPORT_PDF_OUT;

const evidence: QualityEvidence = {
  dashboard: {
    period: { from: '2025-11-17', to: '2026-11-17' },
    snapshot: {
      satisfaction: { count: 8, n: 10, rate: 80, respondents: 4, invited: 6 },
      impact: { enrolled: 12, dropped: 1, dropRate: { count: 1, n: 12, rate: 8.3 }, attendance: { count: 60, n: 70, rate: 85.7 } },
    },
    complaints: { total: 1, open: 0, answered: 1, meanDelayDays: 3, maxDelayDays: 3, bySource: { participant: 1 } },
    actions: { total: 1, open: 0, closed: 1, overdue: 0, done: 1, effectivenessRecorded: { count: 1, n: 1, rate: 100 } },
    trainers: { total: 1, upToDate: 1, outdated: 0, none: 0, aiTrained: 1, maxAgeMonths: 24 },
    needs: { count: 5, n: 12, rate: 41.7, adaptation: 1 },
  },
  complaints: [
    {
      id: 'c1', source: 'participant', channel: 'espace_en_ligne', receivedOn: '2026-10-01', subject: 'Salle froide', description: 'La salle était froide.',
      reporterName: null, participantName: 'Léa Martin', organizationName: null, status: 'resolved', response: 'Chauffage réparé.', respondedOn: '2026-10-04', createdAt: '2026-10-01T08:00:00Z',
    },
  ],
  actions: [
    {
      id: 'a1', origin: 'reclamation', originDetails: null, title: 'Vérifier le chauffage', description: null, ownerName: 'Camille', dueOn: '2026-10-10', status: 'done',
      closedOn: '2026-10-08', effectiveness: 'Plus de réclamation', complaintId: 'c1', complaintSubject: 'Salle froide', watchEntryId: null, watchSource: null, createdAt: '2026-10-02T08:00:00Z',
    },
  ],
  watch: [{ id: 'w1', kind: 'legale', source: 'Décret n° 2026-728', observedOn: '2026-08-04', summary: 'Nouveau référentiel qualité', impact: 'Relire les indicateurs', decision: null }],
  registry: [
    {
      trainer: { id: 't1', firstName: 'Camille', lastName: 'Formatrice', email: 'c@exemple.fr', role: 'formateur', status: 'active' },
      qualifications: [{ id: 'q1', trainerId: 't1', kind: 'formation', title: 'Usage de l’IA', provider: 'Organisme X', description: null, startedOn: null, completedOn: '2026-03-01', isAiTraining: true, evidence: 'Attestation au dossier' }],
      training: { state: 'up_to_date', lastTrainingOn: '2026-03-01', threshold: '2024-11-17', aiTraining: true, lastAiTrainingOn: '2026-03-01' },
    },
  ],
};

describe('dossier de preuves qualité (PDF)', () => {
  it('rend le dossier, registres vides compris', async () => {
    const buffer = await renderToBuffer(createElement(QualityEvidenceDocument, { evidence, generatedAt: new Date('2026-11-17T08:00:00Z') }) as never);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    if (out) writeFileSync(join(out, 'dossier-qualite.pdf'), buffer);
    const empty = await renderToBuffer(
      createElement(QualityEvidenceDocument, { evidence: { ...evidence, complaints: [], actions: [], watch: [], registry: [] }, generatedAt: new Date() }) as never,
    );
    expect(empty.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
