#!/usr/bin/env node
/**
 * Pilote la pile Supabase locale (Docker) utilisée pour le développement et les tests.
 *
 *   node scripts/local-stack.mjs start    démarre la pile et applique les migrations manquantes
 *   node scripts/local-stack.mjs stop     arrête les conteneurs (les données sont conservées)
 *   node scripts/local-stack.mjs reset    supprime les données locales puis redémarre à neuf
 *   node scripts/local-stack.mjs status   affiche l'état et les URL
 *   node scripts/local-stack.mjs migrate  applique uniquement les migrations manquantes
 *   node scripts/local-stack.mjs psql ... ouvre psql dans le conteneur (arguments transmis)
 *
 * Les secrets générés ici sont propres à la machine locale (dossier supabase/local/.generated,
 * ignoré par Git). Ils ne doivent jamais servir en production.
 */
import { spawnSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localDir = join(root, 'supabase', 'local');
const generatedDir = join(localDir, '.generated');
const stackEnvPath = join(generatedDir, 'stack.env');
const migrationsDir = join(root, 'supabase', 'migrations');
const composeFile = join(localDir, 'docker-compose.yml');

const API_PORT = process.env.HAPPI_API_PORT ?? '54321';
const DB_PORT = process.env.HAPPI_DB_PORT ?? '54322';
const MAIL_PORT = process.env.HAPPI_MAIL_PORT ?? '54324';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function signJwt(payload, secret) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}`;
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

function parseEnv(text) {
  return Object.fromEntries(
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );
}

/** Crée (une seule fois) les secrets locaux et la configuration de la passerelle. */
function ensureGenerated() {
  mkdirSync(generatedDir, { recursive: true });
  let env = existsSync(stackEnvPath) ? parseEnv(readFileSync(stackEnvPath, 'utf8')) : {};
  if (!env.JWT_SECRET || !env.POSTGRES_PASSWORD) {
    const now = Math.floor(Date.now() / 1000);
    const tenYears = 10 * 365 * 24 * 3600;
    const jwtSecret = randomBytes(48).toString('base64url');
    env = {
      POSTGRES_PASSWORD: randomBytes(24).toString('base64url'),
      JWT_SECRET: jwtSecret,
      ANON_KEY: signJwt({ role: 'anon', iss: 'supabase', iat: now, exp: now + tenYears }, jwtSecret),
      SERVICE_ROLE_KEY: signJwt({ role: 'service_role', iss: 'supabase', iat: now, exp: now + tenYears }, jwtSecret),
    };
    writeFileSync(
      stackEnvPath,
      `# Secrets de la pile locale — générés automatiquement, ne pas versionner.\n${Object.entries(env)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n')}\n`,
      { mode: 0o600 },
    );
  }
  writeFileSync(join(generatedDir, 'kong.yml'), kongConfig(env));
  return env;
}

function kongConfig(env) {
  return `_format_version: '2.1'
_transform: true

consumers:
  - username: anon
    keyauth_credentials:
      - key: ${env.ANON_KEY}
  - username: service_role
    keyauth_credentials:
      - key: ${env.SERVICE_ROLE_KEY}

acls:
  - consumer: anon
    group: anon
  - consumer: service_role
    group: admin

services:
  - name: auth-v1-open
    url: http://auth:9999/verify
    routes:
      - name: auth-v1-open
        strip_path: true
        paths: [/auth/v1/verify]
    plugins:
      - name: cors
  - name: auth-v1-open-callback
    url: http://auth:9999/callback
    routes:
      - name: auth-v1-open-callback
        strip_path: true
        paths: [/auth/v1/callback]
    plugins:
      - name: cors
  - name: auth-v1
    url: http://auth:9999/
    routes:
      - name: auth-v1-all
        strip_path: true
        paths: [/auth/v1/]
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: false
      - name: acl
        config:
          hide_groups_header: true
          allow: [admin, anon]
  - name: rest-v1
    url: http://rest:3000/
    routes:
      - name: rest-v1-all
        strip_path: true
        paths: [/rest/v1/]
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: true
      - name: acl
        config:
          hide_groups_header: true
          allow: [admin, anon]
`;
}

