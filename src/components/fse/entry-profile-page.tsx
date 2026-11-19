import 'server-only';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/ui/primitives';
import { saveEntryProfile } from '@/lib/fse/actions';
import { loadEntryProfiles, loadParticipantGroups } from '@/lib/fse/load';
import { createClient } from '@/lib/supabase/server';

import { EntryProfileEditor, PrivacyNoticeCard } from './entry-profile-editor';

/**
 * Saisie de la fiche d'entrée par un professionnel (organisme habilité ou administrateur).
 * Le contrôle de rôle est fait par la page appelante ; RLS restreint la lecture du participant et des fiches.
 */
export async function EntryProfilePage({ participantId, back }: { participantId: string; back: { href: string; label: string } }) {
  const supabase = await createClient();
  const { data: participant } = await supabase.from('participants').select('id, first_name, last_name').eq('id', participantId).maybeSingle();
  if (!participant) notFound();
  const [groups, profiles] = await Promise.all([loadParticipantGroups(supabase, participantId), loadEntryProfiles(supabase, participantId)]);
  // Consultation de données sensibles : journalisée (refusée par la base si l'accès n'est pas permis).
  const { error } = await supabase.rpc('log_entry_profile_event', { p_action: 'entry_profile.viewed', p_participant_id: participantId });
  if (error) notFound();
  return (
    <>
      <Link href={back.href} className="mb-3 inline-flex min-h-8 items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        {back.label}
      </Link>
      <PageHeader
        title={`Fiche d’entrée · ${participant.first_name} ${participant.last_name}`}
        description="Situation à l’entrée et données demandées par le FSE+ et les financeurs publics. Jamais visible par le formateur ; la personne peut relire et corriger ses réponses dans son espace."
      />
      <div className="space-y-6">
        <PrivacyNoticeCard audience="professional" />
        <EntryProfileEditor action={saveEntryProfile} participantId={participantId} groups={groups} profiles={profiles} mode="professional" />
      </div>
    </>
  );
}
