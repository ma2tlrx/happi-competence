import {
  Award,
  BookOpen,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  FileText,
  FileSignature,
  Gamepad2,
  History,
  LayoutDashboard,
  LifeBuoy,
  MessageSquareHeart,
  MessageSquareWarning,
  Layers,
  ListChecks,
  Radar,
  Route,
  Send,
  Settings,
  Share2,
  Sparkles,
  TrendingUp,
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
        { href: '/participant/dashboard', label: 'Vue d’ensemble', icon: LayoutDashboard, mobile: true, short: 'Accueil' },
        { href: '/participant/competences-transversales', label: 'Compétences transversales', icon: Radar, mobile: true, short: 'Compétences' },
        { href: '/participant/habiletes-sociocognitives', label: 'Habiletés socio-cognitives', icon: Sparkles },
        { href: '/participant/parcours', label: 'Mon parcours', icon: Route, mobile: true, short: 'Parcours' },
        { href: '/participant/bilan', label: 'Mon bilan', icon: FileText, mobile: true, short: 'Bilan' },
      ],
    },
    {
      label: 'Moi',
      items: [
        { href: '/participant/auto-evaluation', label: 'Mon auto-évaluation', icon: ListChecks },
        { href: '/jouer', label: 'Rejoindre une partie', icon: Gamepad2 },
        { href: '/participant/partage', label: 'Partager mon passeport', icon: Share2 },
        { href: '/participant/badges', label: 'Mes badges', icon: Award },
        { href: '/participant/evolution', label: 'Mon évolution', icon: TrendingUp },
        { href: '/participant/jeux', label: 'Mes jeux', icon: Gamepad2 },
        { href: '/participant/satisfaction', label: 'Donnez votre avis', icon: MessageSquareHeart },
        { href: '/participant/signalements', label: 'Signaler un problème', icon: MessageSquareWarning },
        { href: '/participant/consentements', label: 'Mes consentements', icon: FileSignature },
        { href: '/participant/fiche-entree', label: 'Ma fiche d’entrée', icon: ClipboardList },
        { href: '/participant/profil', label: 'Mon profil', icon: User },
      ],
    },
    HELP,
  ],
  organisme: [
    {
      items: [
        { href: '/organisme/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, mobile: true, short: 'Accueil' },
        { href: '/organisme/participants', label: 'Participants', icon: Users, mobile: true },
        { href: '/organisme/sessions', label: 'Sessions', icon: CalendarDays, mobile: true, also: ['/organisme/presences'] },
        { href: '/organisme/orientations', label: 'Orientations', icon: Send, mobile: true },
        { href: '/organisme/programmes', label: 'Programmes', icon: Layers },
        { href: '/organisme/impact', label: 'Résultats', icon: TrendingUp, mobile: true, also: ['/organisme/financements', '/organisme/satisfaction', '/organisme/suivis'] },
        { href: '/organisme/signalements', label: 'Signaler un problème', icon: MessageSquareWarning },
      ],
    },
    HELP,
  ],
  formateur: [
    {
      items: [
        { href: '/formateur/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, mobile: true, short: 'Accueil' },
        { href: '/formateur/sessions', label: 'Sessions', icon: CalendarDays, mobile: true },
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
        { href: '/jeux', label: 'Jeux', icon: Gamepad2, permission: 'games.manage' },
        {
          href: '/admin/impact',
          label: 'Suivi et résultats',
          icon: TrendingUp,
          mobile: true,
          short: 'Résultats',
          also: ['/admin/suivis', '/admin/orientations', '/admin/financements', '/admin/satisfaction', '/admin/qualite', '/admin/fiabilite', '/admin/badges'],
        },
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
  participant: [],
  organisme: [
    {
      title: 'Résultats',
      tabs: [
        { href: '/organisme/impact', label: 'Impact' },
        { href: '/organisme/suivis', label: 'Suivis' },
        { href: '/organisme/satisfaction', label: 'Satisfaction' },
        { href: '/organisme/financements', label: 'Financements' },
      ],
    },
    {
      title: 'Sessions',
      tabs: [
        { href: '/organisme/sessions', label: 'Sessions' },
        { href: '/organisme/presences', label: 'Présences' },
      ],
    },
  ],
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
export function visibleNavigation(space: AppSpace, access: { isAdmin: boolean; permissions?: readonly string[] }): NavGroup[] {
  const allowed = (item: NavItem) => !item.permission || access.isAdmin || (access.permissions ?? []).includes(item.permission);
  return NAVIGATION[space].map((group) => ({ ...group, items: group.items.filter(allowed) })).filter((group) => group.items.length > 0);
}
