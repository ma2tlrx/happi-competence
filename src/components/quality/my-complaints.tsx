import { MessageSquareWarning } from 'lucide-react';

import { Badge, Card, CardBody, CardHeader, EmptyState } from '@/components/ui/primitives';
import { COMPLAINT_STATUSES, type ComplaintStatus } from '@/lib/quality/labels';
import type { MyComplaint } from '@/lib/quality/load';
import { formatDate } from '@/lib/utils';

/** Signalements déposés par le compte connecté, avec la réponse de l'équipe. */
export function MyComplaints({ complaints }: { complaints: MyComplaint[] }) {
  return (
    <Card>
      <CardHeader title="Mes signalements" description="Vous seul(e) et l’équipe HAPPI voyez vos signalements." />
      <CardBody className="pt-2">
        {complaints.length === 0 ? (
          <EmptyState icon={MessageSquareWarning} title="Aucun signalement" description="Un problème, une difficulté, une insatisfaction ? Signalez-le : l’équipe vous répondra ici." />
        ) : (
          <ul className="divide-y divide-line">
            {complaints.map((complaint) => {
              const status = COMPLAINT_STATUSES[complaint.status as ComplaintStatus];
              return (
                <li key={complaint.id} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{complaint.subject}</p>
                    {status ? <Badge variant={status.variant}>{status.label}</Badge> : null}
                  </div>
                  <p className="text-sm text-ink-subtle">Envoyé le {formatDate(complaint.receivedOn)}</p>
                  <p className="mt-2 text-[0.9375rem] whitespace-pre-line">{complaint.description}</p>
                  {complaint.response ? (
                    <div className="mt-3 rounded-md border border-line bg-paper px-4 py-3">
                      <p className="text-sm font-semibold">Réponse de l’équipe HAPPI{complaint.respondedOn ? ` · ${formatDate(complaint.respondedOn)}` : ''}</p>
                      <p className="mt-1 text-[0.9375rem] whitespace-pre-line">{complaint.response}</p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
