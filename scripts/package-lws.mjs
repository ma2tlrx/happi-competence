#!/usr/bin/env node
/**
 * Paquet prêt à téléverser sur un hébergement Node.js classique (LWS cPanel, Phusion Passenger).
 *
 *   node scripts/package-lws.mjs               construit (NEXT_OUTPUT=standalone) puis empaquette
 *   node scripts/package-lws.mjs --skip-build  empaquette le dernier build standalone
 *   node scripts/package-lws.mjs --no-zip      dossier seulement (pour rsync, voir scripts/deploy-lws.sh)
 *
 * Résultat : dist/lws/app/ (serveur autonome + .next/static + public + polices des PDF + app.js)
 * et dist/lws/happi-competence-lws-<commit>.zip. Aucune variable d'environnement ni secret n'est
 * inclus : elles se saisissent dans cPanel (voir docs/hebergement-lws.md).
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const standalone = join(root, '.next', 'standalone');
const outDir = join(root, 'dist', 'lws');
const appDir = join(outDir, 'app');
/** Version de Node.js proposée par LWS (Setup Node.js App) et visée par le paquet. */
const TARGET_NODE = '22.23.4';

function run(command, commandArgs, env = {}) {
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
  if (result.status !== 0) {
    console.error(`✖ ${command} ${commandArgs.join(' ')} a échoué.`);
    process.exit(result.status ?? 1);
  }
}

/** Remplace chaque lien symbolique (relatif, interne au paquet) par une copie de sa cible. */
function replaceSymlinks(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      const target = resolve(dirname(path), readlinkSync(path));
      if (!target.startsWith(appDir)) {
        console.error(`✖ Lien symbolique hors du paquet : ${path} → ${target}`);
        process.exit(1);
      }
      rmSync(path);
      cpSync(target, path, { recursive: true });
    } else if (entry.isDirectory()) {
      replaceSymlinks(path);
    }
  }
}

function commit() {
  const result = spawnSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'inconnu';
}

if (!args.has('--skip-build')) {
  console.log('▸ Construction (NEXT_OUTPUT=standalone)…');
  run('npx', ['next', 'build'], { NEXT_OUTPUT: 'standalone' });
}
if (!existsSync(join(standalone, 'server.js'))) {
  console.error('✖ .next/standalone/server.js introuvable : construisez avec NEXT_OUTPUT=standalone (ou sans --skip-build).');
  process.exit(1);
}

console.log('▸ Assemblage de dist/lws/app…');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
// Les liens symboliques du traçage (.next/node_modules/<paquet>-<empreinte>) deviennent
// de vrais dossiers ; le gestionnaire de fichiers de cPanel ne restitue pas toujours les liens d'un zip.
cpSync(standalone, appDir, { recursive: true, verbatimSymlinks: true });
replaceSymlinks(appDir);
cpSync(join(root, '.next', 'static'), join(appDir, '.next', 'static'), { recursive: true });
// public complet (logos, polices des PDF dans public/fonts/report, images de la vitrine).
cpSync(join(root, 'public'), join(appDir, 'public'), { recursive: true });

// Point d'entrée attendu par Passenger (« Application startup file » : app.js).
writeFileSync(
  join(appDir, 'app.js'),
  `/**
 * Point d'entrée Passenger (LWS cPanel → Setup Node.js App → Application startup file : app.js).
 * Passenger intercepte l'écoute réseau : PORT et HOSTNAME ne servent qu'à un lancement manuel
 * (node app.js), par défaut 127.0.0.1:3000.
 */
process.env.NODE_ENV = 'production';
process.env.HOSTNAME = process.env.APP_HOSTNAME || '127.0.0.1';
process.chdir(__dirname);
require('./server.js');
`,
);

// package.json minimal : aucune dépendance à installer (node_modules déjà présents dans le paquet).
const rootPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
writeFileSync(
  join(appDir, 'package.json'),
  `${JSON.stringify(
    {
      name: rootPackage.name,
      version: rootPackage.version,
      private: true,
      main: 'app.js',
      scripts: { start: 'node app.js' },
      engines: { node: `>=${TARGET_NODE.split('.').slice(0, 2).join('.')}` },
    },
    null,
    2,
  )}\n`,
);
writeFileSync(join(appDir, '.node-version'), `${TARGET_NODE}\n`);
const sha = commit();
writeFileSync(join(appDir, 'BUILD.txt'), `HAPPI Compétence ${rootPackage.version}\ncommit ${sha}\nconstruit le ${new Date().toISOString()}\nNode.js visé : ${TARGET_NODE}\n`);

if (!existsSync(join(appDir, 'public', 'fonts', 'report'))) {
  console.error('✖ Polices des PDF absentes (public/fonts/report).');
  process.exit(1);
}

if (!args.has('--no-zip')) {
  const zipName = `happi-competence-lws-${sha}.zip`;
  console.log(`▸ Archive dist/lws/${zipName}…`);
  const zip = spawnSync('zip', ['-qr', '-X', join('..', zipName), '.'], { cwd: appDir, stdio: 'inherit' });
  if (zip.status !== 0) console.warn('⚠ Commande zip indisponible : téléversez le dossier dist/lws/app (ou compressez-le à la main).');
}
console.log(`✔ Paquet prêt : dist/lws/app (commit ${sha}). Test local : cd dist/lws/app && PORT=3203 node app.js`);
