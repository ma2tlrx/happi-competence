import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { computeConventionReport } from '@/lib/funding/indicators';

import { FundingReportDocument } from './funding-report-document';

// REPORT_PDF_OUT=<dossier> : écrit les PDF pour relecture visuelle.
const out = process.env.REPORT_PDF_OUT;

const report = computeConventionReport({
  terms: { plannedParticipants: 2, plannedHoursPerParticipant: 18, startDate: '2026-01-01', endDate: '2026-12-31' },
  groupIds: ['g1'],
  today: '2026-11-18',
  countersignedSessionIds: ['s1'],
  dataset: {
    impact: {
      groups: [{ id: 'g1', name: 'Groupe Littoral', programId: 'p', programName: 'HAPPI', organizationId: null, organizationName: null, startDate: '2026-03-01', endDate: '2026-04-30', status: 'completed' }],
      participants: [
        { id: 'a', firstName: 'Léa', lastName: 'Martin', organizationId: null, organizationName: null },
        { id: 'b', firstName: 'Noé', lastName: 'Durand', organizationId: null, organizationName: null },
      ],
      memberships: [
        { groupId: 'g1', participantId: 'a', status: 'active', dropReason: null, droppedAt: null },
        { groupId: 'g1', participantId: 'b', status: 'dropped', dropReason: 'emploi_trouve', droppedAt: '2026-03-10' },
      ],
      sessions: [{ id: 's1', groupId: 'g1', status: 'completed', date: '2026-03-02', number: 1 }],
      attendance: [
        { sessionId: 's1', participantId: 'a', status: 'present' },
        { sessionId: 's1', participantId: 'b', status: 'present' },
      ],
      observations: [],
      outcomes: [{ participantId: 'a', groupId: 'g1', kind: 'exit', situation: 'emploi_durable' }],
    },
    sessionDetails: [],
    programs: [{ groupId: 'g1', sessionMinutes: 180, sessionsCount: 6 }],
  },
});

const convention = {
  reference: 'FT-2026-001',
  title: 'Révéler ses compétences par le jeu',
  funderName: 'France Travail Occitanie',
  funderKind: 'france_travail',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  plannedParticipants: 2,
  plannedHours: 18,
  status: 'en_cours',
};

describe('bilan de l’action (PDF)', () => {
  it('rend le bilan agrégé', async () => {
    const buffer = await renderToBuffer(createElement(FundingReportDocument, { convention, report, generatedAt: new Date('2026-11-18T10:00:00Z') }) as never);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    if (out) writeFileSync(join(out, 'bilan-action.pdf'), buffer);
  });

  it('rend le bilan avec l’annexe nominative', async () => {
    const buffer = await renderToBuffer(createElement(FundingReportDocument, { convention, report, nominative: true, generatedAt: new Date() }) as never);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    if (out) writeFileSync(join(out, 'bilan-action-nominatif.pdf'), buffer);
  });
});
