import type { Metadata } from 'next';
import Link from 'next/link';

import { ForgotPasswordForm } from '../auth-forms';
import { AuthHeading } from '../auth-heading';

export const metadata: Metadata = { title: 'Mot de passe oublié', robots: { index: false } };

export default function MotDePasseOubliePage() {
  return (
    <>
      <AuthHeading title="Mot de passe oublié" intro="Indiquez l’adresse de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe." />
      <ForgotPasswordForm />
      <p className="mt-8 border-t border-line pt-6 text-[0.9375rem]">
        <Link href="/connexion" className="font-semibold text-petrol-700 underline underline-offset-4">
          Revenir à la connexion
        </Link>
      </p>
    </>
  );
}
