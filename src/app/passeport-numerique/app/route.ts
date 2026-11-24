import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { getCurrentUser } from '@/lib/auth/session';
import { preparePasseportNumerique } from '@/lib/passeport-numerique/page';
import { getParticipantProgramKind, hasPasseportNumeriqueAccess } from '@/lib/programmes/load';

export const dynamic = 'force-dynamic';

let source: Promise<string> | null = null;
const original = () => (source ??= readFile(join(process.cwd(), 'private', 'passeport-numerique', 'index.html'), 'utf8'));

/**
 * Cette page est une application complète (scripts en ligne) : elle a sa propre politique de sécurité,
 * sans rien d'extérieur à la plateforme (ni polices, ni bibliothèques, ni appels réseau).
 * Elle ne s'affiche que dans un cadre de la plateforme elle-même.
 */
const CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join('; ');

const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy': CSP,
  'Cache-Control': 'private, no-store, max-age=0',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

/**
 * Le Passeport Numérique, préparé pour la personne connectée.
 * - formateur ou administrateur : l'espace animateur s'ouvre sans code ;
 * - participant inscrit au Passeport Numérique : son parcours, avec son compte HAPPI ;
 * - tout autre profil, ou une personne non connectée : refus.
 * Le rôle est décidé ici, côté serveur : la page ne le déduit jamais d'une saisie.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.status !== 'active') return new Response('Connexion requise.', { status: 401, headers: { 'Cache-Control': 'no-store' } });

  let role: 'staff' | 'participant';
  if (user.role === 'formateur' || user.role === 'admin') role = 'staff';
  else if (user.role === 'participant' && user.participantId && (await getParticipantProgramKind(user.participantId)) === 'passeport_numerique') {
    // Les ateliers se font en présentiel : il faut que le formateur ait validé le compte (rattachement à une session).
    if (!(await hasPasseportNumeriqueAccess(user.participantId))) return new Response('Compte en attente de validation par le formateur.', { status: 403, headers: { 'Cache-Control': 'no-store' } });
    role = 'participant';
  }
  else return new Response('Accès réservé aux formateurs et aux participants du Passeport Numérique.', { status: 403, headers: { 'Cache-Control': 'no-store' } });

  const uid = createHash('sha256').update(user.id).digest('hex').slice(0, 16);
  const html = preparePasseportNumerique(await original(), { role, uid, firstName: user.firstName, lastName: user.lastName });
  return new Response(html, { headers: HEADERS });
}
