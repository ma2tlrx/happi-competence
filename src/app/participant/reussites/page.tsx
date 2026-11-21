import type { Metadata } from 'next';

import { ChallengeCelebration } from '@/components/engagement/celebration';
import { ChallengeBoard, StarTotal } from '@/components/engagement/challenges';
import { SkillCollection } from '@/components/engagement/skill-collection';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/primitives';
import { loadParticipantEngagement } from '@/lib/engagement/load';
import { loadMySurveys } from '@/lib/satisfaction/load';

import { getMyPassport } from '../data';

export const metadata: Metadata = { title: 'Mes réussites' };

export default async function ReussitesPage() {
  const { passport, supabase } = await getMyPassport();
  const surveys = await loadMySurveys(supabase);
  const engagement = await loadParticipantEngagement(supabase, passport, surveys);
  return (
    <>
      <ChallengeCelebration
        storageKey={`happi:defis-celebres:${passport.participant.id}`}
        challenges={engagement.challenges.map(({ id, title, goal, stars, done }) => ({ id, title, goal, stars, done }))}
      />
      <PageHeader
        title="Mes défis"
        description="Des étapes pour avancer à votre rythme. Rien ne se perd : une absence ralentit un défi, elle ne le ferme jamais. Ces défis ne comptent pas dans votre bilan."
        actions={<StarTotal {...engagement.stars} />}
      />
      <ChallengeBoard challenges={engagement.challenges} />
      <Card className="mt-6">
        <CardHeader
          title={`Ma collection de compétences : ${engagement.collection.revealed} sur ${engagement.collection.total}`}
          description="Une compétence se révèle dès que vos formateurs l’observent, quel que soit le niveau. Une case vide veut dire « pas encore observée », jamais « zéro »."
        />
        <CardBody className="pt-1">
          <SkillCollection groups={engagement.collection.groups} size="lg" />
        </CardBody>
      </Card>
    </>
  );
}
