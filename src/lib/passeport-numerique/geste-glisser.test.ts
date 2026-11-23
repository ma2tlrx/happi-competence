import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { preparePasseportNumerique } from './page';

/**
 * Exercice « Les gestes spéciaux » (monde « Les premiers gestes ») : faire glisser la photo vers la gauche.
 * Le moteur du geste est écrit dans l'application (private/passeport-numerique/index.html), entre deux repères ;
 * on en teste ici la décision (pure) sur le vrai fichier, et la présence de l'alternative sans glisser.
 * Le geste réel (souris et doigt) est vérifié par les scripts Playwright décrits dans docs/passeport-numerique.md.
 */
const source = readFileSync(join(process.cwd(), 'private/passeport-numerique/index.html'), 'utf8');

type Verdict = 'left' | 'right' | 'tap' | 'short' | 'vertical';
function loadVerdict(): (dx: number, dy: number, ms: number) => Verdict {
  const match = source.match(/\/\* swipe-verdict:start \*\/([\s\S]*?)\/\* swipe-verdict:end \*\//);
  if (!match) throw new Error('Repères « swipe-verdict » introuvables dans index.html');
  return new Function(`${match[1]!}; return swipeVerdict;`)() as (dx: number, dy: number, ms: number) => Verdict;
}

describe('Passeport Numérique : geste « glisser vers la gauche » (décision)', () => {
  const verdict = loadVerdict();

  it('accepte un balayage vers la gauche dès 24 px, même lent', () => {
    expect(verdict(-24, 0, 900)).toBe('left');
    expect(verdict(-140, 6, 400)).toBe('left');
  });

  it('accepte un petit mouvement rapide (flick) de 12 px et plus', () => {
    expect(verdict(-14, 0, 30)).toBe('left');
    expect(verdict(-35, 3, 60)).toBe('left');
  });

  it('refuse un mouvement trop court et trop lent, sans le prendre pour un balayage', () => {
    expect(verdict(-15, 0, 400)).toBe('short');
    expect(verdict(-23, 0, 900)).toBe('short');
  });

  it('distingue un simple appui (aucun mouvement) d’un balayage trop court', () => {
    expect(verdict(0, 0, 80)).toBe('tap');
    expect(verdict(-3, 4, 80)).toBe('tap');
  });

  it('reconnaît le mauvais sens (vers la droite) pour l’expliquer', () => {
    expect(verdict(120, 0, 300)).toBe('right');
    expect(verdict(30, -5, 100)).toBe('right');
  });

  it('tolère une trajectoire en biais mais pas un geste surtout vertical', () => {
    expect(verdict(-90, 80, 300)).toBe('left');
    expect(verdict(-30, 90, 300)).toBe('vertical');
  });
});

describe('Passeport Numérique : alternative sans glisser (WCAG 2.5.7) et consignes d’origine', () => {
  it('garde la consigne et l’aide d’origine, et ajoute l’aide « ou touchez le bouton »', () => {
    expect(source).toContain('Faites glisser votre doigt vers la gauche sur la photo, pour passer à la photo suivante. Faites-le deux fois.');
    expect(source).toContain('Posez le doigt sur la photo et faites-le glisser vers la gauche, comme pour tourner la page d’un album.');
    expect(source).toContain('ou touchez le bouton');
  });

  it('propose un vrai bouton « Déplacer vers la gauche » et les flèches du clavier', () => {
    expect(source).toMatch(/<button[^>]*id="gsl"[^>]*>[\s\S]{0,80}Déplacer vers la gauche/);
    expect(source).toContain("ev.key==='ArrowLeft'");
  });

  it('n’utilise plus le seuil fixe de 50 px sans capture du pointeur', () => {
    expect(source).not.toContain('if(dx<-50)');
    expect(source).toContain('setPointerCapture');
  });

  it('la page préparée reste adaptable et contient le moteur du geste', () => {
    const html = preparePasseportNumerique(source, { role: 'participant', uid: 'a1b2c3d4e5f60718', firstName: 'Camille', lastName: 'Essai' });
    expect(html).toContain('swipeVerdict');
    expect(html).toContain('function swipeLeft');
  });
});
