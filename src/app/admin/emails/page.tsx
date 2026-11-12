import { Mail } from 'lucide-react';
import type { Metadata } from 'next';

import { Badge, Card, CardBody, CardHeader, EmptyState, Notice, PageHeader, StatTile, Table, TableWrap, Td, Th, Tr, type BadgeVariant } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { maskEmail } from '@/lib/email/mask';
import { emailOrigin } from '@/lib/email/origin';
import { detectProvider } from '@/lib/email/provider';
import { MAX_ATTEMPTS } from '@/lib/email/schedule';
import { EMAIL_TEMPLATE_LABELS, type EmailTemplate } from '@/lib/email/templates';
import { isAdminClientConfigured } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/utils';

import { TestEmailForm } from './test-email-form';

export const metadata: Metadata = { title: 'E-mails' };

const PROVIDER_LABELS = { brevo: 'Brevo (API)', smtp: 'SMTP', resend: 'Resend (API)', journal: 'Mode journal (aucun envoi)' } as const;
const STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  queued: { label: 'En file', variant: 'petrol' },
  sent: { label: 'Envoyé', variant: 'success' },
  failed: { label: 'Échec', variant: 'danger' },
  skipped: { label: 'Non envoyé', variant: 'neutral' },
};

function YesNo({ value }: { value: boolean }) {
  return <Badge variant={value ? 'success' : 'warning'}>{value ? 'Oui' : 'Non'}</Badge>;
}

export default async function EmailsPage() {
  const user = await requireRole('admin');
  const supabase = await createClient();
  const config = detectProvider();
  const count = (status: string) => supabase.from('email_outbox').select('id', { count: 'exact', head: true }).eq('status', status);
  // Lecture sous RLS : la politique email_outbox_select réserve la file aux administrateurs.
  const [{ data: rows, error }, queued, sent, failed, skipped] = await Promise.all([
    supabase
      .from('email_outbox')
      .select('id, template, recipient_email, status, attempts, last_error, provider, created_at, sent_at, is_demo')
      .order('created_at', { ascending: false })
      .limit(50),
    count('queued'),
    count('sent'),
    count('failed'),
    count('skipped'),
  ]);

  return (
    <>
      <PageHeader
        title="E-mails"
        description="Convocations, rappels J-1, modifications de séance, bilans disponibles et invitations. Chaque message passe par une file d’envoi : il n’est jamais envoyé deux fois."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="Configuration" description="Variables d’environnement du serveur. Aucune clé n’est affichée." />
          <CardBody className="space-y-4">
            <dl className="space-y-3 text-[0.9375rem]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-ink-muted">Fournisseur</dt>
                <dd className="font-semibold">{PROVIDER_LABELS[config.kind]}</dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-ink-muted">Fournisseur prêt à envoyer</dt>
                <dd><YesNo value={config.configured} /></dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-ink-muted">Expéditeur</dt>
                <dd className="break-all">{config.from ? `${config.from.name} <${config.from.email}>` : '—'}</dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-ink-muted">Liens des e-mails</dt>
                <dd className="break-all">{emailOrigin()}</dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-ink-muted">Rappels J-1 planifiés (CRON_SECRET)</dt>
                <dd><YesNo value={Boolean(process.env.CRON_SECRET && process.env.CRON_SECRET.trim().length >= 16)} /></dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-ink-muted">Clé de service Supabase</dt>
                <dd><YesNo value={isAdminClientConfigured()} /></dd>
              </div>
            </dl>
            {config.issue ? <Notice variant="warning" title="Configuration incomplète">{config.issue}</Notice> : null}
            <Notice title="E-mails d’authentification">
              Confirmation d’inscription et réinitialisation du mot de passe sont envoyées par Supabase : configurez aussi un SMTP dans
              Supabase (Authentication → SMTP Settings), par exemple avec le même fournisseur.
            </Notice>
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Tester l’envoi" />
            <CardBody>
              <TestEmailForm maskedEmail={maskEmail(user.email)} />
            </CardBody>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Envoyés" value={sent.count ?? 0} />
            <StatTile label="En file" value={queued.count ?? 0} />
            <StatTile label="Échecs" value={failed.count ?? 0} />
            <StatTile label="Non envoyés" value={skipped.count ?? 0} />
          </div>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Derniers messages" description={`Les 50 plus récents. Un échec est retenté automatiquement, ${MAX_ATTEMPTS} fois au plus.`} />
        {error ? (
          <CardBody><Notice variant="danger">La file d’envoi n’a pas pu être lue.</Notice></CardBody>
        ) : (rows ?? []).length ? (
          <TableWrap label="Derniers e-mails">
            <Table>
              <thead>
                <tr><Th>Date</Th><Th>Modèle</Th><Th>Destinataire</Th><Th>Statut</Th><Th>Détail</Th></tr>
              </thead>
              <tbody>
                {rows!.map((row) => {
                  const status = STATUS[row.status] ?? STATUS.queued!;
                  return (
                    <Tr key={row.id}>
                      <Td className="text-sm whitespace-nowrap">{formatDateTime(row.sent_at ?? row.created_at)}</Td>
                      <Td className="text-sm">
                        {EMAIL_TEMPLATE_LABELS[row.template as EmailTemplate] ?? row.template}
                        {row.is_demo ? <Badge className="ml-2">Démo</Badge> : null}
                      </Td>
                      <Td className="font-mono text-xs">{maskEmail(row.recipient_email)}</Td>
                      <Td><Badge variant={status.variant}>{status.label}</Badge></Td>
                      <Td className="max-w-xs text-xs break-words text-ink-muted">
                        {[row.provider ? PROVIDER_LABELS[row.provider as keyof typeof PROVIDER_LABELS] ?? row.provider : null, row.attempts ? `${row.attempts} tentative${row.attempts > 1 ? 's' : ''}` : null, row.last_error]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={Mail} title="Aucun e-mail pour le moment" description="Les convocations partent dès qu’une séance datée est planifiée pour un groupe." />
        )}
      </Card>
    </>
  );
}
