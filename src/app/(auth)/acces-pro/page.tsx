import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUser, homePathFor } from '@/lib/auth/session';

import { AccessCodeSignUpForm, RedeemCodeForm } from '../auth-forms';
import { AuthHeading } from '../auth-heading';

export const metadata: Metadata = { title: 'Activer un accès professionnel', robots: { index: false } };

export default async function AccesProPage() {
  const user = await getCurrentUser();
  if (user && !user.awaitingAccessCode) redirect(homePathFor(user));
  if (user?.awaitingAccessCode) {
    return (
      <>
        <AuthHeading title="Finaliser votre accès" intro="Votre compte est créé mais son code d’accès n’a pas encore été activé. Saisissez le code transmis par l’administrateur." />
        <RedeemCodeForm />
      </>
    );
  }
  return (
    <>
      <AuthHeading
        title="Activer un accès professionnel"
        intro="Les comptes formateur et administrateur sont créés uniquement avec un code d’accès à usage unique, délivré par l’administrateur HAPPI."
      />
      <AccessCodeSignUpForm />
      <p className="mt-8 border-t border-line pt-6 text-[0.9375rem] text-ink-muted">
        Vous avez déjà un compte ?{' '}
        <Link href="/connexion?espace=formateur" className="font-semibold text-petrol-700 underline underline-offset-4">
          Me connecter
        </Link>
      </p>
    </>
  );
}
