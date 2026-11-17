import type { Metadata } from 'next';

import { AddQualificationButton, QualificationsTable, TrainingBadge } from '@/components/quality/qualifications';
import { Card, CardBody, CardHeader, Notice, PageHeader } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { trainerTrainingStatus } from '@/lib/quality/indicators';
import { AI_TRAINING_HINT } from '@/lib/quality/labels';
import { loadMyQualifications, loadTrainingMaxAge } from '@/lib/quality/load';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/trainer';

export const metadata: Metadata = { title: 'Mon registre' };

export default async function MyRegistryPage() {
  const user = await requireRole('formateur', 'admin');
  const supabase = await createClient();
  const [rows, maxAgeMonths] = await Promise.all([loadMyQualifications(supabase, user.id), loadTrainingMaxAge(supabase)]);
  const training = trainerTrainingStatus(rows, todayIso(), maxAgeMonths);
  return (
    <>
      <PageHeader
        title="Mon registre d’intervenant"
        description="Vos diplômes, qualifications, expériences et formations suivies. L’équipe HAPPI s’en sert pour justifier les compétences des intervenants lors d’un audit qualité."
      />
      {user.role === 'admin' ? (
        <Notice variant="warning" className="mb-6">
          Le registre concerne les formateurs : gérez celui de chaque formateur depuis Administration › Qualité › Intervenants.
        </Notice>
      ) : null}
      <Notice className="mb-6" title="Pièces justificatives">
        Aucun fichier n’est déposé ici : indiquez la référence du document ou l’adresse sécurisée où il est conservé. {AI_TRAINING_HINT}
      </Notice>
      <Card>
        <CardHeader
          title="Mes lignes"
          description={<TrainingBadge training={training} maxAgeMonths={maxAgeMonths} />}
          action={user.role === 'formateur' ? <AddQualificationButton trainerId={user.id} /> : null}
        />
        <CardBody className="px-0 pb-2 sm:px-0">
          <QualificationsTable trainerId={user.id} rows={rows} canEdit={user.role === 'formateur'} />
        </CardBody>
      </Card>
    </>
  );
}
