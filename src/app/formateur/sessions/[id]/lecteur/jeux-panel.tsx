'use client';

import { Bug, ExternalLink, Gamepad2, HelpCircle, Play, Shuffle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button, buttonClasses } from '@/components/ui/button';
import { Checkbox, Field, Input, Select } from '@/components/ui/form';
import { Dialog, DialogContent } from '@/components/ui/overlays';
import { EmptyState, Notice } from '@/components/ui/primitives';
import { createSession, getSession, listQuizzes, type QuizSummary } from '@/lib/jeux/client-quiz';
import { undercoverApi } from '@/lib/jeux/client-undercover';
import { THEMES } from '@/lib/jeux/words';

import {
  hostPath,
  isResumable,
  launchStorageKey,
  maxPlayersFor,
  parseStoredLaunch,
  pickWordPair,
  quizLaunchProblem,
  wordsProblem,
  type GameKind,
  type StoredLaunch,
} from './jeux-launch';

// Cible tactile de 44 px minimum (le bouton « md » du site en fait 40).
const TOUCH = 'min-h-11';

function readStored(sessionId: string, kind: GameKind): StoredLaunch | null {
  try {
    return parseStoredLaunch(window.localStorage.getItem(launchStorageKey(sessionId, kind)));
  } catch {
    return null;
  }
}
function writeStored(sessionId: string, kind: GameKind, value: StoredLaunch | null) {
  try {
    if (value) window.localStorage.setItem(launchStorageKey(sessionId, kind), JSON.stringify(value));
    else window.localStorage.removeItem(launchStorageKey(sessionId, kind));
  } catch {
    /* stockage indisponible : on ne retient simplement pas la partie */
  }
}

function HostLink({ kind, id, children, primary = true }: { kind: GameKind; id: string; children: string; primary?: boolean }) {
  return (
    <a href={hostPath(kind, id)} target="_blank" rel="noopener" className={buttonClasses({ variant: primary ? 'primary' : 'outline', size: 'md', className: TOUCH })}>
      <ExternalLink aria-hidden />
      {children}
      <span className="sr-only"> (s’ouvre dans un nouvel onglet)</span>
    </a>
  );
}

/** Partie lancée ou reprise : le code à projeter et l'accès à l'écran animateur. */
function Launched({ kind, launch, resumed, onNew }: { kind: GameKind; launch: StoredLaunch; resumed: boolean; onNew: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-petrol-50 p-4" data-testid={`jeu-${kind}-lancee`}>
      <p className="font-semibold text-ink">{resumed ? 'Une partie est déjà en cours pour cette session.' : 'Partie créée.'}</p>
      {launch.label ? <p className="text-sm text-ink-muted">{launch.label}</p> : null}
      <p className="text-sm text-ink-muted">
        Code à communiquer aux participants (page « Rejoindre une partie ») :{' '}
        <strong data-testid={`jeu-${kind}-code`} className="font-display text-2xl tracking-widest text-ink">
          {launch.code || '—'}
        </strong>
      </p>
      <div className="flex flex-wrap gap-2">
        <HostLink kind={kind} id={launch.id}>{resumed ? 'Reprendre la partie' : 'Ouvrir l’écran animateur'}</HostLink>
        <Button variant="outline" className={TOUCH} onClick={onNew}>
          Nouvelle partie
        </Button>
      </div>
    </div>
  );
}

