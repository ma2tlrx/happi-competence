import { describe, expect, it } from 'vitest';

import { computeCareerPaths, type CareerPathsInputs, type RomeReference } from './engine';
import { SECTOR_ROME_PREFIXES } from './sectors';

/**
 * Référentiel miniature : 4 grands domaines, 6 domaines professionnels, 7 fiches.
 * Savoir-être : 6D102 (esprit d'équipe, très répandu), 6D108 (autonomie), 6D105 (inspirer, rare).
 */
function reference(): RomeReference {
  const fiche = (code: string, appellations: string[], savoirEtre: string[]) => ({ code, appellations, savoirEtre });
  return {
    domains: {
      D: 'Commerce, Vente et Grande distribution',
      G: 'Hôtellerie-Restauration, Tourisme, Loisirs et Animation',
      K: 'Services à la personne et à la collectivité',
      N: 'Transport et Logistique',
      D12: 'Commerce non alimentaire',
      G12: "Animation d'activités de loisirs",
      K11: 'Accompagnement de la personne',
      K12: 'Action sociale, socio-éducative et socio-culturelle',
      K21: 'Formation initiale et continue',
      N13: "Personnel d'encadrement de la logistique",
    },
    fiches: [
      fiche('D1214', ['Vendeur / Vendeuse en équipement de la personne'], ['6D102']),
      fiche('G1203', ['Animateur / Animatrice de loisirs', 'Animateur / Animatrice de loisirs'], ['6D102', '6D105']),
      fiche('K1101', ['Accompagnateur / Accompagnatrice de personnes'], ['6D102']),
      fiche('K1206', ['Animateur / Animatrice socioculturel', 'Coordinateur / Coordinatrice de projets', 'Médiateur / Médiatrice', 'Quatrième'], ['6D102', '6D108', '6D105']),
      fiche('K1207', ['Intervenant / Intervenante d’action sociale'], ['6D108']),
      fiche('K2111', ['Formateur / Formatrice'], ['6D105', '6D102']),
      fiche('N1301', ['Chef / Cheffe d’équipe logistique'], ['6D108', '6D102']),
    ],
  };
}

const SE_LABELS = { '6D102': "Avoir l'esprit d'équipe", '6D105': 'Inspirer, donner du sens', '6D108': "Faire preuve d'autonomie" } as const;

function inputs(overrides: Partial<CareerPathsInputs> = {}): CareerPathsInputs {
  return {
    frameworks: [
      {
        code: 'transversal',
        insufficient: false,
        strengths: ['esprit_d_equipe', 'autonomie'],
        skills: [
          { code: 'esprit_d_equipe', name: "Esprit d'équipe" },
          { code: 'autonomie', name: 'Autonomie' },
          { code: 'leadership', name: 'Leadership' },
        ],
      },
      { code: 'sociocognitive', insufficient: true, strengths: [], skills: [{ code: 'cooperation', name: 'Coopération' }] },
    ],
    mappings: [
      { frameworkCode: 'transversal', skillCode: 'esprit_d_equipe', savoirEtreCode: '6D102', savoirEtreLabel: SE_LABELS['6D102'], linkType: 'equivalent' },
      { frameworkCode: 'transversal', skillCode: 'autonomie', savoirEtreCode: '6D108', savoirEtreLabel: SE_LABELS['6D108'], linkType: 'equivalent' },
      { frameworkCode: 'transversal', skillCode: 'leadership', savoirEtreCode: '6D105', savoirEtreLabel: SE_LABELS['6D105'], linkType: 'partial' },
      { frameworkCode: 'sociocognitive', skillCode: 'cooperation', savoirEtreCode: '6D102', savoirEtreLabel: SE_LABELS['6D102'], linkType: 'close' },
    ],
    reference: reference(),
    declaredSectors: [],
    source: 'ROME 4.0 (France Travail), version 26M10',
    ...overrides,
  };
}

