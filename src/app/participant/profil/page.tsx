import { PencilLine } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AttendanceBadge, SessionStatusBadge } from '@/components/passport/session-status';
import { Button } from '@/components/ui/button';
import { Avatar, Card, CardBody, CardHeader, PageHeader } from '@/components/ui/primitives';
import { formatDate } from '@/lib/utils';

import { getMyPassport } from '../data';

export const metadata: Metadata = { title: 'Mon profil' };

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr]">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-[0.9375rem] text-ink">{children}</dd>
    </div>
  );
}

export default async function ProfilPage() {
  const { passport } = await getMyPassport();
  const { participant, group } = passport;
  return (
    <>
      <PageHeader
        title="Mon profil"
        actions={
          <Button asChild variant="outline">
            <Link href="/compte">
              <PencilLine aria-hidden />
              Modifier mes informations
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardBody className="flex items-center gap-4">
            <Avatar person={{ first_name: participant.firstName, last_name: participant.lastName }} size="lg" />
            <div>
              <p className="font-display text-xl font-semibold">
                {participant.firstName} {participant.lastName}
              </p>
              <p className="text-ink-muted">{participant.email}</p>
            </div>
          </CardBody>
          <CardBody className="border-t border-line pt-2">
            <dl className="divide-y divide-line">
              <Item label="Organisme">{participant.organization?.name ?? 'Aucun rattachement'}</Item>
              <Item label="Programme">{group?.programName ?? 'Pas encore inscrit'}</Item>
              <Item label="Groupe">{group?.name ?? '—'}</Item>
              <Item label="Formateurs">{group?.trainers.length ? group.trainers.join(', ') : '—'}</Item>
              <Item label="Date de début">{formatDate(group?.startDate, '—')}</Item>
              <Item label="Date de fin">{formatDate(group?.endDate, '—')}</Item>
              <Item label="Inscription">{formatDate(participant.createdAt)}</Item>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Historique du parcours" />
          <CardBody>
            {passport.sessions.length > 0 ? (
              <ol className="divide-y divide-line">
                {passport.sessions.map((session) => (
                  <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span>
                      <span className="font-medium text-ink">Session {session.number} · {session.title}</span>
                      <span className="block text-sm text-ink-subtle">{formatDate(session.date)}</span>
                    </span>
                    <span className="flex gap-1.5">
                      <SessionStatusBadge status={session.status} />
                      {session.status === 'completed' ? <AttendanceBadge status={session.attendance} /> : null}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-ink-muted">Aucune session pour le moment.</p>
            )}
            {passport.otherGroups.length > 0 ? (
              <p className="mt-4 border-t border-line pt-4 text-sm text-ink-muted">
                Groupes précédents : {passport.otherGroups.map((g) => g.name).join(', ')}
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
