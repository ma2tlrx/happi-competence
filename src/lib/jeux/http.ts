import 'server-only';

import { NextResponse } from 'next/server';
import type { z } from 'zod';

import { getCurrentUser, type CurrentUser } from '@/lib/auth/session';
import { mfaStep } from '@/lib/auth/mfa';
import { rateLimit, requestIp } from '@/lib/security/rate-limit';
import type { RateLimitScope } from '@/lib/security/rate-limit-core';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import { GameDataError, getSession, type Db, type Session } from './data';
import { canManageGames, isSameOrigin, ownsOrAdmin, playerKind } from './guards';
import { idParamSchema } from './schemas';

const NO_STORE = { 'cache-control': 'no-store' };

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

export function error(message: string, status: number) {
  return json({ error: message }, status);
}

/** Erreur inattendue : détail dans les journaux du serveur, message neutre pour l'appelant. */
export function serverError(context: string, cause: unknown) {
  console.error(`[jeux] ${context}`, cause instanceof GameDataError ? `${cause.message} (${cause.code ?? '?'})` : cause);
  return error('Erreur serveur.', 500);
}

export type Params<T extends string> = { params: Promise<Record<T, string>> };

/** Identifiant d'URL : un UUID, sinon la ressource « n'existe pas » (404) sans interroger la base. */
export async function uuidParam<T extends string>(context: Params<T>, name: T): Promise<string | null> {
  const value = (await context.params)[name];
  const parsed = idParamSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Corps JSON validé. En cas d'échec : 400 avec le premier message de validation (français).
 * `optional` : un corps vide est lu comme `{}` (routes d'action sans paramètre).
 */
export async function readBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  options: { optional?: boolean } = {},
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    const text = await request.text();
    raw = !text.trim() && options.optional ? {} : JSON.parse(text);
  } catch {
    return { ok: false, response: error('Requête invalide.', 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, response: error(parsed.error.issues[0]?.message || 'Requête invalide.', 400) };
  return { ok: true, data: parsed.data };
}

/** Limitation de débit des routes publiques (par adresse IP). Renvoie la réponse 429 à retourner, ou `null`. */
export async function limitPublic(scope: Extract<RateLimitScope, 'game_join' | 'game_play'>): Promise<NextResponse | null> {
  const message = await rateLimit(scope, { ip: await requestIp() });
  return message ? error(message, 429) : null;
}

export type Manager = { user: CurrentUser; db: Db };

/**
 * Garde des routes d'animation : compte connecté et actif, double authentification en règle,
 * rôle formateur ou administrateur avec la permission games.manage, requête issue du site.
 * `db` est le client de la session (RLS appliquée).
 */
export async function requireManager(request: Request): Promise<{ ok: true; manager: Manager } | { ok: false; response: NextResponse }> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    if (!isSameOrigin(request.headers.get('origin'), host)) return { ok: false, response: error('Origine non autorisée.', 403) };
  }
  const user = await getCurrentUser();
  if (!user) return { ok: false, response: error('Non authentifié', 401) };
  if (user.status !== 'active') return { ok: false, response: error('Compte désactivé.', 403) };
  if (mfaStep(user.mfa) !== null || user.awaitingAccessCode) return { ok: false, response: error('Non authentifié', 401) };
  if (!canManageGames({ id: user.id, role: user.role, status: user.status, permissions: user.permissions })) {
    return { ok: false, response: error('Accès refusé : réservé aux formateurs et administrateurs autorisés.', 403) };
  }
  return { ok: true, manager: { user, db: (await createClient()) as unknown as Db } };
}

export type Player = { user: CurrentUser; participantId: string | null; trial: boolean };

const SIGN_IN_TO_PLAY = 'Connectez-vous avec votre compte participant pour jouer.';

/** Compte connecté, actif, authentification complète : sinon 401/403. Sans contrôle de rôle. */
async function signedInUser(): Promise<{ ok: true; user: CurrentUser } | { ok: false; response: NextResponse }> {
  const user = await getCurrentUser();
  if (!user || mfaStep(user.mfa) !== null || user.awaitingAccessCode) return { ok: false, response: error(SIGN_IN_TO_PLAY, 401) };
  if (user.status !== 'active') return { ok: false, response: error('Compte désactivé.', 403) };
  return { ok: true, user };
}

/**
 * Garde des routes joueur : l'identité vient de la SESSION (cookies), jamais d'un jeton ni d'un champ du corps.
 *  - participant actif avec fiche : joue normalement (résultats conservés) ;
 *  - formateur / administrateur autorisé : joue en mode essai (aucun résultat) ;
 *  - tout autre compte (organisme, participant sans fiche…) : 403 ; visiteur non connecté : 401.
 * Les requêtes qui modifient des données doivent venir du site (contrôle d'origine).
 */
export async function requirePlayer(request: Request): Promise<{ ok: true; player: Player } | { ok: false; response: NextResponse }> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    if (!isSameOrigin(request.headers.get('origin'), host)) return { ok: false, response: error('Origine non autorisée.', 403) };
  }
  const signedIn = await signedInUser();
  if (!signedIn.ok) return signedIn;
  const { user } = signedIn;
  const kind = playerKind({ id: user.id, role: user.role, status: user.status, permissions: user.permissions, participantId: user.participantId });
  if (!kind) return { ok: false, response: error('Les jeux sont réservés aux participants connectés (et aux animateurs, en mode essai).', 403) };
  return { ok: true, player: { user, participantId: kind === 'participant' ? user.participantId : null, trial: kind === 'trial' } };
}

/**
 * Lecture d'une partie (état, vue publique) : compte connecté qui est joueur de la partie, ou animateur
 * propriétaire / administrateur. Renvoie le compte ; l'appelant vérifie l'appartenance avec l'état.
 */
export async function requireViewer(): Promise<{ ok: true; user: CurrentUser; manager: boolean } | { ok: false; response: NextResponse }> {
  const signedIn = await signedInUser();
  if (!signedIn.ok) return signedIn;
  const { user } = signedIn;
  const manager = canManageGames({ id: user.id, role: user.role, status: user.status, permissions: user.permissions });
  const participant = user.role === 'participant' && !!user.participantId;
  if (!manager && !participant) return { ok: false, response: error('Les jeux sont réservés aux participants connectés.', 403) };
  return { ok: true, user, manager };
}

export function serviceDb(): Db {
  return createAdminClient() as unknown as Db;
}

/** Appartient à l'appelant, ou administrateur : sinon la ressource « n'existe pas » (404), sans en révéler l'existence. */
export function owned(manager: Manager, ownerId: string | null | undefined) {
  return ownsOrAdmin({ id: manager.user.id, role: manager.user.role, status: manager.user.status, permissions: manager.user.permissions }, ownerId);
}

/** Partie de Quiz de l'animateur (RLS + contrôle explicite de propriété). */
export async function ownedSession(manager: Manager, sessionId: string): Promise<Session | null> {
  const session = await getSession(manager.db, sessionId);
  return session && owned(manager, session.ownerId) ? session : null;
}

/** Purge opportuniste des états expirés (à la création d'une partie) : sans effet sur la réponse si elle échoue. */
export async function purgeExpired(): Promise<void> {
  try {
    await serviceDb().rpc('purge_expired_games');
  } catch (cause) {
    console.error('[jeux] purge des états expirés impossible', cause);
  }
}
