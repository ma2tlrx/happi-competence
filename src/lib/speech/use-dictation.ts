'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * Dictée vocale par l'API Web Speech du navigateur (SpeechRecognition, préfixée
 * « webkit » sur Chrome, Edge et Safari), en français. Aucune donnée ne passe par
 * HAPPI ; selon le navigateur, l'audio peut toutefois être transcrit par le service
 * de reconnaissance de son éditeur. Sans prise en charge, le clavier reste disponible.
 */

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const noop = () => () => {};

/** Vrai côté navigateur si la dictée est disponible (faux au rendu serveur). */
export function useDictationSupported() {
  return useSyncExternalStore(noop, () => recognitionConstructor() !== null, () => false);
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Accès au micro refusé. Autorisez le micro dans votre navigateur, ou tapez vos notes.',
  'service-not-allowed': 'La dictée n’est pas autorisée par ce navigateur. Tapez vos notes.',
  'no-speech': 'Aucune parole détectée. Réessayez en parlant plus près du micro.',
  'audio-capture': 'Aucun micro détecté. Tapez vos notes.',
  network: 'La dictée de ce navigateur n’est pas joignable (réseau). Tapez vos notes.',
};

/**
 * `onText` reçoit chaque segment définitif (à ajouter au texte). `interim` contient le
 * segment en cours, affiché à titre indicatif.
 */
export function useDictation(onText: (text: string) => void) {
  const supported = useDictationSupported();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const callback = useRef(onText);
  useEffect(() => {
    callback.current = onText;
  });

  const stop = useCallback(() => {
    recognition.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Constructor = recognitionConstructor();
    if (!Constructor) return;
    setError(null);
    const instance = new Constructor();
    instance.lang = 'fr-FR';
    instance.continuous = true;
    instance.interimResults = true;
    instance.onresult = (event) => {
      let pending = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]!;
        if (result.isFinal) callback.current(result[0].transcript.trim());
        else pending += result[0].transcript;
      }
      setInterim(pending);
    };
    instance.onerror = (event) => {
      if (event.error !== 'aborted') setError(ERRORS[event.error] ?? 'La dictée s’est interrompue. Réessayez ou tapez vos notes.');
    };
    instance.onend = () => {
      setListening(false);
      setInterim('');
      recognition.current = null;
    };
    recognition.current = instance;
    try {
      instance.start();
      setListening(true);
    } catch {
      setError('La dictée n’a pas pu démarrer. Tapez vos notes.');
    }
  }, []);

  // Arrêt de la dictée quand le composant disparaît (changement de participant, de page).
  useEffect(() => () => recognition.current?.abort(), []);

  return { supported, listening, interim, error, start, stop };
}
