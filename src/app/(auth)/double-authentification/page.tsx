import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { mfaStep } from '@/lib/auth/mfa';
import { getCurrentUser, homePathFor } from '@/lib/auth/session';
import { safeInternalPath } from '@/lib/utils';

import { MfaChallengeForm } from '../auth-forms';
import { AuthHeading } from '../auth-heading';

export const metadata: Metadata = { title: 'Double authentification', robots: { index: false } };

/** Deuxième étape de la connexion pour un compte protégé par une application d'authentification. */
export default async function DoubleAuthentificationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeInternalPath(typeof params.suite === 'string' ? params.suite : '', '');
  const user = await getCurrentUser();
  if (!user) redirect('/connexion');
  if (mfaStep(user.mfa) !== 'challenge') redirect(next || homePathFor(user));

  return (
    <>
      <AuthHeading
        title="Vérification en deux étapes"
        intro="Votre compte est protégé par la double authentification. Ouvrez votre application d’authentification et saisissez le code affiché pour HAPPI Compétence."
      />
      <MfaChallengeForm next={next} />
      <div className="mt-8 space-y-3 border-t border-line pt-6 text-[0.9375rem] text-ink-muted">
        <p>Vous n’avez plus accès à votre application ? Contactez l’administrateur HAPPI : il pourra réinitialiser la double authentification de votre compte après vérification de votre identité.</p>
        <form action="/deconnexion" method="post">
          <Button type="submit" variant="outline" size="sm">Me déconnecter</Button>
        </form>
      </div>
    </>
  );
}
