/**
 * Modèles des e-mails transactionnels (HTML sobre et version texte, en français).
 *
 * - Aucune image distante : le logo est un texte, le message reste lisible images bloquées.
 * - Contrastes AA : texte encre #102C32 sur blanc, bouton encre à texte blanc ; l'orange #EA632E
 *   n'est qu'un filet décoratif.
 * - Tableaux de mise en page marqués role="presentation", langue déclarée, liens explicites.
 * - Les liens des données sont relatifs (« /participant/parcours ») et rendus absolus ici.
 */
import { format, isValid, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export const EMAIL_TEMPLATES = [
  'session_convocation',
  'session_reminder',
  'session_updated',
  'session_cancelled',
  'report_available',
  'participant_invitation',
  'test',
] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

export const EMAIL_TEMPLATE_LABELS: Record<EmailTemplate, string> = {
  session_convocation: 'Convocation',
  session_reminder: 'Rappel J-1',
  session_updated: 'Séance modifiée',
  session_cancelled: 'Séance annulée',
  report_available: 'Bilan disponible',
  participant_invitation: 'Invitation',
  test: 'Test',
};

export type SessionEmailData = {
  firstName?: string | null;
  sessionNumber: number;
  sessionTitle?: string | null;
  programName?: string | null;
  groupName?: string | null;
  /** AAAA-MM-JJ, heure de Paris. */
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  summary?: string | null;
  objectives?: string[] | null;
  /** Ce qu'il faut apporter : affiché seulement si l'information existe. */
  bring?: string[] | null;
  link?: string | null;
};

export type ReportEmailData = { firstName?: string | null; version?: number | null; link?: string | null };
export type InvitationEmailData = { firstName?: string | null; groupName?: string | null; programName?: string | null; link?: string | null };
export type TestEmailData = { firstName?: string | null; provider?: string | null };

export type EmailDataFor<T extends EmailTemplate> = T extends 'report_available'
  ? ReportEmailData
  : T extends 'participant_invitation'
    ? InvitationEmailData
    : T extends 'test'
      ? TestEmailData
      : SessionEmailData;

export type RenderedEmail = { subject: string; html: string; text: string };

const COLORS = { ink: '#102C32', inkMuted: '#3F5257', orange: '#EA632E', paper: '#F5F5F2', line: '#E5E5E0', white: '#FFFFFF' };
const BRAND = 'HAPPI Compétence';

// ── Mise en forme ───────────────────────────────────────────────────────────
export function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/** « 2026-11-12 » → « jeudi 12 novembre 2026 » */
export function longDate(value: string | null | undefined): string {
  if (!value) return 'date à définir';
  const date = parseISO(value);
  return isValid(date) ? format(date, 'EEEE d MMMM yyyy', { locale: fr }) : 'date à définir';
}

/** « 09:00:00 » → « 9 h 00 » */
export function shortTime(value: string | null | undefined): string {
  if (!value) return '';
  const [hours, minutes] = value.split(':');
  return hours && minutes ? `${Number(hours)} h ${minutes}` : '';
}

function timeRange(start?: string | null, end?: string | null) {
  const from = shortTime(start);
  const to = shortTime(end);
  if (from && to) return `de ${from} à ${to}`;
  if (from) return `à partir de ${from}`;
  return 'horaire à préciser';
}

/** Lien absolu à partir d'un chemin interne ; tout autre lien est remplacé par l'accueil du site. */
export function absoluteLink(origin: string, path: string | null | undefined): string {
  const base = origin.replace(/\/+$/, '');
  if (!path || !path.startsWith('/') || path.startsWith('//')) return `${base}/`;
  return `${base}${path}`;
}

function hello(firstName?: string | null) {
  const name = firstName?.trim();
  return name ? `Bonjour ${name},` : 'Bonjour,';
}

type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'details'; rows: [string, string][] }
  | { kind: 'list'; title: string; items: string[] }
  | { kind: 'button'; label: string; href: string }
  | { kind: 'notice'; text: string };

