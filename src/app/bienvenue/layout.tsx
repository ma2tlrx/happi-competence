import type { Metadata } from 'next';
import Link from 'next/link';

import { Logo } from '@/components/brand/logo';

export const metadata: Metadata = { title: 'Bienvenue', robots: { index: false } };

/** Mise en page sans menu : le questionnaire d'accueil occupe tout l'écran, comme dans l'ancien formulaire. */
export default function BienvenueLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pixel-grid min-h-dvh bg-petrol-900">
      <header className="mx-auto flex h-16 w-full max-w-xl items-center px-4">
        <Link href="/participant/dashboard" aria-label="HAPPI Compétence, mon accueil">
          <Logo tone="white" />
        </Link>
      </header>
      <main id="contenu" className="mx-auto w-full max-w-xl px-4 pb-16">
        {children}
      </main>
    </div>
  );
}
