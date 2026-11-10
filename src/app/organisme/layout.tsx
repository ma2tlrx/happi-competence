import { Clock, ShieldAlert } from 'lucide-react';

import { SpaceShell } from '@/components/app/shell-loader';
import { Card, EmptyState } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';

export default async function OrganismeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('organisme');
  const status = user.organization?.status;
  let content = children;
  if (!user.organization) {
    content = (
      <Card>
        <EmptyState icon={ShieldAlert} title="Aucune structure rattachée" description="Votre compte n’est relié à aucun organisme. Contactez l’équipe HAPPI." />
      </Card>
    );
  } else if (status === 'pending') {
    content = (
      <Card>
        <EmptyState
          icon={Clock}
          title="Votre demande est en cours de validation"
          description={`L’équipe HAPPI vérifie la demande d’ouverture de l’espace « ${user.organization.name} ». Vous serez notifié dès qu’il sera activé.`}
        />
      </Card>
    );
  } else if (status !== 'active') {
    content = (
      <Card>
        <EmptyState
          icon={ShieldAlert}
          title={status === 'suspended' ? 'Espace suspendu' : 'Demande non retenue'}
          description="L’accès aux données des participants est fermé. Contactez l’équipe HAPPI pour en savoir plus."
        />
      </Card>
    );
  }
  return (
    <SpaceShell space="organisme" user={user}>
      {content}
    </SpaceShell>
  );
}
