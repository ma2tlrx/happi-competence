import { join } from 'node:path';

import { renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { SkillsCvDocument } from '@/lib/pdf/skills-cv-document';
import { fixturePassport } from '@/lib/report/fixtures';

import { buildSkillsCv, CV_MAX_MAPPINGS, CV_MAX_SKILLS, firstSentence, observedSkillOptions } from './skills-cv';

const passport = fixturePassport({
  attended: [1, 2],
  evaluated: [1, 2],
  ct: { relationnel: [[1, 3, 'Commentaire privé du formateur.']], adaptabilite: [[1, 2], [2, 4]] },
  feedback: { 1: { observation: 'Observation de séance privée.' } },
});

describe('CV de compétences', () => {
  it('ne propose que les compétences observées', () => {
    expect(observedSkillOptions(passport).map((option) => option.code).sort()).toEqual(['adaptabilite', 'relationnel']);
  });

  it('respecte le choix du participant et ignore les codes inconnus ou non observés', () => {
    const cv = buildSkillsCv(passport, ['relationnel', 'leadership', 'inconnu']);
    expect(cv.frameworks.flatMap((f) => f.skills.map((s) => s.code))).toEqual(['relationnel']);
    expect(cv.frameworks[0]!.skills[0]).toMatchObject({ toConfirm: true, levelLabel: expect.any(String) });
    expect(buildSkillsCv(passport, null).frameworks.flatMap((f) => f.skills)).toHaveLength(2);
  });

  it('ne contient rien de privé (commentaires, présences, organisme)', () => {
    const json = JSON.stringify(buildSkillsCv(passport, null));
    expect(json).not.toContain('Commentaire privé');
    expect(json).not.toContain('Observation de séance');
    if (passport.participant.organization) expect(json).not.toContain(passport.participant.organization.name);
    expect(json).not.toMatch(/attendance|present/);
  });

  it('se limite à une page de compétences', () => {
    const many = fixturePassport({ attended: [1], evaluated: [1], ct: Object.fromEntries(observedCodes().map((code) => [code, [[1, 3]]])) });
    expect(buildSkillsCv(many, null).frameworks.flatMap((f) => f.skills).length).toBeLessThanOrEqual(CV_MAX_SKILLS);
  });

  it('reprend les correspondances validées du passeport, bornées, avec leur source', () => {
    const withMappings = structuredClone(passport);
    const skill = withMappings.frameworks[0]!.skills.find((item) => item.code === 'relationnel')!;
    const source = { code: 'src_a', name: 'Source fictive', publisher: 'Éditeur fictif', version: '1.0' };
    skill.publicMappings = ['Un', 'Deux', 'Trois'].map((label) => ({ code: label, label, linkType: 'close' as const, source }));
    const cv = buildSkillsCv(withMappings, ['relationnel']);
    expect(cv.frameworks[0]!.skills[0]!.mappings).toEqual([
      { label: 'Un', linkLabel: 'proche', source: 'Source fictive 1.0' },
      { label: 'Deux', linkLabel: 'proche', source: 'Source fictive 1.0' },
    ]);
    expect(CV_MAX_MAPPINGS).toBe(2);
    expect(cv.mappingSources).toEqual(['Source fictive (Éditeur fictif), version 1.0']);
    expect(buildSkillsCv(passport, null).mappingSources).toEqual([]);
  });

  it('reste sur une page avec le maximum de compétences et de correspondances', async () => {
    const many = fixturePassport({ attended: [1], evaluated: [1], ct: Object.fromEntries(observedCodes().map((code) => [code, [[1, 3]]])) });
    const source = { code: 'src_a', name: 'Source fictive au nom assez long', publisher: 'Éditeur fictif', version: '1.2.1' };
    for (const framework of many.frameworks) {
      for (const skill of framework.skills) {
        skill.publicMappings = ['Premier élément fictif au libellé plutôt long', 'Second élément fictif'].map((label) => ({ code: label, label, linkType: 'partial' as const, source }));
      }
    }
    const cv = buildSkillsCv(many, null);
    const mascotPath = join(process.cwd(), 'public', 'brand', 'happi-mascotte.png');
    const pdf = await renderToBuffer(createElement(SkillsCvDocument, { cv, mascotPath, generatedAt: new Date('2026-11-16') }) as never);
    expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
  }, 60_000);

  it('garde la première phrase du descripteur', () => {
    expect(firstSentence('Première phrase. Deuxième.')).toBe('Première phrase.');
    expect(firstSentence('x '.repeat(200), 50)!.length).toBeLessThanOrEqual(50);
    expect(firstSentence(null)).toBeNull();
  });

  it('produit un PDF d’une page, avec ou sans QR code', async () => {
    const mascotPath = join(process.cwd(), 'public', 'brand', 'happi-mascotte.png');
    const cv = buildSkillsCv(passport, null);
    const plain = await renderToBuffer(createElement(SkillsCvDocument, { cv, mascotPath, generatedAt: new Date('2026-11-16') }) as never);
    const qr = await QRCode.toDataURL('http://localhost:3000/verifier/AAAA', { margin: 2 });
    const withQr = await renderToBuffer(createElement(SkillsCvDocument, { cv, mascotPath, generatedAt: new Date('2026-11-16'), qr }) as never);
    expect(plain.subarray(0, 4).toString()).toBe('%PDF');
    expect(withQr.length).toBeGreaterThan(plain.length);
    expect((plain.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
  }, 60_000);
});

function observedCodes() {
  return fixturePassport({}).frameworks.find((framework) => framework.code === 'transversal')!.skills.map((skill) => skill.code);
}
