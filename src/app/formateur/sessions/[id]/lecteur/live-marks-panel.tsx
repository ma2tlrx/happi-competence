'use client';

import { CloudOff, Undo2, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { enqueueMark, flushQueue, parseQueue, removeFromQueue, type PendingMark, type SendOutcome } from '@/lib/live-marks/live-marks';
import { cn } from '@/lib/utils';

import { addLiveMark, removeLiveMark } from './actions';

export type LiveParticipant = { id: string; label: string; present: boolean };
export type LiveSkill = { code: string; name: string };
export type LiveMarkSummary = { id: string; participantId: string; skillCode: string | null };
export type LiveContext = { blockIndex: number | null; blockTitle: string | null; elapsedSeconds: number | null };

/** Durée pendant laquelle le sélecteur de compétence reste proposé après un « + ». */
const PICKER_MS = 4000;
const FLUSH_EVERY_MS = 15000;

const stamp = () => Date.now();
const storageKey = (sessionId: string) => `happi.live-marks.queue.${sessionId}`;
const readQueue = (sessionId: string) => {
  try {
    return parseQueue(window.localStorage.getItem(storageKey(sessionId)));
  } catch {
    return [];
  }
};
const writeQueue = (sessionId: string, queue: PendingMark[]) => {
  try {
    if (queue.length) window.localStorage.setItem(storageKey(sessionId), JSON.stringify(queue));
    else window.localStorage.removeItem(storageKey(sessionId));
  } catch {
    // Stockage indisponible : la file reste en mémoire pour cette page.
  }
};

/**
 * Panneau « Points en direct » : un appui sur un participant = un « + » horodaté, rattaché au bloc en cours.
 * Mise à jour immédiate ; envoi en arrière-plan avec file locale (réessai) : aucun « + » n'est perdu en silence.
 * Aide-mémoire pour la notation faite après la séance : aucun score n'est créé.
 */
export function LiveMarksPanel({
  sessionId,
  participants,
  skills,
  initialMarks,
  getContext,
  onClose,
  onCount,
}: {
  sessionId: string;
  participants: LiveParticipant[];
  skills: LiveSkill[];
  initialMarks: LiveMarkSummary[];
  getContext: () => LiveContext;
  onClose: () => void;
  onCount: (total: number) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [marks, setMarks] = useState<LiveMarkSummary[]>(initialMarks);
  const [queue, setQueue] = useState<PendingMark[]>([]);
  const [picker, setPicker] = useState<{ markId: string; participantId: string; label: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const queueRef = useRef<PendingMark[]>([]);
  const holdRef = useRef<string | null>(null);
  const flushing = useRef(false);
  const cancelledRef = useRef(new Set<string>());
  const pickerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextRef = useRef(getContext);
  useEffect(() => {
    contextRef.current = getContext;
  });

  const setQueueBoth = useCallback(
    (next: PendingMark[]) => {
      queueRef.current = next;
      setQueue(next);
      writeQueue(sessionId, next);
    },
    [sessionId],
  );

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      const rejected: string[] = [];
      const sendable = queueRef.current.filter((item) => item.id !== holdRef.current);
      const left = await flushQueue(sendable, async (item): Promise<SendOutcome> => {
        const result = await addLiveMark({ id: item.id, sessionId, participantId: item.participantId, skillCode: item.skillCode, blockIndex: item.blockIndex, blockTitle: item.blockTitle, elapsedSeconds: item.elapsedSeconds });
        if (result.ok) return 'sent';
        if (result.retry) return 'retry';
        rejected.push(item.id);
        return 'rejected';
      });
      // On garde ce qui est à réessayer, ce qui est retenu pour le sélecteur, et tout ce qui a été ajouté pendant l'envoi.
      const stillQueued = new Set(left.map((item) => item.id));
      const sentOrRejected = new Set(sendable.filter((item) => !stillQueued.has(item.id)).map((item) => item.id));
      // Un « + » modifié (compétence choisie) pendant l'envoi reste en file ; son id étant identique, le renvoi est sans effet.
      setQueueBoth(queueRef.current.filter((item) => !sentOrRejected.has(item.id)));
      // Annulé pendant l'envoi : le « + » est arrivé en base, on le retire.
      for (const id of sentOrRejected) {
        if (cancelledRef.current.delete(id)) void removeLiveMark(sessionId, id).catch(() => undefined);
      }
      if (rejected.length) {
        setMarks((current) => current.filter((mark) => !rejected.includes(mark.id)));
        setNotice(`${rejected.length} point(s) refusé(s) par le serveur (droits ou participant hors groupe).`);
      }
    } finally {
      flushing.current = false;
    }
  }, [sessionId, setQueueBoth]);

  // Reprise : file locale d'une visite précédente, réessai au retour du réseau et périodique.
  useEffect(() => {
    const restored = readQueue(sessionId);
    if (restored.length) {
      const known = new Set(queueRef.current.map((item) => item.id));
      setQueueBoth([...restored.filter((item) => !known.has(item.id)), ...queueRef.current]);
      setMarks((current) => [...current, ...restored.filter((item) => !current.some((mark) => mark.id === item.id)).map((item) => ({ id: item.id, participantId: item.participantId, skillCode: item.skillCode }))]);
    }
    void flush();
    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);
    const interval = window.setInterval(() => {
      if (queueRef.current.length) void flush();
    }, FLUSH_EVERY_MS);
    return () => {
      window.removeEventListener('online', onOnline);
      window.clearInterval(interval);
    };
  }, [sessionId, flush, setQueueBoth]);

  useEffect(() => onCount(marks.length), [marks.length, onCount]);

  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const mark of marks) result.set(mark.participantId, (result.get(mark.participantId) ?? 0) + 1);
    return result;
  }, [marks]);

  const closePicker = useCallback(() => {
    if (pickerTimer.current) clearTimeout(pickerTimer.current);
    pickerTimer.current = null;
    holdRef.current = null;
    setPicker(null);
    void flush();
  }, [flush]);
  useEffect(() => () => {
    if (pickerTimer.current) clearTimeout(pickerTimer.current);
  }, []);

  const addMark = (participant: LiveParticipant) => {
    // Un nouveau « + » libère le précédent : il part tel quel (général).
    if (holdRef.current) closePicker();
    const context = contextRef.current();
    const item: PendingMark = { id: crypto.randomUUID(), participantId: participant.id, skillCode: null, ...context, clientAt: stamp() };
    holdRef.current = item.id;
    setMarks((current) => [...current, { id: item.id, participantId: item.participantId, skillCode: null }]);
    setQueueBoth(enqueueMark(queueRef.current, item));
    setNotice(null);
    setPicker({ markId: item.id, participantId: participant.id, label: participant.label });
    try {
      navigator.vibrate?.(15);
    } catch {
      // Pas de retour haptique sur cet appareil.
    }
    if (pickerTimer.current) clearTimeout(pickerTimer.current);
    pickerTimer.current = setTimeout(closePicker, PICKER_MS);
  };

  const chooseSkill = (code: string) => {
    if (!picker) return;
    const id = picker.markId;
    setMarks((current) => current.map((mark) => (mark.id === id ? { ...mark, skillCode: code } : mark)));
    setQueueBoth(queueRef.current.map((item) => (item.id === id ? { ...item, skillCode: code } : item)));
    closePicker();
  };

  const undo = async () => {
    const last = marks[marks.length - 1];
    if (!last) return;
    if (picker?.markId === last.id) closePicker();
    setMarks((current) => current.filter((mark) => mark.id !== last.id));
    if (queueRef.current.some((item) => item.id === last.id)) {
      // Pas encore parti : on le retire simplement de la file.
      setQueueBoth(removeFromQueue(queueRef.current, last.id));
      if (flushing.current) cancelledRef.current.add(last.id);
      return;
    }
    try {
      const result = await removeLiveMark(sessionId, last.id);
      if (!result.ok) throw new Error('refus');
    } catch {
      setMarks((current) => [...current, last]);
      setNotice('Annulation impossible pour le moment : réessayez.');
    }
  };

  const skillName = (code: string | null) => skills.find((skill) => skill.code === code)?.name ?? null;
  const last = marks[marks.length - 1];
  const lastParticipant = last ? participants.find((participant) => participant.id === last.participantId) : null;

  return (
    <motion.aside
      data-live-marks
      initial={reduceMotion ? false : { y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
      transition={{ duration: 0.18 }}
      aria-label="Points en direct"
      className="absolute inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex max-h-[46%] flex-col border-t border-line bg-white shadow-lg lg:static lg:inset-auto lg:max-h-none lg:w-80 lg:shrink-0 lg:border-t-0 lg:border-l lg:shadow-none"
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <h2 className="font-display font-semibold">Points en direct</h2>
        <span className="text-sm text-ink-muted tabular-nums">{marks.length}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => void undo()}
            disabled={!last}
            className="flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-2.5 text-sm font-semibold hover:bg-paper disabled:opacity-40"
            aria-label={last && lastParticipant ? `Annuler le dernier point (${lastParticipant.label})` : 'Annuler le dernier point'}
          >
            <Undo2 className="size-4" aria-hidden />
            Annuler
          </button>
          <button type="button" onClick={onClose} className="flex size-9 items-center justify-center rounded-md hover:bg-paper" aria-label="Fermer les points en direct">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {picker ? (
          <div className="mb-3 rounded-lg border border-petrol-300 bg-petrol-50 p-2.5" role="group" aria-label={`Compétence pour le point de ${picker.label}`}>
            <p className="mb-1.5 flex items-center justify-between text-sm">
              <span><span className="font-semibold">{picker.label}</span> + enregistré. Compétence ?</span>
              <button type="button" onClick={closePicker} className="rounded-sm px-1.5 py-0.5 text-xs font-semibold text-petrol-700 hover:bg-white">Général</button>
            </p>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {skills.map((skill) => (
                <button key={skill.code} type="button" onClick={() => chooseSkill(skill.code)} className="min-h-9 rounded-full border border-petrol-300 bg-white px-3 text-sm hover:bg-petrol-100">
                  {skill.name}
                </button>
              ))}
              {skills.length === 0 ? <p className="text-xs text-ink-muted">Aucune compétence définie pour cette session : le point reste général.</p> : null}
            </div>
            <style>{'@keyframes live-marks-countdown{from{transform:scaleX(1)}to{transform:scaleX(0)}}'}</style>
            <span
              key={picker.markId}
              aria-hidden
              className="mt-2 block h-0.5 origin-left rounded-full bg-petrol-500 motion-reduce:hidden"
              style={{ animation: `live-marks-countdown ${PICKER_MS}ms linear forwards` }}
            />
          </div>
        ) : null}

        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1" aria-label="Participants de la session">
          {participants.map((participant) => {
            const count = counts.get(participant.id) ?? 0;
            return (
              <li key={participant.id}>
                <button
                  type="button"
                  onClick={() => addMark(participant)}
                  aria-label={`Ajouter un plus à ${participant.label}${count ? `, ${count} déjà` : ''}${participant.present ? '' : ' (non pointé présent)'}`}
                  className={cn(
                    'flex min-h-14 w-full items-center justify-between gap-2 rounded-lg border px-3 text-left font-medium transition-colors active:scale-[0.98] motion-reduce:active:scale-100',
                    participant.present ? 'border-line-strong bg-white hover:bg-petrol-50' : 'border-line bg-paper text-ink-muted hover:bg-white',
                  )}
                >
                  <span className="min-w-0 truncate">{participant.label}</span>
                  <span className="flex shrink-0 items-center gap-1 text-petrol-700">
                    <span className="text-lg font-semibold">+</span>
                    <motion.span
                      key={count}
                      initial={reduceMotion || count === 0 ? false : { scale: 1.5 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                      className="min-w-5 text-center text-lg font-semibold tabular-nums"
                    >
                      {count}
                    </motion.span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {participants.length === 0 ? <p className="text-sm text-ink-muted">Aucun participant inscrit dans le groupe de cette session.</p> : null}
        {participants.some((participant) => !participant.present) ? <p className="mt-3 text-xs text-ink-muted">Les participants en gris ne sont pas pointés présents ; ils restent cliquables.</p> : null}
      </div>

      <div className="flex items-center gap-2 border-t border-line px-4 py-2 text-xs text-ink-muted" role="status" aria-live="polite">
        {queue.length ? (
          <span className="flex items-center gap-1.5 font-medium text-warning">
            <CloudOff className="size-3.5" aria-hidden />
            {queue.length} en attente d’envoi (réessai automatique)
          </span>
        ) : (
          <span>Tous les points sont enregistrés.</span>
        )}
        {notice ? <span className="text-danger">{notice}</span> : null}
        {last && !notice ? <span className="ml-auto truncate">Dernier : {lastParticipant?.label ?? ''}{last.skillCode ? ` · ${skillName(last.skillCode) ?? last.skillCode}` : ''}</span> : null}
      </div>
    </motion.aside>
  );
}
