'use client';

import { Building2, GraduationCap, Sparkles, Trash2, User } from 'lucide-react';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/primitives';
import type { ActionState } from '@/lib/action-state';

import { createDemoAction, deleteDemoAction, openDemoSpaceAction } from './actions';

const ICONS = { formateur: GraduationCap, organisme: Building2, participant: User } as const;

export function DemoControls({ exists, spaces }: { exists: boolean; spaces: { key: keyof typeof ICONS; label: string; email: string }[] }) {
  const [pending, startTransition] = useTransition();
  const [task, setTask] = useState<string | null>(null);
  const [message, setMessage] = useState<ActionState>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = (name: string, action: () => Promise<ActionState>) => {
    setTask(name);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      // Une ouverture d'espace réussie redirige : aucun message à afficher.
      if (result) setMessage(result);
      setTask(null);
    });
  };

  return (
    <div className="space-y-5">
      {exists ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {spaces.map((space) => {
            const Icon = ICONS[space.key];
            return (
              <button
                key={space.key}
                type="button"
                disabled={pending}
                onClick={() => run(space.key, () => openDemoSpaceAction(space.key))}
                className="flex items-start gap-3 rounded-lg border border-line bg-white p-4 text-left transition-colors hover:border-petrol-400 hover:bg-petrol-50 disabled:opacity-60"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-petrol-900 text-white">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold">{pending && task === space.key ? 'Ouverture…' : `Ouvrir l’espace ${space.label.toLowerCase()}`}</span>
                  <span className="block text-sm text-ink-muted">{space.email}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button onClick={() => run('create', createDemoAction)} loading={pending && task === 'create'} disabled={pending}>
          <Sparkles aria-hidden />
          {exists ? 'Recréer la démonstration' : 'Créer la démonstration'}
        </Button>
        {exists ? (
          confirmDelete ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink-muted">Tous les comptes et données « démo » seront supprimés.</span>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirmDelete(false);
                  run('delete', deleteDemoAction);
                }}
              >
                Confirmer la suppression
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Annuler
              </Button>
            </span>
          ) : (
            <Button variant="danger-outline" onClick={() => setConfirmDelete(true)} loading={pending && task === 'delete'} disabled={pending}>
              <Trash2 aria-hidden />
              Supprimer la démonstration
            </Button>
          )
        ) : null}
      </div>
      {pending && task === 'create' ? (
        <Notice variant="info">Création en cours : comptes, groupes, sessions, présences et évaluations. Comptez 20 à 60 secondes.</Notice>
      ) : null}
      {message?.message ? <Notice variant={message.ok ? 'success' : 'danger'}>{message.message}</Notice> : null}
    </div>
  );
}
