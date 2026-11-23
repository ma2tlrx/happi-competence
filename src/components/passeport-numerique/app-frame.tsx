'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';

/** Pages vers lesquelles l'application peut renvoyer la personne (jamais une adresse choisie par la page). */
const EXITS = new Set(['/participant/dashboard', '/formateur/programmes?programme=passeport-numerique']);

/** Sous cette largeur (téléphone), la barre de navigation basse de la plateforme est masquée sur cette page. */
const PHONE = '(max-width: 639.98px)';

type Area = { top: number; left: number; bottom: number };

/**
 * L'application du Passeport Numérique, dans la plateforme (menu et en-tête conservés), sur TOUT l'espace restant :
 * le cadre est ancré sous l'en-tête (et le bandeau éventuel), à droite du menu latéral, et va jusqu'aux bords de la
 * fenêtre — plus de marges vides de chaque côté. Ce n'est pas le plein écran du navigateur.
 * Le contenu (et le rôle de la personne) est préparé par la route /passeport-numerique/app ; ce cadre n'ajoute
 * aucune autorisation.
 */
export function PasseportNumeriqueFrame({ title = 'Le Passeport Numérique' }: { title?: string }) {
  const router = useRouter();
  const [area, setArea] = useState<Area | null>(null);

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
    // Sur téléphone, la barre basse de la plateforme est masquée sur cette page : l'application a la sienne.
    document.documentElement.classList.add('pn-immersive');
    const phoneQuery = window.matchMedia(PHONE);
    function measure() {
      const header = document.querySelector('header');
      const main = document.querySelector('main');
      // Bas de l'en-tête, ou du bandeau (démonstration…) placé entre l'en-tête et le contenu.
      const above = main?.previousElementSibling ?? header;
      const top = Math.max(0, Math.round((above ?? header)?.getBoundingClientRect().bottom ?? 0));
      // Menu latéral (grand écran) : le contenu de la plateforme est décalé d'autant.
      const shell = main?.parentElement;
      const left = shell ? Math.round(parseFloat(getComputedStyle(shell).paddingLeft) || 0) : 0;
      let bottom = 0;
      if (phoneQuery.matches) {
        const bars = [...document.querySelectorAll<HTMLElement>('nav')].filter((nav) => {
          const rect = nav.getBoundingClientRect();
          return getComputedStyle(nav).position === 'fixed' && rect.height > 0 && rect.top > window.innerHeight / 2 && rect.bottom >= window.innerHeight - 1;
        });
        bottom = bars.length ? Math.round(window.innerHeight - Math.min(...bars.map((nav) => nav.getBoundingClientRect().top))) : 0;
      }
      setArea({ top, left, bottom });
    }
    measure();
    phoneQuery.addEventListener('change', measure);
    window.addEventListener('resize', measure);
    return () => {
      document.documentElement.classList.remove('pn-immersive');
      phoneQuery.removeEventListener('change', measure);
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Un cadre (élément remplacé) ne s'étire pas entre deux bords : sa taille est donnée explicitement.
  const style: CSSProperties | undefined = area
    ? { position: 'fixed', left: area.left, top: area.top, width: `calc(100vw - ${area.left}px)`, height: `calc(100dvh - ${area.top + area.bottom}px)`, zIndex: 15 }
    : undefined;

  return (
    <iframe
      title={title}
      src="/passeport-numerique/app"
      allow="clipboard-write"
      style={style}
      // Avant la mesure (premier affichage) : grand cadre dans la page, remplacé aussitôt par le cadre ancré.
      className={area ? 'block border-0 bg-paper' : 'block h-[calc(100dvh-7rem)] min-h-[40rem] w-full border border-line bg-paper'}
    />
  );
}
