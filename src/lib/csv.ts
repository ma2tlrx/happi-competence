/**
 * Export CSV (séparateur « ; », BOM UTF-8 pour Excel), protégé contre l'injection de
 * formules : une cellule qui commencerait par =, +, -, @, une tabulation ou un retour
 * chariot (éventuellement précédés d'espaces) est neutralisée par une apostrophe.
 */
export function csvCell(value: string | number | null | undefined): string {
  // Nombres : jamais une formule ; virgule décimale, comme l'attend un tableur en français.
  if (typeof value === 'number') return Number.isFinite(value) ? `"${String(value).replace('.', ',')}"` : '""';
  const text = value ?? '';
  const safe = /^\s*[=+\-@]/.test(text) || /^[\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function toCsv(lines: (string | number | null | undefined)[][]): string {
  return `﻿${lines.map((line) => line.map(csvCell).join(';')).join('\r\n')}\r\n`;
}
