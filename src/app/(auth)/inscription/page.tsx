import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Notice } from '@/components/ui/primitives';
import { parseSpace } from '@/lib/auth/spaces';
import { getCurrentUser, homePathFor } from '@/lib/auth/session';
import { getPublicCatalog } from '@/lib/public-catalog';
import { PROGRAM_KIND_LABELS, programKindFromSlug, programSlug } from '@/lib/programmes/kind';

import { OrganizationSignUpForm, ParticipantSignUpForm } from '../auth-forms';
import { AuthHeading } from '../auth-heading';
import { ProgramChoice } from '../program-choice';

export const metadata: Metadata = { title: 'Créer un compte', robots: { index: false } };

export default async function InscriptionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const space = parseSpace(params.espace);
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  if (space === 'formateur' || space === 'admin') redirect('/acces-pro');

  if (space === 'organisme') {
    const catalog = await getPublicCatalog();
    const open = catalog.settings['platform.organization_signup_enabled'] !== false;
    return (
      <>
        <AuthHeading title="Demander un espace organisme" intro="Après vérification par l’équipe HAPPI, vous pourrez suivre les participants rattachés à votre structure." />
        {open ? (
          <OrganizationSignUpForm />
        ) : (
          <Notice title="Les demandes sont momentanément fermées">
            Contactez l’équipe HAPPI depuis la <Link href="/contact" className="underline">page contact</Link>.
          </Notice>
        )}
        <p className="mt-8 border-t border-line pt-6 text-[0.9375rem] text-ink-muted">
          Déjà un compte ?{' '}
          <Link href="/connexion?espace=organisme" className="font-semibold text-petrol-700 underline underline-offset-4">
            Me connecter
          </Link>
        </p>
      </>
    );
  }

  // Étape 1 : le programme. Étape 2 : le compte (le programme choisi est rappelé et modifiable).
  const programKind = programKindFromSlug(params.programme);
  if (!programKind) {
    return (
      <>
        <AuthHeading title="Pour quel programme vous inscrivez-vous ?" intro="Votre choix détermine les questions qui vous seront posées juste après la création de votre compte." />
        <ProgramChoice />
        <p className="mt-8 border-t border-line pt-6 text-[0.9375rem] text-ink-muted">
          Déjà un compte ?{' '}
          <Link href="/connexion?espace=participant" className="font-semibold text-petrol-700 underline underline-offset-4">
            Me connecter
          </Link>
        </p>
      </>
    );
  }
  return (
    <>
      <AuthHeading
        title="Créer mon compte participant"
        intro={
          <>
            Programme : <strong className="font-semibold text-ink">{PROGRAM_KIND_LABELS[programKind].name}</strong> ·{' '}
            <Link href="/inscription?espace=participant" className="font-semibold text-petrol-700 underline underline-offset-4" data-programme={programSlug(programKind)}>
              Changer
            </Link>
          </>
        }
      />
      <ParticipantSignUpForm programKind={programKind} />
      <p className="mt-8 border-t border-line pt-6 text-[0.9375rem] text-ink-muted">
        Déjà un compte ?{' '}
        <Link href="/connexion?espace=participant" className="font-semibold text-petrol-700 underline underline-offset-4">
          Me connecter
        </Link>
      </p>
    </>
  );
}
