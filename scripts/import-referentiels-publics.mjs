#!/usr/bin/env node
/**
 * Import d'un référentiel public (savoir-être professionnels ROME 4.0, compétences
 * transversales ESCO…) à partir d'un fichier OFFICIEL téléchargé par l'administrateur.
 * Mode d'emploi complet, sources et licences : docs/referentiels-publics.md.
 *
 *   npm run referentiels:import -- --fichier ~/telechargements/esco/transversal.csv \
 *     --code esco_transversal --nom "Compétences transversales ESCO" --editeur "Commission européenne" \
 *     --version 1.2.1 --source https://esco.ec.europa.eu/fr/use-esco/download --licence "…" --date 2026-11-18 \
 *     --colonne-code conceptUri --colonne-libelle preferredLabel --colonne-definition description \
 *     [--filtre-colonne <colonne> --filtre-valeur <valeur>[,<valeur>…]] [--proposer] [--essai]
 *
 * Principes
 *   • Rien n'est inventé : chaque élément vient du fichier ; les colonnes sont nommées
 *     explicitement et un fichier qui ne les contient pas est refusé (colonnes listées).
 *   • Le fichier source reste HORS du dépôt (refus s'il est dans le dépôt) : sa licence
 *     n'est pas celle du code.
 *   • Ré-import : les éléments sont mis à jour par code ; un élément absent du nouveau
 *     fichier est marqué inactif (jamais supprimé : ses correspondances restent lisibles).
 *   • --proposer : PROPOSITIONS de correspondance pour les seuls libellés identiques ou
 *     quasi identiques, justifiées. Aucune n'est validée : la base refuse toute validation
 *     qui ne vient pas d'un administrateur identifié dans l'interface.
 *   • --essai : analyse et affiche ce qui serait importé, sans rien écrire.
 *
 * Accepte un CSV (séparateur deviné : « ; », tabulation ou « , ») ou un JSON (tableau d'objets).
 * Clé de service requise (fichier .env.local) ; à lancer sur un poste de confiance.
 */
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import { extractExternalSkills, jsonToRecords, parseCsv, proposeLabelMatches, toRecords } from '../src/lib/public-frameworks/import.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback = null) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);
const fail = (message) => {
  console.error(`✖ ${message}`);
  process.exit(1);
};

const file = option('fichier');
const meta = {
  code: option('code'),
  name: option('nom'),
  publisher: option('editeur'),
  version: option('version'),
  source_url: option('source'),
  license: option('licence'),
  retrieved_on: option('date'),
  notes: option('notes'),
};
const columns = {
  code: option('colonne-code'),
  label: option('colonne-libelle'),
  definition: option('colonne-definition'),
  filter: option('filtre-colonne') ? { column: option('filtre-colonne'), values: (option('filtre-valeur') ?? '').split(',').map((v) => v.trim()).filter(Boolean) } : null,
};
const dryRun = flag('essai');
const propose = flag('proposer');

if (!file) fail('--fichier <chemin du fichier officiel téléchargé> est requis.');
for (const [key, label] of [['code', '--code'], ['name', '--nom'], ['publisher', '--editeur'], ['version', '--version'], ['source_url', '--source'], ['license', '--licence'], ['retrieved_on', '--date']]) {
  if (!meta[key]) fail(`${label} est requis : la source, la version, la licence et la date de récupération accompagnent toujours le référentiel.`);
}
if (!/^[a-z0-9_]{2,40}$/.test(meta.code)) fail('--code : minuscules, chiffres et « _ » (2 à 40 caractères).');
if (!/^https:\/\//.test(meta.source_url)) fail('--source : adresse https de la source officielle.');
if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.retrieved_on)) fail('--date : date de récupération au format AAAA-MM-JJ.');
if (!columns.code || !columns.label) fail('--colonne-code et --colonne-libelle sont requis (noms exacts des colonnes du fichier).');
if (columns.filter && columns.filter.values.length === 0) fail('--filtre-colonne exige --filtre-valeur.');

let path;
try {
  path = realpathSync(resolve(file));
} catch {
  fail(`Fichier introuvable : ${file}`);
}
const inside = relative(realpathSync(root), path);
if (!inside.startsWith('..') && !inside.startsWith('/')) {
  fail('Le fichier source est dans le dépôt : placez-le en dehors (sa licence n’est pas celle du code, voir docs/referentiels-publics.md).');
}

