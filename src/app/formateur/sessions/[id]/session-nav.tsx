import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { SessionStatusBadge } from '@/components/passport/session-status';
import { LinkTabs } from '@/components/ui/navigation';
import { formatDate, formatTimeRange } from '@/lib/utils';

/** En-tête commun aux pages d'une session : retour, titre, onglets. */
export function SessionHeader({
  session,
  title,
  groupName,
  actions,
}: {
  session: { id: string; number: number; scheduled_date: string | null; start_time: string | null; end_time: string | null; status: string; location: string | null };
  title: string;
  groupName: string;
  actions?: React.ReactNode;
}) {
  const base = `/formateur/sessions/${session.id}`;
  return (
    <header className="mb-6">
      <Link href="/formateur/sessions" className="mb-2 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        Sessions
      </Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-[1.625rem] leading-tight font-semibold tracking-[-0.02em] sm:text-[1.875rem]">
            Session {session.number} · {title}
            <SessionStatusBadge status={session.status} />
          </h1>
          <p className="mt-1.5 text-[0.9375rem] text-ink-muted">
            {groupName} · {formatDate(session.scheduled_date)} · {formatTimeRange(session.start_time, session.end_time)}
            {session.location ? ` · ${session.location}` : ''}
          </p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <LinkTabs
        label="Rubriques de la session"
        className="mt-6"
        tabs={[
          { href: base, label: 'Vue d’ensemble', exact: true },
          { href: `${base}/presences`, label: 'Présences' },
          { href: `${base}/evaluations`, label: 'Évaluations' },
          { href: `${base}/lecteur`, label: 'Lecteur pédagogique' },
        ]}
      />
    </header>
  );
}
