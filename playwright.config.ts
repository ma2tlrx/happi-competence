import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const port = new URL(baseURL).port || '3000';
// Adresse fictive propre à l'exécution : les compteurs de débit par IP de la connexion ne
// s'accumulent pas d'une exécution à l'autre (la limite par e-mail reste vérifiée).
const runIp = `10.250.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;

/**
 * Tests de bout en bout. Prérequis : pile locale démarrée (npm run db:start)
 * et données de démonstration créées (npm run demo:seed).
 * Le serveur Next.js est lancé automatiquement s'il ne tourne pas déjà.
 * Autre port : E2E_BASE_URL=http://localhost:3205 npx playwright test (serveur lancé sur ce port).
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL,
    extraHTTPHeaders: { 'x-forwarded-for': runIp },
    locale: 'fr-FR',
    trace: 'off',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /(responsive|vitrine-mobile)\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /(responsive|vitrine-mobile)\.spec\.ts/ },
  ],
  webServer: {
    command: `npm run dev -- -p ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
