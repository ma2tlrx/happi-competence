'use client';

import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Select } from './form';

/** Met à jour un paramètre de l'URL en conservant les autres (et revient à la première page). */
function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const update = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }
    if (!('page' in changes)) params.delete('page');
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };
  return { update, pending, searchParams };
}

/** Champ de recherche synchronisé avec l'URL (paramètre ?q=). */
export function SearchInput({ placeholder = 'Rechercher', param = 'q', className }: { placeholder?: string; param?: string; className?: string }) {
  const { update, pending, searchParams } = useQueryUpdater();
  const initial = searchParams.get(param) ?? '';
  const [value, setValue] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onChange = (next: string) => {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => update({ [param]: next.trim() || null }), 300);
  };

  return (
    <div className={cn('relative w-full sm:max-w-xs', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-[1.125rem] -translate-y-1/2 text-ink-subtle" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          'h-10 w-full rounded-md border border-line-strong bg-white pr-9 pl-9 text-[0.9375rem] text-ink placeholder:text-ink-subtle/70 hover:border-petrol-400',
          'focus-visible:border-petrol-600 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-orange-500 [&::-webkit-search-cancel-button]:hidden',
          pending && 'opacity-70',
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-xs text-ink-subtle hover:bg-petrol-50 hover:text-ink"
          aria-label="Effacer la recherche"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** Liste déroulante de filtre synchronisée avec l'URL. */
export function FilterSelect({
  param,
  label,
  options,
  allLabel = 'Tous',
  className,
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
  className?: string;
}) {
  const { update, searchParams } = useQueryUpdater();
  return (
    <Select
      aria-label={label}
      value={searchParams.get(param) ?? ''}
      onChange={(event) => update({ [param]: event.target.value || null })}
      className={cn('w-full sm:w-auto sm:min-w-44', className)}
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

/** Pagination par liens (?page=). */
export function Pagination({ page, pageCount, total, label = 'résultats' }: { page: number; pageCount: number; total: number; label?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (pageCount <= 1) {
    return total > 0 ? <p className="px-5 py-3 text-sm text-ink-subtle sm:px-6">{`${total} ${label}`}</p> : null;
  }
  const hrefFor = (target: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) params.delete('page');
    else params.set('page', String(target));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };
  const linkClass = 'flex size-9 items-center justify-center rounded-sm border border-line-strong bg-white text-ink transition-colors hover:bg-petrol-50';
  const disabledClass = 'flex size-9 items-center justify-center rounded-sm border border-line bg-paper text-ink-subtle/50';
  return (
    <nav className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6" aria-label="Pagination">
      <p className="text-sm text-ink-subtle">{`Page ${page} sur ${pageCount} — ${total} ${label}`}</p>
      <div className="flex gap-1.5">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={linkClass} aria-label="Page précédente" scroll={false}>
            <ChevronLeft className="size-[1.125rem]" aria-hidden />
          </Link>
        ) : (
          <span className={disabledClass} aria-hidden>
            <ChevronLeft className="size-[1.125rem]" />
          </span>
        )}
        {page < pageCount ? (
          <Link href={hrefFor(page + 1)} className={linkClass} aria-label="Page suivante" scroll={false}>
            <ChevronRight className="size-[1.125rem]" aria-hidden />
          </Link>
        ) : (
          <span className={disabledClass} aria-hidden>
            <ChevronRight className="size-[1.125rem]" />
          </span>
        )}
      </div>
    </nav>
  );
}

/** Onglets de navigation entre pages (état actif d'après l'URL). */
export function LinkTabs({ tabs, className, label }: { tabs: { href: string; label: ReactNode; exact?: boolean }[]; className?: string; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={cn('scrollbar-none -mx-1 flex gap-1 overflow-x-auto border-b border-line px-1', className)}>
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2.5 text-[0.9375rem] whitespace-nowrap transition-colors',
              active ? 'border-orange-500 font-semibold text-ink' : 'border-transparent font-medium text-ink-muted hover:text-ink',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
