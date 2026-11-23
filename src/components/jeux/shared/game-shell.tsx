import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Cadre immersif des jeux : fond vert pétrole, logo HAPPI, aucun menu du site.
 * Utilisé par le groupe de routes `(jeu)` (écrans joueur sur téléphone, écran animateur au projecteur).
 */
export function GameShell({ children, back }: { children: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="flex min-h-dvh flex-col bg-petrol-900 text-white">
      <header className="flex items-center gap-3 px-4 pt-4 pb-2 sm:px-8 sm:pt-6">
        <Image src="/brand/happi-mascotte.png" alt="" width={36} height={36} className="size-9 shrink-0" />
        <Image src="/brand/happi-logotype-blanc.png" alt="HAPPI" width={800} height={305} className="h-5 w-auto" priority />
        <span className="ml-1 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/80">Jeux</span>
        {back ? (
          <Link
            href={back.href}
            className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-md border border-white/25 px-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {back.label}
          </Link>
        ) : null}
      </header>
      <main id="contenu" className="flex flex-1 flex-col px-4 pt-4 pb-10 sm:px-8">
        {children}
      </main>
    </div>
  );
}

/**
 * Zone de contenu : « player » pour un téléphone (colonne étroite), « stage » pour un projecteur
 * (pleine largeur jusqu'à 1920 px, texte agrandi par les composants qui le demandent).
 */
export function GameStage({ size = 'player', className, children }: { size?: 'player' | 'stage'; className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full', size === 'player' ? 'max-w-md' : 'max-w-[110rem]', className)}>{children}</div>;
}

/** Panneau translucide sur le fond pétrole. */
export function GamePanel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-xl border border-white/15 bg-white/[0.06] p-5', className)}>{children}</div>;
}

/** Titre d'écran, centré, avec une petite ligne d'introduction facultative. */
export function GameHeading({ eyebrow, title, className, as: Tag = 'h1' }: { eyebrow?: string; title: ReactNode; className?: string; as?: 'h1' | 'h2' }) {
  return (
    <div className={cn('text-center', className)}>
      {eyebrow ? <p className="text-sm font-medium tracking-wide text-orange-300 uppercase">{eyebrow}</p> : null}
      <Tag className="mt-1 font-display text-2xl font-semibold text-white sm:text-3xl">{title}</Tag>
    </div>
  );
}