type Layout = { subject: string; preheader: string; heading: string; greeting: string; blocks: Block[]; footer?: string };

function renderHtml(layout: Layout): string {
  const p = (text: string, style = '') =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${COLORS.ink};${style}">${escapeHtml(text)}</p>`;
  const body = layout.blocks
    .map((block) => {
      switch (block.kind) {
        case 'paragraph':
          return p(block.text);
        case 'notice':
          return `<p style="margin:0 0 16px;padding:12px 16px;border-left:4px solid ${COLORS.orange};background:${COLORS.paper};font-size:16px;line-height:1.6;color:${COLORS.ink};">${escapeHtml(block.text)}</p>`;
        case 'details':
          return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid ${COLORS.line};border-radius:8px;border-collapse:separate;">${block.rows
            .map(
              ([label, value], index) =>
                `<tr><th scope="row" align="left" style="padding:10px 16px;${index ? `border-top:1px solid ${COLORS.line};` : ''}font-size:14px;font-weight:600;color:${COLORS.inkMuted};width:34%;vertical-align:top;">${escapeHtml(label)}</th><td style="padding:10px 16px;${index ? `border-top:1px solid ${COLORS.line};` : ''}font-size:16px;color:${COLORS.ink};vertical-align:top;">${escapeHtml(value)}</td></tr>`,
            )
            .join('')}</table>`;
        case 'list':
          return `<p style="margin:0 0 8px;font-size:16px;font-weight:700;color:${COLORS.ink};">${escapeHtml(block.title)}</p><ul style="margin:0 0 20px;padding-left:20px;color:${COLORS.ink};font-size:16px;line-height:1.6;">${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
        case 'button':
          return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:8px;background:${COLORS.ink};"><a href="${escapeHtml(block.href)}" style="display:inline-block;padding:14px 22px;font-size:16px;font-weight:700;color:${COLORS.white};text-decoration:none;border-radius:8px;">${escapeHtml(block.label)}</a></td></tr></table><p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${COLORS.inkMuted};">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="${escapeHtml(block.href)}" style="color:${COLORS.ink};word-break:break-all;">${escapeHtml(block.href)}</a></p>`;
      }
    })
    .join('');
  const footer = layout.footer ?? `Cet e-mail vous est adressé par ${BRAND} dans le cadre de votre accompagnement.`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(layout.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.paper};font-family:Arial,Helvetica,sans-serif;color:${COLORS.ink};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(layout.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.paper};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${COLORS.white};border:1px solid ${COLORS.line};border-radius:12px;">
<tr><td style="padding:20px 28px;border-bottom:4px solid ${COLORS.orange};">
<p style="margin:0;font-size:20px;font-weight:700;letter-spacing:0.02em;color:${COLORS.ink};">HAPPI <span style="font-weight:400;">Compétence</span></p>
</td></tr>
<tr><td style="padding:28px;">
<h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:${COLORS.ink};">${escapeHtml(layout.heading)}</h1>
${p(layout.greeting)}
${body}
<p style="margin:24px 0 0;font-size:16px;line-height:1.6;color:${COLORS.ink};">L’équipe ${BRAND}</p>
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid ${COLORS.line};font-size:13px;line-height:1.5;color:${COLORS.inkMuted};">${escapeHtml(footer)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function renderText(layout: Layout): string {
  const lines: string[] = [layout.heading, '', layout.greeting, ''];
  for (const block of layout.blocks) {
    if (block.kind === 'paragraph' || block.kind === 'notice') lines.push(block.text, '');
    if (block.kind === 'details') lines.push(...block.rows.map(([label, value]) => `${label} : ${value}`), '');
    if (block.kind === 'list') lines.push(`${block.title} :`, ...block.items.map((item) => `- ${item}`), '');
    if (block.kind === 'button') lines.push(`${block.label} : ${block.href}`, '');
  }
  lines.push(`L’équipe ${BRAND}`, '', '—', layout.footer ?? `Cet e-mail vous est adressé par ${BRAND} dans le cadre de votre accompagnement.`);
  return lines.join('\n');
}

// ── Séances ─────────────────────────────────────────────────────────────────
function sessionLabel(data: SessionEmailData) {
  return data.sessionTitle?.trim() ? `Séance ${data.sessionNumber} : ${data.sessionTitle.trim()}` : `Séance ${data.sessionNumber}`;
}

function sessionDetails(data: SessionEmailData): Block {
  const rows: [string, string][] = [
    ['Séance', sessionLabel(data)],
    ['Date', longDate(data.date)],
    ['Horaire', timeRange(data.startTime, data.endTime)],
    ['Lieu', data.location?.trim() || 'à préciser par votre formateur'],
  ];
  if (data.groupName?.trim()) rows.push(['Groupe', data.groupName.trim()]);
  return { kind: 'details', rows };
}

function programBlocks(data: SessionEmailData): Block[] {
  const blocks: Block[] = [];
  if (data.summary?.trim()) blocks.push({ kind: 'paragraph', text: `Au programme : ${data.summary.trim()}` });
  const objectives = (data.objectives ?? []).map((item) => item.trim()).filter(Boolean);
  if (objectives.length) blocks.push({ kind: 'list', title: 'Objectifs de la séance', items: objectives });
  const bring = (data.bring ?? []).map((item) => item.trim()).filter(Boolean);
  if (bring.length) blocks.push({ kind: 'list', title: 'À apporter', items: bring });
  return blocks;
}

function sessionLayout(template: 'session_convocation' | 'session_reminder' | 'session_updated' | 'session_cancelled', data: SessionEmailData, origin: string): Layout {
  const when = longDate(data.date);
  const program = data.programName?.trim() ? ` du parcours ${data.programName.trim()}` : '';
  const button: Block = { kind: 'button', label: 'Voir mon parcours', href: absoluteLink(origin, data.link ?? '/participant/parcours') };
  const contact: Block = { kind: 'paragraph', text: 'En cas d’empêchement, prévenez votre formateur ou votre conseiller dès que possible.' };
  switch (template) {
    case 'session_convocation':
      return {
        subject: `Convocation : séance ${data.sessionNumber} le ${when}`,
        preheader: `Séance ${data.sessionNumber}, ${when}, ${timeRange(data.startTime, data.endTime)}.`,
        heading: 'Votre convocation',
        greeting: hello(data.firstName),
        blocks: [{ kind: 'paragraph', text: `Vous êtes attendu(e) à la séance ${data.sessionNumber}${program}.` }, sessionDetails(data), ...programBlocks(data), contact, button],
      };
    case 'session_reminder':
      return {
        subject: `Rappel : séance ${data.sessionNumber} demain, ${when}`,
        preheader: `Demain ${timeRange(data.startTime, data.endTime)}${data.location ? `, ${data.location}` : ''}.`,
        heading: 'Rappel : votre séance a lieu demain',
        greeting: hello(data.firstName),
        blocks: [{ kind: 'paragraph', text: `Nous vous rappelons la séance ${data.sessionNumber}${program}, demain.` }, sessionDetails(data), ...programBlocks(data), contact, button],
        footer: `Vous recevez ce rappel car vous participez à un parcours ${BRAND}. Vous pouvez désactiver les rappels depuis la page « Mon compte ».`,
      };
    case 'session_updated':
      return {
        subject: `Séance ${data.sessionNumber} modifiée : nouvelles informations`,
        preheader: `Séance ${data.sessionNumber} : ${when}, ${timeRange(data.startTime, data.endTime)}.`,
        heading: 'Votre séance a été modifiée',
        greeting: hello(data.firstName),
        blocks: [
          { kind: 'notice', text: `Les informations de la séance ${data.sessionNumber} ont changé. Voici ce qui est désormais prévu.` },
          sessionDetails(data),
          ...programBlocks(data),
          contact,
          button,
        ],
      };
    case 'session_cancelled':
      return {
        subject: `Séance ${data.sessionNumber} du ${when} annulée`,
        preheader: `La séance ${data.sessionNumber} prévue le ${when} n’aura pas lieu.`,
        heading: 'Votre séance est annulée',
        greeting: hello(data.firstName),
        blocks: [
          { kind: 'notice', text: `La séance ${data.sessionNumber}${program}, prévue le ${when}, est annulée.` },
          { kind: 'paragraph', text: 'Votre formateur vous communiquera les suites à donner. Vous n’avez rien à faire pour le moment.' },
          button,
        ],
      };
  }
}

// ── Point d'entrée ──────────────────────────────────────────────────────────
export function renderEmail<T extends EmailTemplate>(template: T, data: EmailDataFor<T>, origin: string): RenderedEmail {
  const layout = buildLayout(template, data as never, origin);
  return { subject: layout.subject, html: renderHtml(layout), text: renderText(layout) };
}

function buildLayout(template: EmailTemplate, data: Record<string, unknown>, origin: string): Layout {
  switch (template) {
    case 'session_convocation':
    case 'session_reminder':
    case 'session_updated':
    case 'session_cancelled':
      return sessionLayout(template, data as SessionEmailData, origin);
    case 'report_available': {
      const report = data as ReportEmailData;
      return {
        subject: 'Votre bilan HAPPI est disponible',
        preheader: 'Votre formateur a validé votre bilan individuel.',
        heading: 'Votre bilan est disponible',
        greeting: hello(report.firstName),
        blocks: [
          { kind: 'paragraph', text: 'Votre formateur a validé votre bilan individuel. Vous pouvez le consulter et le télécharger depuis votre espace.' },
          { kind: 'button', label: 'Consulter mon bilan', href: absoluteLink(origin, report.link ?? '/participant/bilan') },
        ],
      };
    }
    case 'participant_invitation': {
      const invitation = data as InvitationEmailData;
      const group = invitation.groupName?.trim() ? ` (groupe « ${invitation.groupName.trim()} »)` : '';
      const program = invitation.programName?.trim() || 'HAPPI Compétence';
      return {
        subject: `Votre inscription au parcours ${program}`,
        preheader: 'Créez votre compte pour suivre votre parcours et vos compétences.',
        heading: 'Bienvenue dans votre parcours',
        greeting: hello(invitation.firstName),
        blocks: [
          { kind: 'paragraph', text: `Vous êtes inscrit(e) au parcours ${program}${group}.` },
          {
            kind: 'paragraph',
            text: 'Créez votre compte avec cette adresse e-mail pour retrouver vos séances, votre auto-évaluation et votre passeport de compétences.',
          },
          { kind: 'button', label: 'Créer mon compte', href: absoluteLink(origin, invitation.link ?? '/inscription') },
          { kind: 'paragraph', text: 'Si vous ne vous attendiez pas à ce message, vous pouvez l’ignorer.' },
        ],
      };
    }
    case 'test': {
      const test = data as TestEmailData;
      return {
        subject: `E-mail de test ${BRAND}`,
        preheader: 'La configuration d’envoi fonctionne.',
        heading: 'La configuration d’envoi fonctionne',
        greeting: hello(test.firstName),
        blocks: [
          { kind: 'paragraph', text: 'Ce message de test a été demandé depuis l’administration (page « E-mails »).' },
          ...(test.provider ? [{ kind: 'details', rows: [['Fournisseur', test.provider]] } satisfies Block] : []),
          { kind: 'button', label: 'Ouvrir l’administration', href: absoluteLink(origin, '/admin/emails') },
        ],
        footer: `Message technique envoyé par ${BRAND}.`,
      };
    }
  }
}
