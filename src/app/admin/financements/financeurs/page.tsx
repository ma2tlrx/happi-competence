import { Landmark } from 'lucide-react';
import type { Metadata } from 'next';

import { DeleteButton, RecordDialog } from '@/components/quality/record-dialog';
import { Badge, Card, CardBody, EmptyState, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { deleteFunder, saveFunder } from '@/lib/funding/actions';
import { funderFields } from '@/lib/funding/forms';
import { funderKindLabel } from '@/lib/funding/labels';
import { loadFunders } from '@/lib/funding/load';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Financeurs' };

export default async function FundersPage() {
  await requireRole('admin');
  const funders = await loadFunders(await createClient());

  return (
    <>
      <PageHeader
        title="Financeurs"
        description="France Travail, Région, Département, État, OPCO, FSE+, Mission Locale, fondations… Le type détermine la ligne d’origine du financement dans le bilan pédagogique et financier."
        actions={<RecordDialog mode="create" triggerLabel="Ajouter un financeur" title="Nouveau financeur" fields={funderFields()} action={saveFunder.bind(null, null)} />}
      />
      <Card>
        {funders.length === 0 ? (
          <EmptyState icon={Landmark} title="Aucun financeur" description="Enregistrez les financeurs de vos actions pour y rattacher des conventions." />
        ) : (
          <CardBody className="px-0 pb-2 sm:px-0">
            <TableWrap label="Financeurs">
              <Table>
                <thead>
                  <tr>
                    <Th>Financeur</Th>
                    <Th>Type</Th>
                    <Th>Contact</Th>
                    <Th className="text-right">Conventions</Th>
                    <Th className="text-right">
                      <span className="sr-only">Gestion</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {funders.map((funder) => (
                    <Tr key={funder.id}>
                      <Td className="font-semibold">
                        {funder.name} {funder.isDemo ? <Badge variant="orange">Démo</Badge> : null}
                      </Td>
                      <Td className="text-sm">{funderKindLabel(funder.kind)}</Td>
                      <Td className="text-sm">
                        {funder.contactName ?? <span className="text-ink-subtle">Non renseigné</span>}
                        {funder.contactEmail ? <span className="block break-all text-ink-muted">{funder.contactEmail}</span> : null}
                        {funder.contactPhone ? <span className="block text-ink-muted">{funder.contactPhone}</span> : null}
                      </Td>
                      <Td className="text-right">{funder.conventions}</Td>
                      <Td className="text-right whitespace-nowrap">
                        <RecordDialog
                          mode="edit"
                          triggerLabel="Modifier"
                          ariaLabel={`Modifier le financeur « ${funder.name} »`}
                          title="Financeur"
                          fields={funderFields(funder)}
                          action={saveFunder.bind(null, funder.id)}
                        />
                        {funder.conventions === 0 ? (
                          <DeleteButton action={deleteFunder.bind(null, funder.id)} label={`Supprimer le financeur « ${funder.name} »`} confirm="Supprimer ce financeur ?" />
                        ) : null}
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
