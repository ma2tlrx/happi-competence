import type { Metadata } from 'next';

import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/utils';

import { DataRequestActions, MessageActions } from '../admin-client';
import { SettingsForm } from './settings-form';

export const metadata: Metadata = { title: 'Paramètres' };

export default async function SettingsPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const [{ data: settings }, { data: messages }, { data: requests }] = await Promise.all([
    supabase.from('app_settings').select('key, value'),
    supabase.from('contact_messages').select('*').neq('status', 'archived').order('created_at', { ascending: false }).limit(50),
    supabase.from('data_requests').select('*, profiles!data_requests_user_id_fkey ( first_name, last_name, email )').order('created_at', { ascending: false }).limit(50),
  ]);
  return (
    <>
      <PageHeader title="Paramètres" description="Coordonnées, mentions légales, messages reçus et demandes relatives aux données personnelles." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Paramètres de la plateforme" />
          <CardBody><SettingsForm values={Object.fromEntries((settings ?? []).map((s) => [s.key, s.value]))} /></CardBody>
        </Card>
        <Card id="messages">
          <CardHeader title="Messages du formulaire de contact" />
          <CardBody className="pt-3">
            {(messages ?? []).length ? (
              <ul className="divide-y divide-line">
                {messages!.map((message) => (
                  <li key={message.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="font-semibold">
                        {message.name} · <a href={`mailto:${message.email}`} className="text-petrol-700 underline">{message.email}</a>
                        {message.organization ? <span className="font-normal text-ink-muted"> · {message.organization}</span> : null}
                        {message.status === 'new' ? <Badge variant="orange" className="ml-2">Nouveau</Badge> : null}
                      </p>
                      <MessageActions id={message.id} status={message.status} />
                    </div>
                    <p className="mt-1 text-sm text-ink-subtle">{formatDateTime(message.created_at)}</p>
                    <p className="mt-2 whitespace-pre-line text-[0.9375rem]">{message.message}</p>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="Aucun message" />}
          </CardBody>
        </Card>
        <Card id="rgpd">
          <CardHeader title="Demandes relatives aux données personnelles" description="Les exports sont disponibles en libre-service ; les suppressions sont traitées ici." />
          <CardBody className="pt-3">
            {(requests ?? []).length ? (
              <ul className="divide-y divide-line">
                {requests!.map((request) => (
                  <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <span>
                      <span className="font-semibold">{request.type === 'deletion' ? 'Suppression' : 'Export'} · {request.profiles ? `${request.profiles.first_name} ${request.profiles.last_name} (${request.profiles.email})` : 'Compte supprimé'}</span>
                      <span className="block text-sm text-ink-subtle">{formatDateTime(request.created_at)}{request.details ? ` · « ${request.details} »` : ''}</span>
                    </span>
                    {request.status === 'pending' ? <DataRequestActions id={request.id} type={request.type} /> : <Badge variant={request.status === 'completed' ? 'success' : 'neutral'}>{request.status === 'completed' ? 'Traitée' : request.status === 'cancelled' ? 'Annulée' : 'Refusée'}</Badge>}
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="Aucune demande" />}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
