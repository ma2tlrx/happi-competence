'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiResult } from '@/lib/jeux/client-undercover';

export type PollError = { status: number; message: string };

/**
 * Interroge le serveur à intervalle régulier (en pause quand l'onglet est caché, avec rafraîchissement
 * immédiat au retour). Les réponses arrivées dans le désordre sont ignorées : seule la plus récente compte.
 * `setData` applique tout de suite l'état renvoyé par une action de l'animateur ou d'un joueur.
 */
export function usePolledResource<T>(load: () => Promise<ApiResult<T>>, intervalMs = 2000) {
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<PollError | null>(null);
  const loader = useRef(load);
  const sequence = useRef(0);
  const alive = useRef(false);

  useEffect(() => {
    loader.current = load;
  });

  const refresh = useCallback(async () => {
    const id = ++sequence.current;
    const result = await loader.current();
    if (!alive.current || id !== sequence.current) return;
    if (result.ok) {
      setDataState(result.data);
      setError(null);
    } else {
      setError({ status: result.status, message: result.error });
    }
  }, []);

  const setData = useCallback((value: T) => {
    sequence.current += 1;
    setDataState(value);
    setError(null);
  }, []);

  useEffect(() => {
    alive.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (!document.hidden) await refresh();
      if (alive.current) timer = setTimeout(tick, intervalMs);
    };
    void tick();
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive.current = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, intervalMs]);

  return { data, error, refresh, setData };
}
