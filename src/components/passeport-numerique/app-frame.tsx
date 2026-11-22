'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Pages vers lesquelles l'application peut renvoyer la personne (jamais une adresse choisie par la page). */
const EXITS = new Set(['/participant/dashboard', '/formateur/programmes?programme=passeport-numerique']);

/**
 * L'application du Passeport Numérique, en plein écran : le cadre couvre tout l'écran (sans menu ni barre de la
 * plateforme), dans les limites de la fenêtre. Le plein écran du navigateur est demandé par le bouton de lancement
 * (voir PasseportLauncher) ; ici on le quitte proprement quand la personne sort de l'application.
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
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      router.push(data.to);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [router]);

  return (
    <iframe
      title={title}
      src="/passeport-numerique/app"
      allow="clipboard-write; fullscreen"
      className="fixed inset-0 z-[80] h-dvh w-screen border-0 bg-paper"
    />
  );
}
