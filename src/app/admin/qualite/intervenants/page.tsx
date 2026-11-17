import { GraduationCap } from 'lucide-react';
import type { Metadata } from 'next';

import { AddQualificationButton, QualificationsTable, TrainingBadge } from '@/components/quality/qualifications';
import { ThresholdForm } from '@/components/quality/threshold-form';
import { Badge, Card, CardBody, CardHeader, EmptyState, Notice, PageHeader, ProvisionalBadge } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { AI_TRAINING_HINT, QUALIOPI_DISCLAIMER, QUALIOPI_HINTS } from '@/lib/quality/labels';
import { loadTrainerRegistry, loadTrainingMaxAge } from '@/lib/quality/load';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/trainer';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Registre des intervenants' };

export default async function TrainersRegistryPage() {
  await requireRole('admin');
  const today = todayIso();
  const supabase = await createClient();
  const maxAgeMonths = await loadTrainingMaxAge(supabase);
  const registry = await loadTrainerRegistry(supabase, today, maxAgeMonths);

  return (
    <>
      <PageHeader
        title="Registre des intervenants"
        description={`Diplômes, qualifications, expériences et formations suivies de chaque formateur. ${QUALIOPI_HINTS.trainers} — ${QUALIOPI_DISCLAIMER}`}
      />
      <Notice className="mb-6" title="Pièces justificatives">
        Aucun fichier n’est déposé sur la plateforme : indiquez la référence du document ou l’adresse sécurisée où il est conservé. Chaque formateur complète
        aussi son propre registre depuis son espace. {AI_TRAINING_HINT}
      </Notice>
      <Card className="mb-6">
        <CardHeader
          title="Alerte de formation continue"
          description="Un formateur est signalé lorsque sa formation suivie la plus récente est plus ancienne que ce seuil."
          action={<ProvisionalBadge>Seuil à valider</ProvisionalBadge>}
        />
        <CardBody>
          <ThresholdForm months={maxAgeMonths} />
        </CardBody>
      </Card>

      {registry.length === 0 ? (
        <Card>
          <EmptyState icon={GraduationCap} title="Aucun formateur" description="Les comptes formateurs apparaîtront ici." />
        </Card>
      ) : (
        <div className="space-y-4">
          {registry.map(({ trainer, qualifications, training }) => {
            const name = `${trainer.firstName} ${trainer.lastName}`.trim() || trainer.email;
            return (
              <Card key={trainer.id}>
                <CardHeader
                  as="h2"
                  title={name}
                  description={
                    <span className="flex flex-wrap items-center gap-2">
                      <TrainingBadge training={training} maxAgeMonths={maxAgeMonths} />
                      {training.aiTraining ? (
                        <Badge variant="petrol">{`Formé(e) à l’usage de l’IA le ${formatDate(training.lastAiTrainingOn)}`}</Badge>
                      ) : (
                        <Badge variant="outline">Pas de formation à l’IA enregistrée</Badge>
                      )}
                      {trainer.status !== 'active' ? <Badge>Compte désactivé</Badge> : null}
                      {training.lastTrainingOn ? <span>{`Dernière formation : ${formatDate(training.lastTrainingOn)}`}</span> : null}
                    </span>
                  }
                  action={<AddQualificationButton trainerId={trainer.id} trainerName={name} />}
                />
                <CardBody className="px-0 pb-2 sm:px-0">
                  <QualificationsTable trainerId={trainer.id} rows={qualifications} canEdit />
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
