'use client';

import { ArrowLeft, Check, FastForward, Play, Trophy, Users } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import {
  endQuestion,
  getGameState,
  getSession,
  nextQuestion,
  revealAnswers,
  showQuestion,
  startGame,
  type GameStatus,
  type LeaderboardEntry,
  type LobbyPlayer,
  type PublicAnswer,
  type PublicQuestion,
  type QuestionStats,
} from '@/lib/jeux/client-quiz';
import { cn } from '@/lib/utils';

import { Announcer } from './announcer';
import { answerStyle } from './answer-style';
import { Leaderboard } from './leaderboard';
import { QrCodeDisplay } from './qr-code';
import { TimerBar } from './timer-bar';
import { useDeadlineTimer } from './use-deadline-timer';
import { useQuizChannel } from './use-quiz-channel';

/** Délais du déroulé d'origine : décompte de départ, lecture de la question avant les réponses. */
const START_DELAY_MS = 3500;
const READ_DELAY_MS = 3000;

type HostQuestion = PublicQuestion & { answers?: PublicAnswer[] };

const view = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const },
};

/**
 * Écran animateur (projecteur) : le navigateur de l'animateur pilote le déroulé, comme dans
 * l'application d'origine. Affichage plein écran par-dessus la coque du site (pas de menu).
 */
