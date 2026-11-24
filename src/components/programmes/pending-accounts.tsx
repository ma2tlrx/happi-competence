'use client';

import { Check } from 'lucide-react';
import { useState, useTransition } from 'react';

import { approvePasseportNumeriqueAccount } from '@/app/formateur/programmes/actions';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { toast } from '@/components/ui/toast';

export type PendingAccount = { id: string; name: string; email: string | null; createdAt: string };
export type SessionOption = { id: string; label: string };

/** Comptes Passeport Numérique en attente : le formateur choisit la session et valide. */
export function PendingAccountsList({ accounts, sessions }: { accounts: PendingAccount[]; sessions: SessionOption[] }) {
  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {accounts.map((account) => (
        <PendingRow key={account.id} account={account} sessions={sessions} />
      ))}
    </ul>
  );
}

function PendingRow({ account, sessions }: { account: PendingAccount; sessions: SessionOption[] }) {
  const [groupId, setGroupId] = useState(sessions[0]?.id ?? '');
  const [pending, start] = useTransition();
  const approve = () =>
    start(async () => {
      const result = await approvePasseportNumeriqueAccount(account.id, groupId);
      if (result.ok) toast.success(`${account.name} est validé(e) : l’accès aux ateliers est ouvert.`);
      else toast.error(result.message ?? 'Validation impossible.');
    });
  return (
    <li className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{account.name}</p>
        <p className="truncate text-sm text-ink-muted">
          {account.email ?? 'Sans adresse e-mail'} · compte créé le {account.createdAt}
        </p>
      </div>
      <Select aria-label={`Session pour ${account.name}`} value={groupId} onChange={(event) => setGroupId(event.target.value)} disabled={sessions.length === 0} className="sm:w-64">
        {sessions.length === 0 ? <option value="">Aucune session</option> : sessions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </Select>
      <Button size="sm" onClick={approve} loading={pending} disabled={!groupId}>
        <Check aria-hidden />
        Valider
      </Button>
    </li>
  );
}
