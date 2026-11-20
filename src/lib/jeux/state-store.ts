/**
 * Écriture d'un état de partie avec verrou optimiste.
 *
 * Plusieurs joueurs répondent au même instant, chacun dans sa propre requête serveur : lire puis
 * réécrire l'état sans précaution perdrait des réponses. Chaque état porte donc un numéro de
 * version ; une écriture n'aboutit que si la version lue est encore la version courante. En cas de
 * conflit, la mutation est rejouée sur l'état à jour (jusqu'à MAX_ATTEMPTS fois, avec une attente
 * aléatoire croissante), exactement comme dans le jeu d'origine.
 *
 * Module pur : le stockage est injecté (Supabase en production, mémoire dans les tests).
 */

export type Versioned<T> = { state: T; version: number };

export interface StateStore<T> {
  /** Lit l'état courant ; `null` s'il n'existe pas ou s'il a expiré. */
  read(id: string): Promise<Versioned<T> | null>;
  /**
   * Écrit l'état si `expectedVersion` est encore la version courante et renvoie `true`.
   * Renvoie `false` en cas de conflit (une autre écriture est passée entre-temps).
   */
  write(id: string, state: T, expectedVersion: number): Promise<boolean>;
}

export const MAX_ATTEMPTS = 6;

/** Résultat d'une mutation : refus (aucune écriture) ou nouvel état et valeur à renvoyer. */
export type Mutation<T, R, E extends string> = { reject: E } | { state: T; result: R };

export type MutateOutcome<T, R, E extends string> =
  | { kind: 'ok'; state: T; result: R; version: number }
  | { kind: 'rejected'; reason: E }
  | { kind: 'missing' }
  | { kind: 'conflict' };

export type MutateOptions = {
  maxAttempts?: number;
  /** Attente entre deux essais (remplaçable dans les tests). */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Lit l'état, applique `fn`, écrit avec contrôle de version. `fn` doit être sans effet de bord
 * (elle peut être rejouée) et peut modifier l'état reçu en place.
 */
export async function mutateState<T, R, E extends string>(
  store: StateStore<T>,
  id: string,
  fn: (state: T) => Mutation<T, R, E>,
  options: MutateOptions = {},
): Promise<MutateOutcome<T, R, E>> {
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const current = await store.read(id);
    if (!current) return { kind: 'missing' };
    const outcome = fn(current.state);
    if ('reject' in outcome) return { kind: 'rejected', reason: outcome.reject };
    if (await store.write(id, outcome.state, current.version)) {
      return { kind: 'ok', state: outcome.state, result: outcome.result, version: current.version + 1 };
    }
    if (attempt < maxAttempts - 1) await sleep(10 + random() * 30 * (attempt + 1));
  }
  return { kind: 'conflict' };
}

/** Stockage en mémoire (tests unitaires) : mêmes garanties que la table, copie à chaque lecture. */
export function createMemoryStore<T>(initial?: Record<string, T>): StateStore<T> & { failNextWrites: (count: number) => void } {
  const data = new Map<string, { state: T; version: number }>();
  for (const [id, state] of Object.entries(initial ?? {})) data.set(id, { state: structuredClone(state), version: 1 });
  let forcedConflicts = 0;
  return {
    failNextWrites(count: number) {
      forcedConflicts = count;
    },
    async read(id) {
      const row = data.get(id);
      return row ? { state: structuredClone(row.state), version: row.version } : null;
    },
    async write(id, state, expectedVersion) {
      const row = data.get(id);
      if (!row) return false;
      if (forcedConflicts > 0) {
        // Simule une écriture concurrente passée entre la lecture et l'écriture.
        forcedConflicts--;
        row.version += 1;
        return false;
      }
      if (row.version !== expectedVersion) return false;
      data.set(id, { state: structuredClone(state), version: expectedVersion + 1 });
      return true;
    },
  };
}
