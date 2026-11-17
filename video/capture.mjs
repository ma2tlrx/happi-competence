// Captures réelles de l'application (données de démonstration) pour la vidéo.
// Prérequis : pile Supabase locale, `npm run demo:seed` et `next dev -p 3000` lancés depuis la racine du dépôt.
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'out', 'captures');
mkdirSync(out, { recursive: true });
const base = process.env.APP_URL ?? 'http://localhost:3000';
const creds = JSON.parse(readFileSync(join(here, '..', '.demo-credentials.json'), 'utf8')).comptes;
const password = (email) => creds.find((c) => c.email === email).password;

// Ni bandeau « démonstration » ni indicateur de développement dans les images.
const hide = `
  aside[aria-label="Démonstration"], nextjs-portal, [data-nextjs-toast], #__next-build-watcher { display: none !important; }
  *, *::before, *::after { transition: none !important; animation-duration: 0s !important; animation-delay: 0s !important; caret-color: transparent !important; }
`;

const browser = await chromium.launch();

async function session(email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'fr-FR' });
  const page = await context.newPage();
  await page.goto(`${base}/connexion`);
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.locator('input[name=password]').fill(password(email));
  await page.getByRole('button', { name: 'Me connecter' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/connexion'), { timeout: 30000 });
  return { context, page };
}

async function shot(page, path, name, { scrollTo, wait = 1200 } = {}) {
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: hide });
  if (scrollTo) {
    await page.locator(scrollTo).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.evaluate(() => window.scrollBy(0, -96));
  }
  await page.waitForTimeout(wait);
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log('✓', name, path);
}

// Participant : passeport, évolution, tableau de bord
{
  const { context, page } = await session('participant@demo.happi.test');
  await shot(page, '/participant/dashboard', 'participant-dashboard');
  await shot(page, '/participant/competences-transversales', 'passeport-ct');
  await shot(page, '/participant/habiletes-sociocognitives', 'passeport-hbs');
  await shot(page, '/participant/evolution', 'evolution');
  await context.close();
}

// Formateur : évaluations d'une séance terminée, fiche participant
{
  const { context, page } = await session('formateur@demo.happi.test');
  await page.goto(`${base}/formateur/sessions`, { waitUntil: 'networkidle' });
  const hrefs = await page.locator('a[href^="/formateur/sessions/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')))]);
  const sessionId = hrefs.map((h) => h.split('/')[3]).find(Boolean);
  if (sessionId) {
    await shot(page, `/formateur/sessions/${sessionId}/evaluations`, 'evaluations');
    await shot(page, `/formateur/sessions/${sessionId}/presences`, 'presences');
  }
  await shot(page, '/formateur/dashboard', 'formateur-dashboard');
  await page.goto(`${base}/formateur/groupes`, { waitUntil: 'networkidle' });
  const group = await page.locator('a[href^="/formateur/groupes/"]').first().getAttribute('href');
  if (group) await shot(page, group, 'groupe');
  await context.close();
}

// Organisme et administration : impact
{
  const { context, page } = await session('organisme@demo.happi.test');
  await shot(page, '/organisme/dashboard', 'organisme-dashboard');
  await shot(page, '/organisme/impact', 'organisme-impact');
  await context.close();
}
{
  const { context, page } = await session('admin@demo.happi.test');
  await shot(page, '/admin/impact', 'admin-impact');
  await context.close();
}

await browser.close();
