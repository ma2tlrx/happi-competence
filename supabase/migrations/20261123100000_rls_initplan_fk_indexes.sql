-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — performance des règles d'accès et index des clés étrangères
--
-- Audit mené avec le skill « supabase-postgres-best-practices » (Supabase, MIT) :
--
-- 1. security-rls-performance : 21 politiques appelaient des fonctions sans paramètre
--    (private.is_admin(), my_participant_id(), current_role_code(), …) directement :
--    Postgres les réévaluait pour CHAQUE ligne. Enveloppées dans (select …), elles sont
--    calculées une fois par requête (InitPlan). La logique d'accès est STRICTEMENT la même :
--    instructions générées automatiquement depuis pg_policies, seul l'enveloppement change.
--    Les fonctions qui dépendent de la ligne (trains_participant(participant_id)…) restent telles quelles.
-- 2. schema-foreign-key-indexes : 83 clés étrangères sans index (jointures, règles d'accès,
--    suppressions en cascade qui parcouraient toute la table enfant).
--
-- Rejouable : alter policy est idempotent ; create index if not exists.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Règles d'accès : fonctions évaluées une fois par requête ─────────────
alter policy participant_reports_select on public.participant_reports
  using ((( SELECT private.is_admin()) OR (private.trains_participant(participant_id) AND (NOT private.calibration_blind_participant(participant_id))) OR ((status = 'final'::text) AND ((participant_id = ( SELECT private.my_participant_id())) OR private.org_sees_participant(participant_id)))));

alter policy participant_report_easy_reads_select on public.participant_report_easy_reads
  using ((( SELECT private.is_admin()) OR (private.trains_participant(participant_id) AND (NOT private.calibration_blind_participant(participant_id))) OR ((status = 'validated'::text) AND ((participant_id = ( SELECT private.my_participant_id())) OR private.org_sees_participant(participant_id)))));

alter policy participant_reports_insert on public.participant_reports
  with check ((( SELECT private.is_admin()) OR private.trains_participant(participant_id)));

alter policy participant_reports_update on public.participant_reports
  using (((status = 'draft'::text) AND (( SELECT private.is_admin()) OR private.trains_participant(participant_id))))
  with check ((( SELECT private.is_admin()) OR private.trains_participant(participant_id)));

alter policy participant_reports_delete on public.participant_reports
  using (((status = 'draft'::text) AND (( SELECT private.is_admin()) OR private.trains_participant(participant_id))));

alter policy passport_shares_select on public.passport_shares
  using (((participant_id = ( SELECT private.my_participant_id())) OR ( SELECT private.is_admin())));

alter policy passport_share_views_select on public.passport_share_views
  using ((EXISTS ( SELECT 1
   FROM passport_shares s
  WHERE ((s.id = passport_share_views.share_id) AND ((s.participant_id = ( SELECT private.my_participant_id())) OR ( SELECT private.is_admin()))))));

alter policy quality_complaints_select on public.quality_complaints
  using ((( SELECT private.is_admin() AS is_admin) OR ((created_by = ( SELECT auth.uid() AS uid)) AND (( SELECT private.current_role_code()) = ANY (ARRAY['participant'::text, 'organisme'::text])))));

alter policy trainer_qualifications_select on public.trainer_qualifications
  using ((( SELECT private.is_admin() AS is_admin) OR ((trainer_id = ( SELECT auth.uid() AS uid)) AND (( SELECT private.current_role_code()) = 'formateur'::text))));

alter policy trainer_qualifications_insert on public.trainer_qualifications
  with check ((( SELECT private.is_admin() AS is_admin) OR ((trainer_id = ( SELECT auth.uid() AS uid)) AND (( SELECT private.current_role_code()) = 'formateur'::text))));

alter policy trainer_qualifications_update on public.trainer_qualifications
  using ((( SELECT private.is_admin() AS is_admin) OR ((trainer_id = ( SELECT auth.uid() AS uid)) AND (( SELECT private.current_role_code()) = 'formateur'::text))))
  with check ((( SELECT private.is_admin() AS is_admin) OR ((trainer_id = ( SELECT auth.uid() AS uid)) AND (( SELECT private.current_role_code()) = 'formateur'::text))));

alter policy trainer_qualifications_delete on public.trainer_qualifications
  using ((( SELECT private.is_admin() AS is_admin) OR ((trainer_id = ( SELECT auth.uid() AS uid)) AND (( SELECT private.current_role_code()) = 'formateur'::text))));

alter policy referrals_insert on public.referrals
  with check (((( SELECT private.current_role_code() AS current_role_code) = 'organisme'::text) AND ( SELECT private.has_permission('org.referrals.write'::text) AS has_permission) AND (organization_id = ANY ((( SELECT private.my_organization_ids()))::uuid[]))));

