'use client';

import { ChevronDown, CirclePlus, EyeOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { formatMarkContext, type LiveMark } from '@/lib/live-marks/live-marks';
import { cn } from '@/lib/utils';

const key = (sessionId: string) => `happi.live-marks.hidden.${sessionId}`;

/**
 * Points masqués par le formateur sur CET appareil : simple confort de lecture, rien n'est supprimé en base
 * (la suppression se fait depuis le lecteur, via « Annuler »).
 */
export function useHiddenMarks(sessionId: string) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key(sessionId));
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      // Lecture du stockage local après le rendu serveur : seule source possible de cet état.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(parsed)) setHidden(new Set(parsed.filter((value): value is string => typeof value === 'string')));
    } catch {
      // Stockage indisponible : rien n'est masqué.
    }
  }, [sessionId]);
  const update = useCallback(
    (next: Set<string>) => {
      setHidden(next);
      try {
        window.localStorage.setItem(key(sessionId), JSON.stringify([...next]));
      } catch {
        // Le masquage reste valable pour cette page.
      }
    },
    [sessionId],
  );
  return { hidden, hide: (ids: string[]) => update(new Set([...hidden, ...ids])), reset: () => update(new Set()) };
}

export type SkillLabel = { code: string; name: string };

function MarkLine({ mark }: { mark: LiveMark }) {
  const context = formatMarkContext(mark);
  return <span>{context || 'sans repère'}</span>;
}

/** Panneau d'aide à la notation : « + » du participant courant, par compétence, repliable, en lecture seule. */
export function LiveMarksHints({
  participantName,
  marks,
  skills,
  hidden,
  onHide,
  onReset,
}: {
  participantName: string;
  marks: LiveMark[];
  skills: SkillLabel[];
  hidden: Set<string>;
  onHide: (ids: string[]) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const visible = useMemo(() => marks.filter((mark) => !hidden.has(mark.id)), [marks, hidden]);
  const hiddenCount = marks.length - visible.length;
  const nameOf = (code: string | null) => (code ? (skills.find((skill) => skill.code === code)?.name ?? code) : 'Général');
  const groups = useMemo(() => {
    const result = new Map<string | null, LiveMark[]>();
    for (const mark of visible) result.set(mark.skillCode, [...(result.get(mark.skillCode) ?? []), mark]);
    return [...result.entries()].sort(([a], [b]) => (a === null ? -1 : b === null ? 1 : a.localeCompare(b)));
  }, [visible]);

  if (marks.length === 0) return null;
  return (
    <section className="rounded-lg border border-petrol-200 bg-petrol-50/60" aria-labelledby="points-direct-titre" data-testid="live-marks-hints">
      <h3 id="points-direct-titre" className="text-title">
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center gap-2 px-5 py-3 text-left">
          <CirclePlus className="size-5 text-petrol-700" aria-hidden />
          <span>Points en direct pour {participantName}</span>
          <span className="rounded-full bg-petrol-900 px-2 text-sm font-semibold text-white tabular-nums">{visible.length}</span>
          <ChevronDown className={cn('ml-auto size-5 transition-transform motion-reduce:transition-none', open && 'rotate-180')} aria-hidden />
        </button>
      </h3>
      {open ? (
        <div className="border-t border-petrol-200 px-5 py-3">
          <p className="mb-3 text-sm text-ink-muted">Aide-mémoire noté pendant la séance : il ne remplit aucune note, c’est vous qui décidez.</p>
          {groups.length === 0 ? <p className="text-sm text-ink-muted">Tous les points sont masqués.</p> : null}
          <ul className="space-y-3">
            {groups.map(([code, items]) => (
              <li key={code ?? 'general'}>
                <p className="text-sm font-semibold">{nameOf(code)} <span className="font-normal text-ink-muted">· + {items.length}</span></p>
                <ul className="mt-1 space-y-0.5 text-sm text-ink-muted">
                  {items.map((mark) => (
                    <li key={mark.id} className="flex items-center gap-2">
                      <span aria-hidden>+</span>
                      <MarkLine mark={mark} />
                      <button type="button" onClick={() => onHide([mark.id])} className="ml-auto flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs hover:bg-white" aria-label={`Masquer ce point (${nameOf(code)})`}>
                        <EyeOff className="size-3.5" aria-hidden />
                        Masquer
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {visible.length > 1 ? <button type="button" onClick={() => onHide(visible.map((mark) => mark.id))} className="font-semibold text-petrol-700 underline">Tout masquer</button> : null}
            {hiddenCount > 0 ? <button type="button" onClick={onReset} className="font-semibold text-petrol-700 underline">Afficher les {hiddenCount} masqué{hiddenCount > 1 ? 's' : ''}</button> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Rappel discret sous le nom d'une compétence : « + 2 en direct », dépliable en lecture seule. */
export function SkillMarkHint({ skillName, marks }: { skillName: string; marks: LiveMark[] }) {
  const [open, setOpen] = useState(false);
  if (marks.length === 0) return null;
  return (
    <div className="mt-1" data-testid="skill-mark-hint">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="inline-flex items-center gap-1 rounded-full bg-petrol-50 px-2 py-0.5 text-xs font-semibold text-petrol-700 hover:bg-petrol-100" aria-label={`${marks.length} point${marks.length > 1 ? 's' : ''} en direct sur ${skillName}`}>
        <CirclePlus className="size-3.5" aria-hidden />
        {marks.length} en direct
      </button>
      {open ? (
        <ul className="mt-1 space-y-0.5 text-xs text-ink-muted">
          {marks.map((mark) => (
            <li key={mark.id}>+ <MarkLine mark={mark} /></li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
