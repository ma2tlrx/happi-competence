import type { Metadata } from 'next';

import { PageHero } from '@/components/public/sections';
import { siteConfig } from '@/config/site';
import { getCurrentUser } from '@/lib/auth/session';
import type { HelpAudience } from '@/lib/help/content';
import { getPublicCatalog, settingString } from '@/lib/public-catalog';

import { HelpCenter } from './help-center';

export const metadata: Metadata = {
  title: 'Centre d’aide',
  description: 'Guides courts pour les participants, formateurs, organismes et administrateurs de HAPPI Compétence, questions fréquentes et contact.',
};

const AUDIENCE_BY_ROLE: Record<string, HelpAudience> = { participant: 'participant', formateur: 'formateur', organisme: 'organisme', admin: 'admin' };

/** Centre d'aide, ouvert à tous ; une personne connectée voit d'abord les guides de son espace. */
export default async function AidePage() {
  const [user, catalog] = await Promise.all([getCurrentUser().catch(() => null), getPublicCatalog()]);
  const email = settingString(catalog, 'contact.email') || siteConfig.contactEmail;
  return (
    <>
      <PageHero title="Centre d’aide" intro="Des guides courts pour chaque espace, les questions fréquentes, et comment nous joindre." />
      <div className="bg-white py-12 sm:py-16">
        <div className="container-site">
          <HelpCenter audience={user ? (AUDIENCE_BY_ROLE[user.role] ?? null) : null} contactEmail={email} />
        </div>
      </div>
    </>
  );
}