alter policy participant_report_easy_reads_insert on public.participant_report_easy_reads
  with check ((( SELECT private.is_admin()) OR private.trains_participant(participant_id)));

alter policy badge_assertions_select on public.badge_assertions
  using (((participant_id = ( SELECT private.my_participant_id())) OR ( SELECT private.is_admin()) OR private.trains_participant(participant_id)));

alter policy participant_report_easy_reads_update on public.participant_report_easy_reads
  using (((status = 'draft'::text) AND (( SELECT private.is_admin()) OR private.trains_participant(participant_id))))
  with check ((( SELECT private.is_admin()) OR private.trains_participant(participant_id)));

alter policy participant_report_easy_reads_delete on public.participant_report_easy_reads
  using (((status = 'draft'::text) AND (( SELECT private.is_admin()) OR private.trains_participant(participant_id))));

alter policy badge_classes_select on public.badge_classes
  using ((( SELECT private.is_staff()) OR (EXISTS ( SELECT 1
   FROM badge_assertions a
  WHERE ((a.badge_class_id = badge_classes.id) AND (a.participant_id = ( SELECT private.my_participant_id())))))));

alter policy badge_classes_insert on public.badge_classes
  with check (( SELECT private.is_admin()));

alter policy badge_classes_update on public.badge_classes
  using (( SELECT private.is_admin()))
  with check (( SELECT private.is_admin()));

alter policy badge_classes_delete on public.badge_classes
  using (( SELECT private.is_admin()));

