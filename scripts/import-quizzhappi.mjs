#!/usr/bin/env node
/**
 * Import optionnel des anciennes données du « Site de Quizz » (export JSON) vers les tables game_*.
 *
 * Le script ne contacte AUCUNE base : il lit un fichier JSON et écrit un fichier SQL d'insertions, à relire
 * puis à exécuter soi-même sur la base voulue (pile locale, ou production après validation du propriétaire).
 *
 * Entrée (export des tables d'origine, par exemple depuis l'éditeur SQL de l'ancien projet) :
 *   { "admins": [{ "id", "email", "name" }],
 *     "quizzes": [{ "id", "admin_id", "title", "description", "theme_color", "created_at" }],
 *     "questions": [{ "id", "quiz_id", "text", "type", "time_limit", "order", "image_url", "answers": [...] }],
 *     "undercover_configs": [{ "admin_id", "name", "civil_word", "undercover_word", "include_mister_white" }] }
 * Les parties, joueurs et états vivants ne sont PAS importés (éphémères, pseudos).
 *
 * Usage :
 *   node scripts/import-quizzhappi.mjs export.json --owner <uuid-du-profil> [--out import.sql]
 *   node scripts/import-quizzhappi.mjs export.json --map ancien@mail.fr=<uuid> --map autre@mail.fr=<uuid>
 *   (--owner : tout attribuer à un seul profil ; --map : un profil par ancienne adresse d'administrateur.)
 *
 * Les profils cibles doivent exister (public.profiles) et pouvoir gérer les jeux (formateur ou administrateur).
 * Les identifiants d'origine sont conservés : réimporter le même fichier ne crée pas de doublon (ON CONFLICT DO NOTHING).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set(['multiple_choice', 'true_false', 'multiple_select']);

function fail(message) {
  console.error(`Erreur : ${message}`);
  process.exit(1);
}

/** Littéral SQL texte entre apostrophes (apostrophes doublées, octet nul refusé). */
export function sqlText(value) {
  if (value === null || value === undefined) return 'null';
  const text = String(value);
  if (text.includes('\u0000')) throw new Error('Caractère nul interdit dans une valeur.');
  return `'${text.replaceAll("'", "''")}'`;
}

const sqlUuid = (value) => {
  if (!UUID.test(String(value))) throw new Error(`Identifiant invalide : ${value}`);
  return `'${String(value).toLowerCase()}'`;
};

