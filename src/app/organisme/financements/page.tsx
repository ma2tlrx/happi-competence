import { HandCoins, ShieldAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Badge, Card, CardBody, EmptyState, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { conventionStatusLabel, funderKindLabel } from '@/lib/funding/labels';
import { loadOrganizationConventions } from '@/lib/funding/load';
import { canReadImpact } from '@/lib/outcomes/report';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Financements' };

export default async function OrganizationFundingPage() {
  const user = await requireRole('organisme');
  if (!canReadImpact(user)) {
    return (
      <Card>
        <EmptyState icon={ShieldAlert} title="Accès non ouvert" description="Votre compte ne permet pas de consulter les financements. Contactez l’équipe HAPPI." />
      </Card>
    );
  }
  const conventions = await loadOrganizationConventions(await createClient());
  return (
    <>
      <PageHeader
        title="Financements"
        description="Les conventions de financement dont un groupe accueille vos participants, et leur réalisation pour vos seuls participants. Consultation uniquement."
      />
      <Card>
        {conventions.length === 0 ? (
          <EmptyState icon={HandCoins} title="Aucune convention" description="Aucun groupe accueillant vos participants n’est rattaché à une convention en cours ou soldée." />
        ) : (
          <CardBody className="px-0 pb-2 sm:px-0">
            <TableWrap label="Conventions de financement">
              <Table>
                <thead>
                  <tr>
                    <Th>Action</Th>
                    <Th>Financeur</Th>
                    <Th>Période</Th>
                    <Th>Statut</Th>
                  </tr>
                </thead>
                <tbody>
                  {conventions.map((convention) => (
                    <Tr key={convention.id}>
                      <Td className="max-w-[20rem]">
                        <Link href={`/organisme/financements/${convention.id}`} className="inline-flex min-h-8 items-center font-semibold text-petrol-700 underline">
                          {convention.title}
                        </Link>
                        {convention.reference ? <span className="block text-sm text-ink-muted">{convention.reference}</span> : null}
                      </Td>
                      <Td className="text-sm">
                        {convention.funderName}
                        <span className="block text-ink-subtle">{funderKindLabel(convention.funderKind)}</span>
                      </Td>
                      <Td className="text-sm whitespace-nowrap">{`${formatDate(convention.startDate)} → ${formatDate(convention.endDate)}`}</Td>
                      <Td>
                        <Badge variant="petrol">{conventionStatusLabel(convention.status)}</Badge>
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
