-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — 7/7 : privilèges et politiques Row Level Security
--
-- Règles générales
--   • Le rôle anon n'a accès à aucune table : le site vitrine passe par la
--     fonction get_public_catalog().
--   • Participant : uniquement ses propres données (évaluations validées).
--   • Organisme   : uniquement les participants qui lui sont rattachés, en lecture.
--   • Formateur   : uniquement les groupes qui lui sont attribués.
--   • Admin       : ensemble des données.
-- Les contrôles inter-tables passent par des fonctions SECURITY DEFINER du schéma
-- private afin de ne jamais dépendre de la visibilité RLS d'une autre table.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Privilèges de base ──────────────────────────────────────────────────────
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Journaux et historiques : lecture seule pour les utilisateurs connectés.
revoke insert, update, delete on public.audit_logs, public.evaluation_history, public.attendance_history,
  public.participant_organization_history from authenticated;
-- Notifications et messages de contact : créés par le système uniquement.
revoke insert on public.notifications, public.contact_messages from authenticated;
-- Codes d'accès : jamais d'écriture directe, et l'empreinte n'est pas lisible.
revoke all on public.invitation_codes from authenticated;
grant select (id, code_hint, role, organization_id, label, expires_at, created_by, created_at, used_at, used_by, revoked_at, revoked_by)
  on public.invitation_codes to authenticated;
-- Rôles et permissions : référentiel en lecture ; seule la matrice est modifiable.
revoke insert, update, delete on public.roles, public.permissions from authenticated;

-- ── Activation de RLS sur toutes les tables ─────────────────────────────────
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('alter table public.%I force row level security', t.tablename);
  end loop;
end $$;

-- ── Rôles et permissions ────────────────────────────────────────────────────
create policy roles_select on public.roles for select to authenticated using (true);
create policy permissions_select on public.permissions for select to authenticated using (true);
create policy role_permissions_select on public.role_permissions for select to authenticated using (true);
create policy role_permissions_insert on public.role_permissions for insert to authenticated
  with check ((select private.is_admin()));
create policy role_permissions_delete on public.role_permissions for delete to authenticated
  using ((select private.is_admin()));

-- ── Profils ─────────────────────────────────────────────────────────────────
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));

-- Annuaire de l'équipe HAPPI (identité uniquement) pour afficher le nom du formateur.
create view public.staff_directory with (security_invoker = false) as
  select p.id, p.first_name, p.last_name, p.role
  from public.profiles p
  where p.role in ('formateur', 'admin') and p.status = 'active';
revoke all on public.staff_directory from public, anon;
grant select on public.staff_directory to authenticated;

-- ── Organismes ──────────────────────────────────────────────────────────────
create policy organizations_select on public.organizations for select to authenticated using (
  (select private.is_admin())
  or private.is_org_member(id)
  or (status = 'active' and (select private.is_staff()))
  or id = (select private.my_participant_org_id())
);
create policy organizations_insert on public.organizations for insert to authenticated
  with check ((select private.is_admin()));
create policy organizations_update on public.organizations for update to authenticated
  using ((select private.is_admin()) or private.is_org_owner(id))
  with check ((select private.is_admin()) or private.is_org_owner(id));
create policy organizations_delete on public.organizations for delete to authenticated
  using ((select private.is_admin()));

create policy organization_members_select on public.organization_members for select to authenticated using (
  (select private.is_admin())
  or user_id = (select auth.uid())
  or organization_id = any ((select private.my_organization_ids())::uuid[])
);
create policy organization_members_insert on public.organization_members for insert to authenticated
  with check ((select private.is_admin()));
create policy organization_members_update on public.organization_members for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy organization_members_delete on public.organization_members for delete to authenticated
  using ((select private.is_admin()));

