import { HandCoins } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { DeleteButton, RecordDialog } from '@/components/quality/record-dialog';
import { Badge, Card, CardBody, EmptyState, Notice, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { deleteConvention, saveConvention } from '@/lib/funding/actions';
import { conventionFields } from '@/lib/funding/forms';
import { conventionStatusLabel, funderKindLabel } from '@/lib/funding/labels';
import { loadConventions, loadFunders } from '@/lib/funding/load';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Financements' };

const STATUS_VARIANT = { brouillon: 'neutral', en_cours: 'petrol', soldee: 'success' } as const;

export default async function FundingPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const [conventions, funders] = await Promise.all([loadConventions(supabase), loadFunders(supabase)]);

  return (
    <>
      <PageHeader
        title="Conventions de financement"
        description="Rattachez les groupes à la convention ou au marché qui les finance, suivez le réalisé face au conventionné et produisez le bilan de l’action."
        actions={
          funders.length ? (
            <RecordDialog
              mode="create"
              triggerLabel="Nouvelle convention"
              title="Nouvelle convention"
              fields={conventionFields(funders, { plannedHours: 18 })}
              action={saveConvention.bind(null, null)}
            />
          ) : null
        }
      />
      {funders.length === 0 ? (
        <Notice className="mb-6" title="Commencez par enregistrer un financeur">
          <Link href="/admin/financements/financeurs" className="font-semibold text-petrol-700 underline">
            Ajouter un financeur
          </Link>{' '}
          (France Travail, Région, OPCO…), puis créez sa convention.
        </Notice>
      ) : null}
      <Card>
        {conventions.length === 0 ? (
          <EmptyState icon={HandCoins} title="Aucune convention" description="Une convention regroupe un ou plusieurs groupes financés par un même financeur." />
        ) : (
          <CardBody className="px-0 pb-2 sm:px-0">
            <TableWrap label="Conventions de financement">
              <Table>
                <thead>
                  <tr>
                    <Th>Action</Th>
                    <Th>Financeur</Th>
                    <Th>Période</Th>
                    <Th className="text-right">Conventionnés</Th>
                    <Th className="text-right">Groupes</Th>
                    <Th>Statut</Th>
                    <Th className="text-right">
                      <span className="sr-only">Gestion</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {conventions.map((convention) => (
                    <Tr key={convention.id}>
                      <Td className="max-w-[20rem]">
                        <Link href={`/admin/financements/${convention.id}`} className="inline-flex min-h-8 items-center font-semibold text-petrol-700 underline">
                          {convention.title}
                        </Link>
                        {convention.reference ? <span className="block text-sm text-ink-muted">{convention.reference}</span> : null}
                        {convention.isDemo ? <Badge variant="orange">Démo</Badge> : null}
                      </Td>
                      <Td className="text-sm">
                        {convention.funderName}
                        <span className="block text-ink-subtle">{funderKindLabel(convention.funderKind)}</span>
                      </Td>
                      <Td className="text-sm whitespace-nowrap">{`${formatDate(convention.startDate)} → ${formatDate(convention.endDate)}`}</Td>
                      <Td className="text-right">{convention.plannedParticipants}</Td>
                      <Td className="text-right">{convention.groupIds.length}</Td>
                      <Td>
                        <Badge variant={STATUS_VARIANT[convention.status as keyof typeof STATUS_VARIANT] ?? 'neutral'}>{conventionStatusLabel(convention.status)}</Badge>
                      </Td>
                      <Td className="text-right">
                        <DeleteButton
                          action={deleteConvention.bind(null, convention.id)}
                          label={`Supprimer la convention « ${convention.title} »`}
                          confirm="Supprimer cette convention ? Ses groupes sont conservés mais n’y sont plus rattachés."
                        />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </CardBody>
        )}
      </Card>
    </>
  );
}