function compose(args, { env, input, capture = false, allowFailure = false } = {}) {
  const result = spawnSync('docker', ['compose', '-f', composeFile, ...args], {
    cwd: localDir,
    env: {
      ...process.env,
      POSTGRES_PASSWORD: env.POSTGRES_PASSWORD,
      JWT_SECRET: env.JWT_SECRET,
      API_PORT,
      DB_PORT,
      MAIL_PORT,
      SITE_URL,
      MAILER_AUTOCONFIRM: process.env.HAPPI_MAILER_AUTOCONFIRM ?? 'true',
    },
    input,
    encoding: 'utf8',
    stdio: capture || input !== undefined ? ['pipe', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) fail(`Docker est introuvable ou inaccessible : ${result.error.message}`);
  if (result.status !== 0 && !allowFailure) {
    fail(`docker compose ${args.join(' ')} a échoué.\n${result.stderr ?? ''}${result.stdout ?? ''}`);
  }
  return result;
}

function psql(env, sql, { user = 'postgres', singleTransaction = false, allowFailure = false } = {}) {
  const args = ['exec', '-T', 'db', 'psql', '-h', 'localhost', '-U', user, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-At'];
  if (singleTransaction) args.push('--single-transaction');
  args.push('-f', '-');
  return compose(args, { env, input: sql, capture: true, allowFailure });
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function waitFor(label, check, { attempts = 90, delay = 1000 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await check()) return;
    await sleep(delay);
  }
  fail(`${label} n'a pas démarré dans le délai imparti.`);
}

async function httpOk(url, headers = {}) {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function start(env) {
  console.log('▸ Démarrage de PostgreSQL…');
  compose(['up', '-d', 'db'], { env });
  await waitFor('PostgreSQL', () => psql(env, 'select 1;', { user: 'supabase_admin', allowFailure: true }).status === 0);

  // Les rôles de service de l'image Supabase n'ont pas de mot de passe par défaut.
  const password = sqlLiteral(env.POSTGRES_PASSWORD);
  psql(
    env,
    `do $$
declare r text;
begin
  foreach r in array array['authenticator','pgbouncer','supabase_auth_admin','supabase_functions_admin','supabase_storage_admin'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('alter role %I with password %L', r, ${password});
    end if;
  end loop;
end $$;`,
    { user: 'supabase_admin' },
  );

  console.log('▸ Démarrage de l’authentification, de l’API et de la messagerie de test…');
  compose(['up', '-d'], { env });
  const apiUrl = `http://localhost:${API_PORT}`;
  await waitFor('Le service d’authentification', () => httpOk(`${apiUrl}/auth/v1/health`, { apikey: env.ANON_KEY }));
  await waitFor('L’API PostgREST', () => httpOk(`${apiUrl}/rest/v1/`, { apikey: env.ANON_KEY }));

  migrate(env);
  writeEnvLocal(env);
  printSummary(env);
}

function migrate(env) {
  psql(
    env,
    `create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, name text, applied_at timestamptz not null default now());`,
  );
  const applied = new Set(
    psql(env, 'select version from supabase_migrations.schema_migrations order by version;').stdout.split('\n').filter(Boolean),
  );
  const files = existsSync(migrationsDir) ? readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort() : [];
  let count = 0;
  for (const file of files) {
    const version = file.split('_')[0];
    if (applied.has(version)) continue;
    const name = file.replace(/^\d+_/, '').replace(/\.sql$/, '');
    process.stdout.write(`▸ Migration ${file}… `);
    const sql = `${readFileSync(join(migrationsDir, file), 'utf8')}\ninsert into supabase_migrations.schema_migrations (version, name) values (${sqlLiteral(version)}, ${sqlLiteral(name)});\n`;
    const result = psql(env, sql, { singleTransaction: true, allowFailure: true });
    if (result.status !== 0) {
      console.log('échec');
      fail(`La migration ${file} a échoué :\n${result.stderr}`);
    }
    console.log('ok');
    count += 1;
  }
  psql(env, "notify pgrst, 'reload schema';");
  console.log(count === 0 ? '▸ Base à jour, aucune migration à appliquer.' : `▸ ${count} migration(s) appliquée(s).`);
}

function writeEnvLocal(env) {
  const target = join(root, '.env.local');
  const managed = {
    NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${API_PORT}`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SITE_URL: SITE_URL,
  };
  const existing = existsSync(target) ? readFileSync(target, 'utf8') : '';
  const current = parseEnv(existing);
  // On ne remplace jamais une configuration qui pointe vers un autre projet Supabase.
  if (current.NEXT_PUBLIC_SUPABASE_URL && !/localhost|127\.0\.0\.1/.test(current.NEXT_PUBLIC_SUPABASE_URL)) {
    console.log('▸ .env.local pointe vers un projet distant : fichier laissé intact.');
    return;
  }
  const others = existing
    .split('\n')
    .filter((line) => line.trim() && !Object.keys(managed).some((key) => line.startsWith(`${key}=`)) && !line.startsWith('# Pile locale'));
  const content = [
    '# Pile locale HAPPI — valeurs générées par scripts/local-stack.mjs (ne pas versionner)',
    ...Object.entries(managed).map(([key, value]) => `${key}=${value}`),
    ...others,
  ].join('\n');
  writeFileSync(target, `${content}\n`, { mode: 0o600 });
  console.log('▸ .env.local mis à jour pour la pile locale.');
}

function printSummary(env) {
  console.log(`
✔ Pile locale prête
  API Supabase   http://localhost:${API_PORT}
  Base de données postgresql://postgres:${'*'.repeat(8)}@localhost:${DB_PORT}/postgres
  E-mails de test http://localhost:${MAIL_PORT}
  Clés            supabase/local/.generated/stack.env (${Object.keys(env).length} valeurs, locales uniquement)
`);
}

const [command = 'status', ...rest] = process.argv.slice(2);
const env = ensureGenerated();

switch (command) {
  case 'start':
    await start(env);
    break;
  case 'stop':
    compose(['stop'], { env });
    break;
  case 'reset':
    console.log('▸ Suppression des données locales…');
    compose(['down', '-v', '--remove-orphans'], { env });
    await start(env);
    break;
  case 'migrate':
    migrate(env);
    break;
  case 'status':
    compose(['ps'], { env });
    break;
  case 'psql': {
    const result = spawnSync(
      'docker',
      ['compose', '-f', composeFile, 'exec', '-T', 'db', 'psql', '-h', 'localhost', '-U', 'postgres', '-d', 'postgres', ...rest],
      { cwd: localDir, env: { ...process.env, POSTGRES_PASSWORD: env.POSTGRES_PASSWORD, JWT_SECRET: env.JWT_SECRET }, stdio: 'inherit' },
    );
    process.exit(result.status ?? 1);
    break;
  }
  default:
    fail(`Commande inconnue : ${command}. Utilisez start, stop, reset, migrate, status ou psql.`);
}