describe('pistes métiers : cas où rien n’est proposé (jamais de piste au hasard)', () => {
  it('sans référentiel ROME', () => {
    expect(computeCareerPaths(inputs({ reference: null }))).toMatchObject({ status: 'unavailable', reason: 'no_reference', paths: [] });
    expect(computeCareerPaths(inputs({ reference: { domains: {}, fiches: [] } }))).toMatchObject({ reason: 'no_reference' });
  });

  it('sans correspondance validée', () => {
    expect(computeCareerPaths(inputs({ mappings: [] }))).toMatchObject({ status: 'unavailable', reason: 'no_validated_mappings' });
  });

  it('sans point d’appui (règle existante du moteur d’évaluation : trop peu de compétences observées)', () => {
    const frameworks = inputs().frameworks.map((framework) => ({ ...framework, insufficient: true, strengths: [] }));
    expect(computeCareerPaths(inputs({ frameworks }))).toMatchObject({ status: 'unavailable', reason: 'no_strengths' });
  });

  it('quand les points d’appui ne sont reliés à aucun savoir-être', () => {
    const frameworks = [{ code: 'transversal', insufficient: false, strengths: ['leadership_bis'], skills: [{ code: 'leadership_bis', name: 'Autre' }] }];
    expect(computeCareerPaths(inputs({ frameworks }))).toMatchObject({ status: 'unavailable', reason: 'no_anchors', strengths: ['Autre'] });
  });

  it('un référentiel marqué « insuffisant » ne fournit aucun point d’appui, même si la liste n’est pas vide', () => {
    const frameworks = [{ code: 'transversal', insufficient: true, strengths: ['autonomie'], skills: [{ code: 'autonomie', name: 'Autonomie' }] }];
    expect(computeCareerPaths(inputs({ frameworks }))).toMatchObject({ reason: 'no_strengths' });
  });
});