function UndercoverSection({ sessionId }: { sessionId: string }) {
  const [theme, setTheme] = useState(THEMES[0].id);
  const [pair, setPair] = useState(() => pickWordPair(THEMES[0].id));
  const [spy, setSpy] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launch, setLaunch] = useState<StoredLaunch | null>(null);
  const [resumed, setResumed] = useState(false);
  const [checking, setChecking] = useState(true);

  // Une partie mémorisée pour cette session : on vérifie qu'elle existe encore et n'est pas terminée.
  useEffect(() => {
    let off = false;
    const stored = readStored(sessionId, 'undercover');
    Promise.resolve(stored ? undercoverApi.get(stored.id) : null).then((result) => {
      if (off) return;
      if (stored && result?.ok && isResumable(result.data.game.status)) {
        setLaunch({ ...stored, code: result.data.game.code || stored.code });
        setResumed(true);
      } else if (stored && result && !result.ok && result.status !== 0) writeStored(sessionId, 'undercover', null);
      setChecking(false);
    });
    return () => {
      off = true;
    };
  }, [sessionId]);

  const changeTheme = (id: string) => {
    setTheme(id);
    setPair(pickWordPair(id));
  };

  async function create() {
    const problem = wordsProblem(pair.civil, pair.undercover);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    const result = await undercoverApi.create({ civilWord: pair.civil.trim(), undercoverWord: pair.undercover.trim(), includeMisterWhite: spy });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    const created = { id: result.data.gameId, code: result.data.code, label: `Mots : ${pair.civil.trim()} / ${pair.undercover.trim()}` };
    writeStored(sessionId, 'undercover', created);
    setLaunch(created);
    setResumed(false);
  }

  return (
    <section aria-labelledby="jeu-undercover-titre" className="flex flex-col gap-4">
      <h3 id="jeu-undercover-titre" className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
        <Bug className="size-5 text-orange-650" aria-hidden />
        Undercover — Fourmi Caché
      </h3>

      <details className="rounded-md border border-line bg-white p-4" open>
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-ink">
          <HelpCircle className="size-4" aria-hidden />
          Rappel des règles
        </summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[0.9375rem] text-ink">
          <li>Chaque joueur reçoit un mot sur son téléphone. Il faut au moins 3 joueurs.</li>
          <li><strong>Civils</strong> : trouvez la Fourmi parmi vous.</li>
          <li><strong>Fourmi</strong> : son mot est voisin de celui des Civils ; elle reste discrète et cherche à survivre.</li>
          <li><strong>Espion (Mister White)</strong> : pas de mot, actif à partir de 4 joueurs. Il observe, puis s’il est éliminé il tente de deviner le mot des Civils.</li>
          <li>Discussion à tour de rôle, puis vote : le joueur le plus désigné est éliminé.</li>
        </ul>
      </details>

      {checking ? (
        <p className="text-sm text-ink-muted" role="status">Recherche d’une partie en cours…</p>
      ) : launch ? (
        <Launched kind="undercover" launch={launch} resumed={resumed} onNew={() => { setLaunch(null); setResumed(false); }} />
      ) : (
        <div className="flex flex-col gap-3">
          <Field label="Thème">
            {({ id }) => (
              <Select id={id} value={theme} onChange={(e) => changeTheme(e.target.value)} className="h-11">
                {THEMES.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </Select>
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mot des Civils">
              {({ id }) => <Input id={id} className="h-11" value={pair.civil} maxLength={40} onChange={(e) => setPair({ ...pair, civil: e.target.value })} />}
            </Field>
            <Field label="Mot de la Fourmi">
              {({ id }) => <Input id={id} className="h-11" value={pair.undercover} maxLength={40} onChange={(e) => setPair({ ...pair, undercover: e.target.value })} />}
            </Field>
          </div>
          <Checkbox label="Inclure l’Espion (Mister White)" description="Actif seulement à partir de 4 joueurs." checked={spy} onChange={(e) => setSpy(e.target.checked)} />
          {error ? <Notice variant="danger">{error}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            <Button size="md" className={TOUCH} loading={busy} onClick={create}>
              <Play aria-hidden />
              Lancer une partie d’Undercover
            </Button>
            <Button variant="outline" className={TOUCH} onClick={() => setPair(pickWordPair(theme))}>
              <Shuffle aria-hidden />
              Autre paire de mots
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function QuizSection({ sessionId, memberCount }: { sessionId: string; memberCount: number }) {
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [launch, setLaunch] = useState<StoredLaunch | null>(null);
  const [resumed, setResumed] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    const stored = readStored(sessionId, 'quiz');
    const [list, current] = await Promise.all([listQuizzes(), stored ? getSession(stored.id) : Promise.resolve(null)]);
    if (list.ok) setQuizzes(list.data.quizzes);
    else {
      setQuizzes([]);
      setLoadError(list.error);
    }
    if (stored && current) {
      if (current.ok && isResumable(current.data.session.status)) {
        setLaunch({ ...stored, code: current.data.session.code || stored.code });
        setResumed(true);
      } else if (!current.ok && current.status !== 0) writeStored(sessionId, 'quiz', null);
    }
  }, [sessionId]);

  useEffect(() => {
    // Chargement initial depuis l'API (l'état n'est renseigné qu'une fois la réponse reçue).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function start(quiz: QuizSummary) {
    const problem = quizLaunchProblem(quiz.questionCount);
    if (problem) return setError(problem);
    setBusy(quiz.id);
    setError(null);
    const result = await createSession(quiz.id, maxPlayersFor(memberCount));
    setBusy(null);
    if (!result.ok) return setError(result.error);
    const created = { id: result.data.session.id, code: result.data.session.code, label: `Quiz : ${quiz.title}` };
    writeStored(sessionId, 'quiz', created);
    setLaunch(created);
    setResumed(false);
  }

  return (
    <section aria-labelledby="jeu-quiz-titre" className="flex flex-col gap-4">
      <h3 id="jeu-quiz-titre" className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
        <Gamepad2 className="size-5 text-orange-650" aria-hidden />
        Quiz
      </h3>
      {launch ? (
        <Launched kind="quiz" launch={launch} resumed={resumed} onNew={() => { setLaunch(null); setResumed(false); }} />
      ) : quizzes === null ? (
        <p className="text-sm text-ink-muted" role="status">Chargement de vos quiz…</p>
      ) : quizzes.length === 0 ? (
        <EmptyState
          title={loadError ? 'Vos quiz n’ont pas pu être chargés' : 'Vous n’avez pas encore de quiz'}
          description={loadError ?? 'Créez un quiz dans la bibliothèque, puis revenez le lancer ici.'}
          action={
            <a href="/jeux/quiz" target="_blank" rel="noopener" className={buttonClasses({ variant: 'outline', className: TOUCH })}>
              <ExternalLink aria-hidden />
              Créer un quiz
              <span className="sr-only"> (s’ouvre dans un nouvel onglet)</span>
            </a>
          }
          className="py-6"
        />
      ) : (
        <>
          <ul className="divide-y divide-line rounded-md border border-line bg-white">
            {quizzes.map((quiz) => (
              <li key={quiz.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{quiz.title}</p>
                  <p className="text-sm text-ink-muted">{quiz.questionCount} question{quiz.questionCount > 1 ? 's' : ''}</p>
                </div>
                <Button size="md" className={TOUCH} loading={busy === quiz.id} disabled={busy !== null && busy !== quiz.id} onClick={() => start(quiz)} aria-label={`Lancer ce quiz : ${quiz.title}`}>
                  <Play aria-hidden />
                  Lancer ce quiz
                </Button>
              </li>
            ))}
          </ul>
          <a href="/jeux/quiz" target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-1.5 self-start font-medium text-petrol-700 underline underline-offset-4">
            Créer un quiz
            <span className="sr-only"> (s’ouvre dans un nouvel onglet)</span>
          </a>
        </>
      )}
      {error ? <Notice variant="danger">{error}</Notice> : null}
    </section>
  );
}

/**
 * Panneau « Jeux » du lecteur pédagogique : lance un Undercover ou un Quiz sans quitter le lecteur.
 * Dialogue modal (focus piégé, Échap, retour du focus au bouton) ; l'écran animateur s'ouvre dans un nouvel onglet,
 * le lecteur garde donc sa position et ses chronomètres. Aucune règle de jeu ici : appels aux routes /api/jeux existantes.
 */
export function GamesPanel({ sessionId, memberCount, canLaunch, open, onOpenChange }: { sessionId: string; memberCount: number; canLaunch: boolean; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        // Le dialogue n'a pas de déclencheur Radix : on rend le focus au bouton « Jeux » du lecteur.
        if (!next) setTimeout(() => document.getElementById('lecteur-jeux-bouton')?.focus(), 50);
      }}
    >
      <DialogContent title="Lancer une activité" description="La partie se crée pour cette session ; l’écran animateur s’ouvre dans un nouvel onglet et le lecteur reste en place." size="lg">
        {canLaunch ? (
          <div className="flex flex-col gap-8">
            <UndercoverSection sessionId={sessionId} />
            <QuizSection sessionId={sessionId} memberCount={memberCount} />
          </div>
        ) : (
          <Notice variant="warning">Votre compte n’a pas la permission d’animer des jeux. Demandez-la à l’administrateur.</Notice>
        )}
      </DialogContent>
    </Dialog>
  );
}
