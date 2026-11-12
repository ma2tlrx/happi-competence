import 'server-only';

import { after } from 'next/server';

import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin';
import type { Database, Json } from '@/lib/supabase/database.types';

import { scrubError } from './mask';
import { emailOrigin } from './origin';
import { detectProvider } from './provider';
import { BATCH_SIZE, MAX_ATTEMPTS, retryDelayMs } from './schedule';
import { EmailSendError, sendEmail } from './send';
import { EMAIL_TEMPLATES, renderEmail, type EmailDataFor, type EmailTemplate } from './templates';

type OutboxRow = Database['public']['Tables']['email_outbox']['Row'];
type Admin = ReturnType<typeof createAdminClient>;

/** Notification in-app créée en même temps que l'e-mail (une seule fois, grâce à la clé d'idempotence). */
export type InAppNotification = { type: string; title: string; body?: string | null; link?: string | null };

export type EnqueueInput<T extends EmailTemplate = EmailTemplate> = {
  key: string;
  template: T;
  data: EmailDataFor<T>;
  to: string | null | undefined;
  userId?: string | null;
  participantId?: string | null;
  sessionId?: string | null;
  reportId?: string | null;
  /** Données de démonstration : jamais d'envoi réel. */
  isDemo?: boolean;
  /** Raison de ne pas envoyer (préférence, etc.) : la ligne est enregistrée « skipped ». */
  skipReason?: string | null;
  createdBy?: string | null;
  notification?: InAppNotification | null;
};

export const SKIP_REASONS = {
  demo: 'Données de démonstration : aucun envoi réel.',
  noAddress: 'Aucune adresse e-mail connue pour ce destinataire.',
  remindersOff: 'Rappels désactivés dans les préférences du compte.',
} as const;

/** Raison de ne pas envoyer, dans l'ordre : démonstration, absence d'adresse, raison fournie. */
export function skipReasonFor(input: Pick<EnqueueInput, 'isDemo' | 'to' | 'skipReason'>): string | null {
  if (input.isDemo) return SKIP_REASONS.demo;
  if (!input.to?.trim()) return SKIP_REASONS.noAddress;
  return input.skipReason ?? null;
}

/**
 * Met des e-mails en file. Une clé déjà présente est ignorée (jamais de doublon) ; la notification
 * in-app n'est créée que pour les lignes réellement ajoutées. Ne lève pas d'exception : un e-mail ne
 * doit jamais faire échouer l'action métier qui l'a déclenché.
 */
export async function enqueueEmails(inputs: EnqueueInput[], admin?: Admin): Promise<{ inserted: number; duplicates: number }> {
  if (inputs.length === 0) return { inserted: 0, duplicates: 0 };
  if (!admin && !isAdminClientConfigured()) {
    console.warn('E-mails non mis en file : SUPABASE_SERVICE_ROLE_KEY absente.');
    return { inserted: 0, duplicates: inputs.length };
  }
  const client = admin ?? createAdminClient();
  const origin = emailOrigin();
  const rows = inputs.map((input) => {
    const reason = skipReasonFor(input);
    return {
      idempotency_key: input.key,
      template: input.template,
      recipient_email: input.to?.trim().toLowerCase() || null,
      recipient_user_id: input.userId ?? null,
      participant_id: input.participantId ?? null,
      session_id: input.sessionId ?? null,
      report_id: input.reportId ?? null,
      subject: renderEmail(input.template, input.data, origin).subject.slice(0, 200),
      data: input.data as unknown as Json,
      status: reason ? 'skipped' : 'queued',
      last_error: reason,
      provider: null,
      is_demo: Boolean(input.isDemo),
      created_by: input.createdBy ?? null,
    };
  });
  const { data, error } = await client
    .from('email_outbox')
    .upsert(rows, { onConflict: 'idempotency_key', ignoreDuplicates: true })
    .select('idempotency_key');
  if (error) {
    console.error('Mise en file d’e-mails impossible', error.code, scrubError(error.message));
    return { inserted: 0, duplicates: 0 };
  }
  const inserted = new Set((data ?? []).map((row) => row.idempotency_key));
  const notifications = inputs
    .filter((input) => inserted.has(input.key) && input.userId && input.notification)
    .map((input) => ({
      user_id: input.userId!,
      type: input.notification!.type,
      title: input.notification!.title,
      body: input.notification!.body ?? null,
      link: input.notification!.link ?? null,
    }));
  if (notifications.length) {
    const { error: notifyError } = await client.from('notifications').insert(notifications);
    if (notifyError) console.error('Notifications in-app non créées', notifyError.code);
  }
  return { inserted: inserted.size, duplicates: inputs.length - inserted.size };
}

