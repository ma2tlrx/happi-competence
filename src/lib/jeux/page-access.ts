import 'server-only';

import { redirect } from 'next/navigation';

import { hasPermission, homePathFor, requireRole, type CurrentUser } from '@/lib/auth/session';

/**
 * Accès aux pages de gestion et d'animation des jeux : formateur ou administrateur, avec la permission
 * `games.manage`. Contrôlé côté serveur à chaque affichage ; tout autre compte est renvoyé vers son espace.
 */
export async function requireGamesAccess(): Promise<CurrentUser> {
  const user = await requireRole('formateur', 'admin');
  if (!hasPermission(user, 'games.manage')) redirect(homePathFor(user));
  return user;
}
