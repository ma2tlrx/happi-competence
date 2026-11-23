import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Gabarit PDF HAPPI du Passeport Numérique (public/passeport-numerique/happi-pdf.js), exécuté ici avec les mêmes
 * fichiers que le navigateur : pdf-lib et fontkit hébergés par la plateforme, polices et logos officiels.
 */
const root = process.cwd();
const require = createRequire(import.meta.url);
const pub = (...parts: string[]) => join(root, 'public', ...parts);

/* eslint-disable @typescript-eslint/no-explicit-any -- le gabarit est un script navigateur, sans types */
const globals = globalThis as any;
globals.HappiPdfAssets = require(pub('passeport-numerique/happi-pdf-assets.js')) && globals.HappiPdfAssets;
const PDFLib = require(pub('passeport-numerique/vendor/pdf-lib.min.js'));
const fontkit = require(pub('passeport-numerique/vendor/fontkit.umd.min.js'));
const HappiPdf = require(pub('passeport-numerique/happi-pdf.js'));
const fetchBytes = async (url: string) => new Uint8Array(readFileSync(pub(url)));
const env = { asso: 'Happi', fmtD: () => '23/11/2026' };
const make = (opts: any = {}, e: any = env) => HappiPdf.create(PDFLib, opts, e, { fontkit, fetchBytes });

/** Enregistre tout ce qui est écrit sur les pages (le texte des polices embarquées n'est pas lisible dans le fichier). */
function recordText() {
  const drawn: string[] = [];
  const proto = PDFLib.PDFPage.prototype;
  const original = proto.drawText;
  proto.drawText = function (text: string, options: unknown) {
    drawn.push(text);
    return original.call(this, text, options);
  };
  return { drawn, stop: () => { proto.drawText = original; } };
}
const inspect = (bytes: Uint8Array) => PDFLib.PDFDocument.load(bytes);
/** Noms des polices embarquées (les objets du PDF sont compressés : on lit le document, pas le fichier brut). */
async function fontNames(bytes: Uint8Array): Promise<string[]> {
  const doc = await inspect(bytes);
  const names = new Set<string>();
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    const base = object?.get?.(PDFLib.PDFName.of('BaseFont'));
    if (base) names.add(String(base).replace(/^\/(?:[A-Z]{6}\+)?/, ''));
  }
  return [...names];
}

describe('Gabarit PDF HAPPI : document', () => {
  it('produit un A4 portrait avec les polices Poppins et DM Sans embarquées (jamais Helvetica)', async () => {
    const P = await make({ title: 'Rapport d’activité', sub: 'Ateliers numériques' });
    P.h2('Chiffres clés');
    P.kpis([[1, 'séances'], [2, 'personnes accompagnées'], ['2,3 h', 'd’accompagnement']]);
    P.bars({ 'Moins de 25 ans': 3, '26-45 ans': 5 });
    P.table(['N°', 'Prénom et nom'], [[1, 'Camille Martin']], [0.2, 0.8]);
    P.callout('Les astuces', [{ t: 'Touchez doucement.', bullet: true }, { t: 'En douceur, sans se presser.', bold: true }], { mascot: true });
    const bytes: Uint8Array = await P.finish();
    const doc = await inspect(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize()).toEqual({ width: 595.28, height: 841.89 });
    const names = (await fontNames(bytes)).join(' ');
    expect(names).toMatch(/Poppins/);
    expect(names).toMatch(/DMSans/);
    expect(names).not.toMatch(/Helvetica/);
  });

  it('met la mention HAPPI Compétence · Passeport Numérique et « Page n / N » en pied de chaque page', async () => {
    const rec = recordText();
    try {
      const P = await make({ title: 'Long document' });
      for (let i = 0; i < 60; i += 1) P.text(`Ligne ${i} de texte pédagogique inchangé.`, { size: 11 });
      const bytes: Uint8Array = await P.finish();
      const pages = (await inspect(bytes)).getPageCount();
      expect(pages).toBeGreaterThanOrEqual(2);
      expect(rec.drawn.filter((t) => t === 'HAPPI Compétence · Passeport Numérique')).toHaveLength(pages);
      for (let n = 1; n <= pages; n += 1) expect(rec.drawn).toContain(`Page ${n} / ${pages}`);
      expect(rec.drawn).toContain(' · document généré le 23/11/2026');
    } finally {
      rec.stop();
    }
  });

  it('ajoute le nom de l’association au pied de page quand ce n’est pas Happi', async () => {
    const rec = recordText();
    try {
      const P = await make({ title: 'Test' }, { asso: 'Association API', fmtD: () => '' });
      await P.finish();
      expect(rec.drawn).toContain('HAPPI Compétence · Passeport Numérique · Association API');
    } finally {
      rec.stop();
    }
  });

  it('retire les caractères que les polices ne savent pas dessiner, sans toucher aux accents ni à la typographie française', async () => {
    const P = await make({ title: 'x' });
    expect(P.safe('Écrire à « Léa » — l’été… œuvre • ok')).toBe('Écrire à « Léa » — l’été… œuvre • ok');
    expect(P.safe('Réussi ✓ ★ fin')).toBe('Réussi  * fin');
    expect(P.safe('Total : 3')).toBe('Total : 3');
  });

  it('coupe un mot plus long que la ligne au lieu de déborder de la page', async () => {
    const P = await make({ title: 'x' });
    const lines: string[] = P.wrap('A'.repeat(200), P.F, 10, 100);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(P.F.widthOfTextAtSize(line, 10)).toBeLessThanOrEqual(100);
  });
});

