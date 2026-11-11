import type { Metadata } from 'next';

import { Card, CardBody, CardHeader, Notice, PageHeader } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { DEMO_SPACES, demoStatus, isDemoAllowed } from '@/lib/demo/environment';
import { isAdminClientConfigured } from '@/lib/supabase/admin';

import { DemoControls } from './demo-controls';

export const metadata: Metadata = { title: 'Démonstration' };
// La création complète enchaîne quelques centaines d'écritures.
export const maxDuration = 300;

export default async function DemonstrationPage() {
  await requireRole('admin');
  const available = isDemoAllowed() && isAdminClientConfigured();
  const status = available ? await demoStatus() : null;
  const exists = Boolean(status && (status.profiles > 0 || status.participants > 0));
  return (
    <>
      <PageHeader
        title="Démonstration"
        description="Des comptes et des données fictifs, tous marqués « démo », pour découvrir les espaces formateur, organisme et participant, puis tout supprimer en un clic."
      />
      {!available ? (
        <Notice variant="warning">La démonstration n’est pas disponible sur cet environnement (clé de service absente ou HAPPI_ALLOW_DEMO=false).</Notice>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={exists ? 'Démonstration en place' : 'Aucune donnée de démonstration'}
              description={
                exists && status
                  ? `${status.organizations} organismes · ${status.groups} groupes · ${status.participants} participants · ${status.profiles} comptes · ${status.reports} bilans, tous marqués « démo ».`
                  : 'Créez un jeu complet : deux organismes, deux groupes, des sessions passées et à venir, des présences, des évaluations validées et des auto-évaluations.'
              }
            />
            <CardBody>
              <DemoControls
                exists={exists}
                spaces={Object.entries(DEMO_SPACES).map(([key, value]) => ({ key: key as keyof typeof DEMO_SPACES, label: value.label, email: value.email }))}
              />
            </CardBody>
          </Card>
          <Notice variant="info">
            Ouvrir un espace de démonstration vous connecte avec le compte démo correspondant : votre session administrateur se ferme. Pour revenir, utilisez « Quitter la
            démonstration » dans le bandeau, puis reconnectez-vous avec votre compte. Les comptes créés depuis cette page ont un mot de passe aléatoire jamais conservé, et utilisent un domaine qui ne
            reçoit aucun e-mail.
          </Notice>
        </div>
      )}
    </>
  );
}
