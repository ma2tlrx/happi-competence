import { Award } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Badge, Card, CardBody, CardHeader, EmptyState, Notice, PageHeader, ProvisionalBadge, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { loadSkillOptions } from '@/lib/badges/eligibility';
import { describeCondition, parseRule } from '@/lib/badges/rules';
import { badgeSigning } from '@/lib/badges/server';
import { createClient } from '@/lib/supabase/server';

import { BadgeClassForm } from './badges-client';

export const metadata: Metadata = { title: 'Badges' };

/** Open Badges 3.0 : modèles, état de la signature, accès au détail (éligibles, émission, révocation). */
export default async function AdminBadgesPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const [{ data: classes }, { data: assertions }, skills] = await Promise.all([
    supabase.from('badge_classes').select('id, name, is_active, is_provisional, award_rule, updated_at').order('created_at'),
    supabase.from('badge_assertions').select('badge_class_id, revoked_at').limit(5000),
    loadSkillOptions(supabase),
  ]);
  const signing = badgeSigning();
  const skillNames = Object.fromEntries(skills.map((skill) => [skill.key, skill.name]));
  const issued = (id: string) => (assertions ?? []).filter((row) => row.badge_class_id === id && !row.revoked_at).length;
  const revoked = (id: string) => (assertions ?? []).filter((row) => row.badge_class_id === id && row.revoked_at).length;

  return (
    <>
      <PageHeader
        title="Badges numériques"
        description="Open Badges 3.0 signés, que les participants emportent dans leur portefeuille numérique et dont l’authenticité se vérifie en ligne."
      />
      {signing.ok ? (
        <Notice className="mb-6" title="Signature active">
          Les badges sont signés avec la clé configurée sur le serveur (RS256). Clé publique :{' '}
          <a className="font-semibold underline underline-offset-2" href="/api/badges/jwks">
            JWKS
          </a>
          , profil de l’émetteur :{' '}
          <a className="font-semibold underline underline-offset-2" href="/api/badges/emetteur">
            /api/badges/emetteur
          </a>
          .
        </Notice>
      ) : (
        <Notice className="mb-6" variant="warning" title="Émission désactivée">
          {signing.message} Les modèles restent modifiables, mais aucun badge ne peut être émis ni vérifié tant que la clé n’est pas configurée (voir docs/open-badges.md :
          génération de la clé et variable OPEN_BADGES_SIGNING_KEY).
        </Notice>
      )}

      <Card className="mb-6">
        <CardHeader title="Modèles de badge" description="Les critères sont une décision de l’équipe HAPPI : un modèle provisoire reste inactif." />
        {(classes ?? []).length > 0 ? (
          <TableWrap label="Modèles de badge">
            <Table>
              <thead>
                <tr>
                  <Th>Modèle</Th>
                  <Th>Statut</Th>
                  <Th>Règle de suggestion</Th>
                  <Th>Émis</Th>
                </tr>
              </thead>
              <tbody>
                {(classes ?? []).map((item) => {
                  const rule = parseRule(item.award_rule);
                  return (
                    <Tr key={item.id}>
                      <Td className="font-semibold">
                        <Link href={`/admin/badges/${item.id}`} className="text-petrol-800 underline-offset-2 hover:underline focus-visible:underline">
                          {item.name}
                        </Link>
                      </Td>
                      <Td>
                        <span className="flex flex-wrap gap-1.5">
                          <Badge variant={item.is_active ? 'success' : 'neutral'}>{item.is_active ? 'Actif' : 'Inactif'}</Badge>
                          {item.is_provisional ? <ProvisionalBadge>Provisoire — à valider</ProvisionalBadge> : null}
                        </span>
                      </Td>
                      <Td className="text-sm text-ink-muted">
                        {rule.conditions.length > 0 ? (
                          <ul className="space-y-0.5">
                            {rule.conditions.map((condition, index) => (
                              <li key={index}>{describeCondition(condition, skillNames)}</li>
                            ))}
                          </ul>
                        ) : (
                          'Aucune (émission manuelle)'
                        )}
                      </Td>
                      <Td className="text-sm whitespace-nowrap text-ink-muted">
                        {issued(item.id)}
                        {revoked(item.id) ? <span className="block">{revoked(item.id)} révoqué(s)</span> : null}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={Award} title="Aucun modèle de badge" />
        )}
      </Card>

      <Card>
        <CardHeader title="Nouveau modèle" description="Il est créé inactif et « provisoire » tant que vous n’avez pas confirmé son critère." />
        <CardBody>
          <BadgeClassForm skills={skills.map((skill) => ({ key: skill.key, label: `${skill.name} (${skill.frameworkName})` }))} />
        </CardBody>
      </Card>
    </>
  );
}
