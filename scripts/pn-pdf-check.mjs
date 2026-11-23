#!/usr/bin/env node
/**
 * Vérification des PDF et du certificat du Passeport Numérique (rebrandés HAPPI), via le banc d'essai.
 *
 *   node --experimental-strip-types scripts/pn-harness.mjs 4103 &
 *   node scripts/pn-pdf-check.mjs <dossier de sortie> [http://127.0.0.1:4103]
 *
 * Génère chaque type de PDF (rapport, émargement, attestation, cartes de code, mémos, défis chrono, certificat),
 * les enregistre dans le dossier, et capture le certificat à l'écran. Conversion en images : `pdftoppm -r 70 -png`.
 * Sort en erreur si un PDF n'est pas produit ou si une police de la charte n'est pas embarquée (option --charte).
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PDFLib = require('../public/passeport-numerique/vendor/pdf-lib.min.js');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const checkFonts = process.argv.includes('--charte');
const out = args[0];
const base = args[1] ?? 'http://127.0.0.1:4103';
if (!out) throw new Error('Usage : pn-pdf-check.mjs <dossier de sortie> [url] [--charte]');
mkdirSync(out, { recursive: true });

const KEY = 'passeport-numerique-v1:banc-d-essai';
const html = await (await fetch(`${base}/?role=staff`)).text();
const exIds = [...html.matchAll(/^ \{id:'([a-z0-9_]+)',t:/gm)].map((m) => m[1]);
const now = Date.now();
const done = (ids) => Object.fromEntries(ids.map((id) => [id, now]));
const state = {
  cfg: { asso: 'Happi', lieu: 'Salle des fêtes, Bézu' },
  profiles: {
    p1: { name: 'Camille', last: 'Martin', dev: 'phone', done: done(exIds), help: [{ t: now, cat: 'Mails', st: 'resolu' }], pin: '4821', age: '26-45 ans', created: now },
    p2: { name: 'Léa', last: 'Dupont', dev: 'pc', done: done(exIds.slice(0, 12)), help: [], pin: '1093', age: '60 ans et plus', created: now },
  },
  sessions: [{ id: 's1', start: now, end: now + 3 * 3600e3, title: 'Atelier numérique', lieu: 'Salle des fêtes', anim: 'Alex', present: { p1: true, p2: true } }],
  cur: 'p1',
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 1500 }, acceptDownloads: true });
await context.addInitScript(([key, value]) => { try { if (!localStorage.getItem(key)) localStorage.setItem(key, value); } catch {} }, [KEY, JSON.stringify(state)]);
const page = await context.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.log('console', m.text().slice(0, 200)); });
await page.goto(`${base}/?role=staff`);
await page.waitForTimeout(800);

async function trigger(action, value = '') {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 25000 }),
    page.evaluate(([a, v]) => { const b = document.createElement('button'); b.dataset.a = a; if (v) b.dataset.v = v; b.style.display = 'none'; document.body.appendChild(b); b.click(); b.remove(); }, [action, value]),
  ]);
  return download;
}
const jobs = [
  ['rapport', 'xRapport', ''], ['emargement', 'xEmarg', 's1'], ['attestation', 'xAttest', 'p1'], ['cartes', 'xCartes', ''],
  ['memo-monde-1', 'memoDl', '0'], ['memos-tous', 'memoAll', ''], ['defis', 'dPdf', ''],
];
let failed = 0;
for (const [name, action, value] of jobs) {
  try {
    const d = await trigger(action, value);
    const file = join(out, `${name}.pdf`);
    await d.saveAs(file);
    const bytes = readFileSync(file);
    const parsed = await PDFLib.PDFDocument.load(bytes);
    const names = new Set();
    for (const [, object] of parsed.context.enumerateIndirectObjects()) {
      const base = object?.get?.(PDFLib.PDFName.of('BaseFont'));
      if (base) names.add(String(base).replace(/^\/(?:[A-Z]{6}\+)?/, ''));
    }
    const fonts = [...names];
    console.log(name, bytes.length, 'octets,', parsed.getPageCount(), 'page(s),', fonts.join(','));
    if (checkFonts && !(/Poppins/.test(fonts.join()) && /DMSans|DM-?Sans/i.test(fonts.join()))) { console.log('  ! polices de la charte absentes'); failed++; }
  } catch (e) { console.log(name, 'ÉCHEC', e.message); failed++; }
}
// Certificat : à l'écran (aperçu animateur) puis en PDF.
await page.evaluate(() => { const b = document.createElement('button'); b.dataset.a = 'certDemo'; document.body.appendChild(b); b.click(); b.remove(); });
await page.waitForSelector('#certv');
await page.waitForTimeout(4500);
await page.locator('#certv').screenshot({ path: join(out, 'certificat-ecran.png') });
const cert = await trigger('certDl');
await cert.saveAs(join(out, 'certificat.pdf'));
console.log('certificat', readFileSync(join(out, 'certificat.pdf')).length, 'octets');
await browser.close();
process.exit(failed ? 1 : 0);
