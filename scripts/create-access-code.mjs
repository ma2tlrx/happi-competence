#!/usr/bin/env node
/**
 * Provisionnement sécurisé d'un accès administrateur (ou formateur / organisme).
 *
 *   npm run admin:code                          → code administrateur, valable 48 h
 *   npm run admin:code -- --role formateur      → code formateur
 *   npm run admin:code -- --hours 2 --label "Premier administrateur"
 *
 * Le script s'exécute sur un poste de confiance avec la clé de service. Il génère
 * un code aléatoire, n'enregistre en base que son empreinte SHA-256 (identique à
 * la fonction private.hash_code) et l'affiche une seule fois. La personne crée
 * ensuite son compte sur /acces-pro avec ce code. Aucun mot de passe ni code
 * universel n'est stocké dans le code de l'application.
 */
import { createHash, randomBytes } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const role = option('role', 'admin');
const hours = Number(option('hours', '48'));
const label = option('label', role === 'admin' ? 'Provisionnement administrateur' : null);
const organizationId = option('organisme', null);

if (!['admin', 'formateur', 'organisme'].includes(role)) {
  console.error('✖ Rôle invalide : admin, formateur ou organisme.');
  process.exit(1);
}
if (role === 'organisme' && !organizationId) {
  console.error('✖ Un code organisme nécessite --organisme <identifiant de l’organisme>.');
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('✖ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (fichier .env.local ou variables d’environnement).');
  process.exit(1);
}

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const raw = [...randomBytes(20)].map((byte) => alphabet[byte % 32]).join('');
const code = `HAPPI-${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}-${raw.slice(15, 20)}`;
const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
const hash = createHash('sha256').update(normalized).digest('hex');

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { error } = await supabase.from('invitation_codes').insert({
  code_hash: hash,
  code_hint: raw.slice(-4),
  role,
  organization_id: role === 'organisme' ? organizationId : null,
  label,
  expires_at: Number.isFinite(hours) && hours > 0 ? new Date(Date.now() + hours * 3600_000).toISOString() : null,
});
if (error) {
  console.error(`✖ Le code n’a pas pu être créé : ${error.message}`);
  process.exit(1);
}

console.log(`
✔ Code d’accès « ${role} » créé${Number.isFinite(hours) && hours > 0 ? `, valable ${hours} h` : ''}.

    ${code}

  Il ne sera plus jamais affiché : transmettez-le par un canal sûr.
  Utilisation : ${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://votre-domaine'}/acces-pro
`);
