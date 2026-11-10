import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SPACES, parseSpace, type Space } from '@/lib/auth/spaces';
import { getCurrentUser, homePathFor } from '@/lib/auth/session';
import { cn, safeInternalPath } from '@/lib/utils';

import { SignInForm } from '../auth-forms';
import { AuthHeading } from '../auth-heading';

export const metadata: Metadata = { title: 'Connexion', robots: { index: false } };

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const space = parseSpace(params.espace);
  const next = safeInternalPath(typeof params.suite === 'string' ? params.suite : '', '');
  const user = await getCurrentUser();
  if (user) redirect(next || homePathFor(user));
  const config = SPACES[space];
  const tabs: Space[] = ['participant', 'organisme'];

  return (
    <>
      <AuthHeading title={config.title} intro={config.intro}>
        {space === 'participant' || space === 'organisme' ? (
          <nav aria-label="Type d’espace" className="mb-8 grid grid-cols-2 gap-1 rounded-md bg-paper p-1">
            {tabs.map((tab) => (
              <Link
                key={tab}
                href={`/connexion?espace=${tab}`}
                aria-current={tab === space ? 'page' : undefined}
                className={cn(
                  'rounded-sm px-3 py-2 text-center text-sm font-semibold transition-colors',
                  tab === space ? 'bg-white text-ink shadow-xs' : 'text-ink-muted hover:text-ink',
                )}
              >
                {tab === 'participant' ? 'Participant' : 'Organisme'}
              </Link>
            ))}
          </nav>
        ) : null}
      </AuthHeading>
      <SignInForm next={next} />
      <div className="mt-8 border-t border-line pt-6 text-[0.9375rem] text-ink-muted">
        {config.canSignUp ? (
          <p>
            {space === 'organisme' ? 'Votre structure n’a pas encore d’espace ?' : 'Pas encore de compte ?'}{' '}
            <Link href={`/inscription?espace=${space}`} className="font-semibold text-petrol-700 underline underline-offset-4">
              {space === 'organisme' ? 'Demander un espace' : 'Créer mon compte'}
            </Link>
          </p>
        ) : (
          <p>
            Première connexion ?{' '}
            <Link href="/acces-pro" className="font-semibold text-petrol-700 underline underline-offset-4">
              Activer mon accès avec un code
            </Link>
          </p>
        )}
      </div>
    </>
  );
}