-- ── 2. Index des clés étrangères ────────────────────────────────────────────
create index if not exists app_settings_updated_by_fk_idx on public.app_settings (updated_by);
create index if not exists attendance_recorded_by_fk_idx on public.attendance (recorded_by);
create index if not exists attendance_countersignatures_trainer_id_fk_idx on public.attendance_countersignatures (trainer_id);
create index if not exists attendance_signatures_collected_by_fk_idx on public.attendance_signatures (collected_by);
create index if not exists badge_assertions_issued_by_fk_idx on public.badge_assertions (issued_by);
create index if not exists badge_assertions_revoked_by_fk_idx on public.badge_assertions (revoked_by);
create index if not exists badge_classes_created_by_fk_idx on public.badge_classes (created_by);
create index if not exists calibration_exercises_created_by_fk_idx on public.calibration_exercises (created_by);
create index if not exists calibration_ratings_created_by_fk_idx on public.calibration_ratings (created_by);
create index if not exists contact_messages_handled_by_fk_idx on public.contact_messages (handled_by);
create index if not exists data_requests_processed_by_fk_idx on public.data_requests (processed_by);
create index if not exists email_outbox_created_by_fk_idx on public.email_outbox (created_by);
create index if not exists evaluation_comments_author_id_fk_idx on public.evaluation_comments (author_id);
create index if not exists evaluation_criterion_scores_criterion_id_fk_idx on public.evaluation_criterion_scores (criterion_id);
create index if not exists evaluation_frameworks_framework_version_id_fk_idx on public.evaluation_frameworks (framework_version_id);
create index if not exists evaluations_evaluator_id_fk_idx on public.evaluations (evaluator_id);
create index if not exists evaluations_validated_by_fk_idx on public.evaluations (validated_by);
create index if not exists framework_versions_based_on_version_id_fk_idx on public.framework_versions (based_on_version_id);
create index if not exists framework_versions_created_by_fk_idx on public.framework_versions (created_by);
create index if not exists framework_versions_published_by_fk_idx on public.framework_versions (published_by);
create index if not exists funders_created_by_fk_idx on public.funders (created_by);
create index if not exists funding_convention_groups_created_by_fk_idx on public.funding_convention_groups (created_by);
create index if not exists funding_conventions_created_by_fk_idx on public.funding_conventions (created_by);
create index if not exists game_session_players_profile_id_fk_idx on public.game_session_players (profile_id);
create index if not exists group_members_added_by_fk_idx on public.group_members (added_by);
create index if not exists group_trainers_assigned_by_fk_idx on public.group_trainers (assigned_by);
create index if not exists groups_created_by_fk_idx on public.groups (created_by);
create index if not exists invitation_codes_created_by_fk_idx on public.invitation_codes (created_by);
create index if not exists invitation_codes_organization_id_fk_idx on public.invitation_codes (organization_id);
create index if not exists invitation_codes_revoked_by_fk_idx on public.invitation_codes (revoked_by);
create index if not exists invitation_codes_role_fk_idx on public.invitation_codes (role);
create index if not exists invitation_codes_used_by_fk_idx on public.invitation_codes (used_by);
create index if not exists organizations_created_by_fk_idx on public.organizations (created_by);
create index if not exists organizations_validated_by_fk_idx on public.organizations (validated_by);
create index if not exists participant_entry_profiles_created_by_fk_idx on public.participant_entry_profiles (created_by);
create index if not exists participant_entry_profiles_recorded_by_fk_idx on public.participant_entry_profiles (recorded_by);
create index if not exists participant_needs_assessments_recorded_by_fk_idx on public.participant_needs_assessments (recorded_by);
create index if not exists participant_organization_history_changed_by_fk_idx on public.participant_organization_history (changed_by);
create index if not exists participant_organization_history_organization_id_fk_idx on public.participant_organization_history (organization_id);
create index if not exists participant_organization_history_previous_organization_id_fk_id on public.participant_organization_history (previous_organization_id);
create index if not exists participant_outcomes_created_by_fk_idx on public.participant_outcomes (created_by);
create index if not exists participant_outcomes_recorded_by_fk_idx on public.participant_outcomes (recorded_by);
create index if not exists participant_report_easy_reads_created_by_fk_idx on public.participant_report_easy_reads (created_by);
create index if not exists participant_report_easy_reads_validated_by_fk_idx on public.participant_report_easy_reads (validated_by);
create index if not exists participant_reports_created_by_fk_idx on public.participant_reports (created_by);
create index if not exists participant_reports_finalized_by_fk_idx on public.participant_reports (finalized_by);
create index if not exists participant_session_notes_session_id_fk_idx on public.participant_session_notes (session_id);
create index if not exists participants_invited_by_fk_idx on public.participants (invited_by);
create index if not exists passport_shares_created_by_fk_idx on public.passport_shares (created_by);
create index if not exists passport_shares_revoked_by_fk_idx on public.passport_shares (revoked_by);
create index if not exists pedagogical_content_versions_created_by_fk_idx on public.pedagogical_content_versions (created_by);
create index if not exists pedagogical_contents_current_version_id_fk_idx on public.pedagogical_contents (current_version_id);
create index if not exists program_frameworks_activated_by_fk_idx on public.program_frameworks (activated_by);
create index if not exists program_frameworks_framework_id_fk_idx on public.program_frameworks (framework_id);
create index if not exists program_frameworks_framework_version_id_fk_idx on public.program_frameworks (framework_version_id);
create index if not exists programs_created_by_fk_idx on public.programs (created_by);
create index if not exists quality_improvement_actions_created_by_fk_idx on public.quality_improvement_actions (created_by);
create index if not exists quality_public_results_updated_by_fk_idx on public.quality_public_results (updated_by);
create index if not exists quality_watch_entries_created_by_fk_idx on public.quality_watch_entries (created_by);
create index if not exists questionnaire_versions_created_by_fk_idx on public.questionnaire_versions (created_by);
create index if not exists referral_events_actor_id_fk_idx on public.referral_events (actor_id);
create index if not exists referrals_group_id_fk_idx on public.referrals (group_id);
create index if not exists referrals_referent_id_fk_idx on public.referrals (referent_id);
create index if not exists referrals_status_changed_by_fk_idx on public.referrals (status_changed_by);
create index if not exists reliability_settings_updated_by_fk_idx on public.reliability_settings (updated_by);
create index if not exists role_permissions_permission_code_fk_idx on public.role_permissions (permission_code);
create index if not exists rome_domains_parent_code_fk_idx on public.rome_domains (parent_code);
create index if not exists satisfaction_responses_organization_id_fk_idx on public.satisfaction_responses (organization_id);
create index if not exists satisfaction_responses_participant_id_fk_idx on public.satisfaction_responses (participant_id);
create index if not exists satisfaction_responses_survey_version_id_fk_idx on public.satisfaction_responses (survey_version_id);
create index if not exists satisfaction_survey_versions_created_by_fk_idx on public.satisfaction_survey_versions (created_by);
create index if not exists self_assessment_answers_question_id_fk_idx on public.self_assessment_answers (question_id);
create index if not exists self_assessments_questionnaire_version_id_fk_idx on public.self_assessments (questionnaire_version_id);
create index if not exists session_player_states_content_version_id_fk_idx on public.session_player_states (content_version_id);
create index if not exists session_player_states_trainer_id_fk_idx on public.session_player_states (trainer_id);
create index if not exists session_skill_map_skill_id_fk_idx on public.session_skill_map (skill_id);
create index if not exists sessions_created_by_fk_idx on public.sessions (created_by);
create index if not exists sessions_program_session_id_fk_idx on public.sessions (program_session_id);
create index if not exists sessions_trainer_id_fk_idx on public.sessions (trainer_id);
create index if not exists skill_mappings_proposed_by_fk_idx on public.skill_mappings (proposed_by);
create index if not exists skill_mappings_validated_by_fk_idx on public.skill_mappings (validated_by);
create index if not exists trainer_notes_session_id_fk_idx on public.trainer_notes (session_id);
create index if not exists trainer_qualifications_created_by_fk_idx on public.trainer_qualifications (created_by);
