import type { CareerPaths } from './model';

/** Exemples illustratifs pour les tests et les aperçus (personne fictive ; codes et libellés à titre d'exemple). */
export const CAREER_PATHS_FIXTURE: CareerPaths = {
  engineVersion: 'pistes-1.0',
  source: 'ROME 4.0 (France Travail), version 26M10',
  status: 'ok',
  reason: null,
  strengths: ['Esprit d’équipe', 'Autonomie', 'Coopération'],
  paths: [
    {
      basis: 'declared_sector',
      domain: { code: 'K', label: 'Services à la personne et à la collectivité' },
      subdomain: { code: 'K12', label: 'Action sociale, socio-éducative et socio-culturelle' },
      ficheCode: 'K1206',
      examples: ['Animateur / Animatrice socioculturel(le)', 'Coordinateur / Coordinatrice d’activités socioculturelles'],
      anchors: [
        { code: '6D102', label: 'Avoir l’esprit d’équipe', happiSkills: ['Esprit d’équipe', 'Coopération'] },
        { code: '6D108', label: 'Faire preuve d’autonomie', happiSkills: ['Autonomie'] },
      ],
    },
    {
      basis: 'declared_sector',
      domain: { code: 'G', label: 'Hôtellerie-Restauration, Tourisme, Loisirs et Animation' },
      subdomain: { code: 'G12', label: 'Animation d’activités de loisirs' },
      ficheCode: 'G1203',
      examples: ['Animateur / Animatrice de loisirs', 'Animateur / Animatrice de centre de vacances'],
      anchors: [{ code: '6D102', label: 'Avoir l’esprit d’équipe', happiSkills: ['Esprit d’équipe', 'Coopération'] }],
    },
    {
      basis: 'opening',
      domain: { code: 'N', label: 'Transport et Logistique' },
      subdomain: { code: 'N13', label: 'Personnel d’encadrement de la logistique' },
      ficheCode: 'N1301',
      examples: ['Chef / Cheffe d’équipe logistique'],
      anchors: [{ code: '6D108', label: 'Faire preuve d’autonomie', happiSkills: ['Autonomie'] }],
    },
  ],
};

export const CAREER_PATHS_UNAVAILABLE_FIXTURE: CareerPaths = {
  engineVersion: 'pistes-1.0',
  source: 'ROME 4.0 (France Travail), version 26M10',
  status: 'unavailable',
  reason: 'no_strengths',
  strengths: [],
  paths: [],
};
