import type { ZodError } from 'zod';
import './zod-fr';

/** Résultat standard d'une action serveur, consommé par useActionState. */
export type ActionState<TData = undefined> = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: TData;
} | null;

export function actionError(message: string, fieldErrors?: Record<string, string>): NonNullable<ActionState> {
  return { ok: false, message, fieldErrors };
}

export function actionSuccess<TData = undefined>(message?: string, data?: TData): NonNullable<ActionState<TData>> {
  return { ok: true, message, data };
}

/** Transforme une erreur de validation en messages par champ (premier message de chaque champ). */
export function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export function validationError(error: ZodError): NonNullable<ActionState> {
  return actionError('Certains champs sont à corriger.', fieldErrorsFrom(error));
}

/**
 * Message lisible à partir d'une erreur renvoyée par la base.
 * Les fonctions et déclencheurs de HAPPI lèvent des messages en français (code P0001 / 42501 / 22023)
 * que l'on peut afficher tels quels ; tout le reste devient un message générique.
 */
export function databaseErrorMessage(
  error: { code?: string; message?: string } | null | undefined,
  fallback = 'L’opération n’a pas pu être effectuée. Réessayez dans un instant.',
) {
  if (!error) return fallback;
  if (error.code === '23505') return 'Cet élément existe déjà.';
  if (error.code === '23503') return 'Cet élément est utilisé ailleurs et ne peut pas être modifié ainsi.';
  if (error.code === '42501' && (!error.message || /row-level security|permission denied/i.test(error.message))) {
    return 'Vous n’êtes pas autorisé à effectuer cette action.';
  }
  if (error.code && ['P0001', 'P0002', '42501', '22023'].includes(error.code) && error.message) return error.message;
  return fallback;
}
