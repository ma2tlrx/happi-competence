import { Download, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Badge, Card, CardBody, CardHeader, Notice, PageHeader } from '@/components/ui/primitives';
import { ROLE_LABELS } from '@/lib/auth/roles';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

import { DeletionForm, EmailPreferencesForm, PasswordForm, ProfileForm } from './account-forms';
import { cancelDeletion } from './actions';

export const metadata: Metadata = { title: 'Mon compte' };

export default async function ComptePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: profile }, { data: requests }, { data: emailPreferences }] = await Promise.all([
    supabase.from('profiles').select('terms_accepted_at, privacy_consent_at, created_at').eq('id', user.id).single(),
    supabase.from('data_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('email_preferences').select('reminders').eq('user_id', user.id).maybeSingle(),
  ]);
  const pendingDeletion = requests?.find((request) => request.type === 'deletion' && request.status === 'pending');

  return (
    <>
      <PageHeader title="Mon compte" description={`${ROLE_LABELS[user.role]} · compte créé le ${formatDate(profile?.created_at)}`} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Informations personnelles" />
            <CardBody>
              <ProfileForm firstName={user.firstName} lastName={user.lastName} phone={user.phone ?? ''} email={user.email} />
            </CardBody>
          </Card>
          {user.role === 'participant' ? (
            <Card>
              <CardHeader title="E-mails" description="Choisissez les messages que vous recevez à votre adresse e-mail." />
              <CardBody>
                <EmailPreferencesForm reminders={emailPreferences?.reminders ?? true} />
              </CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Mot de passe" description="Au moins 10 caractères, dont une lettre et un chiffre." />
            <CardBody>
              <PasswordForm />
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Sécurité"
              description="Double authentification : un code de votre téléphone en plus du mot de passe."
              action={user.mfa.enrolled ? <Badge variant="success">Activée</Badge> : <Badge variant="neutral">Désactivée</Badge>}
            />
            <CardBody>
              <Button asChild variant="outline">
                <Link href="/compte/securite">
                  <ShieldCheck aria-hidden />
                  {user.mfa.enrolled ? 'Gérer la double authentification' : 'Activer la double authentification'}
                </Link>
              </Button>
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Mes données" description="Vous gardez la main sur vos informations personnelles." />
            <CardBody className="space-y-4 text-[0.9375rem]">
              <dl className="space-y-2 text-ink-muted">
                <div className="flex justify-between gap-4"><dt>Conditions acceptées</dt><dd className="text-ink">{formatDate(profile?.terms_accepted_at, '—')}</dd></div>
                <div className="flex justify-between gap-4"><dt>Consentement données</dt><dd className="text-ink">{formatDate(profile?.privacy_consent_at, '—')}</dd></div>
              </dl>
              <Button asChild variant="outline" className="w-full">
                <a href="/api/exports/mes-donnees" download>
                  <Download aria-hidden />
                  Télécharger mes données
                </a>
              </Button>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Supprimer mes données" />
            <CardBody>
              {pendingDeletion ? (
                <Notice variant="warning" title="Demande en cours" action={
                  <form action={cancelDeletion.bind(null, pendingDeletion.id)}>
                    <Button type="submit" size="sm" variant="outline">Annuler</Button>
                  </form>
                }>
                  Envoyée le {formatDate(pendingDeletion.created_at)}. L’équipe HAPPI la traitera prochainement.
                </Notice>
              ) : (
                <DeletionForm />
              )}
              {requests && requests.some((request) => request.status !== 'pending') ? (
                <ul className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
                  {requests.filter((request) => request.status !== 'pending').map((request) => (
                    <li key={request.id} className="flex items-center justify-between gap-3">
                      <span className="text-ink-muted">{request.type === 'deletion' ? 'Suppression' : 'Export'} · {formatDate(request.created_at)}</span>
                      <Badge variant={request.status === 'completed' ? 'success' : 'neutral'}>
                        {request.status === 'completed' ? 'Traitée' : request.status === 'cancelled' ? 'Annulée' : 'Refusée'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
