// Présentation institutionnelle A4 recto-verso : index.html → HAPPI-presentation-A4.pdf (+ aperçus PNG pour contrôle).
//   node build.mjs
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(join(here, 'index.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
// Contrôle de débordement : le contenu doit finir avant le pied de page
const overflow = await page.evaluate(() =>
  [...document.querySelectorAll('.page')].map((p, i) => {
    const top = p.getBoundingClientRect().top;
    const foot = p.querySelector('.foot').getBoundingClientRect();
    const kids = [...p.querySelectorAll('.body > *')];
    const last = kids[kids.length - 1].getBoundingClientRect();
    return { page: i + 1, bodyBottom: Math.round(last.bottom - top), footTop: Math.round(foot.top - top) };
  }),
);
console.log(JSON.stringify(overflow));
await page.pdf({ path: join(here, 'HAPPI-presentation-A4.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
const pages = await page.$$('.page');
for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: join(here, `apercu-${i + 1}.png`) });
await browser.close();
