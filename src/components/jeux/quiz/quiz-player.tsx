'use client';

import { Check, Hourglass, Trophy, X } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { loginUrl } from '@/lib/jeux/client-http';
import {
  getGameState,
  getSession,
  joinGame,
  submitAnswer,
  type AnswerResultEvent,
  type GameStateResponse,
  type LeaderboardEntry,
  type LobbyPlayer,
  type PublicAnswer,
  type PublicQuestion,
} from '@/lib/jeux/client-quiz';
import { cn } from '@/lib/utils';

import { Announcer } from './announcer';
import { answerStyle } from './answer-style';
import { Leaderboard } from './leaderboard';
import { TimerBar } from './timer-bar';
import { useDeadlineTimer } from './use-deadline-timer';
import { useQuizChannel } from './use-quiz-channel';

type Phase = 'lobby' | 'starting' | 'question_show' | 'answering' | 'answered' | 'review' | 'finished' | 'closed';

/**
 * Relecture régulière de l'état : c'est elle qui fait fonctionner l'écran (la pile locale n'a pas de temps réel) ;
 * le canal temps réel ne sert qu'à accélérer les changements quand il est disponible.
 */
const POLL_MS = 2000;

const view = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const },
};

/** Lobby puis jeu côté joueur (participant connecté, ou animateur en essai) : conçu pour un téléphone de 360 px de large. */
export function QuizPlayer({ sessionId, playerId, trial }: { sessionId: string; playerId: string; trial: boolean }) {
  const [phase, setPhase] = useState<Phase>('lobby');
  const [meta, setMeta] = useState<{ code: string; title: string } | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [answers, setAnswers] = useState<PublicAnswer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [correctIds, setCorrectIds] = useState<string[]>([]);
  const [result, setResult] = useState<AnswerResultEvent | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [announce, setAnnounce] = useState('Vous êtes dans la salle d’attente.');
  const [error, setError] = useState<string | null>(null);

  const countdown = useDeadlineTimer();
  const timer = useDeadlineTimer();
  const joined = useRef(false);
  const phaseRef = useRef<Phase>('lobby');
  const questionRef = useRef<PublicQuestion | null>(null);

  const go = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  // Nom et informations de la partie.
  useEffect(() => {
    let cancelled = false;
    getSession(sessionId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setError(res.status === 404 ? 'Cette partie n’existe pas ou est terminée.' : res.error);
        go('closed');
        return;
      }
      setMeta({ code: res.data.session.code, title: res.data.quiz?.title ?? 'Quiz' });
      if (res.data.session.status === 'finished') {
        setError('Cette partie est terminée.');
        go('closed');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, go]);

  // Inscription dans la salle (une seule fois).
  useEffect(() => {
    if (joined.current) return;
    joined.current = true;
    void joinGame(sessionId, playerId).then((res) => {
      // 409 : la partie a déjà commencé ou le joueur est déjà inscrit (rechargement) : on resynchronise ensuite.
      if (res.ok || res.status === 409) return;
      setError(res.error);
      // Compte non connecté, d'un autre rôle ou non inscrit à cette partie : l'écran de jeu n'a plus de sens.
      if (res.status === 401 || res.status === 403) go('closed');
    });
  }, [sessionId, playerId, go]);

  const openAnswers = useCallback(
    (q: PublicQuestion, list: PublicAnswer[], seconds: number) => {
      questionRef.current = q;
      setQuestion(q);
      setAnswers(list);
      go('answering');
      timer.start(seconds);
      setAnnounce(`Réponses ouvertes : ${seconds} secondes. Choisissez une réponse.`);
    },
    [go, timer],
  );

  /** Aligne l'écran sur l'état du serveur (arrivée tardive, événement manqué). */
  const reconcile = useCallback(
    async (s: GameStateResponse) => {
      const current = phaseRef.current;
      if (current === 'closed') return;
      setPlayers(s.players);
      if (s.status === 'lobby') return;
      if (s.status === 'starting') {
        if (current !== 'starting') {
          go('starting');
          countdown.start(3);
          setAnnounce('La partie commence dans quelques secondes. Préparez-vous.');
        }
        return;
      }
      if (s.status === 'question_show' && s.question && (current !== 'question_show' || questionRef.current?.index !== s.question.index)) {
        questionRef.current = s.question;
        setQuestion(s.question);
        setAnswers([]);
        setSelectedId(null);
        setCorrectIds([]);
        setResult(null);
        timer.stop();
        go('question_show');
        setAnnounce(`Question ${s.question.index + 1} sur ${s.question.total} : ${s.question.text}`);
      } else if (s.status === 'answering' && s.question && (current === 'lobby' || current === 'starting' || current === 'question_show' || current === 'review' || questionRef.current?.index !== s.question.index)) {
        const elapsed = Date.now() - (s.questionStartTime ?? Date.now());
        const remaining = Math.max(0, Math.ceil((s.question.timeLimit * 1000 - elapsed) / 1000));
        if (questionRef.current?.index !== s.question.index) {
          setSelectedId(null);
          setResult(null);
          setCorrectIds([]);
        }
        openAnswers(s.question, s.answers ?? [], remaining);
      } else if ((s.status === 'review' || s.status === 'finished') && current !== 'review' && current !== 'finished') {
        // Résultats manqués (événement perdu, arrivée tardive) : classement et corrections viennent de l'état.
        timer.stop();
        setCorrectIds(s.correctAnswerIds ?? []);
        setLeaderboard((s.status === 'finished' ? s.finalScores : s.leaderboard) ?? s.leaderboard ?? []);
        go(s.status === 'finished' ? 'finished' : 'review');
        setAnnounce(s.status === 'finished' ? 'Partie terminée.' : 'Fin de la question.');
      } else if (s.status === 'finished' && current === 'review') {
        setLeaderboard(s.finalScores ?? s.leaderboard ?? []);
        go('finished');
        setAnnounce('Partie terminée. Voici le classement final.');
      }
    },
    [go, openAnswers, countdown, timer],
  );

  const syncNow = useCallback(async () => {
    const res = await getGameState(sessionId);
    if (res.ok) await reconcile(res.data);
    else if (res.status === 404 && phaseRef.current !== 'finished') {
      setError('Cette partie n’existe plus.');
      go('closed');
    }
  }, [sessionId, reconcile, go]);

  useEffect(() => {
    const t = setInterval(() => void syncNow(), POLL_MS);
    return () => clearInterval(t);
  }, [syncNow]);

  useQuizChannel(
    sessionId,
    {
      onReady: () => void syncNow(),
      'lobby:updated': ({ players: list }) => setPlayers(list),
      'game:starting': ({ countdown: n }) => {
        go('starting');
        countdown.start(n);
        setAnnounce(`La partie commence dans ${n} secondes. Préparez-vous.`);
      },
      'question:show': (q) => {
        questionRef.current = q;
        setQuestion(q);
        setAnswers([]);
        setSelectedId(null);
        setCorrectIds([]);
        setResult(null);
        timer.stop();
        go('question_show');
        setAnnounce(`Question ${q.index + 1} sur ${q.total} : ${q.text}`);
      },
      'question:answers': ({ answers: list, remainingTime }) => {
        const q = questionRef.current;
        openAnswers(q ?? { id: '', text: '', type: 'multiple_choice', timeLimit: remainingTime ?? 20, index: 0, total: 0 }, list, remainingTime ?? q?.timeLimit ?? 20);
      },
      'answer:result': (r) => {
        setResult(r);
        timer.stop();
        if (phaseRef.current === 'answering') go('answered');
      },
      'question:ended': (p) => {
        timer.stop();
        setCorrectIds(p.correctAnswerIds);
        setLeaderboard(p.leaderboard);
        go('review');
        setAnnounce('Fin de la question.');
      },
      'game:ended': (p) => {
        timer.stop();
        setLeaderboard(p.finalScores);
        go('finished');
        setAnnounce('Partie terminée. Voici le classement final.');
      },
    },
    playerId,
  );

  async function choose(answerId: string) {
    if (phase !== 'answering' || selectedId) return;
    setSelectedId(answerId);
    timer.stop();
    const res = await submitAnswer(sessionId, playerId, answerId);
    if (res.ok) {
      setResult({ isCorrect: res.data.isCorrect, points: res.data.points, totalScore: res.data.totalScore });
      if (phaseRef.current === 'answering') go('answered');
      setAnnounce('Réponse enregistrée. En attente des autres joueurs.');
    } else if (res.status === 409) {
      // Déjà répondu, ou question close : l'état réel arrivera par le canal.
      if (phaseRef.current === 'answering') go('answered');
    } else {
      setSelectedId(null);
      if (res.status === 401) window.location.assign(loginUrl(`/jouer/quiz/${sessionId}?playerId=${encodeURIComponent(playerId)}`));
      setError(res.error);
      setAnnounce(`Réponse non envoyée : ${res.error}`);
    }
  }

  const me = leaderboard.find((p) => p.id === playerId);
  const correctTexts = answers.filter((a) => correctIds.includes(a.id)).map((a) => a.text);
  const displayName = players.find((p) => p.id === playerId)?.nickname || 'Joueur';

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh flex-col bg-petrol-900 text-white">
        <Announcer message={announce} />
        <header className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="min-w-0 truncate font-display text-base font-semibold">{meta?.title ?? 'Quiz en direct'}</p>
          {meta ? (
            <span className="shrink-0 rounded-md bg-white/10 px-2.5 py-1 font-mono text-sm font-semibold tracking-[0.2em]">
              <span className="sr-only">Code : </span>
              {meta.code}
            </span>
          ) : null}
        </header>

        {trial ? (
          <p className="mx-4 mb-2 rounded-md border border-orange-300/50 bg-orange-500/15 px-3 py-2 text-center text-sm font-medium text-orange-100">
            Partie d’essai : aucun résultat n’est enregistré.
          </p>
        ) : null}

        {error && phase !== 'closed' ? (
          <p role="alert" className="mx-4 mb-2 rounded-md border border-orange-300/50 bg-orange-500/15 px-3 py-2 text-sm">
            {error}
          </p>
        ) : null}

        <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-6">
          <AnimatePresence mode="wait" initial={false}>
            {phase === 'lobby' && (
              <motion.section key="lobby" {...view} className="m-auto w-full space-y-5 text-center" aria-label="Salle d’attente">
                <span aria-hidden className="mx-auto flex size-20 items-center justify-center rounded-full bg-orange-500 font-display text-3xl font-bold text-petrol-950">
                  {displayName[0]?.toUpperCase()}
                </span>
                <div>
                  <h1 className="font-display text-2xl font-semibold text-white">{displayName}</h1>
                  <p className="mt-1 text-white/85">Vous êtes dans la salle d’attente.</p>
                </div>
                <div className="rounded-xl border border-white/15 bg-white/10 p-4 text-left">
                  <h2 className="mb-3 flex items-center justify-between font-display text-base font-semibold text-white">
                    Joueurs
                    <span className="rounded-full bg-orange-500 px-2.5 py-0.5 text-sm font-bold text-petrol-950">{players.length}</span>
                  </h2>
                  {players.length === 0 ? (
                    <p className="text-sm text-white/80">En attente d’autres joueurs…</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {players.map((p) => (
                        <li key={p.id} className={cn('rounded-full px-3 py-1 text-sm font-medium', p.id === playerId ? 'bg-orange-500 text-petrol-950' : 'bg-white/15 text-white')}>
                          {p.nickname}
                          {p.id === playerId ? ' (vous)' : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="flex items-center justify-center gap-2 text-sm text-white/85">
                  <Hourglass className="size-4" aria-hidden />
                  En attente de l’animateur. La partie démarrera bientôt.
                </p>
              </motion.section>
            )}

            {phase === 'starting' && (
              <motion.section key="starting" {...view} className="m-auto text-center" aria-label="Départ de la partie">
                <p className="font-display text-9xl font-bold tabular-nums text-white" aria-hidden>
                  {Math.max(countdown.timeLeft, 0)}
                </p>
                <p className="mt-2 text-lg text-white/85">La partie commence. Préparez-vous !</p>
              </motion.section>
            )}

            {phase === 'question_show' && question && (
              <motion.section key={`show-${question.index}`} {...view} className="m-auto w-full text-center" aria-label="Question">
                <p className="mb-4 inline-block rounded-full bg-white/10 px-3 py-1 text-sm text-white/85">
                  Question {question.index + 1} sur {question.total}
                </p>
                {question.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={question.imageUrl} alt="" className="mx-auto mb-4 max-h-40 rounded-xl object-cover" />
                ) : null}
                <h1 className="font-display text-2xl leading-tight font-semibold text-white">{question.text}</h1>
                <p className="mt-6 text-sm text-orange-300">Les réponses arrivent…</p>
              </motion.section>
            )}

            {phase === 'answering' && question && (
              <motion.section key={`ans-${question.index}`} {...view} className="flex flex-1 flex-col gap-3" aria-label="Question en cours">
                <TimerBar timeLeft={timer.timeLeft} total={question.timeLimit} />
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-white/10 px-3 py-1 text-sm text-white/85">
                    {question.index + 1} / {question.total}
                  </span>
                  <span role="timer" aria-label={`${timer.timeLeft} secondes restantes`} className={cn('rounded-lg px-4 py-1 font-display text-xl font-bold tabular-nums', timer.timeLeft <= 5 ? 'bg-danger text-white' : 'bg-orange-500 text-petrol-950')}>
                    {timer.timeLeft}
                  </span>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  {question.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={question.imageUrl} alt="" className="mx-auto mb-2 max-h-28 rounded-lg object-cover" />
                  ) : null}
                  <h1 className="text-center font-display text-lg leading-snug font-semibold text-white">{question.text}</h1>
                </div>
                <div role="group" aria-label="Réponses" className={cn('grid flex-1 gap-3', answers.length <= 2 ? 'grid-cols-1' : 'grid-cols-2')} style={{ gridAutoRows: 'minmax(5.5rem, 1fr)' }}>
                  {answers.map((a, i) => {
                    const st = answerStyle(i);
                    const Icon = st.icon;
                    const chosen = selectedId === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => void choose(a.id)}
                        disabled={selectedId !== null}
                        aria-label={`Réponse ${st.letter} : ${a.text}`}
                        aria-pressed={chosen}
                        className={cn(
                          'flex min-h-11 flex-col items-center justify-center gap-1.5 rounded-xl p-3 text-center shadow-md transition-[transform,opacity,filter] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100',
                          st.bg,
                          st.text,
                          selectedId && !chosen && 'opacity-40',
                          chosen && 'ring-4 ring-white',
                          !selectedId && 'hover:brightness-110',
                        )}
                      >
                        <Icon className="size-5" aria-hidden />
                        <span aria-hidden className="text-[0.9375rem] leading-tight font-semibold break-words">
                          {a.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.section>
            )}

            {phase === 'answered' && (
              <motion.section key="answered" {...view} className="m-auto text-center" aria-label="Réponse enregistrée">
                <span className="mx-auto mb-5 flex size-24 items-center justify-center rounded-full bg-white/10">
                  <Check className="size-10 text-orange-300" aria-hidden />
                </span>
                <h1 className="font-display text-2xl font-semibold text-white">Réponse enregistrée</h1>
                <p className="mt-1 text-white/80">En attente des autres joueurs…</p>
              </motion.section>
            )}

            {phase === 'review' && (
              <motion.section key={`rev-${question?.index ?? 0}`} {...view} className="m-auto w-full space-y-4" aria-label="Résultat de la question">
                {result ? (
                  <div className={cn('rounded-xl border p-4 text-center', result.isCorrect ? 'border-success/60 bg-success/25' : 'border-danger/60 bg-danger/25')}>
                    <span className="mx-auto mb-1 flex size-10 items-center justify-center rounded-full bg-white/15">
                      {result.isCorrect ? <Check className="size-6" aria-hidden /> : <X className="size-6" aria-hidden />}
                    </span>
                    <h1 className="font-display text-xl font-semibold text-white">{result.isCorrect ? 'Bonne réponse !' : 'Mauvaise réponse'}</h1>
                    {result.isCorrect ? <p className="font-display text-3xl font-bold text-orange-300">+{result.points} pts</p> : null}
                  </div>
                ) : (
                  <h1 className="text-center font-display text-xl font-semibold text-white">Fin de la question</h1>
                )}
                {correctTexts.length > 0 ? (
                  <p className="text-center text-sm text-white/85">
                    {correctTexts.length > 1 ? 'Bonnes réponses' : 'Bonne réponse'} : <strong className="font-semibold text-white">{correctTexts.join(' · ')}</strong>
                  </p>
                ) : null}
                {me ? (
                  <div className="rounded-xl bg-white/10 p-4 text-center">
                    <p className="text-sm text-white/80">Votre classement</p>
                    <p className="font-display text-4xl font-bold">
                      <span className="sr-only">Rang </span>#{me.rank}
                    </p>
                    <p className="font-display text-lg font-semibold text-orange-300">{me.score} pts</p>
                  </div>
                ) : null}
                <div>
                  <h2 className="mb-2 flex items-center gap-2 font-display text-base font-semibold text-white">
                    <Trophy className="size-4" aria-hidden />
                    Meilleurs scores
                  </h2>
                  <Leaderboard entries={leaderboard} limit={5} highlightId={playerId} />
                </div>
                <p className="text-center text-sm text-white/75">Prochaine question bientôt…</p>
              </motion.section>
            )}

            {phase === 'finished' && (
              <motion.section key="finished" {...view} className="m-auto w-full space-y-5" aria-label="Classement final">
                <div className="text-center">
                  <Trophy className="mx-auto mb-2 size-12 text-orange-400" aria-hidden />
                  <h1 className="font-display text-3xl font-semibold text-white">Partie terminée</h1>
                  <p className="text-white/80">Merci d’avoir joué.</p>
                </div>
                {me ? (
                  <div className="rounded-xl bg-white/10 p-5 text-center">
                    <p className="text-sm text-white/80">Votre position finale</p>
                    <p className="font-display text-5xl font-bold">
                      <span className="sr-only">Rang </span>#{me.rank}
                    </p>
                    <p className="font-display text-2xl font-semibold text-orange-300">{me.score} pts</p>
                  </div>
                ) : null}
                <div>
                  <h2 className="mb-2 font-display text-base font-semibold text-white">Classement final</h2>
                  <Leaderboard entries={leaderboard} highlightId={playerId} />
                </div>
                <Button asChild size="lg" className="w-full">
                  <Link href="/jouer">Rejoindre une autre partie</Link>
                </Button>
              </motion.section>
            )}

            {phase === 'closed' && (
              <motion.section key="closed" {...view} className="m-auto w-full space-y-5 text-center" role="alert">
                <h1 className="font-display text-2xl font-semibold text-white">{error ?? 'Cette partie n’est plus disponible.'}</h1>
                <Button asChild size="lg" className="w-full">
                  <Link href="/jouer">Saisir un autre code</Link>
                </Button>
              </motion.section>
            )}
          </AnimatePresence>
        </main>
      </div>
    </MotionConfig>
  );
}
