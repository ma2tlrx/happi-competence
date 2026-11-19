import { ArrowLeft, UserCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge, Card, CardBody, CardHeader, EmptyState, Notice, PageHeader, ProvisionalBadge, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { loadMemberships, loadSkillOptions } from '@/lib/badges/eligibility';
import { evaluateRule, parseRule } from '@/lib/badges/rules';
import { badgeSigning } from '@/lib/badges/server';
import { createClient } from '@/lib/supabase/server';
import { formatDate, isUuid } from '@/lib/utils';

import { BadgeClassForm, IssueButton, ManualIssueForm, RevokeBadgeButton } from '../badges-client';

export const metadata: Metadata = { title: 'Modèle de badge' };

export default async function AdminBadgeClassPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data: badgeClass } = await supabase
    .from('badge_classes')
    .select('id, name, description, criteria_narrative, image_url, related_skills, award_rule, is_active, is_provisional')
    .eq('id', id)
    .maybeSingle();
  if (!badgeClass) notFound();

  const [skills, memberships, { data: assertions }] = await Promise.all([
    loadSkillOptions(supabase),
    loadMemberships(supabase),
    supabase
      .from('badge_assertions')
      .select('id, participant_id, issued_at, revoked_at, revocation_reason, participants ( first_name, last_name ), groups ( name )')
      .eq('badge_class_id', id)
      .order('issued_at', { ascending: false }),
  ]);
  const signing = badgeSigning();
  const canIssue = signing.ok && badgeClass.is_active && !badgeClass.is_provisional;
  const rule = parseRule(badgeClass.award_rule);
  const skillNames = Object.fromEntries(skills.map((skill) => [skill.key, skill.name]));
  const holders = new Set((assertions ?? []).filter((row) => !row.revoked_at).map((row) => row.participant_id));
  const candidates = memberships.filter((membership) => !holders.has(membership.participantId));
  const eligible = candidates
    .map((membership) => ({ membership, evaluation: evaluateRule(rule, membership.facts, skillNames) }))
    .filter((item) => item.evaluation.eligible);
  const related = Array.isArray(badgeClass.related_skills)
    ? badgeClass.related_skills.flatMap((item) => (item && typeof item === 'object' && !Array.isArray(item) ? [`${String(item.framework)}:${String(item.code)}`] : []))
    : [];

  return (
    <>
      <PageHeader
        back={
          <Link href="/admin/badges" className="inline-flex min-h-8 items-center gap-1.5 font-semibold text-petrol-700 hover:text-petrol-950">
            <ArrowLeft className="size-4" aria-hidden />
            Tous les badges
          </Link>
        }
        title={badgeClass.name}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge variant={badgeClass.is_active ? 'success' : 'neutral'}>{badgeClass.is_active ? 'Actif' : 'Inactif'}</Badge>
            {badgeClass.is_provisional ? <ProvisionalBadge>Provisoire — à valider</ProvisionalBadge> : null}
          </span>
        }
      />
      {!signing.ok ? (
        <Notice className="mb-6" variant="warning" title="Émission désactivée">
          {signing.message}
        </Notice>
      ) : !canIssue ? (
        <Notice className="mb-6" variant="warning" title="Modèle non émis">
          Confirmez le critère puis activez le modèle pour pouvoir émettre ce badge.
        </Notice>
      ) : null}

      <Card className="mb-6">
        <CardHeader
          title="Participants éligibles"
          description={
            rule.conditions.length > 0
              ? 'Suggestion calculée à partir des faits mesurés (présences, séances, évaluations validées), groupe par groupe. Rien n’est émis sans votre clic.'
              : 'Aucune règle de suggestion : utilisez l’émission manuelle ci-dessous.'
          }
        />
        {eligible.length > 0 ? (
          <TableWrap label="Participants éligibles">
            <Table>
              <thead>
                <tr>
                  <Th>Participant</Th>
                  <Th>Groupe</Th>
                  <Th>Conditions</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {eligible.map(({ membership, evaluation }) => (
                  <Tr key={`${membership.participantId}-${membership.groupId}`}>
                    <Td className="font-semibold">
                      {membership.lastName.toUpperCase()} {membership.firstName}
                    </Td>
                    <Td className="text-sm text-ink-muted">{membership.groupName}</Td>
                    <Td className="text-sm text-ink-muted">
                      <ul className="space-y-0.5">
                        {evaluation.results.map((result, index) => (
                          <li key={index}>{result.detail}</li>
                        ))}
                      </ul>
                    </Td>
                    <Td className="text-right">
                      <IssueButton
                        badgeClassId={badgeClass.id}
                        participantId={membership.participantId}
                        groupId={membership.groupId}
                        name={`${membership.firstName} ${membership.lastName}`}
                        disabled={!canIssue}
                      />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={UserCheck} title={rule.conditions.length > 0 ? 'Aucun participant éligible pour le moment' : 'Pas de suggestion'} />
        )}
        <CardBody className="border-t border-line">
          <ManualIssueForm
            badgeClassId={badgeClass.id}
            disabled={!canIssue}
            options={candidates.map((membership) => ({
              value: `${membership.participantId}|${membership.groupId}`,
              label: `${membership.lastName.toUpperCase()} ${membership.firstName} — ${membership.groupName}`,
            }))}
          />
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardHeader title="Badges émis" description={`${holders.size} badge(s) valide(s).`} />
        {(assertions ?? []).length > 0 ? (
          <TableWrap label="Badges émis">
            <Table>
              <thead>
                <tr>
                  <Th>Participant</Th>
                  <Th>Groupe</Th>
                  <Th>Émis le</Th>
                  <Th>Statut</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {(assertions ?? []).map((row) => {
                  const name = row.participants ? `${row.participants.first_name} ${row.participants.last_name}` : 'Participant';
                  return (
                    <Tr key={row.id}>
                      <Td className="font-semibold">{row.participants ? `${row.participants.last_name.toUpperCase()} ${row.participants.first_name}` : '—'}</Td>
                      <Td className="text-sm text-ink-muted">{row.groups?.name ?? '—'}</Td>
                      <Td className="text-sm whitespace-nowrap text-ink-muted">{formatDate(row.issued_at)}</Td>
                      <Td>
                        <Badge variant={row.revoked_at ? 'neutral' : 'success'}>{row.revoked_at ? `Révoqué le ${formatDate(row.revoked_at)}` : 'Valide'}</Badge>
                        {row.revocation_reason ? <span className="mt-1 block max-w-64 text-xs text-ink-subtle">{row.revocation_reason}</span> : null}
                      </Td>
                      <Td className="text-right">{row.revoked_at ? null : <RevokeBadgeButton id={row.id} name={name} />}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState title="Aucun badge émis" />
        )}
      </Card>

      <Card>
        <CardHeader title="Modèle et règle" description="Les badges déjà émis gardent le texte signé au moment de leur émission." />
        <CardBody>
          <BadgeClassForm
            skills={skills.map((skill) => ({ key: skill.key, label: `${skill.name} (${skill.frameworkName})` }))}
            values={{
              id: badgeClass.id,
              name: badgeClass.name,
              description: badgeClass.description,
              criteria: badgeClass.criteria_narrative,
              imageUrl: badgeClass.image_url ?? '',
              relatedSkills: related,
              rule,
              validated: !badgeClass.is_provisional,
              active: badgeClass.is_active,
            }}
          />
        </CardBody>
      </Card>
    </>
  );
}
