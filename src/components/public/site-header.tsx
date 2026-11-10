'use client';

import { Building2, CircleUserRound, GraduationCap, Menu as MenuIcon, ShieldCheck, User, X } from 'lucide-react';
import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/overlays';
import { publicNavigation } from '@/config/site';
import { cn } from '@/lib/utils';

export type HeaderAccount = {
  name: string;
  href: string;
  roleLabel: string;
} | null;

const spaces = [
  {
    href: '/connexion?espace=participant',
    label: 'Je suis participant',
    hint: 'Mon passeport de compétences',
    icon: User,
  },
  {
    href: '/connexion?espace=organisme',
    label: 'Je suis un organisme',
    hint: 'Suivi de mes participants',
    icon: Building2,
  },
];
const proSpaces = [
  {
    href: '/connexion?espace=formateur',
    label: 'Espace formateur',
    icon: GraduationCap,
  },
  {
    href: '/connexion?espace=admin',
    label: 'Administration',
    icon: ShieldCheck,
  },
];

export function SiteHeader({ account, tone = 'light' }: { account: HeaderAccount; tone?: 'light' | 'dark' }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Ferme le menu lors d'un changement de page (ajustement d'état pendant le rendu, sans effet).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  // En haut d'une page à fond pétrole, l'en-tête est transparent et clair ; au défilement il devient blanc.
  const dark = (tone === 'dark' || pathname === '/') && !scrolled && !open;
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 200,
    damping: 40,
    mass: 0.3,
  });

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-[background-color,border-color,box-shadow] duration-300',
        dark ? 'border-b border-white/10 bg-petrol-900' : 'border-b border-line bg-white/92 backdrop-blur-md',
        scrolled && !dark && 'shadow-xs',
      )}
    >
      {pathname === '/' ? (
        <motion.div aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 origin-left bg-orange-500" style={{ scaleX: progress }} />
      ) : null}
      <div className="container-site flex h-16 items-center justify-between gap-6 lg:h-[4.5rem]">
        <Link href="/" className="shrink-0 rounded-sm" aria-label="HAPPI Compétence, accueil">
          <Logo tone={dark ? 'white' : 'petrol'} priority />
        </Link>

        <nav aria-label="Navigation principale" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {publicNavigation.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative rounded-sm px-3 py-2 text-[0.9375rem] font-medium transition-colors',
                      dark ? 'text-white/75 hover:text-white' : 'text-ink-muted hover:text-ink',
                      active && (dark ? 'text-white' : 'text-ink'),
                    )}
                  >
                    {item.label}
                    {active ? (
                      <motion.span layoutId="nav-active" className="absolute inset-x-3 -bottom-[1px] h-0.5 rounded-full bg-orange-500" />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          {account ? (
            <Button asChild variant={dark ? 'inverse' : 'outline'} size="md" className="hidden sm:inline-flex">
              <Link href={account.href}>
                <CircleUserRound aria-hidden />
                Mon espace
              </Link>
            </Button>
          ) : (
            <Button asChild size="md" className="hidden sm:inline-flex">
              <Link href="/#acces">Accéder à mon espace</Link>
            </Button>
          )}

          <Menu>
            <MenuTrigger
              className={cn(
                'flex size-10 items-center justify-center rounded-md transition-colors',
                dark ? 'text-white hover:bg-white/10' : 'text-ink hover:bg-petrol-50',
              )}
              aria-label={account ? `Compte de ${account.name}` : 'Accès aux espaces'}
            >
              <CircleUserRound className="size-6" aria-hidden />
            </MenuTrigger>
            <MenuContent className="w-72">
              {account ? (
                <>
                  <MenuLabel>
                    <span className="block font-semibold text-ink">{account.name}</span>
                    {account.roleLabel}
                  </MenuLabel>
                  <MenuSeparator />
                  <MenuItem asChild>
                    <Link href={account.href}>
                      <CircleUserRound aria-hidden />
                      Ouvrir mon espace
                    </Link>
                  </MenuItem>
                  <MenuItem asChild>
                    <Link href="/compte">
                      <User aria-hidden />
                      Mon compte
                    </Link>
                  </MenuItem>
                </>
              ) : (
                <>
                  {spaces.map((space) => (
                    <MenuItem key={space.href} asChild>
                      <Link href={space.href}>
                        <space.icon aria-hidden />
                        <span>
                          <span className="block font-medium">{space.label}</span>
                          <span className="block text-sm text-ink-subtle">{space.hint}</span>
                        </span>
                      </Link>
                    </MenuItem>
                  ))}
                  <MenuSeparator />
                  <MenuLabel>Équipe HAPPI</MenuLabel>
                  {proSpaces.map((space) => (
                    <MenuItem key={space.href} asChild>
                      <Link href={space.href}>
                        <space.icon aria-hidden />
                        {space.label}
                      </Link>
                    </MenuItem>
                  ))}
                </>
              )}
            </MenuContent>
          </Menu>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className={cn(
              'flex size-10 items-center justify-center rounded-md transition-colors lg:hidden',
              dark ? 'text-white hover:bg-white/10' : 'text-ink hover:bg-petrol-50',
            )}
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {open ? <X className="size-6" aria-hidden /> : <MenuIcon className="size-6" aria-hidden />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.nav
            id="menu-mobile"
            aria-label="Navigation principale"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-line bg-white lg:hidden"
          >
            <ul className="container-site flex flex-col py-3">
              {publicNavigation.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex h-12 items-center rounded-sm text-base font-medium text-ink"
                    aria-current={(item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)) ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="mt-2 pb-2">
                <Button asChild size="lg" className="w-full">
                  <Link href={account ? account.href : '/#acces'}>{account ? 'Ouvrir mon espace' : 'Accéder à mon espace'}</Link>
                </Button>
              </li>
            </ul>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
