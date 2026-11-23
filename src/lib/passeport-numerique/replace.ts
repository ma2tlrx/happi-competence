/** Remplacements « exacts » sur le fichier d'origine : ils échouent si la phrase cherchée a disparu (mise à jour de l'application). */

export function replaceOnce(html: string, search: string | RegExp, replacement: string, label: string): string {
  const matches = typeof search === 'string' ? html.split(search).length - 1 : (html.match(new RegExp(search.source, search.flags.includes('g') ? search.flags : `${search.flags}g`)) ?? []).length;
  if (matches !== 1) throw new Error(`Passeport Numérique : « ${label} » trouvé ${matches} fois (1 attendue). Le fichier d'origine a changé : mettez à jour src/lib/passeport-numerique/page.ts.`);
  return typeof search === 'string' ? html.replace(search, () => replacement) : html.replace(search, () => replacement);
}

export function replaceAllExactly(html: string, search: string, replacement: string, expected: number, label: string): string {
  const found = html.split(search).length - 1;
  if (found !== expected) throw new Error(`Passeport Numérique : « ${label} » trouvé ${found} fois (${expected} attendues). Le fichier d'origine a changé : mettez à jour src/lib/passeport-numerique/page.ts.`);
  return html.split(search).join(replacement);
}
