import { describe, expect, it } from 'vitest';

import { fixturePassport } from '@/lib/report/fixtures';
import type { ReportContent } from '@/lib/report/content';

import { buildPublicPassport, METHOD_NOTICE } from './public-view';
import { countActive, shareFormSchema, shareStatus } from './rules';

const passport = () => {
  const value = fixturePassport({
    ct: { relationnel: [[1, 2, 'Commentaire partagé CT'], [2, 4, 'Commentaire partagé CT 2']], rigueur: [[2, 3]] },
    hbs: { cooperation: [[1, 3, 'Commentaire HBS']] },
    attended: [1, 2],
    evaluated: [1, 2],
    feedback: { 1: { observation: 'Observation de session confidentielle', advice: 'Conseil personnel' } },
  });
  value.participant.email = 'camille.exemple@exemple.fr';
  value.selfAssessment = {
    id: 'sa1', status: 'completed', completedAt: '2026-01-05', startedAt: '2026-01-04', comment: 'Auto-évaluation privée', scaleMin: 1, scaleMax: 5,
    scaleLabels: [], versionLabel: '1', versionId: 'v', answers: [{ questionId: 'q', position: 1, text: 'Question privée', frameworkCode: 'ct', skillCode: 'relationnel', value: 5, comment: 'Réponse privée' }],
  };
  return value;
};

const report: ReportContent = {
  introduction: 'Introduction non partagée',
  profile: { summary: 'Synthèse partagée.', traits: ['Trait non partagé'] },
  frameworks: [{ code: 'transversal', summary: 'Lecture CT.' }, { code: 'sociocognitive', summary: 'Lecture HBS.' }],
  behaviour: { summary: 'Comportement non partagé', themes: [] },
  skills: [{ code: 'relationnel', observed: 'Observé non partagé', strengths: 'x', progress: 'Axe non partagé', professional: 'x' }],
  recommendations: [{ skillCode: 'relationnel', priority: 'consolider', why: 'Recommandation non partagée', action: 'a', exercise: 'e', worksOn: 'w', goal: 'g' }],
  conclusion: 'Conclusion partagée.',
  closing: 'Mot final non partagé',
  limits: 'Limites partagées.',
  dataWarnings: ['Alerte non partagée'],
};

const share = { expiresAt: '2026-12-31T00:00:00.000Z' };
const now = new Date('2026-11-12T10:00:00.000Z');

