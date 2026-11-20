'use client';

import { useEffect, useRef } from 'react';

import type { AnswerResultEvent, QuizEventMap } from '@/lib/jeux/client-quiz';
import { createClient } from '@/lib/supabase/client';

export type QuizHandlers = { [K in keyof QuizEventMap]?: (payload: QuizEventMap[K]) => void } & {
  /** Résultat individuel du joueur (nécessite `playerId`). */
  'answer:result'?: (payload: AnswerResultEvent) => void;
  /** Appelé une fois le canal abonné (et à chaque réabonnement) : moment de resynchroniser l'état. */
  onReady?: () => void;
};

/**
 * Abonnement au canal temps réel `session-<id>` (diffusions du serveur).
 * Les gestionnaires peuvent changer à chaque rendu sans réabonner le canal.
 */
export function useQuizChannel(sessionId: string, handlers: QuizHandlers, playerId?: string) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`session-${sessionId}`);
    const names: (keyof QuizEventMap)[] = [
      'lobby:updated',
      'game:starting',
      'question:show',
      'question:answers',
      'answer:received',
      'question:ended',
      'game:ended',
    ];
    for (const name of names) {
      channel.on('broadcast', { event: name }, ({ payload }) => {
        (ref.current[name] as ((p: unknown) => void) | undefined)?.(payload);
      });
    }
    if (playerId) {
      channel.on('broadcast', { event: `answer:result:${playerId}` }, ({ payload }) => {
        ref.current['answer:result']?.(payload as AnswerResultEvent);
      });
    }
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') ref.current.onReady?.();
    });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, playerId]);
}
