'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Pages vers lesquelles l'application peut renvoyer la personne (jamais une adresse choisie par la page). */
const EXITS = new Set(['/participant/dashboard', '/formateur/programmes?programme=passeport-numerique']);

/**
 * L'application du Passeport Numérique, dans la page de la plateforme (menu conservé), avec un grand cadre :
 * toute la largeur disponible et presque toute la hauteur de la fenêtre.
 * Le contenu (et le rôle de la personne) est préparé par la route /passeport-numerique/app ; ce cadre n'ajoute
 * aucune autorisation.
 */
export function PasseportNumeriqueFrame({ title = 'Le Passeport Numérique' }: { title?: string }) {
  const router = useRouter();

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

  return (
    <iframe
      title={title}
      src="/passeport-numerique/app"
      allow="clipboard-write"
      className="block h-[calc(100dvh-9rem)] min-h-[40rem] w-full rounded-xl border border-line bg-paper shadow-sm sm:h-[calc(100dvh-7rem)]"
    />
  );
}
