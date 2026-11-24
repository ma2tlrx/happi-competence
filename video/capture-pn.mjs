// Captation des VRAIS écrans simulés du Passeport Numérique (Amazon, réseau social, plans/GPS), pour la vidéo.
// Sert l'application avec le banc d'essai (scripts/pn-harness.mjs, port 4100), déroule chaque exercice pas à pas
// comme le ferait un participant, et enregistre l'écran du téléphone simulé après chaque action, avec la position
// de l'élément touché. Sortie : out/captures-pn/<module>/*.png + manifest.json
//
//   node --experimental-strip-types ../scripts/pn-harness.mjs 4100 &
//   node capture-pn.mjs
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, 'out', 'captures-pn');
rmSync(root, { recursive: true, force: true });

// [monde, exercice, nom, étapes]. Une étape : { tap: 'data-id' } | { type: [sélecteur, texte, pas] } | { marks: [sélecteurs] }
const MODULES = [
  {
    name: 'amazon', w: 12, e: 0,
    steps: [
      { type: ['#live', 'bouilloire', 1], tapSel: '.az-s' },
      { tap: 'p2', marks: ['.spon', '.stars@1', '.az-price@1'] },
      { tap: 'add', marks: ['.stars', '.az-price', '.green'] },
      { tap: 'go' },
      { tap: 'free', marks: ['.az-tot'] },
      { tap: 'buy' },
    ],
  },
  {
    name: 'facebook', w: 15, e: 1,
    steps: [{ tap: 'new' }, { type: ['textarea, input.rin, #live', 'Joyeux anniversaire Léa', 3] }, { tap: 'grp' }, { tap: 'pub' }],
  },
  {
    name: 'facebook-compte', w: 15, e: 2,
    steps: [{ tap: 'menu' }, { tap: 'conf' }, { tap: 'pub' }, { tap: 'amis' }],
  },
  {
    name: 'gps', w: 12, e: 3,
    steps: [{ type: ['#live', 'Gare de Béziers', 1], tapSel: '.mp-search, .az-s, input' }, { tap: 'iti' }, { tap: 'walk' }, { tap: 'go' }, { tap: 'quit' }],
  },
];

const browser = await chromium.launch();

async function session() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 820 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.route('**/?role=participant', async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).replace("let V={s:'welcome'};", "let V={s:'welcome'};window.__setV=(x)=>{V=x;render()};window.__V=()=>JSON.stringify(V);");
    await route.fulfill({ response: res, body });
  });
  await page.goto('http://127.0.0.1:4100/?role=participant');
  await page.addStyleTag({ content: '#fb,#vox,#scue,.bnav,.exwrap>*:not(#areaw){display:none!important} *{caret-color:transparent!important}' });
  await page.waitForTimeout(600);
  await page.click('text=60 à 69 ans');
  await page.click('text=J’accepte');
  await page.waitForTimeout(500);
  return page;
}

for (const mod of MODULES) {
  const page = await session();
  const dir = join(root, mod.name);
  mkdirSync(dir, { recursive: true });
  await page.evaluate(({ w, e }) => window.__setV({ s: 'ex', w, e }), mod);
  await page.waitForTimeout(500);
  // Choix de l'appareil demandé au début d'un exercice : Android
  if (await page.locator('text=Android').count()) await page.click('text=Android').catch(() => {});
  await page.waitForTimeout(700);
  const scr = page.locator('#scr');
  const manifest = { name: mod.name, frames: [] };
  let n = 0;

  async function boxOf(sel) {
    // « sélecteur@n » : le n-ième élément (0 = premier)
    const [css, nth] = sel.split('@');
    const el = page.locator(css).nth(Number(nth ?? 0));
    if (!(await el.count())) return null;
    const b = await el.boundingBox();
    const s = await scr.boundingBox();
    if (!b || !s) return null;
    return { x: (b.x - s.x) / s.width, y: (b.y - s.y) / s.height, w: b.width / s.width, h: b.height / s.height };
  }
  async function snap(label, tapSel, marks = []) {
    const file = `${String(++n).padStart(2, '0')}-${label}.png`;
    await page.waitForTimeout(800);
    await scr.screenshot({ path: join(dir, file) });
    const entry = { file, tap: tapSel ? await boxOf(tapSel) : null, marks: {}, view: await page.evaluate(() => window.__V()) };
    for (const m of marks) entry.marks[m] = await boxOf(m);
    const s = await scr.boundingBox();
    manifest.size = { w: s.width, h: s.height };
    manifest.frames.push(entry);
  }

  for (const step of mod.steps) {
    if (step.type) {
      const [sel, text, every] = step.type;
      await snap('avant-saisie', step.tapSel ?? sel, []);
      const field = page.locator(sel).first();
      await field.click();
      for (let i = 1; i <= text.length; i++) {
        await field.pressSequentially(text[i - 1], { delay: 0 });
        if (i % every === 0 || i === text.length) await snap(`saisie-${i}`, null);
      }
      await page.waitForTimeout(600);
    } else {
      const sel = `[data-id="${step.tap}"]`;
      await snap(`avant-${step.tap}`, sel, step.marks ?? []);
      await page.locator(sel).first().click();
      await page.waitForTimeout(900);
    }
  }
  await snap('fin', null);
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(mod.name, manifest.frames.length, 'images', manifest.size);
  await page.context().close();
}
await browser.close();
