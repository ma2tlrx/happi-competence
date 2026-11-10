'use client';

import { Check, CircleHelp, X } from 'lucide-react';
import { Dialog as RadixDialog, DropdownMenu as RadixMenu, Popover as RadixPopover, Tabs as RadixTabs, Tooltip as RadixTooltip } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

// ── Dialogue ─────────────────────────────────────────────────────────────────
export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export function DialogContent({
  title,
  description,
  children,
  size = 'md',
  className,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-petrol-950/45 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <RadixDialog.Content
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] w-full flex-col rounded-t-xl border border-line bg-white shadow-lg',
          'data-[state=open]:animate-rise sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[86dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:data-[state=open]:animate-pop',
          widths[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <RadixDialog.Title className="font-display text-lg leading-snug font-semibold text-ink">{title}</RadixDialog.Title>
            {description ? (
              <RadixDialog.Description className="mt-1 text-sm text-ink-muted">{description}</RadixDialog.Description>
            ) : (
              <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close
            className="-mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-petrol-50 hover:text-ink"
            aria-label="Fermer"
          >
            <X className="size-5" aria-hidden />
          </RadixDialog.Close>
        </div>
        <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

// ── Menu déroulant ───────────────────────────────────────────────────────────
export const Menu = RadixMenu.Root;
export const MenuTrigger = RadixMenu.Trigger;

export function MenuContent({ className, align = 'end', ...props }: ComponentProps<typeof RadixMenu.Content>) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        align={align}
        sideOffset={8}
        className={cn(
          'z-50 min-w-56 overflow-hidden rounded-lg border border-line bg-white p-1.5 shadow-md data-[state=open]:animate-pop',
          className,
        )}
        {...props}
      />
    </RadixMenu.Portal>
  );
}

export function MenuItem({ className, ...props }: ComponentProps<typeof RadixMenu.Item>) {
  return (
    <RadixMenu.Item
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-[0.9375rem] text-ink outline-none select-none',
        'data-[highlighted]:bg-petrol-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-[1.125rem] [&_svg]:text-ink-muted',
        className,
      )}
      {...props}
    />
  );
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof RadixMenu.Label>) {
  return <RadixMenu.Label className={cn('px-2.5 py-1.5 text-sm text-ink-subtle', className)} {...props} />;
}

export function MenuSeparator() {
  return <RadixMenu.Separator className="-mx-1.5 my-1.5 h-px bg-line" />;
}

// ── Onglets ──────────────────────────────────────────────────────────────────
export const Tabs = RadixTabs.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      className={cn('scrollbar-none flex gap-1 overflow-x-auto border-b border-line', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        'relative -mb-px border-b-2 border-transparent px-3 py-2.5 text-[0.9375rem] font-medium whitespace-nowrap text-ink-muted transition-colors',
        'hover:text-ink data-[state=active]:border-orange-500 data-[state=active]:font-semibold data-[state=active]:text-ink',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof RadixTabs.Content>) {
  return <RadixTabs.Content className={cn('pt-5 data-[state=active]:animate-fade-in focus-visible:outline-none', className)} {...props} />;
}

// ── Infobulle (survol / focus) ───────────────────────────────────────────────
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RadixTooltip.Provider delayDuration={250} skipDelayDuration={150}>
      {children}
    </RadixTooltip.Provider>
  );
}

export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-xs rounded-sm bg-petrol-950 px-2.5 py-1.5 text-sm leading-snug text-white shadow-md data-[state=delayed-open]:animate-fade-in"
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

// ── Explication au clic (fonctionne aussi au doigt) ──────────────────────────
/** Petit « ? » qui ouvre une explication : sert à dire ce que représente un score ou un terme. */
export function InfoHint({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <RadixPopover.Root>
      <RadixPopover.Trigger
        className={cn(
          'inline-flex size-6 shrink-0 items-center justify-center rounded-full align-middle text-ink-subtle transition-colors hover:bg-petrol-100 hover:text-ink',
          className,
        )}
        aria-label={label}
      >
        <CircleHelp className="size-[1.125rem]" aria-hidden />
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          sideOffset={6}
          collisionPadding={16}
          className="z-50 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-line bg-white p-4 text-sm leading-relaxed text-ink-muted shadow-md data-[state=open]:animate-pop"
        >
          {children}
          <RadixPopover.Arrow className="fill-white" />
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export function PopoverContent({ className, ...props }: ComponentProps<typeof RadixPopover.Content>) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        sideOffset={8}
        collisionPadding={16}
        className={cn('z-50 rounded-lg border border-line bg-white shadow-md data-[state=open]:animate-pop', className)}
        {...props}
      />
    </RadixPopover.Portal>
  );
}

/** Coche animée affichée brièvement après un enregistrement réussi. */
export function SavedMark({ visible, label = 'Enregistré' }: { visible: boolean; label?: string }) {
  if (!visible) return null;
  return (
    <span role="status" className="inline-flex animate-pop items-center gap-1 text-sm font-medium text-success">
      <Check className="size-4" strokeWidth={3} aria-hidden />
      {label}
    </span>
  );
}