describe('pistes métiers : trois pistes, impartiales', () => {
  it('sans secteur déclaré : trois pistes « d’après vos points d’appui », dans trois grands domaines différents', () => {
    const result = computeCareerPaths(inputs());
    expect(result.status).toBe('ok');
    expect(result.paths).toHaveLength(3);
    expect(result.paths.every((path) => path.basis === 'strengths')).toBe(true);
    expect(new Set(result.paths.map((path) => path.domain.code)).size).toBe(3);
    expect(new Set(result.paths.map((path) => path.subdomain.code)).size).toBe(3);
  });

  it('la piste la mieux placée mobilise le plus de points d’appui ; à égalité, celle dont les attentes sont le mieux couvertes (N1301 plutôt que K1206, qui demande aussi « inspirer »)', () => {
    const [first, second] = computeCareerPaths(inputs()).paths;
    expect(first).toMatchObject({ ficheCode: 'N1301', subdomain: { code: 'N13' }, domain: { code: 'N', label: 'Transport et Logistique' } });
    expect(second).toMatchObject({ ficheCode: 'K1206', domain: { label: 'Services à la personne et à la collectivité' } });
    expect(first!.anchors.map((anchor) => anchor.code).sort()).toEqual(['6D102', '6D108']);
  });

  it('un savoir-être non relié à un point d’appui n’est jamais un ancrage (6D105 : leadership n’est pas un point d’appui)', () => {
    const result = computeCareerPaths(inputs());
    expect(result.paths.flatMap((path) => path.anchors.map((anchor) => anchor.code))).not.toContain('6D105');
  });

  it('chaque ancrage cite les compétences HAPPI observées qui y mènent', () => {
    const first = computeCareerPaths(inputs()).paths.find((path) => path.ficheCode === 'K1206');
    expect(first!.anchors.find((anchor) => anchor.code === '6D102')).toEqual({ code: '6D102', label: SE_LABELS['6D102'], happiSkills: ["Esprit d'équipe"] });
  });

  it('exemples : appellations officielles, sans doublon, trois au plus', () => {
    const result = computeCareerPaths(inputs());
    const k1206 = result.paths.find((path) => path.ficheCode === 'K1206')!;
    expect(k1206.examples).toEqual(['Animateur / Animatrice socioculturel', 'Coordinateur / Coordinatrice de projets', 'Médiateur / Médiatrice']);
    const g1203 = computeCareerPaths(inputs({ declaredSectors: ['sport_animation'] })).paths.find((path) => path.ficheCode === 'G1203');
    expect(g1203?.examples).toEqual(['Animateur / Animatrice de loisirs']);
  });

  it('avec des secteurs déclarés : deux pistes dans ces secteurs, puis une ouverture hors de ces secteurs', () => {
    const result = computeCareerPaths(inputs({ declaredSectors: ['sante_social', 'sport_animation'] }));
    expect(result.paths.map((path) => path.basis)).toEqual(['declared_sector', 'declared_sector', 'opening']);
    const [, , third] = result.paths;
    // L'ouverture n'appartient à aucun secteur déclaré.
    const declaredPrefixes = [...SECTOR_ROME_PREFIXES.sante_social, ...SECTOR_ROME_PREFIXES.sport_animation];
    expect(declaredPrefixes.some((prefix) => third!.ficheCode.startsWith(prefix))).toBe(false);
  });

  it('un seul secteur déclaré : une piste dedans, deux ouvertures dans d’autres grands domaines', () => {
    const result = computeCareerPaths(inputs({ declaredSectors: ['transport_logistique'] }));
    expect(result.paths.map((path) => path.basis)).toEqual(['declared_sector', 'opening', 'opening']);
    expect(result.paths[0]!.ficheCode).toBe('N1301');
    expect(new Set(result.paths.map((path) => path.domain.code)).size).toBe(3);
  });

  it('« Autre » seul revient à ne rien déclarer', () => {
    const result = computeCareerPaths(inputs({ declaredSectors: ['autre'] }));
    expect(result.paths.every((path) => path.basis === 'strengths')).toBe(true);
  });

  it('un code de secteur inconnu est ignoré', () => {
    expect(computeCareerPaths(inputs({ declaredSectors: ['astronaute'] })).paths.every((path) => path.basis === 'strengths')).toBe(true);
  });

  it('le bilan ne conserve jamais les secteurs déclarés (ni code, ni libellé)', () => {
    const text = JSON.stringify(computeCareerPaths(inputs({ declaredSectors: ['sante_social', 'sport_animation'] })));
    expect(text).not.toMatch(/sante_social|sport_animation|Santé & social|Sport & animation/);
  });

  it('déterministe : les mêmes données donnent les mêmes pistes, dans le même ordre', () => {
    const a = computeCareerPaths(inputs({ declaredSectors: ['sante_social'] }));
    const b = computeCareerPaths(inputs({ declaredSectors: ['sante_social'] }));
    expect(a).toEqual(b);
  });

  it('moins de trois domaines possibles : moins de trois pistes, jamais de remplissage hors ancrage', () => {
    const tiny: RomeReference = { domains: { K: 'Services', K12: 'Action sociale' }, fiches: [{ code: 'K1206', appellations: ['Animateur'], savoirEtre: ['6D102'] }] };
    const result = computeCareerPaths(inputs({ reference: tiny }));
    expect(result.status).toBe('ok');
    expect(result.paths).toHaveLength(1);
  });

  it('aucun chiffre de score n’est exposé dans le résultat', () => {
    const text = JSON.stringify(computeCareerPaths(inputs({ declaredSectors: ['sante_social'] })));
    expect(text).not.toMatch(/score|%|rang/i);
  });

  it('cite la source et la version du moteur, et liste les points d’appui utilisés', () => {
    const result = computeCareerPaths(inputs());
    expect(result).toMatchObject({ engineVersion: 'pistes-1.0', source: 'ROME 4.0 (France Travail), version 26M10' });
    expect(result.strengths).toEqual(["Esprit d'équipe", 'Autonomie']);
  });
});

describe('correspondance secteurs du questionnaire ↔ ROME', () => {
  it('couvre chaque secteur du questionnaire sauf « Autre », avec des préfixes ROME valides', () => {
    for (const [code, prefixes] of Object.entries(SECTOR_ROME_PREFIXES)) {
      if (code === 'autre') expect(prefixes).toEqual([]);
      else expect(prefixes.length).toBeGreaterThan(0);
      for (const prefix of prefixes) expect(prefix).toMatch(/^[A-N]([0-9]{2})?$/);
    }
  });
});