export type ProcessSummary = { claimed: number; sent: number; skipped: number; failed: number; retrying: number };

function isTemplate(value: string): value is EmailTemplate {
  return (EMAIL_TEMPLATES as readonly string[]).includes(value);
}

/** Envoie un message réservé et enregistre le résultat (verrou libéré dans tous les cas). */
async function deliver(client: Admin, row: OutboxRow, origin: string, config: ReturnType<typeof detectProvider>) {
  const finish = (patch: Database['public']['Tables']['email_outbox']['Update']) =>
    client.from('email_outbox').update({ ...patch, locked_until: null }).eq('id', row.id);
  try {
    if (!isTemplate(row.template)) throw new EmailSendError('Modèle inconnu.', true);
    if (!row.recipient_email) {
      await finish({ status: 'skipped', last_error: SKIP_REASONS.noAddress });
      return 'skipped' as const;
    }
    const rendered = renderEmail(row.template, row.data as never, origin);
    const result = await sendEmail({ to: row.recipient_email, ...rendered }, { idempotencyKey: row.idempotency_key, config });
    if (result.status === 'skipped') {
      await finish({ status: 'skipped', provider: 'journal', last_error: result.reason.slice(0, 500) });
      return 'skipped' as const;
    }
    await finish({
      status: 'sent',
      provider: result.provider,
      provider_message_id: result.messageId?.slice(0, 200) ?? null,
      sent_at: new Date().toISOString(),
      last_error: null,
    });
    return 'sent' as const;
  } catch (error) {
    const permanent = error instanceof EmailSendError && error.permanent;
    const exhausted = permanent || row.attempts >= MAX_ATTEMPTS;
    const message = scrubError(error);
    // Journal applicatif : identifiant et modèle seulement, jamais l'adresse.
    console.error('Échec d’envoi d’e-mail', row.id, row.template, `tentative ${row.attempts}`, message);
    await finish({
      status: 'failed',
      provider: config.kind === 'journal' ? null : config.kind,
      last_error: message,
      attempts: exhausted ? Math.max(row.attempts, MAX_ATTEMPTS) : row.attempts,
      next_attempt_at: new Date(Date.now() + retryDelayMs(row.attempts)).toISOString(),
    });
    return exhausted ? ('failed' as const) : ('retrying' as const);
  }
}

/**
 * Vide la file par lots : messages nouveaux et échecs à reprendre (délai croissant, plafond de
 * tentatives). Les lots sont réservés en base (verrou, skip locked) : deux traitements simultanés
 * n'envoient jamais le même message.
 */
export async function processOutbox(options: { batchSize?: number; maxBatches?: number; origin?: string | null } = {}): Promise<ProcessSummary> {
  const summary: ProcessSummary = { claimed: 0, sent: 0, skipped: 0, failed: 0, retrying: 0 };
  if (!isAdminClientConfigured()) return summary;
  const client = createAdminClient();
  const origin = emailOrigin(options.origin);
  const config = detectProvider();
  const maxBatches = options.maxBatches ?? 4;
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const { data, error } = await client.rpc('claim_email_outbox', { p_limit: options.batchSize ?? BATCH_SIZE, p_max_attempts: MAX_ATTEMPTS });
    if (error) {
      console.error('Lecture de la file d’e-mails impossible', error.code);
      break;
    }
    const rows = (data ?? []) as OutboxRow[];
    if (rows.length === 0) break;
    summary.claimed += rows.length;
    for (const row of rows) summary[await deliver(client, row, origin, config)] += 1;
    if (rows.length < (options.batchSize ?? BATCH_SIZE)) break;
  }
  return summary;
}

/** Envoie la file après la réponse (actions serveur, routes) : l'utilisateur n'attend pas le fournisseur. */
export function flushOutboxLater() {
  after(async () => {
    try {
      await processOutbox({ maxBatches: 2 });
    } catch (error) {
      console.error('Traitement différé de la file d’e-mails impossible', scrubError(error));
    }
  });
}
