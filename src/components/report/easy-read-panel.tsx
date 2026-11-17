'use client';

import { Check, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { ListenButton } from '@/components/a11y/listen-button';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Badge, Card, CardBody, CardHeader, Notice } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';
import type { ActionState } from '@/lib/action-state';
import { EASY_READ_LIMITS, EASY_READ_MENTION, easyReadToText, easyReadWritingMention, sentencesFromLines, type EasyReadContent } from '@/lib/report/easy-read';
import type { StoredEasyRead } from '@/lib/report/load';
import { formatDate } from '@/lib/utils';

import {
  createManualEasyRead,
  deleteEasyReadDraft,
  generateEasyReadDraft,
  saveEasyRead,
  validateEasyRead,
} from '@/app/formateur/participants/[id]/bilan/easy-read-actions';

type Draft = { title: string; lines: string }[];
const toDraft = (content: EasyReadContent | null): Draft => (content?.sections ?? []).map((section) => ({ title: section.title, lines: section.sentences.join('\n') }));
const fromDraft = (draft: Draft): EasyReadContent => ({ sections: draft.map((section) => ({ title: section.title.trim(), sentences: sentencesFromLines(section.lines) })) });

/**
 * Version facile à lire d'un bilan validé (formateur) : proposition par l'IA ou
 * rédaction à la main, relecture, puis validation. Seule une version validée est
 * visible du participant et figure dans le PDF.
 */
export function EasyReadPanel({ reportId, easyReads, aiReady }: { reportId: string; easyReads: StoredEasyRead[]; aiReady: boolean }) {
  const router = useRouter();
  const draft = easyReads.find((item) => item.status === 'draft') ?? null;
  const validated = easyReads.find((item) => item.status === 'validated') ?? null;
  const [form, setForm] = useState<Draft>(() => toDraft(draft?.content ?? null));
  const [formFor, setFormFor] = useState(draft?.id ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  // Nouveau brouillon (génération, création) : le formulaire repart de son contenu.
  if ((draft?.id ?? null) !== formFor) {
    setFormFor(draft?.id ?? null);
    setForm(toDraft(draft?.content ?? null));
    setErrors({});
  }

  const run = (action: () => Promise<ActionState>, after?: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (!result) return;
      if (result.ok) {
        toast.success(result.message ?? 'Fait.');
        setErrors({});
        after?.();
        router.refresh();
      } else {
        toast.error(result.message ?? 'L’opération a échoué.');
        setErrors(result.fieldErrors ?? {});
      }
    });

  const sectionError = (index: number) =>
    Object.entries(errors)
      .filter(([path]) => path === `sections.${index}.title` || path === `sections.${index}.sentences` || path.startsWith(`sections.${index}.sentences.`))
      .map(([path, message]) => {
        const line = /sentences\.(\d+)$/.exec(path);
        return line ? `Ligne ${Number(line[1]) + 1} : ${message}` : message;
      });

  return (
    <Card className="mt-6">
      <CardHeader
        title="Version facile à lire"
        description="Facultative. Une version du bilan en phrases courtes et mots simples, une idée par phrase. Inspirée des règles européennes du FALC, non certifiée. Visible du participant seulement une fois validée."
      />
      <CardBody className="space-y-4">
        {validated?.content ? (
          <div className="rounded-md border border-line bg-paper/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                Version {validated.version} validée le {formatDate(validated.validatedAt)}
              </p>
              <ListenButton text={easyReadToText(validated.content)} />
            </div>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-muted">
              {validated.contentSource === 'manual' ? null : <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
              {easyReadWritingMention(validated.contentSource)}
            </p>
          </div>
        ) : null}

        {!draft ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => run(() => generateEasyReadDraft(reportId))} loading={pending} disabled={!aiReady}>
              <Wand2 aria-hidden />
              Proposer avec l’IA
            </Button>
            <Button variant="outline" onClick={() => run(() => createManualEasyRead(reportId))} disabled={pending}>
              Rédiger à la main
            </Button>
            {!aiReady ? <p className="w-full text-sm text-ink-subtle">Aucune clé de service d’IA n’est configurée : la rédaction à la main reste possible.</p> : null}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">Brouillon (version {draft.version})</span>
              {draft.contentSource === 'manual' ? <Badge variant="outline">Rédigé à la main</Badge> : <Badge variant="orange" icon={Sparkles}>{draft.contentSource === 'ai' ? 'Proposé par l’IA' : 'Proposé par l’IA, modifié'}</Badge>}
            </p>
            <Notice title="À relire avant validation">
              Vérifiez que chaque phrase est exacte et fidèle au bilan validé, sans note chiffrée et sans parler des compétences non observées. Une phrase par ligne,{' '}
              {EASY_READ_LIMITS.sentenceWords} mots au plus.
            </Notice>
            {form.map((section, index) => (
              <fieldset key={index} className="space-y-2 rounded-md border border-line p-4">
                <legend className="px-1 text-sm font-semibold">Partie {index + 1}</legend>
                <Field label="Titre">
                  {({ id }) => <Input id={id} value={section.title} maxLength={EASY_READ_LIMITS.titleLength} onChange={(event) => setForm((all) => all.map((item, i) => (i === index ? { ...item, title: event.target.value } : item)))} />}
                </Field>
                <Field label="Phrases" hint="Une phrase par ligne.">
                  {({ id, describedBy }) => (
                    <Textarea id={id} aria-describedby={describedBy} rows={5} value={section.lines} onChange={(event) => setForm((all) => all.map((item, i) => (i === index ? { ...item, lines: event.target.value } : item)))} />
                  )}
                </Field>
                {sectionError(index).length ? (
                  <ul className="space-y-0.5 text-sm font-medium text-danger" role="alert">
                    {sectionError(index).map((message, position) => (
                      <li key={position}>{message}</li>
                    ))}
                  </ul>
                ) : null}
                <Button type="button" variant="ghost" size="sm" onClick={() => setForm((all) => all.filter((_, i) => i !== index))}>
                  <Trash2 aria-hidden />
                  Retirer cette partie
                </Button>
              </fieldset>
            ))}
            {errors.sections ? <p className="text-sm font-medium text-danger">{errors.sections}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setForm((all) => [...all, { title: '', lines: '' }])} disabled={form.length >= EASY_READ_LIMITS.sections}>
                <Plus aria-hidden />
                Ajouter une partie
              </Button>
              <Button type="button" variant="secondary" onClick={() => run(() => saveEasyRead({ easyReadId: draft.id, content: fromDraft(form) }))} loading={pending}>
                Enregistrer
              </Button>
              <Button type="button" onClick={() => run(async () => {
                const saved = await saveEasyRead({ easyReadId: draft.id, content: fromDraft(form) });
                return saved?.ok ? validateEasyRead(draft.id) : saved;
              })} disabled={pending}>
                <Check aria-hidden />
                Enregistrer et valider
              </Button>
              <Button type="button" variant="danger-outline" onClick={() => run(() => deleteEasyReadDraft(draft.id))} disabled={pending}>
                Supprimer le brouillon
              </Button>
            </div>
          </div>
        )}
        <p className="text-xs text-ink-subtle">{EASY_READ_MENTION}</p>
      </CardBody>
    </Card>
  );
}
