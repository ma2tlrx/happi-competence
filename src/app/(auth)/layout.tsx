import Image from 'next/image';
import Link from 'next/link';

import { Logo } from '@/components/brand/logo';
import { siteConfig } from '@/config/site';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="pixel-grid relative hidden overflow-hidden bg-petrol-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/" aria-label="HAPPI Compétence, accueil" className="w-fit">
          <Logo tone="white" />
        </Link>
        <div className="relative z-10 max-w-md">
          <p className="font-display text-4xl leading-tight font-semibold tracking-tight">{siteConfig.slogan}</p>
          <p className="mt-4 text-lg text-white/70">Identifier, développer et valoriser vos compétences transversales grâce au jeu vidéo.</p>
        </div>
        <p className="relative z-10 text-sm text-white/50">{siteConfig.meaning}</p>
        <Image
          src="/brand/happi-mascotte-3d.webp"
          alt=""
          width={800}
          height={1000}
          className="pointer-events-none absolute -right-10 -bottom-10 w-72 opacity-95 xl:w-80"
          priority
        />
      </aside>
      <div className="flex flex-col bg-white">
        <header className="flex h-16 items-center px-6 lg:hidden">
          <Link href="/" aria-label="HAPPI Compétence, accueil">
            <Logo />
          </Link>
        </header>
        <main id="contenu" className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md animate-rise">{children}</div>
        </main>
      </div>
    </div>
  );
}
