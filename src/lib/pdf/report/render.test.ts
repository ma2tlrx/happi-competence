import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { buildReportData } from '@/lib/report/build';
import { reportOptionsSchema } from '@/lib/report/content';
import { fixtureContent, fixturePassport, SUPPORT_SESSION_1 } from '@/lib/report/fixtures';

import { ReportDocument } from './report-document';

const out = process.env.REPORT_PDF_OUT;
const supports = new Map([[1, SUPPORT_SESSION_1], [2, SUPPORT_SESSION_1]]);

const full = {
  attended: [1, 2, 3, 4, 5],
  evaluated: [1, 2, 3, 4, 5],
  ct: {
    relationnel: [[1, 3, 'Reformule la consigne pour le groupe avant de lancer la partie.'], [3, 4]],
    esprit_d_equipe: [[1, 4]],
    comprehension: [[1, 3]],
    adaptabilite: [[2, 2], [5, 4]],
    gestion_des_priorites: [[2, 3]],
    gestion_du_stress: [[2, 3, 'Reste calme quand le chronomètre s’accélère.']],
    leadership: [[3, 5]],
    force_de_proposition: [[3, 4]],
    organisation: [[3, 3]],
    implication: [[4, 4]],
    analyse_des_problemes: [[4, 3]],
    curiosite: [[4, 4]],
    autonomie: [[5, 2]],
    respect_des_delais: [[5, 3]],
    polyvalence: [[5, 4]],
  },
  hbs: {
    cooperation: [[1, 3], [3, 4]],
    sensibilite_sociale: [[1, 3]],
    adaptation_relationnelle: [[2, 2]],
    planification: [[1, 2], [5, 3]],
    arbitrage: [[2, 2], [3, 3]],
    raisonnement_logique: [[4, 3]],
    synthese: [[5, 1]],
    auto_evaluation: [[2, 2]],
    auto_regulation: [[5, 3]],
    traitement_de_l_information: [[4, 2]],
    projection: [[3, 2]],
  },
  feedback: {
    1: { observation: 'Très à l’écoute des autres, attend souvent avant de proposer.', advice: 'Oser prendre la parole en premier.' },
    3: { observation: 'A pris naturellement la coordination de l’équipe en cuisine.' },
  },
} as Parameters<typeof fixturePassport>[0];

const scenarios = {
  complet: { passport: fixturePassport(full), long: false },
  'textes-longs': { passport: fixturePassport(full), long: true },
  'peu-de-donnees': { passport: fixturePassport({ attended: [1], evaluated: [1], ct: { relationnel: [[1, 4]], comprehension: [[1, 3]] } }), long: false },
  'sans-donnees': { passport: fixturePassport({ withGroup: false }), long: false },
};

describe('rendu PDF du bilan', () => {
  for (const [name, scenario] of Object.entries(scenarios)) {
    it(`produit un PDF valide : ${name}`, async () => {
      const data = buildReportData(scenario.passport, supports, new Date('2026-07-01T10:00:00Z'));
      const content = data.counts.observations ? fixtureContent(data, scenario.long) : null;
      const buffer = await renderToBuffer(
        createElement(ReportDocument, {
          data,
          content,
          options: reportOptionsSchema.parse(name === 'complet' ? { structureName: 'Mission Locale d’exemple', extraObservations: 'Participant très régulier.' } : {}),
          meta: { version: 1, status: name === 'complet' ? 'final' : 'draft', finalizedAt: '2026-07-02T10:00:00Z', contentSource: 'ai_edited' },
        }) as never,
      );
      expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
      if (out) writeFileSync(join(out, `bilan-${name}.pdf`), buffer);
    }, 60_000);
  }
});
