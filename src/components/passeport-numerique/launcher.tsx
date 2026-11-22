'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';

/**
 * Lien de lancement du Passeport Numérique : le clic demande aussi le plein écran du navigateur (ce n'est possible
 * que sur un geste de la personne). Là où le navigateur ne le permet pas (iPhone, par exemple), l'application
 * occupe quand même tout l'écran de la page.
 */
export function PasseportLauncher({ onClick, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event);
        const root = document.documentElement;
        if (!document.fullscreenElement && typeof root.requestFullscreen === 'function') void root.requestFullscreen().catch(() => undefined);
      }}
    />
  );
}
