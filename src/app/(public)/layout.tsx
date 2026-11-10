import { SiteFooter } from '@/components/public/site-footer';
import { SiteHeader } from '@/components/public/site-header';
import { siteConfig } from '@/config/site';
import { getCurrentUser, homePathFor } from '@/lib/auth/session';
import { ROLE_LABELS } from '@/lib/auth/roles';
import { getPublicCatalog, settingList, settingString } from '@/lib/public-catalog';
import { fullName } from '@/lib/utils';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [user, catalog] = await Promise.all([getCurrentUser().catch(() => null), getPublicCatalog()]);
  const account = user
    ? {
        name: fullName({ first_name: user.firstName, last_name: user.lastName }) || user.email,
        href: homePathFor(user),
        roleLabel: ROLE_LABELS[user.role],
      }
    : null;
  return (
    <>
      <SiteHeader account={account} />
      <main id="contenu">{children}</main>
      <SiteFooter email={settingString(catalog, 'contact.email') || siteConfig.contactEmail} phones={settingList(catalog, 'contact.phones')} />
    </>
  );
}
