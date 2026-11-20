'use client';

import { ChevronDown, CircleCheck, CirclePlay, ClipboardList, Hourglass, Pencil, Play, Plus, Trash2, Trophy, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Dialog, DialogContent, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { Badge, Card, CardBody, EmptyState, Notice, PageHeader, Skeleton, StatTile } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';
import {
  cancelSession,
  createQuiz,
  createSession,
  deleteQuiz,
  getSession,
  listQuizzes,
  listSessions,
  type QuizSummary,
  type SessionPlayer,
  type SessionStatus,
  type SessionWithQuiz,
} from '@/lib/jeux/client-quiz';
import { formatDate } from '@/lib/utils';

import { ConfirmDialog } from './confirm-dialog';

const STATUS_LABEL: Record<SessionStatus, { label: string; variant: 'orange' | 'petrol' | 'neutral' }> = {
  waiting: { label: 'En attente de joueurs', variant: 'petrol' },
  active: { label: 'En cours', variant: 'orange' },
  finished: { label: 'Terminée', variant: 'neutral' },
};

/** Bibliothèque de quiz et historique des parties (formateur / administrateur). */
export function QuizLibrary() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [sessions, setSessions] = useState<SessionWithQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [q, s] = await Promise.all([listQuizzes(), listSessions()]);
    if (!q.ok) setError(q.error);
    else if (!s.ok) setError(s.error);
    else {
      setError(null);
      setQuizzes(q.data.quizzes);
      setSessions(s.data.sessions);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Chargement initial : les données viennent du réseau, pas d'un état dérivé.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // ── création ──
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return setTitleError('Donnez un titre au quiz.');
    setCreating(true);
    const res = await createQuiz({ title: newTitle.trim(), description: newDesc.trim() });
    setCreating(false);
    if (!res.ok) return toast.error(res.error);
    router.push(`/jeux/quiz/${res.data.quiz.id}`);
  }

  // ── lancement ──
  const [launching, setLaunching] = useState<QuizSummary | null>(null);
  const [maxPlayers, setMaxPlayers] = useState('10');
  const [launchBusy, setLaunchBusy] = useState(false);

  async function submitLaunch(e: React.FormEvent) {
    e.preventDefault();
    if (!launching) return;
    const n = Math.min(50, Math.max(2, Number.parseInt(maxPlayers, 10) || 10));
    setLaunchBusy(true);
    const res = await createSession(launching.id, n);
    setLaunchBusy(false);
    if (!res.ok) return toast.error(res.error);
    router.push(`/jeux/quiz/partie/${res.data.session.id}`);
  }

  // ── suppression / annulation ──
  const [toDelete, setToDelete] = useState<QuizSummary | null>(null);
  const [toCancel, setToCancel] = useState<SessionWithQuiz | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    const res = await deleteQuiz(toDelete.id);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    setQuizzes((prev) => prev.filter((q) => q.id !== toDelete.id));
    setToDelete(null);
    toast.success('Quiz supprimé.');
  }

  async function confirmCancel() {
    if (!toCancel) return;
    setBusy(true);
    const res = await cancelSession(toCancel.id);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    setSessions((prev) => prev.map((s) => (s.id === toCancel.id ? { ...s, status: 'finished' } : s)));
    setToCancel(null);
    toast.success('Partie annulée.');
  }

  // ── classement d'une partie ──
  const [expanded, setExpanded] = useState<string | null>(null);
  const [players, setPlayers] = useState<Record<string, SessionPlayer[]>>({});
  const [loadingPlayers, setLoadingPlayers] = useState<string | null>(null);

  async function toggleLeaderboard(id: string) {
    if (expanded === id) return setExpanded(null);
    setExpanded(id);
    if (players[id]) return;
    setLoadingPlayers(id);
    const res = await getSession(id);
    setLoadingPlayers(null);
    if (!res.ok) return toast.error(res.error);
    setPlayers((prev) => ({ ...prev, [id]: [...res.data.players].sort((a, b) => b.score - a.score) }));
  }

  const count = (s: SessionStatus) => sessions.filter((x) => x.status === s).length;

  return (
    <>
      <PageHeader
        title="Quiz en direct"
        description="Créez vos quiz, lancez une partie et laissez les participants jouer depuis leur téléphone, avec un code ou un QR code."
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <Plus aria-hidden />
            Nouveau quiz
          </Button>
        }
      />

      {error ? <Notice variant="danger" title="Chargement impossible" className="mb-6">{error}</Notice> : null}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Quiz créés" value={loading ? '–' : quizzes.length} icon={ClipboardList} />
        <StatTile label="Parties terminées" value={loading ? '–' : count('finished')} icon={CircleCheck} />
        <StatTile label="En attente" value={loading ? '–' : count('waiting')} icon={Hourglass} />
        <StatTile label="En cours" value={loading ? '–' : count('active')} icon={CirclePlay} />
      </div>

      <Tabs defaultValue="quiz">
        <TabsList aria-label="Quiz et parties">
          <TabsTrigger value="quiz">Mes quiz</TabsTrigger>
          <TabsTrigger value="parties">Parties</TabsTrigger>
        </TabsList>

        <TabsContent value="quiz">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-44" />
              ))}
            </div>
          ) : quizzes.length === 0 ? (
            <Card>
              <EmptyState
                icon={ClipboardList}
                title="Aucun quiz pour le moment"
                description="Créez votre premier quiz : des questions à choix multiples, vrai ou faux, avec un temps limité."
                action={
                  <Button onClick={() => setNewOpen(true)}>
                    <Plus aria-hidden />
                    Créer un quiz
                  </Button>
                }
              />
            </Card>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {quizzes.map((quiz) => (
                <li key={quiz.id}>
                  <Card className="flex h-full flex-col overflow-hidden">
                    <div className="h-1.5 shrink-0" style={{ background: quiz.themeColor }} aria-hidden />
                    <CardBody className="flex flex-1 flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base leading-snug font-semibold">{quiz.title}</h3>
                        <Badge variant="neutral" className="shrink-0">
                          {quiz.questionCount} question{quiz.questionCount > 1 ? 's' : ''}
                        </Badge>
                      </div>
                      {quiz.description ? <p className="line-clamp-2 text-sm text-ink-muted">{quiz.description}</p> : null}
                      <p className="text-xs text-ink-subtle">Modifié le {formatDate(quiz.updatedAt)}</p>
                      <div className="mt-auto flex flex-wrap gap-2 pt-1">
                        <Button asChild variant="outline" className="flex-1">
                          <Link href={`/jeux/quiz/${quiz.id}`}>
                            <Pencil aria-hidden />
                            Éditer
                            <span className="sr-only"> {quiz.title}</span>
                          </Link>
                        </Button>
                        <Button
                          className="flex-1"
                          disabled={quiz.questionCount === 0}
                          onClick={() => {
                            setMaxPlayers('10');
                            setLaunching(quiz);
                          }}
                          aria-label={`Lancer une partie : ${quiz.title}`}
                        >
                          <Play aria-hidden />
                          Lancer
                        </Button>
                        <Button variant="danger-outline" size="icon" onClick={() => setToDelete(quiz)} aria-label={`Supprimer le quiz ${quiz.title}`}>
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                      {quiz.questionCount === 0 ? (
                        <p className="text-xs text-ink-subtle">Ajoutez au moins une question pour pouvoir lancer ce quiz.</p>
                      ) : null}
                    </CardBody>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="parties">
          {loading ? (
            <Skeleton className="h-40" />
          ) : sessions.length === 0 ? (
            <Card>
              <EmptyState icon={Trophy} title="Aucune partie pour le moment" description="Lancez un quiz depuis l’onglet « Mes quiz » pour ouvrir une partie." />
            </Card>
          ) : (
            <ul className="space-y-3">
              {sessions.map((s) => {
                const st = STATUS_LABEL[s.status];
                const open = expanded === s.id;
                return (
                  <li key={s.id}>
                    <Card>
                      <CardBody className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
                        <div className="min-w-0 flex-1 basis-56">
                          <p className="truncate font-semibold">{s.quiz?.title ?? 'Quiz supprimé'}</p>
                          <p className="mt-0.5 text-sm text-ink-muted">
                            Code <span className="font-mono font-semibold tracking-widest text-ink">{s.code}</span> · {formatDate(s.createdAt)}
                          </p>
                        </div>
                        <Badge variant={st.variant}>{st.label}</Badge>
                        <div className="flex flex-wrap items-center gap-2">
                          {s.status !== 'finished' ? (
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/jeux/quiz/partie/${s.id}`}>{s.status === 'waiting' ? 'Ouvrir la salle' : 'Reprendre'}</Link>
                            </Button>
                          ) : null}
                          {s.status === 'waiting' ? (
                            <Button variant="danger-outline" size="sm" onClick={() => setToCancel(s)}>
                              <X aria-hidden />
                              Annuler
                            </Button>
                          ) : null}
                          {s.status === 'finished' ? (
                            <Button variant="ghost" size="sm" onClick={() => toggleLeaderboard(s.id)} aria-expanded={open}>
                              Classement
                              <ChevronDown className={open ? 'rotate-180' : ''} aria-hidden />
                            </Button>
                          ) : null}
                        </div>
                      </CardBody>
                      {open ? (
                        <div className="border-t border-line px-5 py-4 sm:px-6">
                          {loadingPlayers === s.id ? (
                            <Skeleton className="h-16" />
                          ) : (players[s.id] ?? []).length === 0 ? (
                            <p className="text-sm text-ink-muted">Aucun joueur n’a participé à cette partie.</p>
                          ) : (
                            <ol className="grid gap-1.5 sm:grid-cols-2">
                              {players[s.id].map((p, i) => (
                                <li key={p.id} className="flex items-center gap-3 rounded-md bg-paper px-3 py-2 text-sm">
                                  <span className="w-6 font-display font-semibold text-ink-muted">{i + 1}.</span>
                                  <span className="min-w-0 flex-1 truncate font-medium">{p.nickname}</span>
                                  <span className="font-display font-semibold tabular-nums">{p.score} pts</span>
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      ) : null}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {/* Nouveau quiz */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent title="Nouveau quiz" description="Vous ajouterez les questions à l’étape suivante.">
          <form onSubmit={submitNew} className="space-y-4" noValidate>
            <Field label="Titre" required error={titleError}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  value={newTitle}
                  maxLength={120}
                  autoFocus
                  placeholder="Ex. : Les règles de sécurité en atelier"
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    setTitleError(null);
                  }}
                />
              )}
            </Field>
            <Field label="Description" optional>
              {({ id }) => <Textarea id={id} rows={3} value={newDesc} maxLength={500} onChange={(e) => setNewDesc(e.target.value)} />}
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" loading={creating}>
                Créer le quiz
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Lancer une partie */}
      <Dialog open={launching !== null} onOpenChange={(o) => !o && setLaunching(null)}>
        <DialogContent title="Lancer une partie" description={launching ? `Quiz : ${launching.title}` : undefined} size="sm">
          <form onSubmit={submitLaunch} className="space-y-4">
            <Field label="Nombre maximum de joueurs" hint="Entre 2 et 50. Les joueurs rejoignent avec un code ou un QR code, sans compte.">
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={50}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(e.target.value)}
                />
              )}
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLaunching(null)}>
                Annuler
              </Button>
              <Button type="submit" loading={launchBusy}>
                <Play aria-hidden />
                Ouvrir la salle
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer ce quiz ?"
        description={toDelete ? `« ${toDelete.title} » et ses questions seront supprimés définitivement.` : undefined}
        confirmLabel="Supprimer"
        onConfirm={confirmDelete}
        loading={busy}
      />
      <ConfirmDialog
        open={toCancel !== null}
        onOpenChange={(o) => !o && setToCancel(null)}
        title="Annuler cette partie ?"
        description="Elle ne pourra plus être rejointe."
        confirmLabel="Annuler la partie"
        onConfirm={confirmCancel}
        loading={busy}
      />
    </>
  );
}
