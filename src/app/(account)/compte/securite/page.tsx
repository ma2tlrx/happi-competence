import type { Metadata } from 'next';
import Link from 'next/link';

import { Badge, Card, CardBody, CardHeader, Notice, PageHeader } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth/session';

import { MfaDisableForm, MfaEnrollment } from './security-forms';

export const metadata: Metadata = { title: 'Sécurité du compte' };

export default async function SecuritePage({ searchParams }: { searchParams: Promise<{ obligatoire?: string }> }) {
  const { obligatoire } = await searchParams;
  const user = await requireUser();
  const { enrolled, required } = user.mfa;

  return (
    <>
      <PageHeader title="Sécurité" description="Protégez l’accès à votre compte avec la double authentification." />
      <div className="mb-4 text-sm">
        <Link href="/compte" className="font-medium text-petrol-700 underline underline-offset-4">← Mon compte</Link>
      </div>
      {required && !enrolled ? (
        <Notice variant="warning" title="Double authentification obligatoire" className="mb-6">
          {obligatoire ? 'Avant d’accéder à votre espace, activez la double authentification. ' : ''}
          La plateforme l’exige pour les comptes administrateur et formateur, qui donnent accès aux données de participants.
        </Notice>
      ) : null}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Double authentification"
            description="En plus du mot de passe, un code à six chiffres, généré par une application sur votre téléphone, est demandé à chaque connexion."
            action={enrolled ? <Badge variant="success">Activée</Badge> : <Badge variant="neutral">Désactivée</Badge>}
          />
          <CardBody>
            {enrolled ? (
              required ? (
                <Notice title="Activée et obligatoire pour votre rôle">
                  Elle ne peut pas être désactivée. En cas de perte de votre téléphone, contactez un administrateur HAPPI.
                </Notice>
              ) : (
                <MfaDisableForm />
              )
            ) : (
              <MfaEnrollment />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Bon à savoir" />
          <CardBody className="space-y-3 text-[0.9375rem] text-ink-muted">
            <p>Gardez votre téléphone à portée de main lors de vos connexions : le code change toutes les 30 secondes.</p>
            <p>Si vous changez de téléphone, désactivez puis réactivez la double authentification, ou transférez vos comptes avec l’application.</p>
            <p>Téléphone perdu ? Un administrateur HAPPI peut réinitialiser la double authentification de votre compte après avoir vérifié votre identité.</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
