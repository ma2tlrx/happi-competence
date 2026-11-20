import { describe, expect, it } from 'vitest';

import { NICKNAME_MAX, nicknameError, suggestNickname } from './nickname';

describe('suggestNickname', () => {
  it('propose le prénom et l’initiale du nom', () => {
    expect(suggestNickname('Marie', 'Dupont')).toBe('Marie D.');
    expect(suggestNickname('  jean pierre ', 'martin')).toBe('jean M.');
  });
  it('se limite au prénom sans nom et respecte la longueur maximale', () => {
    expect(suggestNickname('Léa', '')).toBe('Léa');
    expect(suggestNickname('A'.repeat(30), 'B').length).toBeLessThanOrEqual(NICKNAME_MAX);
  });
});

describe('nicknameError', () => {
  it('accepte un pseudo ordinaire', () => {
    expect(nicknameError('Marie D.')).toBeNull();
    expect(nicknameError('Capitaine Pomme')).toBeNull();
    expect(nicknameError('Équipe 3')).toBeNull();
  });
  it('refuse trop court ou trop long', () => {
    expect(nicknameError('a')).toMatch(/au moins/);
    expect(nicknameError('x'.repeat(21))).toMatch(/dépasser/);
  });
  it('refuse e-mail, lien et numéro de téléphone', () => {
    expect(nicknameError('moi@mail.fr')).toMatch(/e-mail/);
    expect(nicknameError('www.site')).toMatch(/lien/);
    expect(nicknameError('06 12 34 56 78')).toMatch(/téléphone/);
  });
  it('refuse une insulte courante, accents et majuscules compris', () => {
    expect(nicknameError('Sale Connard')).toMatch(/pas accepté/);
    expect(nicknameError('Enculé')).toMatch(/pas accepté/);
    expect(nicknameError('FDP')).toMatch(/pas accepté/);
  });
  it('ne refuse pas un mot ordinaire proche', () => {
    expect(nicknameError('Député')).toBeNull();
    expect(nicknameError('Pierre')).toBeNull();
    expect(nicknameError('Hippolyte')).toBeNull();
  });
});
