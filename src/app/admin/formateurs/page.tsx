import { KeyRound } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Badge, Card, EmptyState, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

import { UserStatusButton } from '../admin-client';

export const metadata: Metadata = { title: 'Formateurs' };

export default async function AdminTrainersPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const [{ data: trainers }, { data: assignments }] = await Promise.all([
    supabase.from('profiles').select('id, first_name, last_name, email, status, created_at, role').in('role', ['formateur', 'admin']).order('last_name'),
    supabase.from('group_trainers').select('trainer_id, groups ( id, name, status )'),
  ]);
  return (
    <>
      <PageHeader
        title="Formateurs"
        description="Les comptes formateur se créent uniquement avec un code d’accès à usage unique."
        actions={<Button asChild><Link href="/admin/codes-acces"><KeyRound aria-hidden />Créer un compte formateur</Link></Button>}
      />
      <Card>
        {(trainers ?? []).length > 0 ? (
          <TableWrap>
            <Table>
              <thead><tr><Th>Formateur</Th><Th>Groupes attribués</Th><Th>Depuis</Th><Th>Statut</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
              <tbody>
                {trainers!.map((trainer) => {
                  const groups = (assignments ?? []).filter((a) => a.trainer_id === trainer.id && a.groups);
                  return (
                    <Tr key={trainer.id}>
                      <Td>
                        <span className="font-semibold">{trainer.first_name} {trainer.last_name}</span>
                        {trainer.role === 'admin' ? <Badge variant="dark" className="ml-2">Administrateur</Badge> : null}
                        <span className="block text-sm text-ink-subtle">{trainer.email}</span>
                      </Td>
                      <Td className="text-sm">{groups.length ? groups.map((a) => a.groups!.name).join(', ') : <span className="text-ink-subtle">Aucun</span>}</Td>
                      <Td className="text-sm text-ink-muted">{formatDate(trainer.created_at)}</Td>
                      <Td>{trainer.status === 'active' ? <Badge variant="success">Actif</Badge> : <Badge variant="danger">Désactivé</Badge>}</Td>
                      <Td className="text-right">{trainer.role === 'formateur' ? <UserStatusButton userId={trainer.id} status={trainer.status} name={`${trainer.first_name} ${trainer.last_name}`} /> : null}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState title="Aucun formateur" description="Générez un code d’accès « formateur » pour créer le premier compte." />
        )}
      </Card>
    </>
  );
}
