'use client';

import { Bell, CircleUserRound, ExternalLink, GraduationCap, LogOut, Menu as MenuIcon, ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { Avatar } from '@/components/ui/primitives';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/overlays';
import { cn } from '@/lib/utils';

import { NAVIGATION, SPACE_LABELS, type AppSpace, type NavItem } from './nav-config';

export type ShellUser = { firstName: string; lastName: string; email: string; roleLabel: string; isAdmin: boolean };

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function Sidebar({ space, onNavigate }: { space: AppSpace; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label={SPACE_LABELS[space]} className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
      {NAVIGATION[space].map((group, index) => (
        <div key={group.label ?? index}>
          {group.label ? <p className="mb-1.5 px-3 text-xs font-semibold text-white/45">{group.label}</p> : null}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-[0.9375rem] leading-snug font-medium transition-colors',
                      active ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    {active ? <motion.span layoutId={`sidebar-${space}`} className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-orange-500" /> : null}
                    <item.icon className={cn('size-[1.125rem] shrink-0', active ? 'text-orange-400' : '')} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({
  space,
  user,
  unreadCount,
  banner,
  children,
}: {
  space: AppSpace;
  user: ShellUser;
  unreadCount: number;
  banner?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  // Ferme le menu lors d'un changement de page (ajustement d'état pendant le rendu, sans effet).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setDrawer(false);
  }
  const person = { first_name: user.firstName, last_name: user.lastName };
  const mobileItems = NAVIGATION[space].flatMap((group) => group.items).filter((item) => item.mobile).slice(0, 5);

  const brand = (
    <div className="flex h-16 items-center gap-2.5 px-5">
      <Link href="/" className="flex items-center gap-2.5" aria-label="Retour au site HAPPI">
        <Image src="/brand/happi-mascotte.png" alt="" width={32} height={32} className="size-8" />
        <Image src="/brand/happi-logotype-blanc.png" alt="HAPPI" width={800} height={305} className="h-5 w-auto" />
      </Link>
      <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/75">{SPACE_LABELS[space]}</span>
    </div>
  );

  return (
    <div className="min-h-dvh bg-paper lg:pl-64">
      {/* Barre latérale (ordinateur) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-petrol-900 lg:flex">
        {brand}
        <Sidebar space={space} />
        <div className="border-t border-white/10 p-3">
          <Link href="/compte" className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-white/5">
            <Avatar person={person} tone="light" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">
                {user.firstName} {user.lastName}
              </span>
              <span className="block truncate text-xs text-white/55">{user.roleLabel}</span>
            </span>
          </Link>
        </div>
      </aside>

      {/* Tiroir de navigation (mobile et tablette) */}
      <AnimatePresence>
        {drawer ? (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-petrol-950/50 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-petrol-900 lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              aria-label="Menu"
            >
              <div className="flex items-center justify-between pr-3">
                {brand}
                <button type="button" onClick={() => setDrawer(false)} className="flex size-10 items-center justify-center rounded-md text-white hover:bg-white/10" aria-label="Fermer le menu">
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <Sidebar space={space} onNavigate={() => setDrawer(false)} />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      {/* Barre supérieure */}
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur-md">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="flex size-10 items-center justify-center rounded-md text-ink hover:bg-petrol-50 lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <MenuIcon className="size-5" aria-hidden />
          </button>
          <Link href="/" className="flex items-center lg:hidden" aria-label="Retour au site HAPPI">
            <Image src="/brand/happi-logotype-petrole.png" alt="HAPPI" width={800} height={305} className="h-5 w-auto" />
          </Link>
          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href="/notifications"
              className="relative flex size-10 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-petrol-50 hover:text-ink"
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
            >
              <Bell className="size-5" aria-hidden />
              {unreadCount > 0 ? (
                <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[0.625rem] leading-4 font-bold text-petrol-950">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              ) : null}
            </Link>
            <Menu>
              <MenuTrigger className="flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-petrol-50" aria-label="Menu du compte">
                <Avatar person={person} size="sm" />
                <span className="hidden max-w-40 truncate pr-1 text-sm font-medium text-ink sm:block">{user.firstName}</span>
              </MenuTrigger>
              <MenuContent>
                <MenuLabel>
                  <span className="block font-semibold text-ink">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="block truncate">{user.email}</span>
                </MenuLabel>
                <MenuSeparator />
                <MenuItem asChild>
                  <Link href="/compte">
                    <CircleUserRound aria-hidden />
                    Mon compte
                  </Link>
                </MenuItem>
                {user.isAdmin && space !== 'admin' ? (
                  <MenuItem asChild>
                    <Link href="/admin/dashboard">
                      <ShieldCheck aria-hidden />
                      Administration
                    </Link>
                  </MenuItem>
                ) : null}
                {user.isAdmin && space !== 'formateur' ? (
                  <MenuItem asChild>
                    <Link href="/formateur/dashboard">
                      <GraduationCap aria-hidden />
                      Espace formateur
                    </Link>
                  </MenuItem>
                ) : null}
                <MenuItem asChild>
                  <Link href="/">
                    <ExternalLink aria-hidden />
                    Site HAPPI
                  </Link>
                </MenuItem>
                <MenuSeparator />
                <form action="/deconnexion" method="post">
                  <MenuItem asChild>
                    <button type="submit" className="w-full">
                      <LogOut aria-hidden />
                      Me déconnecter
                    </button>
                  </MenuItem>
                </form>
              </MenuContent>
            </Menu>
          </div>
        </div>
      </header>

      {banner}

      <main id="contenu" className="px-4 pt-6 pb-28 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>

      {/* Navigation basse (téléphone) */}
      <nav aria-label="Navigation rapide" className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur-md sm:hidden">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}>
          {mobileItems.map((item) => {
            const active = isActive(pathname, item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn('flex flex-col items-center gap-1 pt-2.5 pb-1 text-[0.6875rem] font-medium', active ? 'text-ink' : 'text-ink-subtle')}
                >
                  <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', active && 'bg-orange-100 text-orange-700')}>
                    <item.icon className="size-5" aria-hidden />
                  </span>
                  <span className="max-w-full truncate px-1">{item.short ?? item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
