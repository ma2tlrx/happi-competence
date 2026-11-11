import type { LucideIcon } from 'lucide-react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';

import { cn, initials } from '@/lib/utils';

// ── Carte ────────────────────────────────────────────────────────────────────
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-w-0 rounded-lg border border-line bg-white', className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
  as: Heading = 'h2',
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  as?: 'h2' | 'h3';
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 sm:px-6', className)}>
      <div className="min-w-0">
        <Heading className="text-[1.0625rem] leading-snug font-semibold tracking-[-0.01em]">{title}</Heading>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-5 sm:px-6', className)} {...props} />;
}

// ── Badge ────────────────────────────────────────────────────────────────────
const badgeVariants = {
  neutral: 'bg-paper text-ink-muted border-line',
  petrol: 'bg-petrol-100 text-petrol-800 border-petrol-200',
  dark: 'bg-petrol-900 text-white border-petrol-900',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  danger: 'bg-danger-soft text-danger border-danger/20',
  outline: 'bg-white text-ink-muted border-line-strong',
} as const;
export type BadgeVariant = keyof typeof badgeVariants;

export function Badge({
  variant = 'neutral',
  icon: Icon,
  className,
  children,
}: {
  variant?: BadgeVariant;
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-5 font-semibold whitespace-nowrap',
        badgeVariants[variant],
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
      {children}
    </span>
  );
}

// ── Message d'information en ligne ───────────────────────────────────────────
const noticeVariants = {
  info: { box: 'border-petrol-200 bg-petrol-50 text-petrol-800', icon: Info },
  success: { box: 'border-success/25 bg-success-soft text-success', icon: CircleCheck },
  warning: { box: 'border-warning/25 bg-warning-soft text-warning', icon: TriangleAlert },
  danger: { box: 'border-danger/25 bg-danger-soft text-danger', icon: CircleAlert },
} as const;

export function Notice({
  variant = 'info',
  title,
  children,
  className,
  action,
}: {
  variant?: keyof typeof noticeVariants;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  const { box, icon: Icon } = noticeVariants[variant];
  return (
    <div className={cn('flex gap-3 rounded-md border px-4 py-3 text-sm', box, className)} role={variant === 'danger' ? 'alert' : 'note'}>
      <Icon className="mt-0.5 size-[1.125rem] shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn('text-ink-muted', title ? 'mt-0.5' : '')}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}

// ── État vide : une invitation à agir ────────────────────────────────────────
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      {Icon ? (
        <span className="mb-4 flex size-12 items-center justify-center rounded-lg bg-petrol-50 text-petrol-600">
          <Icon className="size-6" aria-hidden />
        </span>
      ) : null}
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {description ? <p className="mt-1.5 max-w-md text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

// ── En-tête de page ──────────────────────────────────────────────────────────
export function PageHeader({
  title,
  description,
  actions,
  back,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Lien de retour affiché au-dessus du titre. */
  back?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className="min-w-0">
        {back ? <div className="mb-2 text-sm">{back}</div> : null}
        <h1 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.02em] sm:text-[1.875rem]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-[0.9375rem] text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

// ── Chiffre clé ──────────────────────────────────────────────────────────────
export function StatTile({
  label,
  value,
  detail,
  icon: Icon,
  className,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <Card className={cn('flex flex-col gap-1 px-5 py-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        {Icon ? <Icon className="size-[1.125rem] text-petrol-400" aria-hidden /> : null}
      </div>
      <p className="font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-ink">{value}</p>
      {detail ? <p className="text-sm text-ink-subtle">{detail}</p> : null}
    </Card>
  );
}

// ── Avatar à initiales ───────────────────────────────────────────────────────
export function Avatar({
  person,
  size = 'md',
  tone = 'petrol',
  className,
}: {
  person: { first_name?: string | null; last_name?: string | null } | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'petrol' | 'light' | 'orange';
  className?: string;
}) {
  const sizes = { sm: 'size-7 text-[0.6875rem]', md: 'size-9 text-xs', lg: 'size-12 text-base' };
  const tones = {
    petrol: 'bg-petrol-100 text-petrol-800',
    light: 'bg-white/12 text-white',
    orange: 'bg-orange-100 text-orange-700',
  };
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide', sizes[size], tones[tone], className)}
    >
      {initials(person)}
    </span>
  );
}

// ── Tableau ──────────────────────────────────────────────────────────────────
/**
 * Zone de défilement d'un tableau. `relative` contient les éléments en position absolue
 * (textes réservés aux lecteurs d'écran) qui, sinon, élargissaient la page sur téléphone ;
 * la zone est atteignable au clavier pour faire défiler un tableau large.
 */
export function TableWrap({ className, children, label = 'Tableau' }: { className?: string; children: ReactNode; label?: string }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className={cn('relative max-w-full overflow-x-auto focus-visible:outline-offset-[-2px]', className)}>
      {children}
    </div>
  );
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full border-collapse text-left text-[0.9375rem]', className)} {...props} />;
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn('border-b border-line bg-paper/60 px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-ink-muted first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6', className)}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-b border-line px-4 py-3 align-middle first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6', className)} {...props} />;
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors last:[&>td]:border-b-0 hover:bg-petrol-50/50', className)} {...props} />;
}

// ── Squelette de chargement ──────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4', className)} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Chargement en cours">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="mt-6 h-72 rounded-lg" />
    </div>
  );
}

/** Mention discrète pour un contenu en attente de validation. */
export function ProvisionalBadge({ children = 'Provisoire' }: { children?: ReactNode }) {
  return (
    <Badge variant="warning" icon={TriangleAlert}>
      {children}
    </Badge>
  );
}