export function QuizHostScreen({ sessionId }: { sessionId: string }) {
  const [meta, setMeta] = useState<{ code: string; title: string } | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [status, setStatus] = useState<GameStatus>('lobby');
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [question, setQuestion] = useState<HostQuestion | null>(null);
  const [answerCount, setAnswerCount] = useState(0);
  const [correctIds, setCorrectIds] = useState<string[] | null>(null);
  const [stats, setStats] = useState<QuestionStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [announce, setAnnounce] = useState('');
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState('');

  const countdown = useDeadlineTimer();
  const answering = useDeadlineTimer();
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const synced = useRef(false);
  const questionRef = useRef<HostQuestion | null>(null);

  const later = useCallback((fn: () => void, ms: number) => {
    timeouts.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(() => {
    const pending = timeouts.current;
    return () => pending.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    // Adresse du site connue seulement dans le navigateur.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  // ── actions de l'animateur ──
  const act = useCallback(async (call: () => Promise<{ ok: boolean } & ({ error?: string } | object)>) => {
    const res = (await call()) as { ok: boolean; error?: string };
    if (!res.ok) toast.error(res.error ?? 'Action impossible.');
    return res.ok;
  }, []);

  const finishQuestion = useCallback(() => {
    // 409 attendu si tous les joueurs ont déjà répondu (le serveur a clos la question) : on l'ignore.
    void endQuestion(sessionId);
  }, [sessionId]);

  // ── état initial et reprise après rechargement ──
  const sync = useCallback(async () => {
    const res = await getGameState(sessionId);
    if (!res.ok) {
      if (!synced.current) setFatal(res.status === 404 ? 'Cette partie est terminée ou n’existe plus.' : res.error);
      return;
    }
    const s = res.data;
    if (synced.current) {
      // Reconnexion du canal : on ne rafraîchit que la salle, sans relancer le déroulé.
      if (s.status === 'lobby') setPlayers(s.players);
      return;
    }
    synced.current = true;
    setStatus(s.status);
    setPlayers(s.players);
    if (s.question) {
      const q = { ...s.question, answers: s.answers ?? undefined };
      questionRef.current = q;
      setQuestion(q);
    }
    if (s.status === 'starting') later(() => void showQuestion(sessionId, 0), 1000);
    if (s.status === 'question_show') later(() => void revealAnswers(sessionId), 1000);
    if (s.status === 'answering' && s.question && s.questionStartTime) {
      const remaining = (s.questionStartTime + s.question.timeLimit * 1000 - Date.now()) / 1000;
      answering.start(remaining, finishQuestion);
    }
    if (s.status === 'review' || s.status === 'finished') {
      const detail = await getSession(sessionId);
      if (detail.ok) {
        setLeaderboard([...detail.data.players].sort((a, b) => b.score - a.score).map((p, i) => ({ rank: i + 1, id: p.id, nickname: p.nickname, score: p.score })));
      }
    }
  }, [sessionId, later, answering, finishQuestion]);

  useEffect(() => {
    let cancelled = false;
    getSession(sessionId).then((res) => {
      if (cancelled) return;
      if (!res.ok) return setFatal(res.status === 404 ? 'Partie introuvable.' : res.error);
      setMeta({ code: res.data.session.code, title: res.data.quiz?.title ?? 'Quiz' });
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // ── événements temps réel ──
  useQuizChannel(sessionId, {
    onReady: () => void sync(),
    'lobby:updated': ({ players: list }) => {
      setPlayers(list);
      setAnnounce(`${list.length} joueur${list.length > 1 ? 's' : ''} connecté${list.length > 1 ? 's' : ''}.`);
    },
    'game:starting': ({ countdown: n }) => {
      setStatus('starting');
      countdown.start(n);
      setAnnounce(`La partie démarre dans ${n} secondes.`);
      later(() => void showQuestion(sessionId, 0), START_DELAY_MS);
    },
    'question:show': (q) => {
      questionRef.current = q;
      setQuestion(q);
      setStatus('question_show');
      setAnswerCount(0);
      setCorrectIds(null);
      setStats(null);
      setAnnounce(`Question ${q.index + 1} sur ${q.total} : ${q.text}`);
      later(() => void revealAnswers(sessionId), READ_DELAY_MS);
    },
    'question:answers': ({ answers }) => {
      setStatus('answering');
      setQuestion((prev) => (prev ? { ...prev, answers } : prev));
      const limit = questionRef.current?.timeLimit ?? 20;
      answering.start(limit, finishQuestion);
      setAnnounce(`Réponses ouvertes : ${limit} secondes.`);
    },
    'answer:received': ({ count }) => setAnswerCount(count),
    'question:ended': (p) => {
      answering.stop();
      setStatus('review');
      setCorrectIds(p.correctAnswerIds);
      setLeaderboard(p.leaderboard);
      setStats(p.stats);
      setAnnounce(`Fin de la question. ${p.stats.totalAnswered} réponse${p.stats.totalAnswered > 1 ? 's' : ''} reçue${p.stats.totalAnswered > 1 ? 's' : ''}.`);
    },
    'game:ended': (p) => {
      answering.stop();
      setStatus('finished');
      setLeaderboard(p.finalScores);
      setAnnounce('Partie terminée. Le classement final est affiché.');
    },
  });

  const run = useCallback(
    async (call: () => Promise<{ ok: boolean }>) => {
      setBusy(true);
      await act(call);
      setBusy(false);
    },
    [act],
  );

  const joinUrl = useMemo(() => (origin && meta ? `${origin}/jouer?code=${meta.code}` : ''), [origin, meta]);
  const isLast = question ? question.index + 1 >= question.total : false;

  return (
    <MotionConfig reducedMotion="user">
      <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-petrol-900 text-white">
        <Announcer message={announce} />
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8 2xl:px-12 2xl:py-5">
          <p className="min-w-0 truncate font-display text-lg font-semibold sm:text-xl 2xl:text-3xl">{meta?.title ?? 'Quiz en direct'}</p>
          <div className="flex items-center gap-3">
            {meta ? (
              <span className="rounded-md bg-white/10 px-3 py-1.5 font-mono text-base font-semibold tracking-[0.25em] 2xl:text-2xl">
                <span className="sr-only">Code de la partie : </span>
                {meta.code}
              </span>
            ) : null}
            <Button asChild variant="inverse" size="sm">
              <Link href="/jeux/quiz">
                <ArrowLeft aria-hidden />
                Quitter
              </Link>
            </Button>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col px-5 pb-8 sm:px-8 2xl:px-12">
          {fatal ? (
            <div className="m-auto max-w-lg text-center" role="alert">
              <p className="font-display text-2xl font-semibold">{fatal}</p>
              <Button asChild className="mt-6">
                <Link href="/jeux/quiz">Retour à la bibliothèque</Link>
              </Button>
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              {(status === 'lobby' || status === 'starting') && (
                <motion.section key="lobby" {...view} className="grid flex-1 content-center gap-8 lg:grid-cols-2 lg:gap-16" aria-label="Salle d’attente">
                  <div className="flex flex-col items-center gap-5 text-center">
                    <p className="max-w-xl text-lg text-white/85 2xl:text-3xl">
                      Rendez-vous sur <strong className="font-semibold text-white">{origin ? origin.replace(/^https?:\/\//, '') : 'le site'}/jouer</strong> et saisissez le code, ou scannez le QR code.
                    </p>
                    <div className="rounded-xl bg-white p-3 shadow-lg">{joinUrl ? <QrCodeDisplay url={joinUrl} size={300} /> : <div className="size-[300px]" />}</div>
                    <p className="font-mono text-6xl font-bold tracking-[0.2em] 2xl:text-8xl" aria-label={meta ? `Code ${meta.code.split('').join(' ')}` : undefined}>
                      {meta?.code ?? '······'}
                    </p>
                  </div>

                  <div className="flex flex-col justify-center gap-4">
                    <h1 className="flex items-center gap-3 font-display text-2xl font-semibold text-white 2xl:text-4xl">
                      <Users className="size-6 2xl:size-9" aria-hidden />
                      Joueurs connectés
                      <span className="rounded-full bg-orange-500 px-3 py-0.5 text-lg font-bold text-petrol-950 2xl:text-3xl">{players.length}</span>
                    </h1>
                    {players.length === 0 ? (
                      <p className="rounded-lg border border-white/15 bg-white/10 px-5 py-8 text-center text-lg text-white/85 2xl:text-2xl">En attente des premiers joueurs…</p>
                    ) : (
                      <ul className="grid max-h-[46vh] gap-2 overflow-y-auto sm:grid-cols-2 2xl:max-h-[52vh]">
                        {players.map((p) => (
                          <motion.li key={p.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 rounded-lg border border-white/15 bg-white/10 px-4 py-3">
                            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-500 font-display font-bold text-petrol-950 2xl:size-12 2xl:text-xl">
                              {p.nickname[0]?.toUpperCase()}
                            </span>
                            <span className="min-w-0 truncate text-lg font-medium 2xl:text-2xl">{p.nickname}</span>
                          </motion.li>
                        ))}
                      </ul>
                    )}
                    <Button size="lg" className="mt-2 min-h-14 text-lg 2xl:min-h-20 2xl:text-3xl" disabled={players.length === 0 || status === 'starting' || busy} onClick={() => void run(() => startGame(sessionId))}>
                      <Play aria-hidden />
                      {status === 'starting' ? `Démarrage dans ${countdown.timeLeft}…` : `Lancer la partie (${players.length} joueur${players.length > 1 ? 's' : ''})`}
                    </Button>
                  </div>
                </motion.section>
              )}

              {status === 'question_show' && question && (
                <motion.section key={`show-${question.index}`} {...view} className="m-auto w-full max-w-5xl text-center" aria-label="Question">
                  <p className="mb-5 inline-block rounded-full bg-white/10 px-4 py-1.5 text-base text-white/85 2xl:text-2xl">
                    Question {question.index + 1} sur {question.total}
                  </p>
                  {question.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={question.imageUrl} alt="" className="mx-auto mb-6 max-h-64 rounded-xl object-cover shadow-lg 2xl:max-h-96" />
                  ) : null}
                  <h1 className="font-display text-3xl leading-tight font-semibold text-white sm:text-5xl 2xl:text-7xl">{question.text}</h1>
                  <p className="mt-8 text-lg text-white/75 2xl:text-3xl">Les réponses arrivent…</p>
                </motion.section>
              )}

              {status === 'answering' && question && (
                <motion.section key={`ans-${question.index}`} {...view} className="flex flex-1 flex-col gap-5" aria-label="Question en cours">
                  <TimerBar timeLeft={answering.timeLeft} total={question.timeLimit} className="h-3 2xl:h-4" />
                  <div className="flex flex-wrap items-center justify-center gap-3 2xl:gap-5">
                    <span className="rounded-lg bg-white/10 px-4 py-1.5 text-base text-white/85 2xl:text-2xl">
                      Question {question.index + 1} / {question.total}
                    </span>
                    <span role="timer" aria-label={`${answering.timeLeft} secondes restantes`} className="rounded-lg bg-orange-500 px-5 py-1.5 font-display text-3xl font-bold text-petrol-950 tabular-nums 2xl:text-6xl">
                      {answering.timeLeft} s
                    </span>
                    <span className="rounded-lg bg-white/10 px-4 py-1.5 text-base text-white/85 2xl:text-2xl">
                      {answerCount} / {players.length} réponses
                    </span>
                  </div>
                  <h1 className="mx-auto max-w-6xl text-center font-display text-2xl leading-tight font-semibold text-white sm:text-4xl 2xl:text-6xl">{question.text}</h1>
                  <AnswerGrid answers={question.answers ?? []} />
                  <div className="mx-auto w-full max-w-4xl">
                    <div className="h-3 overflow-hidden rounded-full bg-white/15" aria-hidden>
                      <div className="h-full rounded-full bg-orange-500 transition-[width] duration-500" style={{ width: players.length > 0 ? `${(answerCount / players.length) * 100}%` : '0%' }} />
                    </div>
                    <p className="mt-2 text-center text-base text-white/80 2xl:text-2xl">
                      {answerCount} réponse{answerCount > 1 ? 's' : ''} sur {players.length}
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <Button variant="inverse" onClick={finishQuestion}>
                      <FastForward aria-hidden />
                      Passer
                    </Button>
                  </div>
                </motion.section>
              )}

              {status === 'review' && question && (
                <motion.section key={`rev-${question.index}`} {...view} className="grid flex-1 content-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_32rem]" aria-label="Résultat de la question">
                  <div>
                    <h1 className="mb-1 text-center font-display text-2xl font-semibold text-white sm:text-3xl 2xl:text-5xl">{question.text}</h1>
                    <p className="mb-5 text-center text-base text-white/80 2xl:text-2xl">
                      {stats?.totalAnswered ?? 0} réponse{(stats?.totalAnswered ?? 0) > 1 ? 's' : ''}
                    </p>
                    <AnswerGrid answers={question.answers ?? []} correctIds={correctIds ?? undefined} stats={stats ?? undefined} total={players.length} />
                    <div className="mt-8 flex justify-center">
                      <Button size="lg" className="min-h-14 text-lg 2xl:min-h-20 2xl:px-12 2xl:text-3xl" disabled={busy} onClick={() => void run(() => nextQuestion(sessionId))}>
                        {isLast ? <Trophy aria-hidden /> : null}
                        {isLast ? 'Voir le podium' : 'Question suivante'}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-semibold text-white 2xl:text-4xl">
                      <Trophy className="size-5 2xl:size-8" aria-hidden />
                      Classement
                    </h2>
                    <Leaderboard entries={leaderboard} limit={5} large />
                  </div>
                </motion.section>
              )}

              {status === 'finished' && (
                <motion.section key="end" {...view} className="m-auto w-full max-w-3xl" aria-label="Classement final">
                  <div className="mb-8 text-center">
                    <Trophy className="mx-auto mb-3 size-14 text-orange-400 2xl:size-24" aria-hidden />
                    <h1 className="font-display text-4xl font-semibold text-white 2xl:text-7xl">Partie terminée</h1>
                    <p className="mt-2 text-lg text-white/80 2xl:text-3xl">{meta?.title}</p>
                  </div>
                  {leaderboard.length === 0 ? <p className="text-center text-white/80">Aucun score à afficher.</p> : <Leaderboard entries={leaderboard} large />}
                  <div className="mt-8 flex justify-center">
                    <Button asChild size="lg">
                      <Link href="/jeux/quiz">
                        <ArrowLeft aria-hidden />
                        Retour à la bibliothèque
                      </Link>
                    </Button>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          )}
        </main>
      </div>
    </MotionConfig>
  );
}

/** Réponses de la question : couleur, forme et lettre ; en revue, bonne réponse cerclée et répartition des votes. */
function AnswerGrid({ answers, correctIds, stats, total = 0 }: { answers: PublicAnswer[]; correctIds?: string[]; stats?: QuestionStats; total?: number }) {
  const review = correctIds !== undefined;
  return (
    <ul className="mx-auto grid w-full max-w-6xl gap-3 sm:grid-cols-2 2xl:gap-5">
      {answers.map((a, i) => {
        const st = answerStyle(i);
        const Icon = st.icon;
        const correct = review && correctIds.includes(a.id);
        const count = stats?.answerCounts[a.id] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <li key={a.id} className={cn('rounded-xl p-4 shadow-md 2xl:p-6', st.bg, st.text, review && !correct && 'opacity-55', correct && 'ring-4 ring-white ring-offset-4 ring-offset-petrol-900')}>
            <div className="flex items-center gap-3">
              <Icon className="size-6 shrink-0 2xl:size-10" aria-hidden />
              <span className="min-w-0 flex-1 text-lg leading-snug font-semibold 2xl:text-4xl">
                <span className="sr-only">{`Réponse ${st.letter} : `}</span>
                {a.text}
              </span>
              {correct ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-sm font-bold text-petrol-950 2xl:text-2xl">
                  <Check className="size-4 2xl:size-7" aria-hidden />
                  Bonne réponse
                </span>
              ) : null}
            </div>
            {stats ? (
              <div className="mt-3">
                <div className="h-2.5 overflow-hidden rounded-full bg-black/25 2xl:h-4" aria-hidden>
                  <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-sm font-medium 2xl:text-2xl">
                  {count} réponse{count > 1 ? 's' : ''} ({pct} %)
                </p>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