-- ── Participants ────────────────────────────────────────────────────────────
create policy participants_select on public.participants for select to authenticated using (
  user_id = (select auth.uid())
  or (select private.is_admin())
  or organization_id = any ((select private.my_organization_ids())::uuid[])
  or private.trains_participant(id)
  or ((select private.current_role_code()) = 'formateur'
      and (select private.has_permission('participants.directory'))
      and private.is_unassigned(id))
);
create policy participants_insert on public.participants for insert to authenticated with check (
  (select private.is_admin())
  or ((select private.current_role_code()) = 'formateur'
      and (select private.has_permission('groups.manage'))
      and user_id is null and invited_by = (select auth.uid()) and status = 'invited')
);
create policy participants_update on public.participants for update to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_admin())
    or ((select private.current_role_code()) = 'formateur'
        and (private.trains_participant(id)
             or ((select private.has_permission('participants.directory')) and private.is_unassigned(id))))
  )
  with check (
    user_id = (select auth.uid())
    or (select private.is_admin())
    or (select private.current_role_code()) = 'formateur'
  );
create policy participants_delete on public.participants for delete to authenticated
  using ((select private.is_admin()));

create policy participant_org_history_select on public.participant_organization_history for select to authenticated
  using ((select private.is_admin()) or private.trains_participant(participant_id));

