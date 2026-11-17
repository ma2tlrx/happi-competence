'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useActionState, useState, useTransition, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox, Field, FormMessage, Input, Select, SubmitButton, Textarea } from '@/components/ui/form';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/overlays';
import { toast } from '@/components/ui/toast';
import type { ActionState } from '@/lib/action-state';
import type { FieldSpec } from '@/lib/quality/forms';

type Props = {
  title: string;
  description?: ReactNode;
  fields: FieldSpec[];
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  /** Saisie d'un nouvel élément (bouton « Ajouter ») ou modification. */
  mode: 'create' | 'edit';
  triggerLabel: string;
  /** Libellé accessible complet du bouton (contexte de la ligne). */
  ariaLabel?: string;
  intro?: ReactNode;
  defaultOpen?: boolean;
  size?: 'md' | 'lg';
};

/** Formulaire générique en boîte de dialogue : champs décrits côté serveur, action serveur liée. */
export function RecordDialog({ title, description, fields, action, mode, triggerLabel, ariaLabel, intro, defaultOpen = false, size = 'lg' }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const initialSelects = Object.fromEntries(fields.filter((field) => field.kind === 'select').map((field) => [field.name, String(field.defaultValue ?? '')]));
  const [selects, setSelects] = useState<Record<string, string>>(initialSelects);
  const [state, submit] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await action(previous, formData);
    if (result?.ok) {
      toast.success(result.message ?? 'Enregistré.');
      setOpen(false);
    }
    return result;
  }, null);
  const errors = state?.fieldErrors ?? {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={mode === 'create' ? 'primary' : 'ghost'} aria-label={ariaLabel}>
          {mode === 'create' ? <Plus aria-hidden /> : <Pencil aria-hidden />}
          <span className={mode === 'edit' ? 'hidden sm:inline' : undefined}>{triggerLabel}</span>
        </Button>
      </DialogTrigger>
      <DialogContent title={title} description={description} size={size}>
        <form action={submit} className="space-y-4" noValidate>
          {intro}
          {fields.map((field) => {
            if (field.showWhen && !field.showWhen.values.includes(selects[field.showWhen.field] ?? '')) {
              return <input key={field.name} type="hidden" name={field.name} value="" />;
            }
            if (field.kind === 'checkbox') {
              return (
                <Checkbox
                  key={field.name}
                  name={field.name}
                  label={field.label}
                  description={field.hint}
                  defaultChecked={Boolean(field.defaultValue)}
                  error={errors[field.name]}
                />
              );
            }
            return (
              <Field key={field.name} label={field.label} required={field.required} optional={!field.required} hint={field.hint} error={errors[field.name]}>
                {({ id, describedBy, invalid }) => {
                  const common = { id, name: field.name, 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined, required: field.required };
                  if (field.kind === 'textarea') {
                    return <Textarea {...common} rows={4} maxLength={field.maxLength} defaultValue={String(field.defaultValue ?? '')} />;
                  }
                  if (field.kind === 'select') {
                    return (
                      <Select
                        {...common}
                        value={selects[field.name] ?? ''}
                        onChange={(event) => setSelects((current) => ({ ...current, [field.name]: event.target.value }))}
                      >
                        <option value="">{field.required ? 'Sélectionner' : 'Aucun'}</option>
                        {(field.options ?? []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    );
                  }
                  return (
                    <Input
                      {...common}
                      type={field.kind === 'date' ? 'date' : 'text'}
                      max={field.max}
                      maxLength={field.maxLength}
                      defaultValue={String(field.defaultValue ?? '')}
                    />
                  );
                }}
              </Field>
            );
          })}
          {state && !state.ok ? <FormMessage state={state} /> : null}
          <SubmitButton>Enregistrer</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Suppression confirmée d'un élément de registre. */
export function DeleteButton({ action, label, confirm }: { action: () => Promise<{ ok: boolean; message?: string }>; label: string; confirm: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label={label}
      loading={pending}
      onClick={() => {
        if (!window.confirm(confirm)) return;
        start(async () => {
          const result = await action();
          if (result.ok) toast.success('Supprimé.');
          else toast.error(result.message ?? 'Suppression impossible.');
        });
      }}
    >
      {pending ? null : <Trash2 aria-hidden />}
    </Button>
  );
}
