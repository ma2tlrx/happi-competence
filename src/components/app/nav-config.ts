import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  FileText,
  Gamepad2,
  History,
  LayoutDashboard,
  LifeBuoy,
  MonitorSmartphone,
  MessageSquareHeart,
  Radar,
  Route,
  Settings,
  Telescope,
  TrendingUp,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';

import type { PermissionCode } from '@/lib/auth/roles';

export type AppSpace = 'participant' | 'organisme' | 'formateur' | 'admin';
export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  mobile?: boolean;
  /** Autres pages (préfixes) qui font partie de cette entrée : elle reste active sur elles. */
  also?: string[];
  exact?: boolean;
  short?: string;
  /** Entrée réservée aux participants de ce programme (par défaut : tous les programmes). */
  programKind?: 'happi_competence' | 'passeport_numerique';
  /** Entrée visible seulement avec cette permission (l'administrateur les a toutes). Le contrôle réel reste côté serveur. */
  permission?: PermissionCode;
};
export type NavGroup = { label?: string; items: NavItem[] };

export const SPACE_LABELS: Record<AppSpace, string> = {
  participant: 'Mon passeport',
  organisme: 'Espace organisme',
  formateur: 'Espace formateur',
  admin: 'Administration',
};

/** Lien vers le centre d'aide, en fin de menu de chaque espace. */
const HELP: NavGroup = { items: [{ href: '/aide', label: 'Aide', icon: LifeBuoy }] };

