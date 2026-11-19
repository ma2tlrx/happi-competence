import type { Metadata } from 'next';

import { EntryProfileEditor, PrivacyNoticeCard } from '@/components/fse/entry-profile-editor';
import { Notice, PageHeader } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { saveMyEntryProfile } from '@/lib/fse/actions';
import { loadEntryProfiles, loadParticipantGroups } from '@/lib/fse/load';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Ma fiche d’entrée' };

/** Le participant relit, complète et corrige ses réponses (RLS : ses propres fiches uniquement). */
export default async function MyEntryProfilePage() {
  const user = await requireRole('participant');
  if (!user.participantId) {
    return (
      <>
        <PageHeader title="Ma fiche d’entrée" />
        <Notice variant="warning">Votre fiche participant n’est pas encore créée.</Notice>
      </>
    );
  }
  const supabase = await createClient();
  const [groups, profiles] = await Promise.all([loadParticipantGroups(supabase, user.participantId), loadEntryProfiles(supabase, user.participantId)]);
  return (
    <>
      <PageHeader
        title="Ma fiche d’entrée"
        description="Quelques questions sur votre situation au début du parcours, demandées par les financeurs. Répondez à ce que vous voulez : rien n’est obligatoire."
      />
      <div className="space-y-6">
        <PrivacyNoticeCard audience="participant" />
        <EntryProfileEditor action={saveMyEntryProfile} groups={groups} profiles={profiles} mode="participant" />
      </div>
    </>
  );
}
