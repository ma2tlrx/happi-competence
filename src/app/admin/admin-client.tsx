'use client';

import { Ban, Check, CheckCheck, Copy, KeyRound, Plus, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react';
import { useActionState, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FormMessage, Input, Select, SubmitButton, Textarea } from '@/components/ui/form';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/overlays';
import { toast } from '@/components/ui/toast';
import type { ActionState } from '@/lib/action-state';
import { ORGANIZATION_TYPES, ROLE_LABELS } from '@/lib/auth/roles';

import {
  assignTrainer,
  createAccessCode,
  createOrganization,
  resolveDataRequest,
  revokeAccessCode,
  revokePassportShare,
  setContactMessageStatus,
  setOrganizationStatus,
  setParticipantOrganization,
  setUserRole,
  setUserStatus,
  togglePermission,
  unassignTrainer,
  updateOrganization,
} from './actions';

type Result = { ok: boolean; message?: string };

function useRun() {
  const [pending, start] = useTransition();
  const run = (action: () => Promise<Result>, success: string, confirm?: string) =>
    start(async () => {
      if (confirm && !window.confirm(confirm)) return;
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.message ?? 'Action impossible.');
    });
  return { pending, run };
}

export function RoleSelect({ userId, role, disabled }: { userId: string; role: string; disabled?: boolean }) {
  const { pending, run } = useRun();
  return (
    <Select
      aria-label="Rôle"
      defaultValue={role}
      disabled={disabled || pending}
      className="h-9 w-40 text-sm"
      onChange={(event) => {
        const next = event.target.value;
        run(() => setUserRole(userId, next), `Rôle changé : ${ROLE_LABELS[next as keyof typeof ROLE_LABELS]}.`, `Changer le rôle de ce compte en « ${ROLE_LABELS[next as keyof typeof ROLE_LABELS]} » ?`);
      }}
    >
      {Object.entries(ROLE_LABELS).map(([value, label]) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </Select>
  );
}

export function UserStatusButton({ userId, status, name, disabled }: { userId: string; status: string; name: string; disabled?: boolean }) {
  const { pending, run } = useRun();
  const active = status === 'active';
  return (
    <Button
      size="sm"
      variant={active ? 'danger-outline' : 'outline'}
      loading={pending}
      disabled={disabled}
      onClick={() =>
        run(
          () => setUserStatus(userId, active ? 'disabled' : 'active'),
          active ? `${name} est désactivé.` : `${name} est réactivé.`,
          active ? `Désactiver le compte de ${name} ? La personne ne pourra plus se connecter.` : undefined,
        )
      }
    >
      {active ? <Ban aria-hidden /> : <RotateCcw aria-hidden />}
      {active ? 'Désactiver' : 'Réactiver'}
    </Button>
  );
}

export function PermissionToggle({ role, permission, enabled, label }: { role: string; permission: string; enabled: boolean; label: string }) {
  const { pending, run } = useRun();
  return (
    <input
      type="checkbox"
      aria-label={label}
      defaultChecked={enabled}
      disabled={pending}
      className="size-5 cursor-pointer accent-[#102c32]"
      onChange={(event) => {
        const next = event.target.checked;
        run(() => togglePermission(role, permission, next), next ? 'Permission accordée.' : 'Permission retirée.');
      }}
    />
  );
}

export function OrganizationStatusActions({ id, status, name }: { id: string; status: string; name: string }) {
  const { pending, run } = useRun();
  const [reason, setReason] = useState('');
  if (status === 'pending') {
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={pending} onClick={() => run(() => setOrganizationStatus(id, 'active'), `${name} est validé.`)}>
          <Check aria-hidden />
          Valider
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="danger-outline">
              <X aria-hidden />
              Refuser
            </Button>
          </DialogTrigger>
          <DialogContent title={`Refuser la demande de ${name}`} description="Le motif est communiqué aux demandeurs dans leur notification.">
            <Field label="Motif" optional>{({ id: fieldId }) => <Textarea id={fieldId} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />}</Field>
            <Button className="mt-4" variant="danger" loading={pending} onClick={() => run(() => setOrganizationStatus(id, 'rejected', reason), 'Demande refusée.')}>
              Confirmer le refus
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
  if (status === 'active') {
    return (
      <Button size="sm" variant="danger-outline" loading={pending} onClick={() => run(() => setOrganizationStatus(id, 'suspended'), `${name} est suspendu.`, `Suspendre ${name} ? Ses membres n’auront plus accès aux données des participants.`)}>
        <Ban aria-hidden />
        Suspendre
      </Button>
    );
  }
  return (
    <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => setOrganizationStatus(id, 'active'), `${name} est réactivé.`)}>
      <RotateCcw aria-hidden />
      Réactiver
    </Button>
  );
}

export function OrganizationDialog({
  organization,
}: {
  organization?: { id: string; name: string; type: string; city: string | null; siret: string | null; contact_email: string | null };
}) {
  const action = organization ? updateOrganization.bind(null, organization.id) : createOrganization;
  const [state, formAction] = useActionState(action, null);
  const errors = state?.fieldErrors ?? {};
  return (
    <Dialog>
      <DialogTrigger asChild>
        {organization ? (
          <Button size="sm" variant="ghost">Modifier</Button>
        ) : (
          <Button>
            <Plus aria-hidden />
            Nouvel organisme
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={organization ? `Modifier ${organization.name}` : 'Créer un organisme'}>
        <form action={formAction} className="space-y-4" noValidate>
          <Field label="Nom" required error={errors.name}>{({ id }) => <Input id={id} name="name" defaultValue={organization?.name} />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" required>
              {({ id }) => (
                <Select id={id} name="type" defaultValue={organization?.type ?? 'mission_locale'}>
                  {Object.entries(ORGANIZATION_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Ville" optional>{({ id }) => <Input id={id} name="city" defaultValue={organization?.city ?? ''} />}</Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SIRET" optional error={errors.siret}>{({ id }) => <Input id={id} name="siret" defaultValue={organization?.siret ?? ''} />}</Field>
            <Field label="E-mail de contact" optional error={errors.contactEmail}>{({ id }) => <Input id={id} name="contactEmail" type="email" defaultValue={organization?.contact_email ?? ''} />}</Field>
          </div>
          <FormMessage state={state} />
          <SubmitButton>{organization ? 'Enregistrer' : 'Créer l’organisme'}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ParticipantOrganizationSelect({ participantId, value, organizations, name }: { participantId: string; value: string | null; organizations: { id: string; name: string }[]; name: string }) {
  const { pending, run } = useRun();
  return (
    <Select
      aria-label={`Organisme de ${name}`}
      defaultValue={value ?? ''}
      disabled={pending}
      className="h-9 min-w-48 text-sm"
      onChange={(event) => {
        const next = event.target.value || null;
        run(() => setParticipantOrganization(participantId, next), 'Rattachement enregistré.');
      }}
    >
      <option value="">Aucun organisme</option>
      {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
    </Select>
  );
}

export function TrainerAssignment({ groupId, assigned, trainers }: { groupId: string; assigned: { id: string; name: string; lead: boolean }[]; trainers: { id: string; name: string }[] }) {
  const { pending, run } = useRun();
  const available = trainers.filter((trainer) => !assigned.some((a) => a.id === trainer.id));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {assigned.map((trainer) => (
        <span key={trainer.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-paper py-0.5 pr-1 pl-2.5 text-sm">
          {trainer.name}
          {trainer.lead ? <span className="text-xs text-ink-subtle">(référent)</span> : null}
          <button type="button" disabled={pending} onClick={() => run(() => unassignTrainer(groupId, trainer.id), 'Formateur retiré du groupe.', `Retirer ${trainer.name} de ce groupe ?`)} className="-my-1 flex size-8 items-center justify-center rounded-full hover:bg-line" aria-label={`Retirer ${trainer.name}`}>
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      {available.length > 0 ? (
        <select
          aria-label="Ajouter un formateur"
          value=""
          disabled={pending}
          onChange={(event) => event.target.value && run(() => assignTrainer(groupId, event.target.value), 'Formateur attribué.')}
          className="h-7 rounded-full border border-dashed border-line-strong bg-white px-2 text-sm text-ink-muted"
        >
          <option value="">+ Formateur</option>
          {available.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.name}</option>)}
        </select>
      ) : null}
    </div>
  );
}

export function AccessCodeForm({ organizations }: { organizations: { id: string; name: string }[] }) {
  const [state, action] = useActionState(createAccessCode, null);
  const [role, setRole] = useState('formateur');
  const errors = state?.fieldErrors ?? {};
  const code = state?.ok ? state.data?.code : null;
  return (
    <div className="space-y-4">
      {code ? (
        <div className="rounded-lg border border-success/30 bg-success-soft p-4" role="status">
          <p className="flex items-center gap-2 font-semibold text-success">
            <ShieldCheck className="size-5" aria-hidden />
            Code généré : copiez-le maintenant
          </p>
          <p className="mt-1 text-sm text-ink-muted">Seule son empreinte est conservée : il ne pourra plus être affiché.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-white px-3 py-2 font-mono text-lg font-semibold tracking-wider text-ink select-all">{code}</code>
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(code).then(() => toast.success('Code copié.'))}>
              <Copy aria-hidden />
              Copier
            </Button>
          </div>
        </div>
      ) : null}
      <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end" noValidate>
        <Field label="Rôle accordé">
          {({ id }) => (
            <Select id={id} name="role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="formateur">Formateur</option>
              <option value="organisme">Membre d’organisme</option>
              <option value="admin">Administrateur</option>
            </Select>
          )}
        </Field>
        {role === 'organisme' ? (
          <Field label="Organisme" required>
            {({ id }) => (
              <Select id={id} name="organizationId" defaultValue="">
                <option value="" disabled>Sélectionner</option>
                {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
              </Select>
            )}
          </Field>
        ) : (
          <input type="hidden" name="organizationId" value="" />
        )}
        <Field label="Libellé" optional hint="Pour qui, pour quoi.">{({ id, describedBy }) => <Input id={id} name="label" aria-describedby={describedBy} placeholder="Ex. Formatrice Montpellier" />}</Field>
        <Field label="Expire le" optional error={errors.expiresAt}>{({ id }) => <Input id={id} name="expiresAt" type="date" />}</Field>
        <div className="sm:col-span-2 lg:col-span-4">
          {!state?.ok ? <FormMessage state={state} /> : null}
          <SubmitButton>
            <KeyRound aria-hidden />
            Générer un code à usage unique
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

export function RevokeCodeButton({ id }: { id: string }) {
  const { pending, run } = useRun();
  return (
    <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => revokeAccessCode(id), 'Code révoqué.', 'Révoquer ce code ? Il ne pourra plus être utilisé.')}>
      <Trash2 aria-hidden />
      Révoquer
    </Button>
  );
}

export function RevokePassportShareButton({ id }: { id: string }) {
  const { pending, run } = useRun();
  return (
    <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => revokePassportShare(id), 'Lien révoqué.', 'Révoquer ce lien de partage ? Le participant verra qu’il a été retiré par l’équipe HAPPI.')}>
      <Ban aria-hidden />
      Révoquer
    </Button>
  );
}

export function MessageActions({ id, status }: { id: string; status: string }) {
  const { pending, run } = useRun();
  return status === 'new' ? (
    <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => setContactMessageStatus(id, 'read'), 'Message marqué comme lu.')}>
      <CheckCheck aria-hidden />
      Marquer lu
    </Button>
  ) : status === 'read' ? (
    <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => setContactMessageStatus(id, 'archived'), 'Message archivé.')}>
      Archiver
    </Button>
  ) : null;
}

export function DataRequestActions({ id, type }: { id: string; type: string }) {
  const { pending, run } = useRun();
  const [note, setNote] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input aria-label="Note de traitement" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (facultative)" className="h-9 max-w-56 text-sm" />
      <Button
        size="sm"
        variant={type === 'deletion' ? 'danger' : 'primary'}
        loading={pending}
        onClick={() =>
          run(
            () => resolveDataRequest(id, 'completed', note),
            type === 'deletion' ? 'Données et compte supprimés.' : 'Demande traitée.',
            type === 'deletion' ? 'Supprimer définitivement les données et le compte de cette personne ? Cette action est irréversible.' : undefined,
          )
        }
      >
        {type === 'deletion' ? 'Supprimer les données' : 'Marquer traitée'}
      </Button>
      <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => resolveDataRequest(id, 'rejected', note), 'Demande refusée.')}>
        Refuser
      </Button>
    </div>
  );
}

export type { ActionState };
