/**
 * Règles d'accès aux jeux, sans dépendance serveur (testables). Les routes les appliquent après
 * avoir lu le compte connecté ; les politiques RLS de la base répètent les mêmes règles.
 */

export type GameActor = {
  id: string;
  role: string;
  status: string;
  permissions: readonly string[];
};

/** Créer, éditer et animer des jeux : formateur ou administrateur actif, avec la permission games.manage. */
export function canManageGames(actor: GameActor | null | undefined): boolean {
  if (!actor || actor.status !== 'active') return false;
  if (actor.role === 'admin') return true;
  return actor.role === 'formateur' && actor.permissions.includes('games.manage');
}

export type PlayerActor = GameActor & { participantId: string | null };

/**
 * Qui peut jouer : un participant actif ayant sa fiche (résultats conservés), ou un animateur
 * (formateur/administrateur autorisé) en mode essai (aucun résultat). Tout autre compte : refusé.
 */
export function playerKind(actor: PlayerActor | null | undefined): 'participant' | 'trial' | null {
  if (!actor || actor.status !== 'active') return null;
  if (actor.role === 'participant') return actor.participantId ? 'participant' : null;
  return canManageGames(actor) ? 'trial' : null;
}

/** Un contenu appartient à son créateur ; l'administrateur peut tout voir et animer. */
export function ownsOrAdmin(actor: GameActor, ownerId: string | null | undefined): boolean {
  return actor.role === 'admin' || (!!ownerId && ownerId === actor.id);
}

/**
 * Contrôle d'origine des requêtes qui modifient des données avec les cookies de session : si le
 * navigateur indique une origine, elle doit être celle du site. (Les cookies SameSite=Lax couvrent
 * déjà le cas courant ; ceci est une seconde barrière.)
 */
export function isSameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin) return true;
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