-- ── Programmes (catalogue commun, géré par l'administrateur) ────────────────
create policy programs_select on public.programs for select to authenticated using (true);
create policy programs_insert on public.programs for insert to authenticated with check ((select private.is_admin()));
create policy programs_update on public.programs for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy programs_delete on public.programs for delete to authenticated using ((select private.is_admin()));

create policy program_sessions_select on public.program_sessions for select to authenticated using (true);
create policy program_sessions_insert on public.program_sessions for insert to authenticated with check ((select private.is_admin()));
create policy program_sessions_update on public.program_sessions for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy program_sessions_delete on public.program_sessions for delete to authenticated using ((select private.is_admin()));

create policy program_frameworks_select on public.program_frameworks for select to authenticated using (true);
create policy program_frameworks_insert on public.program_frameworks for insert to authenticated with check ((select private.is_admin()));
create policy program_frameworks_update on public.program_frameworks for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy program_frameworks_delete on public.program_frameworks for delete to authenticated using ((select private.is_admin()));

-- ── Groupes ─────────────────────────────────────────────────────────────────
create policy groups_select on public.groups for select to authenticated using (
  (select private.is_admin())
  or created_by = (select auth.uid())
  or private.trains_group(id)
  or private.org_sees_group(id)
  or private.member_of_group(id)
);
create policy groups_insert on public.groups for insert to authenticated with check (
  (select private.has_permission('groups.manage'))
  and (select private.is_staff())
  and created_by = (select auth.uid())
);
create policy groups_update on public.groups for update to authenticated
  using ((select private.is_admin()) or (private.trains_group(id) and (select private.has_permission('groups.manage'))))
  with check ((select private.is_admin()) or (private.trains_group(id) and (select private.has_permission('groups.manage'))));
create policy groups_delete on public.groups for delete to authenticated using ((select private.is_admin()));

create policy group_trainers_select on public.group_trainers for select to authenticated using (
  (select private.is_admin())
  or trainer_id = (select auth.uid())
  or private.trains_group(group_id)
  or private.org_sees_group(group_id)
  or private.member_of_group(group_id)
);
create policy group_trainers_insert on public.group_trainers for insert to authenticated with check ((select private.is_admin()));
create policy group_trainers_update on public.group_trainers for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy group_trainers_delete on public.group_trainers for delete to authenticated using ((select private.is_admin()));

create policy group_members_select on public.group_members for select to authenticated using (
  (select private.is_admin())
  or private.trains_group(group_id)
  or participant_id = (select private.my_participant_id())
  or private.org_sees_participant(participant_id)
);
create policy group_members_insert on public.group_members for insert to authenticated with check (
  (select private.is_admin()) or (private.trains_group(group_id) and (select private.has_permission('groups.manage')))
);
create policy group_members_update on public.group_members for update to authenticated
  using ((select private.is_admin()) or (private.trains_group(group_id) and (select private.has_permission('groups.manage'))))
  with check ((select private.is_admin()) or (private.trains_group(group_id) and (select private.has_permission('groups.manage'))));
create policy group_members_delete on public.group_members for delete to authenticated using ((select private.is_admin()));

-- ── Sessions ────────────────────────────────────────────────────────────────
create policy sessions_select on public.sessions for select to authenticated using (
  (select private.is_admin())
  or private.trains_group(group_id)
  or private.org_sees_group(group_id)
  or private.member_of_group(group_id)
);
create policy sessions_insert on public.sessions for insert to authenticated with check (
  (select private.has_permission('sessions.manage')) and ((select private.is_admin()) or private.trains_group(group_id))
);
create policy sessions_update on public.sessions for update to authenticated
  using ((select private.has_permission('sessions.manage')) and ((select private.is_admin()) or private.trains_group(group_id)))
  with check ((select private.has_permission('sessions.manage')) and ((select private.is_admin()) or private.trains_group(group_id)));
create policy sessions_delete on public.sessions for delete to authenticated using (
  (select private.has_permission('sessions.manage')) and ((select private.is_admin()) or private.trains_group(group_id))
);

-- ── Présences ───────────────────────────────────────────────────────────────
create policy attendance_select on public.attendance for select to authenticated using (
  (select private.is_admin())
  or private.trains_group(private.session_group_id(session_id))
  or participant_id = (select private.my_participant_id())
  or ((select private.has_permission('org.attendance.read')) and private.org_sees_participant(participant_id))
);
create policy attendance_insert on public.attendance for insert to authenticated with check (
  (select private.has_permission('attendance.write'))
  and ((select private.is_admin()) or private.trains_group(private.session_group_id(session_id)))
);
create policy attendance_update on public.attendance for update to authenticated
  using ((select private.has_permission('attendance.write'))
         and ((select private.is_admin()) or private.trains_group(private.session_group_id(session_id))))
  with check ((select private.has_permission('attendance.write'))
         and ((select private.is_admin()) or private.trains_group(private.session_group_id(session_id))));
create policy attendance_delete on public.attendance for delete to authenticated using (
  (select private.has_permission('attendance.write'))
  and ((select private.is_admin()) or private.trains_group(private.session_group_id(session_id)))
);
create policy attendance_history_select on public.attendance_history for select to authenticated using (
  (select private.is_admin()) or private.trains_group(private.session_group_id(session_id))
);

-- ── Référentiels ────────────────────────────────────────────────────────────
create policy frameworks_select on public.frameworks for select to authenticated using (true);
create policy frameworks_insert on public.frameworks for insert to authenticated with check ((select private.is_admin()));
create policy frameworks_update on public.frameworks for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy frameworks_delete on public.frameworks for delete to authenticated using ((select private.is_admin()));

create policy framework_versions_select on public.framework_versions for select to authenticated
  using (status <> 'draft' or (select private.is_admin()));
create policy framework_versions_insert on public.framework_versions for insert to authenticated with check ((select private.is_admin()));
create policy framework_versions_update on public.framework_versions for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy framework_versions_delete on public.framework_versions for delete to authenticated using ((select private.is_admin()));

create policy scale_levels_select on public.scale_levels for select to authenticated
  using (private.framework_version_visible(version_id));
create policy scale_levels_write on public.scale_levels for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy skill_categories_select on public.skill_categories for select to authenticated
  using (private.framework_version_visible(version_id));
create policy skill_categories_write on public.skill_categories for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy skills_select on public.skills for select to authenticated
  using (private.framework_version_visible(version_id));
create policy skills_write on public.skills for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy skill_level_descriptors_select on public.skill_level_descriptors for select to authenticated
  using (exists (select 1 from public.skills s where s.id = skill_id));
create policy skill_level_descriptors_write on public.skill_level_descriptors for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Les critères d'observation constituent le barème des formateurs : réservés à l'équipe.
create policy skill_criteria_select on public.skill_criteria for select to authenticated
  using ((select private.is_staff()) and exists (select 1 from public.skills s where s.id = skill_id));
create policy skill_criteria_write on public.skill_criteria for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy session_skill_map_select on public.session_skill_map for select to authenticated
  using (private.framework_version_visible(version_id));
create policy session_skill_map_write on public.session_skill_map for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ── Questionnaires ──────────────────────────────────────────────────────────
create policy questionnaires_select on public.questionnaires for select to authenticated using (true);
create policy questionnaires_write on public.questionnaires for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy questionnaire_versions_select on public.questionnaire_versions for select to authenticated
  using (status <> 'draft' or (select private.is_admin()));
create policy questionnaire_versions_insert on public.questionnaire_versions for insert to authenticated with check ((select private.is_admin()));
create policy questionnaire_versions_update on public.questionnaire_versions for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy questionnaire_versions_delete on public.questionnaire_versions for delete to authenticated using ((select private.is_admin()));

create policy questionnaire_scale_labels_select on public.questionnaire_scale_labels for select to authenticated
  using (private.questionnaire_version_visible(version_id));
create policy questionnaire_scale_labels_write on public.questionnaire_scale_labels for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy questionnaire_questions_select on public.questionnaire_questions for select to authenticated
  using (private.questionnaire_version_visible(version_id));
create policy questionnaire_questions_write on public.questionnaire_questions for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ── Auto-évaluations ────────────────────────────────────────────────────────
create policy self_assessments_select on public.self_assessments for select to authenticated using (
  participant_id = (select private.my_participant_id())
  or (select private.is_admin())
  or private.trains_participant(participant_id)
  or private.org_sees_participant(participant_id)
);
create policy self_assessments_insert on public.self_assessments for insert to authenticated
  with check (participant_id = (select private.my_participant_id()));
create policy self_assessments_update on public.self_assessments for update to authenticated
  using (participant_id = (select private.my_participant_id()))
  with check (participant_id = (select private.my_participant_id()));
create policy self_assessments_delete on public.self_assessments for delete to authenticated
  using ((select private.is_admin()));

create policy self_assessment_answers_select on public.self_assessment_answers for select to authenticated
  using (private.can_read_self_assessment(self_assessment_id));
create policy self_assessment_answers_insert on public.self_assessment_answers for insert to authenticated
  with check (private.owns_open_self_assessment(self_assessment_id));
create policy self_assessment_answers_update on public.self_assessment_answers for update to authenticated
  using (private.owns_open_self_assessment(self_assessment_id))
  with check (private.owns_open_self_assessment(self_assessment_id));
create policy self_assessment_answers_delete on public.self_assessment_answers for delete to authenticated
  using (private.owns_open_self_assessment(self_assessment_id));

-- ── Évaluations ─────────────────────────────────────────────────────────────
-- Les brouillons ne sont visibles que de l'équipe ; participants et organismes
-- ne lisent que les évaluations validées. Une évaluation validée ne se modifie
-- que par la fonction amend_evaluation (modification tracée).
create policy evaluations_select on public.evaluations for select to authenticated using (
  (select private.is_admin())
  or private.trains_group(private.session_group_id(session_id))
  or (status = 'validated' and participant_id = (select private.my_participant_id()))
  or (status = 'validated' and (select private.has_permission('org.evaluations.read')) and private.org_sees_participant(participant_id))
);
create policy evaluations_insert on public.evaluations for insert to authenticated with check (
  status = 'draft' and evaluator_id = (select auth.uid()) and private.can_write_evaluation(session_id)
);
create policy evaluations_update on public.evaluations for update to authenticated
  using (status = 'draft' and private.can_write_evaluation(session_id))
  with check (status = 'draft' and private.can_write_evaluation(session_id));
create policy evaluations_delete on public.evaluations for delete to authenticated
  using (status = 'draft' and private.can_write_evaluation(session_id));

create policy evaluation_frameworks_select on public.evaluation_frameworks for select to authenticated
  using (private.can_read_evaluation(evaluation_id));

create policy evaluation_scores_select on public.evaluation_scores for select to authenticated
  using (private.can_read_evaluation(evaluation_id));
create policy evaluation_scores_insert on public.evaluation_scores for insert to authenticated
  with check (private.can_write_evaluation_draft(evaluation_id));
create policy evaluation_scores_update on public.evaluation_scores for update to authenticated
  using (private.can_write_evaluation_draft(evaluation_id))
  with check (private.can_write_evaluation_draft(evaluation_id));
create policy evaluation_scores_delete on public.evaluation_scores for delete to authenticated
  using (private.can_write_evaluation_draft(evaluation_id));

-- Détail des critères observés : réservé à l'équipe (barème interne).
create policy evaluation_criterion_scores_select on public.evaluation_criterion_scores for select to authenticated
  using ((select private.is_staff()) and private.can_read_evaluation(evaluation_id));
create policy evaluation_criterion_scores_insert on public.evaluation_criterion_scores for insert to authenticated
  with check (private.can_write_evaluation_draft(evaluation_id));
create policy evaluation_criterion_scores_update on public.evaluation_criterion_scores for update to authenticated
  using (private.can_write_evaluation_draft(evaluation_id))
  with check (private.can_write_evaluation_draft(evaluation_id));
create policy evaluation_criterion_scores_delete on public.evaluation_criterion_scores for delete to authenticated
  using (private.can_write_evaluation_draft(evaluation_id));

create policy evaluation_comments_select on public.evaluation_comments for select to authenticated
  using (private.can_read_evaluation(evaluation_id) and (kind <> 'private' or (select private.is_staff())));
create policy evaluation_comments_insert on public.evaluation_comments for insert to authenticated
  with check (private.can_write_evaluation_draft(evaluation_id));
create policy evaluation_comments_update on public.evaluation_comments for update to authenticated
  using (private.can_write_evaluation_draft(evaluation_id))
  with check (private.can_write_evaluation_draft(evaluation_id));
create policy evaluation_comments_delete on public.evaluation_comments for delete to authenticated
  using (private.can_write_evaluation_draft(evaluation_id));

create policy evaluation_history_select on public.evaluation_history for select to authenticated using (
  (select private.is_staff()) and private.can_read_evaluation(evaluation_id)
);

-- ── Supports pédagogiques (équipe uniquement) ───────────────────────────────
create policy pedagogical_contents_select on public.pedagogical_contents for select to authenticated
  using ((select private.is_admin()) or ((select private.is_staff()) and (select private.has_permission('content.read'))));
create policy pedagogical_contents_write on public.pedagogical_contents for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy pedagogical_content_versions_select on public.pedagogical_content_versions for select to authenticated using (
  (select private.is_admin())
  or ((select private.is_staff()) and (select private.has_permission('content.read'))
      and exists (select 1 from public.pedagogical_contents c where c.current_version_id = pedagogical_content_versions.id))
);
create policy pedagogical_content_versions_insert on public.pedagogical_content_versions for insert to authenticated
  with check ((select private.is_admin()));
create policy pedagogical_content_versions_update on public.pedagogical_content_versions for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy pedagogical_content_versions_delete on public.pedagogical_content_versions for delete to authenticated
  using ((select private.is_admin()));

-- ── Lecteur et notes privées : strictement personnels ───────────────────────
create policy session_player_states_all on public.session_player_states for all to authenticated
  using (trainer_id = (select auth.uid())
         and ((select private.is_admin()) or private.trains_group(private.session_group_id(session_id))))
  with check (trainer_id = (select auth.uid())
         and ((select private.is_admin()) or private.trains_group(private.session_group_id(session_id))));

create policy trainer_notes_all on public.trainer_notes for all to authenticated
  using (trainer_id = (select auth.uid())
         and ((select private.is_admin()) or private.trains_group(private.session_group_id(session_id))))
  with check (trainer_id = (select auth.uid())
         and ((select private.is_admin()) or private.trains_group(private.session_group_id(session_id))));

create policy participant_session_notes_all on public.participant_session_notes for all to authenticated
  using (participant_id = (select private.my_participant_id()))
  with check (participant_id = (select private.my_participant_id())
              and private.member_of_group(private.session_group_id(session_id)));

-- ── Codes d'accès, journal, notifications, contact, RGPD, paramètres ────────
create policy invitation_codes_select on public.invitation_codes for select to authenticated
  using ((select private.is_admin()));

create policy audit_logs_select on public.audit_logs for select to authenticated
  using ((select private.is_admin()));

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

create policy contact_messages_select on public.contact_messages for select to authenticated
  using ((select private.is_admin()));
create policy contact_messages_update on public.contact_messages for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy contact_messages_delete on public.contact_messages for delete to authenticated
  using ((select private.is_admin()));

create policy data_requests_select on public.data_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy data_requests_insert on public.data_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and processed_by is null);
create policy data_requests_update on public.data_requests for update to authenticated
  using ((select private.is_admin())
         or (user_id = (select auth.uid()) and status = 'pending'))
  with check ((select private.is_admin())
         or (user_id = (select auth.uid()) and status = 'cancelled' and processed_by is null));

create policy app_settings_select on public.app_settings for select to authenticated
  using (is_public or (select private.is_admin()));
create policy app_settings_write on public.app_settings for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
