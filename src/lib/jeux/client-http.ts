/**
 * Appel générique des routes `/api/jeux/**` depuis le navigateur. Les cookies de session HAPPI (même origine) portent
 * l'identité : aucun jeton de joueur ni d'animateur n'est envoyé ni conservé.
 */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const NETWORK_ERROR = 'Connexion impossible. Vérifiez votre réseau puis réessayez.';

export function fallbackMessage(status: number) {
  if (status === 0) return NETWORK_ERROR;
  if (status === 401) return 'Votre session a expiré. Reconnectez-vous pour continuer.';
  if (status === 403) return 'Action non autorisée avec ce compte.';
  if (status === 404) return 'Élément introuvable. La partie a peut-être expiré.';
  if (status === 409) return 'Cette action n’est plus possible dans l’état actuel de la partie.';
  if (status === 410) return 'Cette partie est terminée.';
  if (status === 429) return 'Trop de tentatives. Patientez quelques instants avant de réessayer.';
  if (status >= 500) return 'Le service de jeu rencontre un problème. Réessayez dans un instant.';
  return 'La demande a échoué. Réessayez.';
}

export async function call<T>(path: string, init?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown }): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method: init?.method ?? 'GET',
      headers: init?.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
      credentials: 'same-origin',
    });
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      // Le serveur renvoie `{ error }` en français ; message de repli pour tout autre cas.
      const message = typeof payload?.error === 'string' && payload.error ? payload.error : fallbackMessage(response.status);
      return { ok: false, status: response.status, error: message };
    }
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR };
  }
}

/** Adresse de connexion qui ramène sur la page indiquée (chemin interne uniquement ; contrôlé aussi côté serveur). */
export function loginUrl(next: string) {
  return `/connexion?suite=${encodeURIComponent(next)}`;
}
