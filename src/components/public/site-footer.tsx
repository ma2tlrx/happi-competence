import { Mail, Phone } from 'lucide-react';
import Link from 'next/link';

import { Logo } from '@/components/brand/logo';
import { publicNavigation, siteConfig } from '@/config/site';

export function SiteFooter({ email, phones }: { email: string; phones: string[] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-petrol-950 text-white/70">
      <div className="container-site grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo tone="white" />
          <p className="mt-4 max-w-xs text-[0.9375rem] leading-relaxed">
            {siteConfig.meaning}. Révéler et valoriser les compétences transversales grâce au jeu vidéo.
          </p>
          <p className="mt-4 font-display text-lg font-semibold text-white">{siteConfig.slogan}</p>
        </div>

        <nav aria-label="Plan du site">
          <h2 className="font-sans text-sm font-semibold text-white">Découvrir</h2>
          <ul className="mt-3 space-y-2 text-[0.9375rem]">
            {publicNavigation.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition-colors hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Espaces">
          <h2 className="font-sans text-sm font-semibold text-white">Espaces</h2>
          <ul className="mt-3 space-y-2 text-[0.9375rem]">
            <li><Link href="/connexion?espace=participant" className="hover:text-white">Espace participant</Link></li>
            <li><Link href="/connexion?espace=organisme" className="hover:text-white">Espace organisme</Link></li>
            <li><Link href="/inscription?espace=organisme" className="hover:text-white">Demander un espace organisme</Link></li>
            <li><Link href="/connexion?espace=formateur" className="hover:text-white">Espace formateur</Link></li>
          </ul>
        </nav>

        <div>
          <h2 className="font-sans text-sm font-semibold text-white">Contact</h2>
          <ul className="mt-3 space-y-2 text-[0.9375rem]">
            {email ? (
              <li>
                <a href={`mailto:${email}`} className="inline-flex items-center gap-2 hover:text-white">
                  <Mail className="size-4" aria-hidden />
                  {email}
                </a>
              </li>
            ) : null}
            {phones.map((phone) => (
              <li key={phone}>
                <a href={`tel:${phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-2 hover:text-white">
                  <Phone className="size-4" aria-hidden />
                  {phone}
                </a>
              </li>
            ))}
            <li>
              <Link href="/contact" className="hover:text-white">Formulaire de contact</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-site flex flex-col gap-3 py-5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} HAPPI Compétence</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            <li><Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link></li>
            <li><Link href="/confidentialite" className="hover:text-white">Politique de confidentialité</Link></li>
            <li><Link href="/conditions-utilisation" className="hover:text-white">Conditions d’utilisation</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
