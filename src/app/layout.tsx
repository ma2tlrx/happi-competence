import type { Metadata, Viewport } from 'next';
import { DM_Sans, Poppins } from 'next/font/google';

import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/toast';
import { isDemoMode, siteConfig } from '@/config/site';

import './globals.css';

// Polices de l'identité HAPPI, auto-hébergées par Next.js (aucun appel à Google côté visiteur).
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' });
const poppins = Poppins({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-poppins', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.slogan}`,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.slogan}`,
    description: siteConfig.description,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#102c32',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${dmSans.variable} ${poppins.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#contenu"
          className="sr-only z-[70] rounded-md bg-petrol-900 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Aller au contenu
        </a>
        {isDemoMode ? (
          <p className="no-print bg-orange-100 px-4 py-1.5 text-center text-sm font-medium text-petrol-950">
            Environnement de démonstration — les données affichées sont fictives.
          </p>
        ) : null}
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
