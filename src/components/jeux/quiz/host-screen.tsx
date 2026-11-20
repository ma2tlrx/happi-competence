'use client';

import { ArrowLeft, Check, FastForward, Play, Trophy, Users } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import {
  endQuestion,
  getGameState,
  getQuiz,
  getSession,
  nextQuestion,
  revealAnswers,
  showQuestion,
  startGame,
  type GameStateResponse,
  type GameStatus,
  type PublicAnswer,
  type PublicQuestion,
  type QuestionStats,
} from '@/lib/jeux/client-quiz';
import { cn } from '@/lib/utils';

import { Announcer } from './announcer';
import { answerStyle } from './answer-style';
import { Leaderboard } from './leaderboard';
import { JoinQr } from '@/components/jeux/shared/join-qr';
import { TimerBar } from './timer-bar';
import { useDeadlineTimer } from './use-deadline-timer';
import { useQuizChannel } from './use-quiz-channel';
import { usePolledResource } from '@/components/jeux/shared/use-polled-resource';

/** Délais du déroulé d'origine : décompte de départ, lecture de la question avant les réponses. */
const START_DELAY_MS = 3500;
const READ_DELAY_MS = 3000;
const POLL_MS = 2000;

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
  const [meta, setMeta] = useState<{ code: string; title: string; quizId: string } | null>(null);
  const [answerCache, setAnswerCache] = useState<{ index: number; answers: PublicAnswer[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState('');

  // L'état du serveur fait foi : relu toutes les 2 s (la pile locale n'a pas de temps réel) et à chaque action.
  const { data: state, error: pollError, refresh } = usePolledResource<GameStateResponse>(() => getGameState(sessionId), POLL_MS);
  const countdown = useDeadlineTimer();
  const answering = useDeadlineTimer();
  const { start: startCountdown } = countdown;
  const { start: startAnswering, stop: stopAnswering } = answering;

  useEffect(() => {
    // Adresse du site connue seulement dans le navigateur.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSession(sessionId).then((res) => {
      if (cancelled) return;
      if (res.ok) setMeta({ code: res.data.session.code, title: res.data.quiz?.title ?? 'Quiz', quizId: res.data.session.quizId });
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // ── lecture de l'état ──
  const status: GameStatus = state?.status ?? 'lobby';
  const players = state?.players ?? [];
  const answerCount = state?.answerCount ?? 0;
  const correctIds = status === 'review' ? (state?.correctAnswerIds ?? []) : null;
  const stats = status === 'review' ? state?.stats : null;
  const leaderboard = (status === 'finished' ? (state?.finalScores ?? state?.leaderboard) : state?.leaderboard) ?? [];
  const questionIndex = state?.question?.index ?? null;
  const questionStart = state?.questionStartTime ?? null;
  const timeLimit = state?.question?.timeLimit ?? 20;

  // Les réponses ne sont envoyées que pendant `answering` : on les garde pour l'écran de correction.
  if (state?.answers && state.question && answerCache?.index !== state.question.index) {
    setAnswerCache({ index: state.question.index, answers: state.answers });
  }
  const question: HostQuestion | null = state?.question
    ? { ...state.question, answers: state.answers ?? (answerCache?.index === state.question.index ? answerCache.answers : undefined) }
    : null;
  const quizId = meta?.quizId;
  const needAnswers = status === 'review' && questionIndex !== null && answerCache?.index !== questionIndex;

  // Reprise après rechargement pendant la correction : les réponses se relisent dans le quiz de l'animateur.
  useEffect(() => {
    if (!needAnswers || !quizId || questionIndex === null) return;
    let cancelled = false;
    getQuiz(quizId).then((res) => {
      if (cancelled || !res.ok) return;
      const found = [...res.data.questions].sort((x, y) => x.order - y.order)[questionIndex];
      if (found) setAnswerCache({ index: questionIndex, answers: found.answers.map((answer) => ({ id: answer.id, text: answer.text })) });
    });
    return () => {
      cancelled = true;
    };
  }, [needAnswers, quizId, questionIndex]);

  const finishQuestion = useCallback(() => {
    // 409 attendu si tous les joueurs ont déjà répondu (le serveur a clos la question) : on l'ignore.
    void endQuestion(sessionId).then(() => refresh());
  }, [sessionId, refresh]);

  // ── déroulé piloté depuis l'état (décompte, lecture de l'énoncé, chronomètre) ──
  useEffect(() => {
    if (status !== 'starting') return;
    startCountdown(START_DELAY_MS / 1000);
    const timer = setTimeout(() => void showQuestion(sessionId, 0).then(() => refresh()), START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [status, sessionId, refresh, startCountdown]);

  useEffect(() => {
    if (status !== 'question_show' || questionIndex === null) return;
    const timer = setTimeout(() => void revealAnswers(sessionId).then(() => refresh()), READ_DELAY_MS);
    return () => clearTimeout(timer);
  }, [status, questionIndex, sessionId, refresh]);

  useEffect(() => {
    if (status !== 'answering' || !questionStart) {
      stopAnswering();
      return;
    }
    startAnswering((questionStart + timeLimit * 1000 - Date.now()) / 1000, finishQuestion);
  }, [status, questionIndex, questionStart, timeLimit, finishQuestion, startAnswering, stopAnswering]);

  // ── annonces vocales (dérivées de l'étape de la partie) ──
  const announce = (() => {
    if (status === 'lobby') return `${players.length} joueur${players.length > 1 ? 's' : ''} connecté${players.length > 1 ? 's' : ''}.`;
    if (status === 'starting') return 'La partie démarre dans quelques secondes.';
    if (status === 'question_show' && questionIndex !== null) return `Question ${questionIndex + 1} sur ${state?.totalQuestions ?? ''} : ${question?.text ?? ''}`;
    if (status === 'answering') return `Réponses ouvertes : ${timeLimit} secondes.`;
    if (status === 'review') return 'Fin de la question.';
    return 'Partie terminée. Le classement final est affiché.';
  })();

  // ── temps réel facultatif : ne sert qu'à relire l'état plus vite ──
  useQuizChannel(sessionId, {
    onReady: () => void refresh(),
    'lobby:updated': () => void refresh(),
    'answer:received': () => void refresh(),
    'question:ended': () => void refresh(),
    'game:ended': () => void refresh(),
  });

  const fatal = pollError && !state ? (pollError.status === 404 ? 'Cette partie est terminée ou n’existe plus.' : pollError.message) : null;

  const run = useCallback(
    async (call: () => Promise<{ ok: boolean; error?: string }>) => {
      setBusy(true);
      const res = await call();
      if (!res.ok) toast.error(res.error ?? 'Action impossible.');
      await refresh();
      setBusy(false);
    },
    [refresh],
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
                    <div className="rounded-xl shadow-lg">{joinUrl ? <JoinQr url={joinUrl} size={300} /> : <div className="size-[300px]" />}</div>
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