const clip = (value, max) => String(value ?? '').trim().slice(0, max);
const sqlBool = (value) => (value === false || value === 'false' || value === 0 ? 'false' : 'true');
const color = (value) => (/^#[0-9a-f]{6}$/i.test(String(value ?? '')) ? String(value) : '#EA632E');
const image = (value) => (/^(https:\/\/\S+|\/[A-Za-z0-9/_.-]+)$/.test(String(value ?? '')) && String(value).length <= 500 ? String(value) : null);

/** Convertit un export en liste d'instructions SQL. Fonction pure (testable). */
export function buildImport(data, resolveOwner) {
  const statements = [];
  const skipped = [];
  const ownerOf = new Map();
  const adminEmail = new Map((data.admins ?? []).map((a) => [a.id, a.email]));
  const owner = (adminId) => {
    if (!ownerOf.has(adminId)) ownerOf.set(adminId, resolveOwner(adminId, adminEmail.get(adminId)));
    return ownerOf.get(adminId);
  };

  const quizIds = new Set();
  for (const quiz of data.quizzes ?? []) {
    const ownerId = owner(quiz.admin_id);
    if (!ownerId) {
      skipped.push(`quiz ${quiz.id} : administrateur ${adminEmail.get(quiz.admin_id) ?? quiz.admin_id} sans profil cible`);
      continue;
    }
    quizIds.add(quiz.id);
    statements.push(
      `insert into public.game_quizzes (id, owner_id, title, description, theme_color, created_at) values (${sqlUuid(quiz.id)}, ${sqlUuid(ownerId)}, ${sqlText(
        clip(quiz.title, 120) || 'Quiz importé',
      )}, ${sqlText(clip(quiz.description, 500))}, ${sqlText(color(quiz.theme_color))}, ${quiz.created_at ? `${sqlText(quiz.created_at)}::timestamptz` : 'now()'}) on conflict (id) do nothing;`,
    );
  }

  let questionCount = 0;
  for (const [index, question] of [...(data.questions ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).entries()) {
    if (!quizIds.has(question.quiz_id)) continue;
    const answers = (Array.isArray(question.answers) ? question.answers : [])
      .slice(0, 8)
      .map((a) => ({ id: String(a.id ?? randomUUID()).slice(0, 64), text: clip(a.text, 200), isCorrect: a.isCorrect === true }));
    const type = TYPES.has(question.type) ? question.type : 'multiple_choice';
    const timeLimit = Math.min(300, Math.max(5, Math.round(Number(question.time_limit) || 20)));
    statements.push(
      `insert into public.game_questions (id, quiz_id, text, type, time_limit, position, image_url, answers) values (${sqlUuid(question.id ?? randomUUID())}, ${sqlUuid(
        question.quiz_id,
      )}, ${sqlText(clip(question.text, 300))}, ${sqlText(type)}, ${timeLimit}, ${Number.isInteger(question.order) ? question.order : index}, ${sqlText(image(question.image_url))}, ${sqlText(
        JSON.stringify(answers),
      )}::jsonb) on conflict (id) do nothing;`,
    );
    questionCount++;
  }

  let configCount = 0;
  for (const config of data.undercover_configs ?? []) {
    const ownerId = owner(config.admin_id);
    if (!ownerId) {
      skipped.push(`configuration « ${config.name} » : administrateur sans profil cible`);
      continue;
    }
    const id = config.id && UUID.test(config.id) ? config.id : randomUUID();
    statements.push(
      `insert into public.game_undercover_configs (id, owner_id, name, civil_word, undercover_word, include_mister_white) values (${sqlUuid(id)}, ${sqlUuid(ownerId)}, ${sqlText(
        clip(config.name, 80) || 'Configuration importée',
      )}, ${sqlText(clip(config.civil_word, 60))}, ${sqlText(clip(config.undercover_word, 60))}, ${sqlBool(config.include_mister_white)}) on conflict (id) do nothing;`,
    );
    configCount++;
  }
  return { statements, skipped, counts: { quizzes: quizIds.size, questions: questionCount, configs: configCount } };
}

function main(argv) {
  const args = argv.slice(2);
  const input = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--owner' && args[args.indexOf(a) - 1] !== '--map' && args[args.indexOf(a) - 1] !== '--out');
  if (!input) fail('fichier JSON manquant. Usage : node scripts/import-quizzhappi.mjs export.json --owner <uuid>');
  const value = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const owner = value('--owner');
  const mapped = new Map();
  args.forEach((a, i) => {
    if (a === '--map' && args[i + 1]) {
      const [email, uuid] = args[i + 1].split('=');
      mapped.set((email ?? '').toLowerCase(), uuid);
    }
  });
  if (!owner && mapped.size === 0) fail('indiquez --owner <uuid> ou au moins un --map email=<uuid>.');
  for (const id of [owner, ...mapped.values()].filter(Boolean)) if (!UUID.test(id)) fail(`identifiant de profil invalide : ${id}`);

  let data;
  try {
    data = JSON.parse(readFileSync(input, 'utf8'));
  } catch (error) {
    fail(`lecture impossible de ${input} : ${error.message}`);
  }
  const { statements, skipped, counts } = buildImport(data, (_adminId, email) => mapped.get((email ?? '').toLowerCase()) ?? owner ?? null);
  const sql = ['-- Import du Site de Quizz (généré par scripts/import-quizzhappi.mjs). À relire avant exécution.', 'begin;', ...statements, 'commit;', ''].join('\n');
  const out = value('--out');
  if (out) writeFileSync(out, sql);
  else process.stdout.write(sql);
  console.error(`${counts.quizzes} quiz, ${counts.questions} questions, ${counts.configs} configurations.${out ? ` Écrit dans ${out}.` : ''}`);
  for (const line of skipped) console.error(`Ignoré : ${line}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
