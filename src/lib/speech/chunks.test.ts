import { describe, expect, it } from 'vitest';

import { speechChunks } from './chunks';

describe('découpage pour la lecture à voix haute', () => {
  it('regroupe les phrases courtes et coupe les textes longs', () => {
    expect(speechChunks('Bonjour. Voici votre bilan.\n\nÀ bientôt.')).toEqual(['Bonjour. Voici votre bilan.', 'À bientôt.']);
    const chunks = speechChunks(`${'mot '.repeat(120)}fin.`, 100);
    expect(chunks.every((chunk) => chunk.length <= 100)).toBe(true);
    expect(chunks.join(' ')).toContain('fin.');
  });
});
