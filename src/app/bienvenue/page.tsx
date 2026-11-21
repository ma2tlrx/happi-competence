import { redirect } from 'next/navigation';

import { requireRole } from '@/lib/auth/session';
import { intakeProgress, loadIntake } from '@/lib/intake/load';
import { createClient } from '@/lib/supabase/server';

import { IntakeWizard, type IntakeValues } from './wizard';

/**
 * Questionnaire d'accueil du participant (« Formulaire HaPPi » de l'ancien outil) : étapes 1 à 5 ici,
 * puis l'auto-évaluation (étape 6). `?modifier=1` rouvre les réponses depuis le profil.
 */
export default async function BienvenuePage({ searchParams }: { searchParams: Promise<{ modifier?: string }> }) {
  const { modifier } = await searchParams;
  const user = await requireRole('participant');
  if (!user.participantId) redirect('/compte');
  const supabase = await createClient();
  const [intake, { data: participant }, { data: self }] = await Promise.all([
    loadIntake(supabase, user.participantId),
    supabase.from('participants').select('first_name, phone').eq('id', user.participantId).maybeSingle(),
    supabase.from('self_assessments').select('status').eq('participant_id', user.participantId).eq('kind', 'initial').order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const progress = intakeProgress(intake);
  const mode = modifier ? 'modifier' : 'accueil';
  if (mode === 'accueil' && progress.status === 'completed') redirect('/participant/dashboard');

  const initial: IntakeValues = {
    age_band: intake?.age_band ?? '',
    situation: intake?.situation ?? '',
    residence: intake?.residence ?? '',
    residence_detail: intake?.residence_detail ?? '',
    phone: participant?.phone ?? '',
    study_level: intake?.study_level ?? '',
    study_field: intake?.study_field ?? '',
    school: intake?.school ?? '',
    volunteering: intake?.volunteering ?? '',
    volunteering_fields: intake?.volunteering_fields ?? [],
    experience: intake?.experience ?? '',
    experience_detail: intake?.experience_detail ?? '',
    sectors: intake?.sectors ?? [],
    ambitions: intake?.ambitions ?? '',
    two_year_plan: intake?.two_year_plan ?? '',
    aptitude_punctuality: intake?.aptitude_punctuality ?? null,
    aptitude_motivation: intake?.aptitude_motivation ?? null,
    aptitude_communication: intake?.aptitude_communication ?? null,
    aptitude_initiative: intake?.aptitude_initiative ?? null,
  };
  const startStep = mode === 'modifier' ? 1 : Math.min(progress.lastStep + 1, 5);

  return (
    <IntakeWizard
      initial={initial}
      startStep={startStep as 1 | 2 | 3 | 4 | 5}
      firstName={participant?.first_name ?? user.firstName}
      mode={mode}
      selfAssessmentDone={self?.status === 'completed'}
    />
  );
}
