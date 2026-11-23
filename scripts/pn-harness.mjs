#!/usr/bin/env node
/**
 * Banc d'essai du Passeport Numérique, SANS compte ni base : sert l'application exactement comme la route
 * /passeport-numerique/app (même transformation `preparePasseportNumerique`), avec ses ressources statiques.
 *
 *   node --experimental-strip-types scripts/pn-harness.mjs [port=4100]
 *
 *   http://localhost:4100/?role=participant   parcours d'un participant (compte « Camille Essai »)
 *   http://localhost:4100/?role=staff         espace animateur
 *
 * Les données de l'application restent dans le navigateur (localStorage) : un contexte Playwright neuf = un parcours neuf.
 * Réservé au développement : n'écoute que sur 127.0.0.1.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { register } from 'node:module';

// Les modules de src/ s'importent sans extension (résolution « bundler ») : on l'apprend à Node pour le banc d'essai.
register(
  'data:text/javascript,' +
    encodeURIComponent("export async function resolve(s,c,n){try{return await n(s,c)}catch(e){if(s.startsWith('.')&&!/\\.[a-z]+$/.test(s))return n(s+'.ts',c);throw e}}"),
);
const { preparePasseportNumerique } = await import('../src/lib/passeport-numerique/page.ts');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] ?? 4100);
const TYPES = { '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
const CSP = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'";

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname === '/' || url.pathname === '/passeport-numerique/app') {
    const role = url.searchParams.get('role') === 'staff' ? 'staff' : 'participant';
    const html = preparePasseportNumerique(readFileSync(join(root, 'private/passeport-numerique/index.html'), 'utf8'), { role, uid: 'banc-d-essai', firstName: 'Camille', lastName: 'Essai' });
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP, 'Cache-Control': 'no-store' });
    return response.end(html);
  }
  const file = join(root, 'public', decodeURIComponent(url.pathname));
  if (file.startsWith(join(root, 'public')) && existsSync(file) && statSync(file).isFile()) {
    response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    return response.end(readFileSync(file));
  }
  response.writeHead(404).end('introuvable');
}).listen(port, '127.0.0.1', () => console.log(`Banc d'essai Passeport Numérique : http://127.0.0.1:${port}/?role=participant`));
