import 'server-only';

import { scrubError } from './mask';
import { detectProvider, formatFrom, type ProviderConfig, type ProviderKind } from './provider';

export type EmailMessage = { to: string; subject: string; html: string; text: string };

export type SendResult =
  | { status: 'sent'; provider: Exclude<ProviderKind, 'journal'>; messageId: string | null }
  | { status: 'skipped'; provider: 'journal'; reason: string };

/** Échec d'envoi. `permanent` : inutile de réessayer (adresse refusée, requête invalide). Message sans adresse. */
export class EmailSendError extends Error {
  constructor(
    message: string,
    readonly permanent = false,
  ) {
    super(scrubError(message));
    this.name = 'EmailSendError';
  }
}

const TIMEOUT_MS = 15_000;

function httpError(provider: string, status: number, body: string) {
  // 4xx (hors 408 et 429) : la requête est refusée telle quelle, une nouvelle tentative n'y changera rien.
  const permanent = status >= 400 && status < 500 && status !== 408 && status !== 429;
  return new EmailSendError(`${provider} a répondu ${status} : ${body.slice(0, 300)}`, permanent);
}

async function sendWithBrevo(message: EmailMessage, config: ProviderConfig): Promise<string | null> {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY!.trim(), 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: config.from,
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await response.text();
  if (!response.ok) throw httpError('Brevo', response.status, body);
  try {
    return (JSON.parse(body) as { messageId?: string }).messageId ?? null;
  } catch {
    return null;
  }
}

async function sendWithResend(message: EmailMessage, config: ProviderConfig, idempotencyKey?: string): Promise<string | null> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
      'content-type': 'application/json',
      // Resend déduplique les requêtes portant la même clé : protection supplémentaire contre un double envoi.
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey.slice(0, 256) } : {}),
    },
    body: JSON.stringify({ from: formatFrom(config.from!), to: [message.to], subject: message.subject, html: message.html, text: message.text }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await response.text();
  if (!response.ok) throw httpError('Resend', response.status, body);
  try {
    return (JSON.parse(body) as { id?: string }).id ?? null;
  } catch {
    return null;
  }
}

type Transporter = { sendMail: (options: Record<string, unknown>) => Promise<{ messageId?: string; rejected?: unknown[] }> };
let smtpTransport: { url: string; transporter: Transporter } | null = null;

async function sendWithSmtp(message: EmailMessage, config: ProviderConfig): Promise<string | null> {
  const url = process.env.SMTP_URL!.trim();
  if (!smtpTransport || smtpTransport.url !== url) {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport(url, {}) as unknown as Transporter;
    smtpTransport = { url, transporter };
  }
  try {
    const info = await smtpTransport.transporter.sendMail({
      from: formatFrom(config.from!),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (info.rejected && info.rejected.length) throw new EmailSendError('Adresse refusée par le serveur SMTP.', true);
    return info.messageId ?? null;
  } catch (error) {
    if (error instanceof EmailSendError) throw error;
    const code = (error as { responseCode?: number }).responseCode;
    throw new EmailSendError(`SMTP : ${scrubError(error)}`, typeof code === 'number' && code >= 500 && code < 600);
  }
}

/**
 * Envoie un e-mail avec le fournisseur configuré. Sans fournisseur (mode journal), rien ne part
 * et le résultat est « skipped ». Lève EmailSendError en cas d'échec. N'écrit jamais l'adresse
 * dans les journaux.
 */
export async function sendEmail(message: EmailMessage, options: { idempotencyKey?: string; config?: ProviderConfig } = {}): Promise<SendResult> {
  const config = options.config ?? detectProvider();
  if (!config.configured || config.kind === 'journal') {
    return { status: 'skipped', provider: 'journal', reason: config.issue ?? 'Aucun fournisseur d’e-mail configuré.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.to)) throw new EmailSendError('Adresse de destination invalide.', true);
  switch (config.kind) {
    case 'brevo':
      return { status: 'sent', provider: 'brevo', messageId: await sendWithBrevo(message, config) };
    case 'resend':
      return { status: 'sent', provider: 'resend', messageId: await sendWithResend(message, config, options.idempotencyKey) };
    case 'smtp':
      return { status: 'sent', provider: 'smtp', messageId: await sendWithSmtp(message, config) };
  }
}
