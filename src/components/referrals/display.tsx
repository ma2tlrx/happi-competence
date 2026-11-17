import { Badge } from '@/components/ui/primitives';
import { formatParisDateTime } from '@/lib/referrals/dates';
import { isReferralStatus, REFERRAL_STATUS } from '@/lib/referrals/status';

export function ReferralStatusBadge({ status }: { status: string }) {
  const meta = isReferralStatus(status) ? REFERRAL_STATUS[status] : null;
  return <Badge variant={meta?.variant ?? 'neutral'}>{meta?.label ?? status}</Badge>;
}

export type ReferralEvent = {
  id: number;
  kind: string;
  from_status: string | null;
  to_status: string | null;
  consent_kind: string | null;
  consent_value: boolean | null;
  source: string;
  reason: string | null;
  created_at: string;
};

const SOURCE_LABELS: Record<string, string> = {
  prescriber: 'prescripteur',
  participant: 'la personne',
  staff: 'équipe HAPPI',
  system: 'système',
};

const CONSENT_LABELS: Record<string, [string, string]> = {
  information: ['Information sur le traitement des données donnée', 'Information non donnée'],
  image: ['Droit à l’image : accepté', 'Droit à l’image : refusé'],
  share_results: ['Partage des résultats : accepté', 'Partage des résultats : refusé'],
};

function eventLabel(event: ReferralEvent) {
  if (event.kind === 'created') return 'Orientation envoyée';
  if (event.kind === 'consent') {
    const [yes, no] = CONSENT_LABELS[event.consent_kind ?? ''] ?? ['Consentement', 'Consentement'];
    return event.consent_value ? yes : no;
  }
  const label = event.to_status && isReferralStatus(event.to_status) ? REFERRAL_STATUS[event.to_status].label : event.to_status;
  return event.from_status === event.to_status ? `${label} (date modifiée)` : `Statut : ${label}`;
}

/** Historique horodaté (statuts et consentements). */
export function ReferralTimeline({ events, showReasons = true }: { events: ReferralEvent[]; showReasons?: boolean }) {
  if (events.length === 0) return <p className="text-sm text-ink-muted">Aucun événement.</p>;
  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="border-l-2 border-line pl-3">
          <p className="text-[0.9375rem] font-medium">{eventLabel(event)}</p>
          <p className="text-sm text-ink-subtle">
            {formatParisDateTime(event.created_at)} · {SOURCE_LABELS[event.source] ?? event.source}
          </p>
          {showReasons && event.reason ? <p className="mt-1 text-sm text-ink-muted">Motif : {event.reason}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export function DefinitionList({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-sm font-semibold text-ink-muted">{label}</dt>
          <dd className="text-[0.9375rem] break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
