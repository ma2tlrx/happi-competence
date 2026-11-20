/** Résultat d'une transition de jeu : valeur de retour, ou motif de refus (code stable, traduit par les routes). */
export type Refusal<C extends string> = { ok: false; code: C };
export type Success<R> = { ok: true; result: R };
export type EngineResult<R, C extends string> = Success<R> | Refusal<C>;

export const fail = <C extends string>(code: C): Refusal<C> => ({ ok: false, code });
export const ok = <R>(result: R): Success<R> => ({ ok: true, result });
