'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/overlays';

import { createGroup } from '../actions';
import { GroupForm } from './group-form';

export function NewGroupDialog({ programs, organizations, defaultOpen }: { programs: { id: string; name: string }[]; organizations: { id: string; name: string }[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden />
          Nouveau groupe
        </Button>
      </DialogTrigger>
      <DialogContent title="Créer un groupe" description="Vous serez le formateur référent du groupe. Vous pourrez ensuite ajouter les participants et planifier les sessions.">
        <GroupForm action={createGroup} programs={programs} organizations={organizations} submitLabel="Créer le groupe" />
      </DialogContent>
    </Dialog>
  );
}
