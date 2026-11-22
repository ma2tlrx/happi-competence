import { describe, expect, it } from 'vitest';

import { CAREER_PATHS_FIXTURE, CAREER_PATHS_UNAVAILABLE_FIXTURE } from '@/lib/career-paths/fixtures';
import type { CareerPath, CareerPathsUnavailable } from '@/lib/career-paths/model';

import {
  anchorLine,
  basisLabel,
  CAREER_PATHS_LEAD,
  careerPathsView,
  ficheLabel,
  sourceLine,
  unavailableMessage,
} from './career-paths-copy';

const [sector, , opening] = CAREER_PATHS_FIXTURE.paths as [CareerPath, CareerPath, CareerPath];

describe('libellés des pistes à explorer', () => {
  it('étiquette chaque piste selon son origine', () => {
    expect(basisLabel(sector)).toBe('Dans un secteur que vous visez');
    expect(basisLabel(opening)).toBe('Une ouverture, hors de vos choix de départ');
    expect(basisLabel({ ...sector, basis: 'strengths' })).toBe('D’après vos points d’appui');
  });

  it('ne cite jamais le secteur déclaré (le bilan validé est lisible par l’organisme, le questionnaire non)', () => {
    expect(basisLabel(sector)).not.toMatch(/:/);
  });

  it('relie chaque savoir-être ROME aux compétences HAPPI qui y mènent', () => {
    expect(anchorLine(sector.anchors[0]!)).toBe('Avoir l’esprit d’équipe — grâce à : Esprit d’équipe, Coopération');
  });

  it('présente le code de fiche, la source et le chapeau', () => {
    expect(ficheLabel('K1206')).toBe('Fiche ROME K1206');
    expect(sourceLine(CAREER_PATHS_FIXTURE.source)).toBe(
      'Source : ROME 4.0 (France Travail), version 26M10. Pistes calculées automatiquement à partir des correspondances validées par l’équipe HAPPI ; elles ne modifient aucun niveau.',
    );
    expect(CAREER_PATHS_LEAD).toMatch(/^Trois pistes de métiers à explorer avec votre conseiller ou votre formateur\./);
  });

  it.each<[CareerPathsUnavailable, RegExp]>([
    ['no_validated_mappings', /n’ont pas encore été validées/],
    ['no_strengths', /Pas encore assez de compétences observées/],
    ['no_anchors', /ne sont pas encore reliés aux savoir-être/],
    ['no_reference', /Le référentiel des métiers n’est pas disponible/],
  ])('explique l’absence de piste : %s', (reason, expected) => {
    expect(unavailableMessage(reason)).toMatch(expected);
    expect(unavailableMessage(reason)).toMatch(/aucune piste n’est proposée/);
  });

  it('n’affiche ni pourcentage ni score', () => {
    const texts = CAREER_PATHS_FIXTURE.paths.flatMap((path) => [basisLabel(path), ficheLabel(path.ficheCode), ...path.anchors.map(anchorLine)]);
    for (const text of [...texts, CAREER_PATHS_LEAD, sourceLine(CAREER_PATHS_FIXTURE.source)]) expect(text).not.toMatch(/%|\bscore\b|\/\s*\d|meilleur/i);
  });
});

describe('affichage de la section', () => {
  it('ne montre rien pour un ancien bilan sans pistes', () => {
    expect(careerPathsView(undefined, { hidden: false, review: true })).toEqual({ kind: 'none' });
    expect(careerPathsView(null, { hidden: false, review: false })).toEqual({ kind: 'none' });
  });

  it('ne montre rien quand la section est masquée', () => {
    expect(careerPathsView(CAREER_PATHS_FIXTURE, { hidden: true, review: true })).toEqual({ kind: 'none' });
  });

  it('montre les pistes disponibles', () => {
    expect(careerPathsView(CAREER_PATHS_FIXTURE, { hidden: false, review: false })).toEqual({ kind: 'paths', paths: CAREER_PATHS_FIXTURE.paths });
  });

  it('explique l’absence de piste en relecture, l’omet dans le bilan remis', () => {
    expect(careerPathsView(CAREER_PATHS_UNAVAILABLE_FIXTURE, { hidden: false, review: true })).toEqual({
      kind: 'unavailable',
      message: unavailableMessage('no_strengths'),
    });
    expect(careerPathsView(CAREER_PATHS_UNAVAILABLE_FIXTURE, { hidden: false, review: false })).toEqual({ kind: 'none' });
  });

  it('traite une liste vide comme une absence de piste', () => {
    const empty = { ...CAREER_PATHS_FIXTURE, paths: [] };
    expect(careerPathsView(empty, { hidden: false, review: false })).toEqual({ kind: 'none' });
    expect(careerPathsView(empty, { hidden: false, review: true }).kind).toBe('unavailable');
  });
});

describe('chapeau accordé au nombre de pistes', () => {
  it('dit « Trois », « Deux » ou « Une » selon le nombre réel', async () => {
    const { careerPathsLead } = await import('./career-paths-copy');
    expect(careerPathsLead(3)).toMatch(/^Trois pistes de métiers/);
    expect(careerPathsLead(2)).toMatch(/^Deux pistes de métiers/);
    expect(careerPathsLead(1)).toMatch(/^Une piste de métiers/);
  });
});
