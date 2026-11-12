/**
 * Choix du fournisseur d'envoi d'après les variables d'environnement serveur (fonction pure).
 *
 *   EMAIL_PROVIDER=brevo   + BREVO_API_KEY   (API HTTPS transactionnelle Brevo)
 *   EMAIL_PROVIDER=smtp    + SMTP_URL        (smtp://utilisateur:motdepasse@hote:587 ; en local, Mailpit)
 *   EMAIL_PROVIDER=resend  + RESEND_API_KEY
 *   absent                 → mode « journal » : aucun envoi, les messages sont marqués « skipped ».
 *   EMAIL_FROM             expéditeur, ex. « HAPPI Compétence <no-reply@happicompetence.fr> ».
 *
 * Aucune de ces variables n'est préfixée par NEXT_PUBLIC_ : elles ne quittent jamais le serveur.
 */

export type ProviderKind = 'brevo' | 'smtp' | 'resend' | 'journal';

export type ProviderConfig = {
  kind: ProviderKind;
  /** Le fournisseur choisi dispose de tout ce qu'il lui faut pour envoyer. */
  configured: boolean;
  /** Raison lisible (sans secret) lorsque la configuration est incomplète. */
  issue?: string;
  from: { name: string; email: string } | null;
};

type Env = Record<string, string | undefined>;

const LOCAL_FROM = 'HAPPI Compétence <no-reply@happi.test>';

/** « Nom <adresse> » ou « adresse » → { name, email }. */
export function parseFrom(value: string | undefined): { name: string; email: string } | null {
  const raw = value?.trim();
  if (!raw) return null;
  const match = /^(.*)<\s*([^<>\s]+@[^<>\s]+)\s*>$/.exec(raw);
  if (match) return { name: match[1]!.trim().replace(/^"|"$/g, '') || 'HAPPI Compétence', email: match[2]! };
  return /^[^\s<>]+@[^\s<>]+$/.test(raw) ? { name: 'HAPPI Compétence', email: raw } : null;
}

export function detectProvider(env: Env = process.env): ProviderConfig {
  const requested = env.EMAIL_PROVIDER?.trim().toLowerCase();
  const from = parseFrom(env.EMAIL_FROM);
  if (!requested) return { kind: 'journal', configured: false, issue: 'EMAIL_PROVIDER n’est pas défini : mode journal, aucun envoi.', from };
  if (requested !== 'brevo' && requested !== 'smtp' && requested !== 'resend') {
    return { kind: 'journal', configured: false, issue: `Fournisseur inconnu (« ${requested.slice(0, 20)} ») : mode journal.`, from };
  }
  if (env.EMAIL_FROM?.trim() && !from) return { kind: requested, configured: false, issue: 'EMAIL_FROM est invalide.', from: null };
  if (requested === 'smtp') {
    const url = env.SMTP_URL?.trim();
    if (!url) return { kind: 'smtp', configured: false, issue: 'SMTP_URL n’est pas défini.', from };
    if (!/^smtps?:\/\//i.test(url)) return { kind: 'smtp', configured: false, issue: 'SMTP_URL doit commencer par smtp:// ou smtps://.', from };
    return { kind: 'smtp', configured: true, from: from ?? parseFrom(LOCAL_FROM) };
  }
  const keyName = requested === 'brevo' ? 'BREVO_API_KEY' : 'RESEND_API_KEY';
  if (!env[keyName]?.trim()) return { kind: requested, configured: false, issue: `${keyName} n’est pas défini.`, from };
  if (!from) return { kind: requested, configured: false, issue: 'EMAIL_FROM est requis (adresse d’un domaine vérifié chez le fournisseur).', from: null };
  return { kind: requested, configured: true, from };
}

export function formatFrom(from: { name: string; email: string }) {
  return `"${from.name.replaceAll('"', '')}" <${from.email}>`;
}
