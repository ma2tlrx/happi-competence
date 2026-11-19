/**
 * Import des référentiels publics (ROME 4.0, ESCO…) — module pur.
 *
 * Partagé par l'application (tests) et par scripts/import-referentiels-publics.mjs,
 * que Node exécute directement (suppression des types) : ce fichier n'importe donc
 * rien et n'emploie que de la syntaxe TypeScript effaçable.
 *
 * Rien n'est inventé ici : les éléments viennent du fichier officiel téléchargé, les
 * colonnes sont désignées explicitement, et un fichier qui ne les contient pas est refusé.
 * Les seules correspondances produites sont des PROPOSITIONS, pour des libellés
 * identiques ou quasi identiques (casse, accents, ponctuation, espaces) ; la validation
 * reste une décision de l'administrateur.
 */

export type CsvRecord = Record<string, string>;

export type ImportColumns = {
  code: string;
  label: string;
  definition?: string | null;
  /** Ne garder que les lignes dont cette colonne vaut l'une des valeurs (ex. type « savoir-être »). */
  filter?: { column: string; values: string[] } | null;
};

export type ImportedSkill = { code: string; label: string; definition: string | null; position: number };

export type ImportResult = { skills: ImportedSkill[]; warnings: string[]; errors: string[] };

export const MAX_LABEL = 300;
export const MAX_CODE = 300;
export const MAX_DEFINITION = 4000;

/** Libellé comparable : sans accents, en minuscules, ponctuation et espaces réduits. */
export function normalizeLabel(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export type LabelMatch = 'identical' | 'near_identical' | null;

/**
 * « identical » : même libellé (espaces de bord exceptés) ; « near_identical » : ne diffère
 * que par la casse, les accents, la ponctuation ou les espaces. Rien d'autre (ni pluriel,
 * ni synonyme) : au-delà, c'est une décision pédagogique.
 */
export function labelMatch(a: string, b: string): LabelMatch {
  const left = a.trim().replace(/\s+/g, ' ');
  const right = b.trim().replace(/\s+/g, ' ');
  if (!left || !right) return null;
  if (left === right) return 'identical';
  const normalized = normalizeLabel(left);
  return normalized !== '' && normalized === normalizeLabel(right) ? 'near_identical' : null;
}

/** Séparateur deviné sur la ligne d'en-tête : point-virgule, tabulation ou virgule. */
export function detectDelimiter(headerLine: string): string {
  const counts = [';', '\t', ','].map((delimiter) => ({ delimiter, count: headerLine.split(delimiter).length - 1 }));
  counts.sort((a, b) => b.count - a.count);
  return counts[0]!.count > 0 ? counts[0]!.delimiter : ',';
}

/** Analyse CSV (RFC 4180 : guillemets, guillemets doublés, retours à la ligne dans un champ). */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const source = text.replace(/^﻿/, '');
  const firstLine = source.slice(0, source.search(/\r?\n/) === -1 ? source.length : source.search(/\r?\n/));
  const sep = delimiter ?? detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"' && field === '') quoted = true;
    else if (char === sep) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((line) => line.some((cell) => cell.trim() !== ''));
}

/** Lignes → enregistrements nommés par l'en-tête. */
export function toRecords(rows: string[][]): { columns: string[]; records: CsvRecord[] } {
  const [header, ...body] = rows;
  const columns = (header ?? []).map((name) => name.trim());
  const records = body.map((line) => Object.fromEntries(columns.map((name, index) => [name, (line[index] ?? '').trim()])));
  return { columns, records };
}

/** Enregistrements JSON (tableau d'objets) → enregistrements texte. */
export function jsonToRecords(value: unknown): { columns: string[]; records: CsvRecord[] } {
  const list = Array.isArray(value) ? value : [];
  const columns = new Set<string>();
  const records = list
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
    .map((item) => {
      const record: CsvRecord = {};
      for (const [key, raw] of Object.entries(item)) {
        columns.add(key);
        record[key] = typeof raw === 'string' ? raw.trim() : typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : '';
      }
      return record;
    });
  return { columns: [...columns], records };
}

