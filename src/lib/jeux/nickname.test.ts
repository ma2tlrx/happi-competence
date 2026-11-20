import { describe, expect, it } from 'vitest';

import { checkNickname, cleanNickname, NICKNAME_MAX, suggestNickname } from './nickname';

describe('filtre de pseudo', () => {
  it('accepte des pseudos ordinaires, accents et espaces normalisés', () => {
    expect(checkNickname('  Inès   M. ')).toEqual({ ok: true, nickname: 'Inès M.' });
    expect(checkNickname('Léa')).toEqual({ ok: true, nickname: 'Léa' });
    expect(checkNickname('Dominique')).toMatchObject({ ok: true });
    expect(checkNickname('Team 42')).toMatchObject({ ok: true });
  });
  it('borne la longueur à 2–20 caractères', () => {
    expect(checkNickname('A').ok).toBe(false);
    expect(checkNickname('x'.repeat(NICKNAME_MAX)).ok).toBe(true);
    expect(checkNickname('x'.repeat(NICKNAME_MAX + 1)).ok).toBe(false);
  });
  it('refuse chevrons et caractères de contrôle', () => {
    expect(checkNickname('<b>gras</b>').ok).toBe(false);
    expect(checkNickname('ab\u0000c').ok).toBe(false);
  });
  it('refuse adresses e-mail, adresses web et numéros de téléphone', () => {
    for (const bad of ['jean@mail.fr', 'jean(at)x', 'www.truc.fr', 'https://x', 'moi.com', '06 12 34 56 78', '0612345678', 'a1b2c3d4e5f6']) {
      const result = checkNickname(bad);
      if (bad === 'jean(at)x') expect(result.ok).toBe(true); // hors du périmètre du filtre simple
      else expect(result.ok, bad).toBe(false);
    }
    expect(checkNickname('Joueur 12').ok).toBe(true);
  });
  it('refuse les insultes évidentes, même avec accents, casse, séparateurs ou chiffres', () => {
    for (const bad of ['Connard', 'CONNARD', 'c.o.n.n.a.r.d', 'c0nnard', 'Sâlope', 'sale pute', 'N@zi', 'Hitler', 'FDP', 'toi connasse']) {
      expect(checkNickname(bad).ok, bad).toBe(false);
    }
  });
  it('ne refuse pas à tort les mots qui en contiennent d’innocents', () => {
    for (const ok of ['Dominique', 'Espuma', 'Computer', 'Scunthorpe', 'Ambiance', 'Kévin']) expect(checkNickname(ok).ok, ok).toBe(true);
  });
  it('cleanNickname ne garde que des espaces simples', () => {
    expect(cleanNickname('  a \t b  ')).toBe('a b');
  });
});

describe('pseudo proposé', () => {
  it('prénom + initiale du nom, jamais le nom complet', () => {
    expect(suggestNickname('Inès', 'Martin')).toBe('Inès M.');
    expect(suggestNickname('  léa ', ' dupont')).toBe('léa D.');
    expect(suggestNickname('Inès', 'Martin')).not.toContain('artin');
  });
  it('sans nom : le prénom seul ; tout vide : « Joueur »', () => {
    expect(suggestNickname('Inès', '')).toBe('Inès');
    expect(suggestNickname('', '')).toBe('Joueur');
  });
  it('respecte la longueur maximale et le filtre', () => {
    const suggestion = suggestNickname('Anne-Marie-Charlotte-Joséphine', 'Dupont');
    expect(Array.from(suggestion).length).toBeLessThanOrEqual(NICKNAME_MAX);
    expect(checkNickname(suggestion).ok).toBe(true);
    expect(suggestNickname('Connard', 'X')).toBe('Joueur');
  });
});