describe('vue publique du passeport', () => {
  it('ne publie que les compétences observées, avec niveau validé, descripteur et nombre de séances', () => {
    const view = buildPublicPassport(passport(), { includeSociocognitive: false, includeReport: false }, share, null, now);
    expect(view.frameworks.map((f) => f.code)).toEqual(['transversal']);
    const ct = view.frameworks[0]!;
    expect(ct.skills.map((s) => s.code)).toEqual(['relationnel', 'rigueur']);
    expect(ct.totalSkills).toBe(18);
    expect(ct.skills[0]).toMatchObject({ value: 4, levelValue: 4, levelLabel: 'Acquis', descriptor: 'Relationnel — niveau « Acquis ».', observationCount: 2 });
    expect(view.observationSessions).toBe(2);
    expect(view.holder).toEqual({ firstName: 'Camille', lastInitial: 'E.' });
    expect(view.program).toEqual({ name: 'Programme HAPPI', startDate: '2026-01-10', endDate: '2026-06-10' });
    expect(view.issuer).toBe('HAPPI Compétence');
    expect(view.method).toBe(METHOD_NOTICE);
    expect(view.method).toMatch(/non une certification/);
    expect(view.generatedAt).toBe(now.toISOString());
    expect(view.report).toBeNull();
  });

  it('n’expose jamais coordonnées, organisme, nom complet, commentaires, présences, auto-évaluation ni formateurs', () => {
    const view = buildPublicPassport(passport(), { includeSociocognitive: true, includeReport: true }, share, { version: 2, finalizedAt: '2026-06-20', content: report }, now);
    const json = JSON.stringify(view);
    for (const forbidden of [
      'camille.exemple@exemple.fr', 'Exemple', 'Mission Locale', 'Commentaire partagé', 'Commentaire HBS', 'Observation de session', 'Conseil personnel',
      'Auto-évaluation privée', 'Question privée', 'Réponse privée', 'Formateur Test', 'Groupe test', 'present', 'absent', 'attendance', 'selfValue',
      'Introduction non partagée', 'Trait non partagé', 'Comportement non partagé', 'Observé non partagé', 'Axe non partagé', 'Recommandation non partagée',
      'Mot final non partagé', 'Alerte non partagée', 'p1', 'o1', 'g1',
    ]) {
      expect(json, forbidden).not.toContain(forbidden);
    }
  });

  it('habiletés socio-cognitives et bilan seulement sur demande', () => {
    const withAll = buildPublicPassport(passport(), { includeSociocognitive: true, includeReport: true }, share, { version: 2, finalizedAt: '2026-06-20', content: report }, now);
    expect(withAll.frameworks.map((f) => f.code)).toEqual(['transversal', 'sociocognitive']);
    expect(withAll.report).toEqual({
      version: 2,
      finalizedAt: '2026-06-20',
      summary: 'Synthèse partagée.',
      frameworks: [
        { code: 'transversal', name: 'Compétences transversales', summary: 'Lecture CT.' },
        { code: 'sociocognitive', name: 'Habiletés socio-cognitives', summary: 'Lecture HBS.' },
      ],
      conclusion: 'Conclusion partagée.',
      limits: 'Limites partagées.',
    });
    // Bilan demandé mais habiletés non partagées : la lecture HBS du bilan est retirée.
    const ctOnly = buildPublicPassport(passport(), { includeSociocognitive: false, includeReport: true }, share, { version: 2, finalizedAt: null, content: report }, now);
    expect(ctOnly.report?.frameworks.map((f) => f.code)).toEqual(['transversal']);
    expect(JSON.stringify(ctOnly)).not.toContain('Lecture HBS');
    // Bilan non demandé : rien, même s'il existe.
    expect(buildPublicPassport(passport(), { includeSociocognitive: false, includeReport: false }, share, { version: 2, finalizedAt: null, content: report }, now).report).toBeNull();
    // Bilan demandé mais aucun bilan validé : rien.
    expect(buildPublicPassport(passport(), { includeSociocognitive: false, includeReport: true }, share, null, now).report).toBeNull();
  });

  it('participant sans groupe ni observation : vue vide mais valide', () => {
    const view = buildPublicPassport(fixturePassport({ withGroup: false }), { includeSociocognitive: true, includeReport: false }, share, null, now);
    expect(view.program).toBeNull();
    expect(view.observationSessions).toBe(0);
    expect(view.frameworks.every((f) => f.skills.length === 0)).toBe(true);
  });
});

describe('règles des liens', () => {
  it('statut : révoqué prime, puis expiration', () => {
    expect(shareStatus({ revokedAt: null, expiresAt: '2026-11-13T00:00:00Z' }, now)).toBe('active');
    expect(shareStatus({ revokedAt: null, expiresAt: '2026-11-12T10:00:00Z' }, now)).toBe('expired');
    expect(shareStatus({ revokedAt: '2026-11-01T00:00:00Z', expiresAt: '2026-12-01T00:00:00Z' }, now)).toBe('revoked');
    expect(shareStatus({ revokedAt: '2026-11-01T00:00:00Z', expiresAt: '2026-11-02T00:00:00Z' }, now)).toBe('revoked');
    expect(countActive([{ revokedAt: null, expiresAt: '2026-12-01' }, { revokedAt: null, expiresAt: '2026-01-01' }, { revokedAt: 'x', expiresAt: '2026-12-01' }], now)).toBe(1);
  });

  it('formulaire : durées 7, 30 ou 90 jours, libellé obligatoire et borné', () => {
    expect(shareFormSchema.parse({ label: '  Entreprise X ', duration: '30', includeSociocognitive: 'on', includeReport: null })).toEqual({
      label: 'Entreprise X', duration: 30, includeSociocognitive: true, includeReport: false,
    });
    for (const duration of ['14', '0', '-7', 'abc', '365']) expect(shareFormSchema.safeParse({ label: 'X', duration }).success).toBe(false);
    expect(shareFormSchema.safeParse({ label: '   ', duration: '7' }).success).toBe(false);
    expect(shareFormSchema.safeParse({ label: 'x'.repeat(81), duration: '7' }).success).toBe(false);
    expect(shareFormSchema.parse({ label: 'A\u0000B', duration: '90' }).label).toBe('A B');
  });
});