/**
 * Éléments à importer. Refuse un fichier sans les colonnes demandées (liste les colonnes
 * trouvées), ignore les lignes sans code ou sans libellé, garde la première occurrence
 * d'un code en double. Aucun texte n'est tronqué : une valeur trop longue est écartée.
 */
export function extractExternalSkills(input: { columns: string[]; records: CsvRecord[] }, columns: ImportColumns): ImportResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const required = [columns.code, columns.label, columns.definition, columns.filter?.column].filter((name): name is string => Boolean(name));
  const missing = required.filter((name) => !input.columns.includes(name));
  if (missing.length) {
    errors.push(`Colonne(s) absente(s) : ${missing.join(', ')}. Colonnes du fichier : ${input.columns.join(', ') || 'aucune'}.`);
    return { skills: [], warnings, errors };
  }
  const allowed = columns.filter ? new Set(columns.filter.values.map((value) => value.trim())) : null;
  const seen = new Set<string>();
  const skills: ImportedSkill[] = [];
  input.records.forEach((record, index) => {
    const line = index + 2;
    if (allowed && !allowed.has((record[columns.filter!.column] ?? '').trim())) return;
    const code = (record[columns.code] ?? '').trim();
    const label = (record[columns.label] ?? '').replace(/\s+/g, ' ').trim();
    const definition = columns.definition ? (record[columns.definition] ?? '').trim() || null : null;
    if (!code || !label) {
      warnings.push(`Ligne ${line} ignorée : code ou libellé vide.`);
      return;
    }
    if (code.length > MAX_CODE || label.length > MAX_LABEL || (definition && definition.length > MAX_DEFINITION)) {
      warnings.push(`Ligne ${line} ignorée : valeur trop longue (code ${MAX_CODE}, libellé ${MAX_LABEL}, définition ${MAX_DEFINITION} caractères au plus).`);
      return;
    }
    if (seen.has(code)) {
      warnings.push(`Ligne ${line} ignorée : code « ${code} » déjà présent.`);
      return;
    }
    seen.add(code);
    skills.push({ code, label, definition, position: skills.length });
  });
  if (skills.length === 0) errors.push('Aucun élément à importer : vérifiez les colonnes et le filtre.');
  return { skills, warnings, errors };
}

export type HappiSkillRef = { frameworkId: string; frameworkName: string; code: string; name: string };
export type ExternalSkillRef = { id: string; code: string; label: string };
export type MappingProposal = {
  frameworkId: string;
  skillCode: string;
  externalSkillId: string;
  linkType: 'equivalent';
  match: Exclude<LabelMatch, null>;
  justification: string;
};

/**
 * Propositions automatiques : uniquement les libellés identiques ou quasi identiques.
 * Chaque proposition porte sa justification ; elle reste « proposée » jusqu'à décision.
 */
export function proposeLabelMatches(happi: HappiSkillRef[], external: ExternalSkillRef[], sourceName: string): MappingProposal[] {
  const proposals: MappingProposal[] = [];
  for (const skill of happi) {
    for (const item of external) {
      const match = labelMatch(skill.name, item.label);
      if (!match) continue;
      const how = match === 'identical' ? 'Libellé identique' : 'Libellé quasi identique (seules la casse, les accents, la ponctuation ou les espaces diffèrent)';
      proposals.push({
        frameworkId: skill.frameworkId,
        skillCode: skill.code,
        externalSkillId: item.id,
        linkType: 'equivalent',
        match,
        justification:
          `${how} : « ${skill.name} » (${skill.frameworkName}) et « ${item.label} » (${sourceName}, ${item.code}). ` +
          'Proposition automatique fondée sur le seul libellé : comparer les définitions et choisir le type de lien avant de valider.',
      });
    }
  }
  return proposals;
}
