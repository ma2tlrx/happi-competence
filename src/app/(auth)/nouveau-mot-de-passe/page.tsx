import type { Metadata } from 'next';
import Link from 'next/link';

import { Notice } from '@/components/ui/primitives';
import { getCurrentUser, homePathFor } from '@/lib/auth/session';

import { NewPasswordForm } from '../auth-forms';
import { AuthHeading } from '../auth-heading';

export const metadata: Metadata = { title: 'Nouveau mot de passe', robots: { index: false } };

export default async function NouveauMotDePassePage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <>
        <AuthHeading title="Lien expiré" />
        <Notice variant="warning" title="Ce lien n’est plus valide">
          Les liens de réinitialisation sont à usage unique et expirent rapidement.{' '}
          <Link href="/mot-de-passe-oublie" className="font-semibold underline">
            Faire une nouvelle demande
          </Link>
        </Notice>
      </>
    );
  }
  return (
    <>
      <AuthHeading title="Choisir un nouveau mot de passe" intro={`Compte : ${user.email}`} />
      <NewPasswordForm home={homePathFor(user)} />
    </>
  );
}