describe('Gabarit PDF HAPPI : documents du Passeport Numérique', () => {
  it('cartes de code : dix cartes par page, nom et code de chaque personne', async () => {
    const rec = recordText();
    try {
      const profiles = Array.from({ length: 12 }, (_, i) => ({ name: `Prénom${i}`, last: 'Nom', pin: '4821' }));
      const P = await make({ title: 'Cartes de code', bare: true, noFirst: true });
      const bytes: Uint8Array = await HappiPdf.cartes(P, profiles);
      expect((await inspect(bytes)).getPageCount()).toBe(2);
      expect(rec.drawn).toContain('Prénom11 Nom');
      expect(rec.drawn.filter((t) => t === '4 8 2 1')).toHaveLength(12);
      expect(rec.drawn).toContain('Page 2 / 2');
    } finally {
      rec.stop();
    }
  });

  it('mémos : une série de pages par monde, numérotation qui repart de 1, textes d’origine', async () => {
    const rec = recordText();
    try {
      const w = (id: string, n: string) => ({ id, n, badge: `Tampon ${n}`, ex: [{ id: 'a', t: 'Toucher les ronds', help: 'Visez bien le milieu.' }, { id: 'b', t: 'Défiler', help: 'Faites glisser.', only: 'pc' }] });
      const worlds = [w('w1', 'Les premiers gestes'), w('w2', 'Le clavier')];
      const P = await make({ title: 'Mémo', bare: true, noFirst: true });
      const bytes: Uint8Array = await HappiPdf.memos(P, { RECAP: { w1: { tips: ['Doucement.'], key: 'En douceur.' } }, exs: (x: any) => x.ex, T1: (s: string) => s }, worlds, true);
      expect((await inspect(bytes)).getPageCount()).toBe(2);
      for (const t of ['Ce que je sais faire', 'Les astuces', 'Mes notes', 'Ne notez jamais un mot de passe ou un code secret sur ce mémo.', 'Les premiers gestes', 'Le clavier']) expect(rec.drawn).toContain(t);
      expect(rec.drawn.filter((t) => t === 'Page 1 / 1')).toHaveLength(2);
    } finally {
      rec.stop();
    }
  });

  it('certificat : une page A4 paysage, sans pied de page, avec les textes d’origine', async () => {
    const rec = recordText();
    try {
      const P = await make({ title: 'Certificat de réussite', landscape: true, bare: true, noFirst: true, noFooter: true });
      const worlds = Array.from({ length: 19 }, (_, i) => `Monde ${i + 1}`);
      const bytes: Uint8Array = await HappiPdf.certificate(P, { name: 'Jeanne Martin', worlds, count: 19, date: '23 novembre 2026', lieu: 'Bézu', asso: 'Association API', seal: null });
      const doc = await inspect(bytes);
      expect(doc.getPageCount()).toBe(1);
      expect(doc.getPage(0).getSize()).toEqual({ width: 841.89, height: 595.28 });
      for (const t of ['Certificat de réussite', 'décerné à', 'Jeanne Martin', 'pour avoir réussi les 19 mondes du parcours de découverte du numérique :', 'Association API · Le Passeport Numérique', 'Le 23 novembre 2026 · Bézu', 'Signature de l’animateur']) expect(rec.drawn).toContain(t);
      expect(rec.drawn.some((t) => t.startsWith('Page '))).toBe(false);
    } finally {
      rec.stop();
    }
  });
});

describe('Gabarit PDF HAPPI : sceau « Passeport Numérique · Validé »', () => {
  it('garde la mention d’origine : association, Passeport Numérique, validé et l’année', () => {
    const svg: string = HappiPdf.sealSvg(130, { asso: 'Association API', year: 2026 });
    expect(svg).toContain('PASSEPORT NUMÉRIQUE');
    expect(svg).toContain('VALIDÉ 2026');
    expect(svg).toContain('ASSOCIATION API');
    expect(svg).not.toContain('ASSOCIATION ASSOCIATION');
    expect(HappiPdf.sealSvg(130, { asso: 'Happi', year: 2026 })).toContain('ASSOCIATION HAPPI');
  });

  it('aux couleurs HAPPI, avec la mascotte, sans ancienne teinte orange', () => {
    const svg: string = HappiPdf.sealSvg(130, { asso: 'Happi', year: 2026 });
    for (const c of ['#102C32', '#EA632E', '#F5F5F2']) expect(svg).toContain(c);
    expect(svg).toContain('data:image/png;base64,');
    expect(svg.toLowerCase()).not.toContain('#d86f00');
  });

  it('échappe le nom de l’association, et n’embarque la police que pour la version rasterisée', () => {
    const hostile: string = HappiPdf.sealSvg(130, { asso: '<script>alert(1)</script>', year: 2026 });
    expect(hostile).not.toContain('<script');
    expect(HappiPdf.sealSvg(130, { asso: 'Happi', year: 2026 })).not.toContain('@font-face');
    expect(HappiPdf.sealSvg(130, { asso: 'Happi', year: 2026, raster: true })).toContain('@font-face');
  });
});

describe('Gabarit PDF HAPPI : charte', () => {
  const source = readFileSync(pub('passeport-numerique/happi-pdf.js'), 'utf8');
  it('n’utilise plus la palette d’origine (vert sarcelle, orange jaune, Helvetica)', () => {
    for (const legacy of ['#16766a', '#f7941d', 'Helvetica', 'StandardFonts']) expect(source.toLowerCase()).not.toContain(legacy.toLowerCase());
  });
  it('définit les couleurs de la charte', () => {
    const { COL } = HappiPdf;
    expect(COL).toMatchObject({ petrol: '#102C32', orange: '#EA632E', orange700: '#B8431A', paper: '#F5F5F2', line: '#E5E5E0' });
  });
});
