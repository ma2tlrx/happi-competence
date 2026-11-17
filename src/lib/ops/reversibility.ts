import { createHash } from 'node:crypto';

import { strToU8, zipSync, type Zippable } from 'fflate';

import { toCsv } from '@/lib/csv';

/**
 * Archive de réversibilité (export complet, exigence des marchés publics) : produite à partir
 * du résultat de public.export_platform_data (supabase/migrations/20261116110000_platform_ops.sql).
 *
 *   LISEZMOI.md      description du format
 *   manifeste.json   périmètre, date, nombre de lignes et empreinte SHA-256 de chaque fichier
 *   donnees.json     toutes les données, structurées (UTF-8)
 *   csv/<table>.csv  une table par fichier (séparateur « ; », BOM UTF-8, formules neutralisées)
 */
export type ExportPayload = {
  format: string;
  format_version: number;
  exported_at: string;
  scope: 'organisme' | 'plateforme';
  organization_id: string | null;
  counts: Record<string, number>;
  data: Record<string, Record<string, unknown>[]>;
};

/** Tables de l'export et leur description (ordre du LISEZMOI). */
export const EXPORT_TABLES: Record<string, string> = {
  organismes: 'Organisme(s) concerné(s) : identité, contact, statut.',
  participants: 'Participants rattachés : identité, coordonnées, statut, organisme.',
  rattachements_historique: 'Historique des changements d’organisme de rattachement.',
  programmes: 'Programmes suivis par les groupes exportés.',
  groupes: 'Groupes : programme, organisme, dates, statut.',
  inscriptions_groupes: 'Appartenance des participants aux groupes, sorties et motifs d’abandon.',
  seances: 'Séances des groupes : numéro, date, horaires, lieu, statut, formateur.',
  intervenants: 'Formateurs et évaluateurs cités (identifiant, nom, rôle).',
  presences: 'Présences par séance et par participant.',
  emargements: 'Émargements : mode, date, empreinte SHA-256 et tracé SVG de la signature (sans IP ni navigateur).',
  contresignatures_formateur: 'Contresignatures des feuilles d’émargement par le formateur.',
  evaluations_validees: 'Évaluations validées (séance, révision, évaluateur, date de validation).',
  evaluations_scores: 'Notes par compétence des évaluations validées.',
  evaluations_criteres: 'Critères observés des évaluations validées.',
  evaluations_commentaires: 'Commentaires des évaluations validées.',
  bilans_finaux: 'Bilans validés : version, contenu rédigé (Markdown) et données chiffrées (JSON).',
  situations: 'Situations à l’issue du parcours (sortie, suivi à 3 et 6 mois).',
  satisfaction_reponses: 'Réponses aux enquêtes de satisfaction (en-têtes).',
  satisfaction_reponses_detail: 'Réponses aux enquêtes de satisfaction : une ligne par question.',
};

function cellValue(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'oui' : 'non';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Table → CSV : colonnes = union des clés (ordre d'apparition), objets sérialisés en JSON. */
export function tableToCsv(rows: Record<string, unknown>[]) {
  const columns: string[] = [];
  for (const row of rows) for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key);
  return toCsv([columns, ...rows.map((row) => columns.map((column) => cellValue(row[column])))]);
}

export function readme(payload: ExportPayload, organizationName: string | null) {
  const scope = payload.scope === 'organisme' ? `organisme « ${organizationName ?? payload.organization_id} »` : 'toute la plateforme';
  const tables = Object.keys(payload.data)
    .map((name) => `| \`${name}\` | ${payload.counts[name] ?? payload.data[name]?.length ?? 0} | ${EXPORT_TABLES[name] ?? ''} |`)
    .join('\n');
  return `# Export de réversibilité — HAPPI Compétence

- Périmètre : ${scope}
- Date d’export : ${payload.exported_at}
- Format : \`${payload.format}\`, version ${payload.format_version}

## Contenu de l’archive

- \`donnees.json\` : toutes les tables, en JSON (UTF-8). Clé \`data\` : un tableau d’objets par table.
- \`csv/<table>.csv\` : les mêmes tables, une par fichier. Séparateur « ; », encodage UTF-8 avec BOM
  (ouverture directe dans Excel ou LibreOffice). Une cellule qui commencerait par = + - @ est précédée
  d’une apostrophe (protection contre l’injection de formules). Colonnes JSON : sérialisées telles quelles.
- \`manifeste.json\` : périmètre, nombre de lignes et empreinte SHA-256 de chaque fichier (contrôle d’intégrité).

## Conventions

- Identifiants : UUID. Les liens entre tables suivent les colonnes \`*_id\`
  (ex. \`presences.session_id\` → \`seances.id\`, \`presences.participant_id\` → \`participants.id\`).
- Dates et heures : ISO 8601 (UTC pour les horodatages, date locale pour \`scheduled_date\`, \`observed_on\`).
- Notes : échelle du référentiel en vigueur lors de l’évaluation (\`evaluations_scores.score\`).
- Émargements : le tracé de signature est un SVG ; \`content_sha256\` permet d’en vérifier l’intégrité.
  Les empreintes d’adresse IP et les navigateurs ne sont jamais exportés.
- Pour un organisme : seuls ses participants (et leurs données) figurent, même dans un groupe partagé
  avec d’autres structures ; les séances et groupes concernés sont inclus.
- Les brouillons (évaluations non validées, bilans non validés) ne sont pas exportés.

## Tables

| Table | Lignes | Description |
| --- | ---: | --- |
${tables}
`;
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Construit l'archive ZIP (compression DEFLATE) : contenu entièrement déterminé par le résultat de l'export. */
export function buildReversibilityArchive(payload: ExportPayload, organizationName: string | null = null) {
  const files: Record<string, Uint8Array> = {
    'LISEZMOI.md': strToU8(readme(payload, organizationName)),
    'donnees.json': strToU8(JSON.stringify(payload, null, 2)),
  };
  for (const [name, rows] of Object.entries(payload.data)) {
    if (Array.isArray(rows)) files[`csv/${name}.csv`] = strToU8(tableToCsv(rows));
  }
  const manifest = {
    format: payload.format,
    format_version: payload.format_version,
    exported_at: payload.exported_at,
    scope: payload.scope,
    organization_id: payload.organization_id,
    counts: payload.counts,
    files: Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path, { bytes: bytes.length, sha256: sha256(bytes) }])),
  };
  const zippable: Zippable = { ...files, 'manifeste.json': strToU8(JSON.stringify(manifest, null, 2)) };
  return zipSync(zippable, { level: 6, mtime: new Date(payload.exported_at) });
}

/** Nom de fichier ASCII sûr pour l'en-tête Content-Disposition. */
export function archiveFilename(payload: ExportPayload, organizationName: string | null) {
  const date = payload.exported_at.slice(0, 10);
  if (payload.scope === 'plateforme') return `happi-export-plateforme-${date}.zip`;
  const slug = (organizationName ?? 'organisme')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `happi-export-${slug || 'organisme'}-${date}.zip`;
}
