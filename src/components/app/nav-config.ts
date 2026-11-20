import {
  Award,
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FileSignature,
  Gamepad2,
  GraduationCap,
  HandCoins,
  History,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  MessageSquareHeart,
  MessageSquareWarning,
  Layers,
  ListChecks,
  Mail,
  Radar,
  Route,
  Scale,
  Send,
  Settings,
  Share2,
  ShieldCheck,
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
        { href: '/organisme/programmes', label: 'Programmes', icon: Layers, mobile: true },
        { href: '/organisme/orientations', label: 'Orientations', icon: Send, mobile: true },
        { href: '/organisme/participants', label: 'Participants', icon: Users, mobile: true },
        { href: '/organisme/sessions', label: 'Sessions', icon: CalendarDays, mobile: true },
        { href: '/organisme/presences', label: 'Présences', icon: ClipboardCheck },
        { href: '/organisme/suivis', label: 'Suivis', icon: CalendarClock },
        { href: '/organisme/impact', label: 'Impact', icon: TrendingUp },
        { href: '/organisme/financements', label: 'Financements', icon: HandCoins },
        { href: '/organisme/satisfaction', label: 'Satisfaction', icon: MessageSquareHeart },
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
        { href: '/formateur/orientations', label: 'Orientations', icon: Send },
        { href: '/formateur/suivis', label: 'Suivis', icon: CalendarClock },
        { href: '/formateur/seconde-cotation', label: 'Seconde cotation', icon: Scale },
        { href: '/formateur/registre', label: 'Mon registre', icon: BadgeCheck },
      ],
    },
    HELP,
  ],
  admin: [
    {
      items: [{ href: '/admin/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, mobile: true, short: 'Accueil' }],
    },
    {
      label: 'Comptes',
      items: [
        { href: '/admin/utilisateurs', label: 'Utilisateurs', icon: User, mobile: true },
        { href: '/admin/organismes', label: 'Organismes', icon: Building2, mobile: true },
        { href: '/admin/formateurs', label: 'Formateurs', icon: GraduationCap },
        { href: '/admin/participants', label: 'Participants', icon: Users },
        { href: '/admin/codes-acces', label: 'Codes d’accès', icon: KeyRound },
        { href: '/admin/partages', label: 'Liens de partage', icon: Share2 },
      ],
    },
    {
      label: 'Programme',
      items: [
        { href: '/admin/programmes', label: 'Programmes', icon: BookOpen },
        { href: '/admin/groupes', label: 'Groupes', icon: Layers },
        { href: '/admin/sessions', label: 'Sessions', icon: CalendarDays, mobile: true },
        { href: '/admin/referentiels', label: 'Référentiels', icon: Radar },
        { href: '/admin/contenus', label: 'Supports pédagogiques', icon: FileText },
        { href: '/jeux', label: 'Jeux', icon: Gamepad2, permission: 'games.manage' },
        { href: '/admin/satisfaction', label: 'Satisfaction', icon: MessageSquareHeart },
      ],
    },
    {
      label: 'Pilotage',
      items: [
        { href: '/admin/orientations', label: 'Orientations', icon: Send },
        { href: '/admin/impact', label: 'Impact', icon: TrendingUp },
        { href: '/admin/financements', label: 'Financements', icon: HandCoins },
        { href: '/admin/suivis', label: 'Suivis', icon: CalendarClock },
        { href: '/admin/qualite', label: 'Qualité', icon: ShieldCheck },
        { href: '/admin/fiabilite', label: 'Fiabilité de la mesure', icon: Scale },
        { href: '/admin/badges', label: 'Badges', icon: Award },
      ],
    },
    {
      label: 'Plateforme',
      items: [
        { href: '/admin/parametres', label: 'Paramètres', icon: Settings },
        { href: '/admin/emails', label: 'E-mails', icon: Mail },
        { href: '/admin/demonstration', label: 'Démonstration', icon: Sparkles },
        { href: '/admin/journal-activite', label: 'Journal d’activité', icon: History },
      ],
    },
    HELP,
  ],
};

/** Navigation d'un espace, sans les entrées dont la permission manque à l'utilisateur. */
export function visibleNavigation(space: AppSpace, access: { isAdmin: boolean; permissions?: readonly string[] }): NavGroup[] {
  const allowed = (item: NavItem) => !item.permission || access.isAdmin || (access.permissions ?? []).includes(item.permission);
  return NAVIGATION[space].map((group) => ({ ...group, items: group.items.filter(allowed) })).filter((group) => group.items.length > 0);
}