export const NAVIGATION: Record<AppSpace, NavGroup[]> = {
  participant: [
    {
      items: [
        { href: '/participant/dashboard', label: 'Accueil', icon: LayoutDashboard, mobile: true },
        { href: '/participant/passeport-numerique', label: 'Passeport Numérique', icon: MonitorSmartphone, mobile: true, short: 'Exercices', programKind: 'passeport_numerique' },
        {
          href: '/participant/competences-transversales',
          label: 'Mes compétences',
          icon: Radar,
          mobile: true,
          programKind: 'happi_competence',
          short: 'Compétences',
          also: ['/participant/habiletes-sociocognitives', '/participant/auto-evaluation', '/participant/evolution'],
        },
        { href: '/participant/parcours', label: 'Mon parcours', icon: Route, mobile: true, short: 'Parcours', programKind: 'happi_competence' },
        { href: '/participant/calendrier', label: 'Calendrier', icon: CalendarDays },
        { href: '/participant/reussites', label: 'Mes réussites', icon: Trophy, mobile: true, short: 'Réussites', also: ['/participant/badges', '/participant/jeux'], programKind: 'happi_competence' },
        { href: '/participant/bilan', label: 'Mon bilan', icon: FileText, mobile: true, short: 'Bilan', also: ['/participant/partage'], programKind: 'happi_competence' },
        { href: '/jouer', label: 'Rejoindre une partie', icon: Gamepad2 },
      ],
    },
    {
      label: 'Moi',
      items: [
        { href: '/participant/profil', label: 'Mon profil', icon: User, mobile: true, short: 'Profil', also: ['/participant/consentements', '/participant/fiche-entree'] },
        { href: '/participant/satisfaction', label: 'Mon avis', icon: MessageSquareHeart, also: ['/participant/signalements'] },
      ],
    },
    HELP,
  ],
  // Espace organisme réduit à l'essentiel : les groupes (et, depuis eux, les résultats de chaque membre).
  // Les autres pages organisme existent toujours (liens d'anciennes notifications) mais ne sont plus au menu.
  organisme: [
    {
      items: [
        { href: '/organisme/dashboard', label: 'Mes groupes', icon: Users, mobile: true, also: ['/organisme/groupes', '/organisme/participants'] },
        { href: '/organisme/calendrier', label: 'Calendrier', icon: CalendarDays, mobile: true },
      ],
    },
    HELP,
  ],
  formateur: [
    {
      items: [
        { href: '/formateur/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, mobile: true, short: 'Accueil' },
        { href: '/formateur/sessions', label: 'Sessions', icon: CalendarDays, mobile: true },
        { href: '/formateur/calendrier', label: 'Calendrier', icon: CalendarDays },
        { href: '/formateur/groupes', label: 'Groupes', icon: Users, mobile: true },
        { href: '/formateur/programmes', label: 'Programmes', icon: BookOpen, mobile: true },
        { href: '/jeux', label: 'Jeux', icon: Gamepad2, permission: 'games.manage' },
        { href: '/formateur/suivis', label: 'Suivi des parcours', icon: CalendarClock, also: ['/formateur/orientations', '/formateur/seconde-cotation', '/formateur/registre'] },
      ],
    },
    HELP,
  ],
  admin: [
    {
      items: [
        { href: '/admin/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, mobile: true, short: 'Accueil' },
        {
          href: '/admin/utilisateurs',
          label: 'Comptes et accès',
          icon: User,
          mobile: true,
          short: 'Comptes',
          also: ['/admin/organismes', '/admin/formateurs', '/admin/participants', '/admin/codes-acces', '/admin/partages'],
        },
        { href: '/admin/programmes', label: 'Programmes', icon: BookOpen, also: ['/admin/referentiels', '/admin/contenus'] },
        { href: '/admin/sessions', label: 'Groupes et sessions', icon: CalendarDays, mobile: true, also: ['/admin/groupes'] },
        { href: '/admin/calendrier', label: 'Calendrier', icon: CalendarDays },
        { href: '/jeux', label: 'Jeux', icon: Gamepad2, permission: 'games.manage' },
        {
          href: '/admin/impact',
          label: 'Suivi et résultats',
          icon: TrendingUp,
          mobile: true,
          short: 'Résultats',
          also: ['/admin/suivis', '/admin/orientations', '/admin/financements', '/admin/satisfaction', '/admin/qualite', '/admin/fiabilite', '/admin/badges'],
        },
        { href: '/admin/observatoire', label: 'Observatoire', icon: Telescope },
        { href: '/admin/parametres', label: 'Paramètres', icon: Settings, also: ['/admin/emails', '/admin/demonstration'] },
        { href: '/admin/journal-activite', label: 'Journal d’activité', icon: History },
      ],
    },
    HELP,
  ],
};

/**
 * Pages regroupées sous une seule entrée de menu : un jeu d'onglets s'affiche en haut de chacune.
 * Les routes et les droits ne changent pas ; seule la navigation est regroupée.
 */
export type Hub = { title: string; tabs: { href: string; label: string }[] };
export const HUBS: Record<AppSpace, Hub[]> = {
  participant: [
    {
      title: 'Mes compétences',
      tabs: [
        { href: '/participant/competences-transversales', label: 'Transversales' },
        { href: '/participant/habiletes-sociocognitives', label: 'Habiletés socio-cognitives' },
        { href: '/participant/auto-evaluation', label: 'Mon auto-évaluation' },
        { href: '/participant/evolution', label: 'Mon évolution' },
      ],
    },
    {
      title: 'Mes réussites',
      tabs: [
        { href: '/participant/reussites', label: 'Défis' },
        { href: '/participant/badges', label: 'Badges' },
        { href: '/participant/jeux', label: 'Jeux' },
      ],
    },
    {
      title: 'Mon bilan',
      tabs: [
        { href: '/participant/bilan', label: 'Mon bilan' },
        { href: '/participant/partage', label: 'Partager mon passeport' },
      ],
    },
    {
      title: 'Mon profil',
      tabs: [
        { href: '/participant/profil', label: 'Profil' },
        { href: '/participant/consentements', label: 'Consentements' },
        { href: '/participant/fiche-entree', label: 'Fiche d’entrée' },
      ],
    },
    {
      title: 'Mon avis',
      tabs: [
        { href: '/participant/satisfaction', label: 'Donner mon avis' },
        { href: '/participant/signalements', label: 'Signaler un problème' },
      ],
    },
  ],
  // Aucun onglet dans l'espace organisme.
  organisme: [],
  formateur: [
    {
      title: 'Suivi des parcours',
      tabs: [
        { href: '/formateur/suivis', label: 'Suivis' },
        { href: '/formateur/orientations', label: 'Orientations' },
        { href: '/formateur/seconde-cotation', label: 'Seconde cotation' },
        { href: '/formateur/registre', label: 'Mon registre' },
      ],
    },
  ],
  admin: [
    {
      title: 'Comptes et accès',
      tabs: [
        { href: '/admin/utilisateurs', label: 'Utilisateurs' },
        { href: '/admin/organismes', label: 'Organismes' },
        { href: '/admin/formateurs', label: 'Formateurs' },
        { href: '/admin/participants', label: 'Participants' },
        { href: '/admin/codes-acces', label: 'Codes d’accès' },
        { href: '/admin/partages', label: 'Liens de partage' },
      ],
    },
    {
      title: 'Programmes',
      tabs: [
        { href: '/admin/programmes', label: 'Programmes' },
        { href: '/admin/referentiels', label: 'Référentiels' },
        { href: '/admin/contenus', label: 'Supports pédagogiques' },
      ],
    },
    {
      title: 'Groupes et sessions',
      tabs: [
        { href: '/admin/sessions', label: 'Sessions' },
        { href: '/admin/groupes', label: 'Groupes' },
      ],
    },
    {
      title: 'Suivi et résultats',
      tabs: [
        { href: '/admin/impact', label: 'Impact' },
        { href: '/admin/suivis', label: 'Suivis' },
        { href: '/admin/orientations', label: 'Orientations' },
        { href: '/admin/satisfaction', label: 'Satisfaction' },
        { href: '/admin/financements', label: 'Financements' },
        { href: '/admin/qualite', label: 'Qualité' },
        { href: '/admin/fiabilite', label: 'Fiabilité' },
        { href: '/admin/badges', label: 'Badges' },
      ],
    },
    {
      title: 'Paramètres',
      tabs: [
        { href: '/admin/parametres', label: 'Général' },
        { href: '/admin/emails', label: 'E-mails' },
        { href: '/admin/demonstration', label: 'Démonstration' },
      ],
    },
  ],
};

/** Le regroupement d'onglets qui contient cette page, s'il y en a un. */
export function hubFor(space: AppSpace, pathname: string): Hub | null {
  return HUBS[space].find((hub) => hub.tabs.some((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`))) ?? null;
}

/** Navigation d'un espace, sans les entrées dont la permission manque à l'utilisateur. */
export function visibleNavigation(space: AppSpace, access: { isAdmin: boolean; permissions?: readonly string[]; programKind?: string }): NavGroup[] {
  const allowed = (item: NavItem) =>
    (!item.permission || access.isAdmin || (access.permissions ?? []).includes(item.permission)) &&
    (!item.programKind || space !== 'participant' || item.programKind === (access.programKind ?? 'happi_competence'));
  return NAVIGATION[space].map((group) => ({ ...group, items: group.items.filter(allowed) })).filter((group) => group.items.length > 0);
}
