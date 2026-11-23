import { describe, expect, it } from 'vitest';

import { THEMES } from '@/lib/jeux/words';

import { hostPath, maxPlayersFor, isResumable, launchStorageKey, parseStoredLaunch, pickWordPair, quizLaunchProblem, wordsProblem } from './jeux-launch';

describe('lancement de jeux depuis le lecteur', () => {
  it('tire une paire du thème avec un tirage injecté, et se replie sur le thème standard', () => {
    const theme = THEMES[0];
    expect(pickWordPair(theme.id, () => 0)).toEqual(theme.pairs[0]);
    expect(pickWordPair(theme.id, () => 0.999)).toEqual(theme.pairs[theme.pairs.length - 1]);
    expect(pickWordPair('inconnu', () => 0)).toEqual(theme.pairs[0]);
  });

  it('refuse des mots vides, identiques (casse ignorée) ou trop longs', () => {
    expect(wordsProblem('Chat', 'Chien')).toBeNull();
    expect(wordsProblem(' ', 'Chien')).toMatch(/Civils/);
    expect(wordsProblem('Chat', '')).toMatch(/Fourmi/);
    expect(wordsProblem('Chat', ' chat ')).toMatch(/différents/);
    expect(wordsProblem('x'.repeat(41), 'y')).toMatch(/40/);
  });

  it('un quiz sans question ne se lance pas', () => {
    expect(quizLaunchProblem(0)).toMatch(/question/);
    expect(quizLaunchProblem(3)).toBeNull();
  });

  it('une partie est reprenable tant qu’elle n’est pas terminée', () => {
    expect(isResumable('lobby')).toBe(true);
    expect(isResumable('discussion')).toBe(true);
    expect(isResumable('waiting')).toBe(true);
    expect(isResumable('active')).toBe(true);
    expect(isResumable('game_over')).toBe(false);
    expect(isResumable('finished')).toBe(false);
  });

  it('relit sans danger une mémoire de lancement', () => {
    expect(launchStorageKey('abc', 'undercover')).toBe('lecteur-jeu:abc:undercover');
    expect(parseStoredLaunch(JSON.stringify({ id: 'g1', code: 'ABC234', label: 'Chat / Chien' }))).toEqual({ id: 'g1', code: 'ABC234', label: 'Chat / Chien' });
    expect(parseStoredLaunch(JSON.stringify({ id: 'g1' }))).toEqual({ id: 'g1', code: '', label: '' });
    for (const bad of [null, '', 'pas du json', '{}', '[]', '{"id":3}']) expect(parseStoredLaunch(bad)).toBeNull();
  });

  it('construit les adresses des écrans animateur', () => {
    expect(hostPath('undercover', 'a b')).toBe('/jeux/undercover/partie/a%20b');
    expect(hostPath('quiz', 'q1')).toBe('/jeux/quiz/partie/q1');
  });

  it('dimensionne la salle sur le groupe, entre 10 et 50 places', () => {
    expect(maxPlayersFor(0)).toBe(10);
    expect(maxPlayersFor(14)).toBe(14);
    expect(maxPlayersFor(80)).toBe(50);
  });
});
