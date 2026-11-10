/**
 * Informations publiques du site. Les coordonnées et mentions légales modifiables
 * depuis l'administration (Paramètres) priment sur ces valeurs par défaut.
 */
export const siteConfig = {
  name: 'HAPPI Compétence',
  shortName: 'HAPPI',
  meaning: 'Human Abilities & Professional Progress Integration',
  slogan: 'L’avenir se joue ici.',
  description:
    'HAPPI révèle et valorise les compétences transversales et les habiletés socio-cognitives grâce au jeu vidéo : 18 heures d’accompagnement, 6 sessions, un passeport de compétences.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  contactEmail: 'contact@happicompetence.fr',
  /** Porteurs du projet, tels que présentés sur le site happicompetence.fr. */
  team: [
    { name: 'Thomas Cannard', role: 'Porteur du projet', email: 't.cannard@happicompetence.fr' },
    { name: 'Mattéo Loriaux', role: 'Porteur du projet', email: 'm.loriaux@happicompetence.fr' },
  ],
  consentVersion: '2026-11',
} as const;

export const publicNavigation = [
  { href: '/', label: 'Accueil' },
  { href: '/programme', label: 'Le programme' },
  { href: '/approche', label: 'Notre approche' },
  { href: '/competences', label: 'Les compétences' },
  { href: '/contact', label: 'Contact' },
] as const;

export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
