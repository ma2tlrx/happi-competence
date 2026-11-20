import 'server-only';

import { redirect } from 'next/navigation';

import { getCurrentUser, hasPermission, homePathFor, requireRole, type CurrentUser } from '@/lib/auth/session';
import { safeInternalPath } from '@/lib/utils';

import { loginUrl } from './client-http';

/**
 * Accès aux pages de gestion et d'animation des jeux : formateur ou administrateur, avec la permission
 * `games.manage`. Contrôlé côté serveur à chaque affichage ; tout autre compte est renvoyé vers son espace.
 * Les routes /api/jeux/** refont ce contrôle : celui-ci ne sert qu'à ne pas afficher la page.
 */
export async function requireGamesAccess(): Promise<CurrentUser> {
  const user = await requireRole('formateur', 'admin');
  if (!hasPermission(user, 'games.manage')) redirect(homePathFor(user));
  return user;
}

export type PlayerAccess = {
  user: CurrentUser;
  /** Animateur (formateur ou administrateur) : il joue en mode essai, aucun résultat n'est enregistré. */
  trial: boolean;
};

/**
 * Accès aux écrans joueur : participant connecté (compte actif), ou animateur en mode essai.
 * Un visiteur non connecté est renvoyé vers la connexion, qui le ramène sur `next` (chemin interne contrôlé).
 * Un autre rôle (organisme…) est renvoyé vers son espace. Les routes de l'API refont ces contrôles.
 */
export async function requirePlayer(next: string): Promise<PlayerAccess> {
  const target = safeInternalPath(next, '/jouer');
  const current = await getCurrentUser();
  if (!current) redirect(loginUrl(target));
  const user = await requireRole('participant', 'formateur', 'admin');
  return { user, trial: user.role !== 'participant' };
}
