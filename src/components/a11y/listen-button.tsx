'use client';

import { Pause, Play, Square, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import { speechChunks } from '@/lib/speech/chunks';

/**
 * Lecture à voix haute par la synthèse vocale du navigateur (speechSynthesis), en
 * français : aucun service externe, rien ne quitte l'appareil. Lecture, pause,
 * reprise et arrêt au clavier (boutons natifs). Masqué si le navigateur ne la propose pas.
 */

const noop = () => () => {};
function useSynthesisSupported() {
  return useSyncExternalStore(noop, () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window, () => false);
}

function frenchVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.lang === 'fr-FR' && voice.localService) ?? voices.find((voice) => voice.lang?.toLowerCase().startsWith('fr')) ?? null;
}

export function ListenButton({ text, label = 'Écouter', className }: { text: string; label?: string; className?: string }) {
  const supported = useSynthesisSupported();
  const [state, setState] = useState<'idle' | 'speaking' | 'paused'>('idle');
  const queue = useRef<string[]>([]);
  const active = useRef(false);

  useEffect(
    () => () => {
      if (active.current) window.speechSynthesis.cancel();
    },
    [],
  );

  if (!supported || !text.trim()) return null;

  const speakNext = () => {
    const next = queue.current.shift();
    if (!next) {
      active.current = false;
      setState('idle');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(next);
    utterance.lang = 'fr-FR';
    const voice = frenchVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95;
    utterance.onend = () => {
      if (active.current) speakNext();
    };
    utterance.onerror = () => {
      active.current = false;
      setState('idle');
    };
    window.speechSynthesis.speak(utterance);
  };

  const play = () => {
    const synth = window.speechSynthesis;
    if (state === 'paused') {
      synth.resume();
      setState('speaking');
      return;
    }
    synth.cancel();
    // Lecture par morceaux : certains navigateurs coupent les textes longs.
    queue.current = speechChunks(text);
    active.current = true;
    setState('speaking');
    speakNext();
  };
  const pause = () => {
    window.speechSynthesis.pause();
    setState('paused');
  };
  const stop = () => {
    active.current = false;
    queue.current = [];
    window.speechSynthesis.cancel();
    setState('idle');
  };

  return (
    <span className={className} role="group" aria-label={`${label} : lecture à voix haute`}>
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {state === 'speaking' ? (
          <Button type="button" variant="outline" size="sm" onClick={pause}>
            <Pause aria-hidden />
            Pause
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={play}>
            {state === 'paused' ? <Play aria-hidden /> : <Volume2 aria-hidden />}
            {state === 'paused' ? 'Reprendre' : label}
          </Button>
        )}
        {state !== 'idle' ? (
          <Button type="button" variant="ghost" size="sm" onClick={stop}>
            <Square aria-hidden />
            Arrêter
          </Button>
        ) : null}
        <span className="sr-only" aria-live="polite">
          {state === 'speaking' ? 'Lecture en cours' : state === 'paused' ? 'Lecture en pause' : ''}
        </span>
      </span>
    </span>
  );
}