const text = readFileSync(path, 'utf8');
const input = extname(path).toLowerCase() === '.json' ? jsonToRecords(JSON.parse(text)) : toRecords(parseCsv(text));
const result = extractExternalSkills(input, columns);
for (const warning of result.warnings.slice(0, 20)) console.warn(`  ! ${warning}`);
if (result.warnings.length > 20) console.warn(`  ! … et ${result.warnings.length - 20} autre(s) avertissement(s).`);
if (result.errors.length) fail(result.errors.join('\n'));
console.log(`→ ${result.skills.length} élément(s) lu(s) dans ${path}.`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  if (dryRun) {
    for (const skill of result.skills.slice(0, 10)) console.log(`  · ${skill.code} — ${skill.label}`);
    console.log('Essai terminé (sans base : propositions non calculées).');
    process.exit(0);
  }
  fail('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (fichier .env.local ou variables d’environnement).');
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const must = (response, label) => {
  if (response.error) fail(`${label} : ${response.error.message}`);
  return response.data;
};

/** Compétences HAPPI : dernière version publiée de chaque référentiel. */
async function happiSkills() {
  const frameworks = must(await supabase.from('frameworks').select('id, name, framework_versions ( id, version_number, status )'), 'référentiels HAPPI');
  const versions = new Map();
  for (const framework of frameworks) {
    const published = framework.framework_versions.filter((v) => v.status === 'published').sort((a, b) => b.version_number - a.version_number)[0];
    if (published) versions.set(published.id, framework);
  }
  if (versions.size === 0) return [];
  const skills = must(await supabase.from('skills').select('version_id, code, name, is_active').in('version_id', [...versions.keys()]), 'compétences HAPPI');
  return skills.filter((skill) => skill.is_active).map((skill) => ({ frameworkId: versions.get(skill.version_id).id, frameworkName: versions.get(skill.version_id).name, code: skill.code, name: skill.name }));
}

const sourceName = `${meta.name} ${meta.version}`;
if (dryRun) {
  const happi = await happiSkills();
  const proposals = proposeLabelMatches(happi, result.skills.map((skill) => ({ id: skill.code, code: skill.code, label: skill.label })), sourceName);
  for (const skill of result.skills.slice(0, 10)) console.log(`  · ${skill.code} — ${skill.label}`);
  console.log(`→ ${proposals.length} proposition(s) possible(s) (libellé identique ou quasi identique) :`);
  for (const proposal of proposals) console.log(`  · ${proposal.skillCode} ↔ ${proposal.externalSkillId} (${proposal.match})`);
  console.log('Essai terminé : rien n’a été écrit.');
  process.exit(0);
}

const framework = must(
  await supabase.from('external_frameworks').upsert(meta, { onConflict: 'code' }).select('id').single(),
  'référentiel public',
);
const existing = must(await supabase.from('external_skills').select('id, code').eq('framework_id', framework.id), 'éléments existants');
const now = new Set(result.skills.map((skill) => skill.code));
for (let index = 0; index < result.skills.length; index += 500) {
  const batch = result.skills.slice(index, index + 500).map((skill) => ({ framework_id: framework.id, code: skill.code, label: skill.label, definition: skill.definition, position: skill.position, is_active: true }));
  must(await supabase.from('external_skills').upsert(batch, { onConflict: 'framework_id,code' }), 'éléments');
}
const absent = existing.filter((row) => !now.has(row.code)).map((row) => row.id);
for (let index = 0; index < absent.length; index += 200) {
  must(await supabase.from('external_skills').update({ is_active: false }).in('id', absent.slice(index, index + 200)), 'éléments absents');
}
console.log(`✔ ${meta.name} ${meta.version} : ${result.skills.length} élément(s) importé(s)${absent.length ? `, ${absent.length} marqué(s) inactif(s)` : ''}.`);

if (propose) {
  const imported = must(await supabase.from('external_skills').select('id, code, label').eq('framework_id', framework.id).eq('is_active', true), 'éléments importés');
  const proposals = proposeLabelMatches(await happiSkills(), imported, sourceName);
  if (proposals.length) {
    must(
      await supabase.from('skill_mappings').upsert(
        proposals.map((proposal) => ({
          framework_id: proposal.frameworkId,
          skill_code: proposal.skillCode,
          external_skill_id: proposal.externalSkillId,
          link_type: proposal.linkType,
          origin: 'label_match',
          justification: proposal.justification,
        })),
        { onConflict: 'framework_id,skill_code,external_skill_id', ignoreDuplicates: true },
      ),
      'propositions',
    );
  }
  console.log(`✔ ${proposals.length} proposition(s) de correspondance (statut « proposée », à examiner dans Administration › Référentiels › Correspondances).`);
}
