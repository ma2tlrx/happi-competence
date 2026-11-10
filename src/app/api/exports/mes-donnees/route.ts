import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

/**
 * Export des données personnelles (droit d'accès et de portabilité, RGPD).
 * Lecture avec la session de l'utilisateur : RLS garantit qu'il n'obtient que ses propres données.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  const supabase = await createClient();

  const [profile, participant, notifications, requests] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name, email, phone, role, created_at, terms_accepted_at, privacy_consent_at').eq('id', user.id).single(),
    user.participantId ? supabase.from('participants').select('*').eq('id', user.participantId).single() : Promise.resolve({ data: null }),
    supabase.from('notifications').select('type, title, body, created_at, read_at').order('created_at'),
    supabase.from('data_requests').select('type, status, created_at, processed_at').order('created_at'),
  ]);

  let passport: Record<string, unknown> | null = null;
  if (user.participantId) {
    const id = user.participantId;
    const [memberships, attendance, selfAssessments, evaluations, notes] = await Promise.all([
      supabase.from('group_members').select('status, joined_at, left_at, groups ( name, start_date, end_date, programs ( name ) )').eq('participant_id', id),
      supabase.from('attendance').select('status, comment, recorded_at, sessions ( number, scheduled_date )').eq('participant_id', id),
      supabase.from('self_assessments').select('kind, status, comment, started_at, completed_at, self_assessment_answers ( value, comment, questionnaire_questions ( text ) )').eq('participant_id', id),
      supabase
        .from('evaluations')
        .select('validated_at, revision, sessions ( number, scheduled_date ), evaluation_scores ( score, comment, skills ( name, code ) ), evaluation_comments ( kind, body )')
        .eq('participant_id', id),
      supabase.from('participant_session_notes').select('learned, updated_at, sessions ( number )').eq('participant_id', id),
    ]);
    passport = {
      groupes: memberships.data,
      presences: attendance.data,
      auto_evaluations: selfAssessments.data,
      evaluations_validees: evaluations.data,
      carnet: notes.data,
    };
  }

  await supabase.rpc('log_event', { p_action: 'export.personal_data' });
  const body = JSON.stringify(
    { exporte_le: new Date().toISOString(), compte: profile.data, fiche_participant: participant.data, passeport: passport, notifications: notifications.data, demandes: requests.data },
    null,
    2,
  );
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="happi-mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
