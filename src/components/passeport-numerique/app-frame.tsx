'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';

/** Pages vers lesquelles l'application peut renvoyer la personne (jamais une adresse choisie par la page). */
const EXITS = new Set(['/participant/dashboard', '/formateur/programmes?programme=passeport-numerique']);

/** Sous cette largeur (téléphone, barre de navigation basse visible), le cadre occupe l'espace entre l'en-tête et la barre du bas. */
const PHONE = '(max-width: 639.98px)';

/**
 * L'application du Passeport Numérique, dans la page de la plateforme (menu conservé).
 * - Ordinateur et tablette : grand cadre, toute la largeur disponible et presque toute la hauteur de la fenêtre.
 * - Téléphone : le cadre remplit tout l'espace sous l'en-tête, bord à bord (la barre basse de la plateforme est
 *   masquée sur cette page), pour un seul défilement, celui de l'application.
 * Le contenu (et le rôle de la personne) est préparé par la route /passeport-numerique/app ; ce cadre n'ajoute
 * aucune autorisation.
 */
export function PasseportNumeriqueFrame({ title = 'Le Passeport Numérique' }: { title?: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState<{ top: number; bottom: number } | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Seul l'application, servie par la plateforme elle-même, peut demander à sortir, vers une page connue.
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: unknown; to?: unknown } | null;
      if (data?.type !== 'pn:exit' || typeof data.to !== 'string' || !EXITS.has(data.to)) return;
      router.push(data.to);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [router]);

  useEffect(() => {
    // Sur téléphone, la barre de navigation basse de la plateforme est masquée sur cette page : l'application a
    // sa propre barre (Passeport, Écouter, Aide…) et deux barres empilées ne laissaient qu'un tiers de l'écran.
    // L'en-tête et son menu restent visibles pour quitter la page.
    document.documentElement.classList.add('pn-immersive');
    const query = window.matchMedia(PHONE);
    function measure() {
      if (!query.matches) return setPhone(null);
      const header = document.querySelector('header');
      const top = header ? Math.max(0, Math.round(header.getBoundingClientRect().bottom)) : 0;
      // Barre de navigation basse : un élément fixe, collé au bas de l'écran.
      const bars = [...document.querySelectorAll<HTMLElement>('nav')].filter((nav) => {
        const rect = nav.getBoundingClientRect();
        return getComputedStyle(nav).position === 'fixed' && rect.height > 0 && rect.top > window.innerHeight / 2 && rect.bottom >= window.innerHeight - 1;
      });
      const bottom = bars.length ? Math.round(window.innerHeight - Math.min(...bars.map((nav) => nav.getBoundingClientRect().top))) : 0;
      setPhone({ top, bottom });
    }
    measure();
    query.addEventListener('change', measure);
    window.addEventListener('resize', measure);
    return () => {
      document.documentElement.classList.remove('pn-immersive');
      query.removeEventListener('change', measure);
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Un cadre (élément remplacé) ne s'étire pas entre top et bottom : sa hauteur est donnée explicitement.
  const phoneStyle: CSSProperties | undefined = phone
    ? { position: 'fixed', left: 0, top: phone.top, width: '100%', height: `calc(100dvh - ${phone.top + phone.bottom}px)`, zIndex: 15 }
    : undefined;

  return (
    <iframe
      title={title}
      src="/passeport-numerique/app"
      allow="clipboard-write"
      style={phoneStyle}
      className={
        phone
          ? 'block border-0 bg-paper'
          : 'block h-[calc(100dvh-9rem)] min-h-[40rem] w-full rounded-xl border border-line bg-paper shadow-sm sm:h-[calc(100dvh-7rem)]'
      }
    />
  );
}
