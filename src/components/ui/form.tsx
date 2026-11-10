'use client';

import { Check, CircleAlert, CircleCheck } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';
import { useFormStatus } from 'react-dom';

import { cn } from '@/lib/utils';

import { Button, type ButtonSize, type ButtonVariant } from './button';

const controlBase =
  'w-full rounded-md border border-line-strong bg-white px-3 text-[0.9375rem] text-ink transition-colors ' +
  'placeholder:text-ink-subtle/70 hover:border-petrol-400 ' +
  'focus-visible:border-petrol-600 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-orange-500 ' +
  'disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-subtle ' +
  'aria-invalid:border-danger';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlBase, 'h-10', className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cn(controlBase, 'min-h-24 py-2.5 leading-relaxed', className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        controlBase,
        'h-10 appearance-none bg-[length:1rem] bg-[position:right_0.7rem_center] bg-no-repeat pr-9',
        "bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%234b6166%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

type FieldProps = {
  label: string;
  /** Identifiant du champ ; généré si absent. */
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
};

/** Libellé, aide et message d'erreur reliés au champ pour les lecteurs d'écran. */
export function Field({ label, htmlFor, hint, error, required, optional, className, children }: FieldProps) {
  const generated = useId();
  const id = htmlFor ?? generated;
  const hintId = hint ? `${id}-aide` : undefined;
  const errorId = error ? `${id}-erreur` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {required ? (
          <span className="ml-0.5 text-orange-700" aria-hidden>
            *
          </span>
        ) : null}
        {optional ? <span className="ml-1.5 font-normal text-ink-subtle">facultatif</span> : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error ? (
        <p id={hintId} className="text-sm text-ink-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode;
  description?: ReactNode;
  error?: string | null;
};

export function Checkbox({ label, description, error, className, id, ...props }: CheckboxProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={inputId} className="group flex cursor-pointer items-start gap-3 text-[0.9375rem] text-ink">
        <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center">
          <input
            id={inputId}
            type="checkbox"
            className="peer absolute inset-0 size-5 cursor-pointer appearance-none rounded-xs border border-line-strong bg-white transition-colors checked:border-petrol-900 checked:bg-petrol-900 hover:border-petrol-500 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger"
            aria-invalid={error ? true : undefined}
            {...props}
          />
          <Check className="pointer-events-none relative size-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100" strokeWidth={3} aria-hidden />
        </span>
        <span>
          {label}
          {description ? <span className="mt-0.5 block text-sm text-ink-subtle">{description}</span> : null}
        </span>
      </label>
      {error ? (
        <p className="ml-8 flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Bouton d'envoi qui reflète l'état de la soumission du formulaire parent. */
export function SubmitButton({
  children,
  variant,
  size,
  className,
  disabled,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} loading={pending} disabled={disabled}>
      {children}
    </Button>
  );
}

/** Message global renvoyé par une action serveur (succès ou erreur). */
export function FormMessage({ state }: { state: { ok: boolean; message?: string } | null | undefined }) {
  if (!state?.message) return null;
  const Icon = state.ok ? CircleCheck : CircleAlert;
  return (
    <p
      role={state.ok ? 'status' : 'alert'}
      className={cn(
        'flex animate-rise items-start gap-2 rounded-md border px-3 py-2.5 text-sm font-medium',
        state.ok ? 'border-success/25 bg-success-soft text-success' : 'border-danger/25 bg-danger-soft text-danger',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{state.message}</span>
    </p>
  );
}
