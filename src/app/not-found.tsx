import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Page introuvable', robots: { index: false } };

export default function NotFound() {
  return (
    <main id="contenu" className="flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center">
      <Link href="/" aria-label="HAPPI Compétence, retour à l’accueil">
        <Logo />
      </Link>
      <p className="mt-12 font-display text-7xl font-semibold tracking-tight text-petrol-200" aria-hidden>
        404
      </p>
      <h1 className="mt-4 text-display-md">Cette page n’existe pas</h1>
      <p className="mt-3 max-w-md text-ink-muted">
        Le lien est peut-être erroné, ou la page a été déplacée. Vérifiez l’adresse ou revenez à l’accueil.
      </p>
      <Button asChild className="mt-8">
        <Link href="/">
          <ArrowLeft aria-hidden />
          Revenir à l’accueil
        </Link>
      </Button>
    </main>
  );
}
