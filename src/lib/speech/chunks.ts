/**
 * Découpe un texte en morceaux lisibles par la synthèse vocale (certains navigateurs
 * interrompent les énoncés trop longs) : par paragraphe, puis par phrase, sans
 * dépasser `max` caractères.
 */
export function speechChunks(text: string, max = 220): string[] {
  const chunks: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    const sentences = paragraph.trim().match(/[^.!?…]+[.!?…]*\s*/g) ?? [];
    let current = '';
    for (const raw of sentences) {
      const sentence = raw.trim();
      if (!sentence) continue;
      if (current && (current + ' ' + sentence).length > max) {
        chunks.push(current);
        current = '';
      }
      if (sentence.length > max) {
        // Phrase très longue : coupure aux virgules, puis aux espaces.
        for (const part of sentence.split(/(?<=[,;:])\s+/)) {
          let rest = part;
          while (rest.length > max) {
            const cut = rest.lastIndexOf(' ', max) > 0 ? rest.lastIndexOf(' ', max) : max;
            chunks.push(rest.slice(0, cut).trim());
            rest = rest.slice(cut).trim();
          }
          if (rest) chunks.push(rest);
        }
        continue;
      }
      current = current ? `${current} ${sentence}` : sentence;
    }
    if (current) chunks.push(current);
  }
  return chunks.filter(Boolean);
}
