'use client';

import { RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="contenu" className="flex min-h-[70dvh] flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-display text-7xl font-semibold tracking-tight text-petrol-200" aria-hidden>
        500
      </p>
      <h1 className="mt-4 text-display-md">La page n’a pas pu s’afficher</h1>
      <p className="mt-3 max-w-md text-ink-muted">
        Une erreur est survenue de notre côté. Vos données ne sont pas perdues : réessayez, ou revenez à l’accueil.
      </p>
      {error.digest ? <p className="mt-2 text-sm text-ink-subtle">Référence de l’erreur : {error.digest}</p> : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>
          <RotateCcw aria-hidden />
          Réessayer
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Revenir à l’accueil</Link>
        </Button>
      </div>
    </main>
  );
}
