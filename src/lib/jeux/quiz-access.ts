import 'server-only';

import { redirect } from 'next/navigation';

import type { PermissionCode } from '@/lib/auth/roles';
import { type CurrentUser, hasPermission, homePathFor, requireRole } from '@/lib/auth/session';

/**
 * Accès aux pages de gestion et d'animation des jeux : formateur ou administrateur
 * disposant de la permission `games.manage` (l'administrateur les possède toutes).
 * Les routes /api/jeux/** refont ce contrôle : celui-ci ne sert qu'à ne pas afficher la page.
 */
export async function requireGamesManager(): Promise<CurrentUser> {
  const user = await requireRole('formateur', 'admin');
  // `games.manage` est ajoutée au type PermissionCode par le chantier J1 (migration + roles.ts).
  if (!hasPermission(user, 'games.manage' as PermissionCode)) redirect(homePathFor(user));
  return user;
}
