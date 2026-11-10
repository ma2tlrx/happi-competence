import { LoaderCircle } from 'lucide-react';
import { Slot } from 'radix-ui';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

const base =
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-semibold ' +
  'transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-out ' +
  'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ' +
  'aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:shrink-0';

const variants = {
  /** Action principale : orange HAPPI, texte pétrole foncé (contraste 5,2:1). */
  primary: 'bg-orange-500 text-petrol-950 shadow-xs hover:bg-orange-400',
  secondary: 'bg-petrol-900 text-white hover:bg-petrol-800',
  outline: 'border border-line-strong bg-white text-ink hover:border-petrol-400 hover:bg-petrol-50',
  ghost: 'text-ink hover:bg-petrol-100/70',
  danger: 'bg-danger text-white hover:bg-[#9d1d13]',
  'danger-outline': 'border border-danger/40 bg-white text-danger hover:bg-danger-soft',
  inverse: 'border border-white/25 text-white hover:bg-white/10',
  link: 'h-auto p-0 text-petrol-700 underline underline-offset-4 hover:text-petrol-950',
} as const;

const sizes = {
  sm: 'h-8 rounded-sm px-3 text-sm [&_svg]:size-4',
  md: 'h-10 rounded-md px-4 text-[0.9375rem] [&_svg]:size-[1.125rem]',
  lg: 'h-12 rounded-md px-6 text-base [&_svg]:size-5',
  icon: 'size-10 rounded-md [&_svg]:size-5',
  'icon-sm': 'size-8 rounded-sm [&_svg]:size-4',
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], variant === 'link' ? '' : sizes[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Rend l'enfant (un lien, par exemple) avec l'apparence d'un bouton. */
  asChild?: boolean;
  loading?: boolean;
  children?: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  asChild = false,
  loading = false,
  className,
  children,
  disabled,
  type,
  ...props
}: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root className={buttonClasses({ variant, size, className })} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      type={type ?? 'button'}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
