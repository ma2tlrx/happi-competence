import { ArrowLeft, CalendarDays, Pencil } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SessionStatusBadge } from '@/components/passport/session-status';
import { GROUP_STATUS } from '@/components/trainer/labels';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/overlays';
import { Avatar, Badge, Card, CardBody, CardHeader, EmptyState, Notice, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatTimeRange, isUuid } from '@/lib/utils';

import { updateGroup } from '../../actions';
import { GroupForm } from '../group-form';
import { AddMemberDialog, MemberActions, OrganizationSelect, PlanSessionsForm } from './group-client';

export const metadata: Metadata = { title: 'Groupe' };

export default async function GroupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cree?: string; planifie?: string }> }) {
  const { id } = await params;
  const { cree, planifie } = await searchParams;
  if (!isUuid(id)) notFound();
  const user = await requireRole('formateur', 'admin');
  const supabase = await createClient();
  const { data: group } = await supabase
    .from('groups')
    .select('id, name, status, start_date, end_date, program_id, organization_id, programs ( id, name, min_group_size, max_group_size ), organizations ( id, name )')
    .eq('id', id)
    .maybeSingle();
  if (!group) notFound();

  const [members, sessions, outline, trainers, programs, organizations, staff, candidates] = await Promise.all([
    supabase
      .from('group_members')
      .select('status, joined_at, participants ( id, first_name, last_name, email, user_id, organization_id )')
      .eq('group_id', id)
      .order('joined_at'),
    supabase.from('sessions').select('id, number, scheduled_date, start_time, end_time, status, program_session_id').eq('group_id', id).order('number'),
    supabase.from('program_sessions').select('id, number, title').eq('program_id', group.program_id).order('number'),
    supabase.from('group_trainers').select('trainer_id, is_lead').eq('group_id', id),
    supabase.from('programs').select('id, name').eq('status', 'active'),
    supabase.from('organizations').select('id, name').eq('status', 'active').order('name'),
    supabase.from('staff_directory').select('id, first_name, last_name'),
    supabase.from('participants').select('id, first_name, last_name, email').eq('status', 'active').order('last_name').limit(200),
  ]);
  const sessionIds = (sessions.data ?? []).map((session) => session.id);
  const { data: attendance } = sessionIds.length
    ? await supabase.from('attendance').select('participant_id, session_id, status').in('session_id', sessionIds)
    : { data: [] as { participant_id: string; session_id: string; status: string }[] };

  const activeMembers = (members.data ?? []).filter((member) => member.status === 'active' && member.participants);
  const removedMembers = (members.data ?? []).filter((member) => member.status !== 'active' && member.participants);
  const memberIds = new Set((members.data ?? []).map((member) => member.participants?.id));
  const max = group.programs?.max_group_size ?? 8;
  const min = group.programs?.min_group_size ?? 4;
  const planned = new Set((sessions.data ?? []).map((session) => session.program_session_id));
  const missing = (outline.data ?? []).filter((item) => !planned.has(item.id));
  const staffName = new Map((staff.data ?? []).map((person) => [person.id, `${person.first_name} ${person.last_name}`]));
  const canManage = hasPermission(user, 'groups.manage');
  const canLink = hasPermission(user, 'participants.link_organization');
  const status = GROUP_STATUS[group.status] ?? GROUP_STATUS.active!;
  // Présences comptées sur les seules sessions terminées, comme le dénominateur (et comme l'espace organisme).
  const completedIds = new Set((sessions.data ?? []).filter((session) => session.status === 'completed').map((session) => session.id));
  const attended = (participantId: string) =>
    (attendance ?? []).filter(
      (row) => row.participant_id === participantId && completedIds.has(row.session_id) && ['present', 'late', 'left_early'].includes(row.status),
    ).length;

  return (
    <>
      <PageHeader
        back={
          <Link href="/formateur/groupes" className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden />
            Groupes
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {group.name}
            <Badge variant={status.variant}>{status.label}</Badge>
          </span>
        }
        description={[group.programs?.name, group.organizations?.name ?? 'Sans organisme', group.start_date ? `${formatDate(group.start_date)} – ${formatDate(group.end_date, '…')}` : null].filter(Boolean).join(' · ')}
        actions={
          canManage ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Pencil aria-hidden />
                  Modifier
                </Button>
              </DialogTrigger>
              <DialogContent title="Modifier le groupe">
                <GroupForm
                  action={updateGroup.bind(null, group.id)}
                  programs={programs.data ?? []}
                  organizations={organizations.data ?? []}
                  submitLabel="Enregistrer"
                  withStatus
                  initial={{ name: group.name, programId: group.program_id, organizationId: group.organization_id, startDate: group.start_date, endDate: group.end_date, status: group.status }}
                />
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {cree ? (
        <Notice variant="success" className="mb-6" title="Groupe créé">
          Ajoutez maintenant les participants, puis planifiez les sessions du programme.
        </Notice>
      ) : null}
      {planifie ? (
        <Notice variant="success" className="mb-6" title={`${planifie} session${Number(planifie) > 1 ? 's' : ''} créée${Number(planifie) > 1 ? 's' : ''}`}>
          Ajustez si besoin les dates et horaires depuis chaque session.
        </Notice>
      ) : null}

      <div className="space-y-6">
        <Card>
          <CardHeader
            title={`Participants (${activeMembers.length}/${max})`}
            description={
              activeMembers.length < min
                ? `Le fonctionnement recommandé prévoit au moins ${min} participants.`
                : activeMembers.length >= max
                  ? 'Le groupe est complet.'
                  : `Entre ${min} et ${max} participants.`
            }
            action={
              canManage ? (
                <AddMemberDialog
                  groupId={group.id}
                  full={activeMembers.length >= max}
                  candidates={(candidates.data ?? [])
                    .filter((candidate) => !memberIds.has(candidate.id))
                    .map((candidate) => ({ id: candidate.id, label: `${candidate.last_name} ${candidate.first_name}${candidate.email ? ` · ${candidate.email}` : ''}` }))}
                />
              ) : null
            }
          />
          <CardBody className="px-0 pb-2 sm:px-0">
            {activeMembers.length > 0 ? (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Participant</Th>
                      <Th>Compte</Th>
                      <Th>Organisme</Th>
                      <Th className="text-right">Présences</Th>
                      <Th className="text-right">
                        <span className="sr-only">Actions</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeMembers.map(({ participants: person }) => {
                      const name = `${person!.first_name} ${person!.last_name}`;
                      return (
                        <Tr key={person!.id}>
                          <Td>
                            <div className="flex items-center gap-3">
                              <Avatar person={person} size="sm" />
                              <div className="min-w-0">
                                <Link href={`/formateur/participants/${person!.id}`} className="font-medium text-ink hover:text-petrol-700 hover:underline">
                                  {name}
                                </Link>
                                <span className="block truncate text-sm text-ink-subtle">{person!.email}</span>
                              </div>
                            </div>
                          </Td>
                          <Td>{person!.user_id ? <Badge variant="success">Créé</Badge> : <Badge variant="outline">Invité</Badge>}</Td>
                          <Td>
                            <OrganizationSelect
                              participantId={person!.id}
                              groupId={group.id}
                              value={person!.organization_id}
                              organizations={organizations.data ?? []}
                              disabled={!canLink}
                              name={name}
                            />
                          </Td>
                          <Td className="text-right tabular-nums">{attended(person!.id)}/{completedIds.size}</Td>
                          <Td className="text-right">{canManage ? <MemberActions groupId={group.id} participantId={person!.id} name={name} removed={false} /> : null}</Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            ) : (
              <EmptyState title="Aucun participant" description="Ajoutez les personnes qui suivront ce groupe." />
            )}
            {removedMembers.length > 0 ? (
              <details className="border-t border-line px-5 py-3 sm:px-6">
                <summary className="cursor-pointer text-sm font-semibold text-ink-muted">{removedMembers.length} participant(s) retiré(s)</summary>
                <ul className="mt-2 space-y-2">
                  {removedMembers.map(({ participants: person }) => (
                    <li key={person!.id} className="flex items-center justify-between gap-3 text-[0.9375rem]">
                      <span>{person!.first_name} {person!.last_name}</span>
                      {canManage ? <MemberActions groupId={group.id} participantId={person!.id} name={`${person!.first_name} ${person!.last_name}`} removed /> : null}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </CardBody>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader title="Sessions" description={`${(sessions.data ?? []).length} sur ${(outline.data ?? []).length} planifiées`} />
            <CardBody className="pt-3">
              {(sessions.data ?? []).length > 0 ? (
                <ul className="divide-y divide-line">
                  {sessions.data!.map((session) => (
                    <li key={session.id}>
                      <Link href={`/formateur/sessions/${session.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:text-petrol-700">
                        <span className="flex items-center gap-3">
                          <span className="flex size-8 items-center justify-center rounded-md bg-petrol-50 font-display text-sm font-semibold text-petrol-800">{session.number}</span>
                          <span>
                            <span className="block font-medium">{(outline.data ?? []).find((item) => item.id === session.program_session_id)?.title}</span>
                            <span className="flex items-center gap-1.5 text-sm text-ink-muted">
                              <CalendarDays className="size-3.5" aria-hidden />
                              {formatDate(session.scheduled_date)} · {formatTimeRange(session.start_time, session.end_time)}
                            </span>
                          </span>
                        </span>
                        <SessionStatusBadge status={session.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              {missing.length > 0 && hasPermission(user, 'sessions.manage') ? (
                <div className={(sessions.data ?? []).length > 0 ? 'mt-4 border-t border-line pt-4' : ''}>
                  <PlanSessionsForm groupId={group.id} missing={missing} defaultStart={group.start_date} />
                </div>
              ) : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Formateurs" description="Les attributions sont gérées par l’administrateur." />
            <CardBody className="pt-3">
              <ul className="space-y-3">
                {(trainers.data ?? []).map((trainer) => (
                  <li key={trainer.trainer_id} className="flex items-center gap-3">
                    <Avatar person={{ first_name: staffName.get(trainer.trainer_id)?.split(' ')[0], last_name: staffName.get(trainer.trainer_id)?.split(' ')[1] }} size="sm" />
                    <span className="text-[0.9375rem]">{staffName.get(trainer.trainer_id) ?? 'Formateur'}</span>
                    {trainer.is_lead ? <Badge variant="petrol">Référent</Badge> : null}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
