'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback: () => void) {
  const query = window.matchMedia(QUERY);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

/**
 * Préférence « réduire les animations ». Le serveur ne la connaît pas : elle vaut `false`
 * pendant le rendu serveur et l'hydratation, puis la valeur réelle, sans écart d'hydratation.
 */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

const never = () => () => {};

/** Faux pendant le rendu serveur et l'hydratation, vrai ensuite. */
export function useHydrated() {
  return useSyncExternalStore(
    never,
    () => true,
    () => false,
  );
}
