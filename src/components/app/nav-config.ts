import {
  BookOpen,
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FileText,
  GraduationCap,
  History,
  KeyRound,
  LayoutDashboard,
  Layers,
  ListChecks,
  Mail,
  Radar,
  Route,
  Settings,
  Share2,
  Sparkles,
  TrendingUp,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type AppSpace = 'participant' | 'organisme' | 'formateur' | 'admin';
export type NavItem = { href: string; label: string; icon: LucideIcon; mobile?: boolean; exact?: boolean; short?: string };
export type NavGroup = { label?: string; items: NavItem[] };

export const SPACE_LABELS: Record<AppSpace, string> = {
  participant: 'Mon passeport',
  organisme: 'Espace organisme',
  formateur: 'Espace formateur',
  admin: 'Administration',
};

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
        { href: '/participant/profil', label: 'Mon profil', icon: User },
      ],
    },
  ],
  organisme: [
    {
      items: [
        { href: '/organisme/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, mobile: true, short: 'Accueil' },
        { href: '/organisme/programmes', label: 'Programmes', icon: Layers, mobile: true },
        { href: '/organisme/participants', label: 'Participants', icon: Users, mobile: true },
        { href: '/organisme/sessions', label: 'Sessions', icon: CalendarDays, mobile: true },
        { href: '/organisme/presences', label: 'Présences', icon: ClipboardCheck },
        { href: '/organisme/suivis', label: 'Suivis', icon: CalendarClock },
        { href: '/organisme/impact', label: 'Impact', icon: TrendingUp },
      ],
    },
  ],
  formateur: [
    {
      items: [
        { href: '/formateur/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, mobile: true, short: 'Accueil' },
        { href: '/formateur/sessions', label: 'Sessions', icon: CalendarDays, mobile: true },
        { href: '/formateur/groupes', label: 'Groupes', icon: Users, mobile: true },
        { href: '/formateur/programmes', label: 'Programmes', icon: BookOpen, mobile: true },
        { href: '/formateur/suivis', label: 'Suivis', icon: CalendarClock },
      ],
    },
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
      ],
    },
    {
      label: 'Pilotage',
      items: [
        { href: '/admin/impact', label: 'Impact', icon: TrendingUp },
        { href: '/admin/suivis', label: 'Suivis', icon: CalendarClock },
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
  ],
};
