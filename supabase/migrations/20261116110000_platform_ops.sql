-- =============================================================================
-- Exploitation de la plateforme : sonde de santé et export de réversibilité.
--
-- 1. public.health_check() : appel le plus léger possible pour /api/health (aucune table lue).
-- 2. public.export_platform_data(p_organization_id) : export complet des données d'un organisme
--    (ou de toute la plateforme si null), réservé à l'administrateur, journalisé dans
--    audit_logs (export.organization_data / export.platform_data, compteurs uniquement).
--    Les empreintes d'IP et navigateurs des émargements ne sont jamais exportés.
-- =============================================================================

create or replace function public.health_check()
returns boolean language sql stable set search_path = '' as $$
  select true;
$$;
comment on function public.health_check() is 'Sonde de disponibilité (/api/health) : ne lit aucune donnée.';
revoke execute on function public.health_check() from public;
grant execute on function public.health_check() to anon, authenticated, service_role;

create or replace function public.export_platform_data(p_organization_id uuid default null)
returns json language plpgsql volatile security definer set search_path = '' as $$
declare
  v_org json;
  v_participants uuid[];
  v_groups uuid[];
  v_sessions uuid[];
  v_evaluations uuid[];
  v_responses uuid[];
  v_data json;
  v_counts jsonb;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'Export réservé aux administrateurs.' using errcode = '42501';
  end if;

  if p_organization_id is not null then
    select row_to_json(o) into v_org from (
      select id, name, type, siret, city, contact_email, contact_phone, status, status_reason, is_demo, created_at, validated_at
      from public.organizations where id = p_organization_id
    ) o;
    if v_org is null then
      raise exception 'Organisme introuvable.' using errcode = 'P0002';
    end if;
    select coalesce(array_agg(p.id), '{}') into v_participants from public.participants p where p.organization_id = p_organization_id;
    -- Groupes de l'organisme, et groupes où figure au moins un de ses participants.
    select coalesce(array_agg(g.id), '{}') into v_groups from public.groups g
    where g.organization_id = p_organization_id
       or exists (select 1 from public.group_members m where m.group_id = g.id and m.participant_id = any (v_participants));
  else
    select coalesce(array_agg(p.id), '{}') into v_participants from public.participants p;
    select coalesce(array_agg(g.id), '{}') into v_groups from public.groups g;
  end if;

  select coalesce(array_agg(s.id), '{}') into v_sessions from public.sessions s where s.group_id = any (v_groups);
  select coalesce(array_agg(e.id), '{}') into v_evaluations from public.evaluations e
  where e.status = 'validated' and e.participant_id = any (v_participants);
  select coalesce(array_agg(r.id), '{}') into v_responses from public.satisfaction_responses r
  where r.participant_id = any (v_participants)
     or (p_organization_id is not null and r.organization_id = p_organization_id) -- réponses du prescripteur
     or p_organization_id is null;

  v_data := json_build_object(
    'organismes', case when p_organization_id is null then (
      select coalesce(json_agg(o order by o.name), '[]'::json) from (
        select id, name, type, siret, city, contact_email, contact_phone, status, status_reason, is_demo, created_at, validated_at
        from public.organizations
      ) o) else json_build_array(v_org) end,
    'participants', (
      select coalesce(json_agg(t order by t.last_name, t.first_name), '[]'::json) from (
        select id, first_name, last_name, email, phone, status, organization_id, is_demo, created_at, updated_at
        from public.participants where id = any (v_participants)
      ) t),
    'rattachements_historique', (
      select coalesce(json_agg(t order by t.changed_at), '[]'::json) from (
        select id, participant_id, previous_organization_id, organization_id, changed_at
        from public.participant_organization_history where participant_id = any (v_participants)
      ) t),
    'programmes', (
      select coalesce(json_agg(t order by t.name), '[]'::json) from (
        select id, name, description, status, sessions_count, session_duration_minutes, created_at
        from public.programs where id in (select g.program_id from public.groups g where g.id = any (v_groups))
      ) t),
    'groupes', (
      select coalesce(json_agg(t order by t.start_date nulls last, t.name), '[]'::json) from (
        select id, name, program_id, organization_id, status, start_date, end_date, is_demo, created_at
        from public.groups where id = any (v_groups)
      ) t),
    'inscriptions_groupes', (
      select coalesce(json_agg(t order by t.group_id, t.joined_at), '[]'::json) from (
        select id, group_id, participant_id, status, joined_at, left_at, drop_reason, drop_details, dropped_at
        from public.group_members where participant_id = any (v_participants) and group_id = any (v_groups)
      ) t),
    'seances', (
      select coalesce(json_agg(t order by t.group_id, t.number), '[]'::json) from (
        select s.id, s.group_id, s.number, ps.title as program_session_title, s.scheduled_date, s.start_time, s.end_time,
               s.location, s.status, s.trainer_id, s.started_at, s.completed_at
        from public.sessions s left join public.program_sessions ps on ps.id = s.program_session_id
        where s.id = any (v_sessions)
      ) t),
    'intervenants', (
      select coalesce(json_agg(t order by t.last_name), '[]'::json) from (
        select pr.id, pr.first_name, pr.last_name, pr.role
        from public.profiles pr
        where pr.id in (
          select s.trainer_id from public.sessions s where s.id = any (v_sessions)
          union select e.evaluator_id from public.evaluations e where e.id = any (v_evaluations)
          union select e.validated_by from public.evaluations e where e.id = any (v_evaluations)
        )
      ) t),
    'presences', (
      select coalesce(json_agg(t order by t.session_id, t.participant_id), '[]'::json) from (
        select id, session_id, participant_id, status, comment, recorded_at, recorded_by, updated_at
        from public.attendance where participant_id = any (v_participants) and session_id = any (v_sessions)
      ) t),
    'emargements', (
      select coalesce(json_agg(t order by t.session_id, t.signed_at), '[]'::json) from (
        select id, session_id, participant_id, kind, method, attendance_status, unable_reason, signed_at, collected_by,
               content_sha256, signature_svg
        from public.attendance_signatures where participant_id = any (v_participants) and session_id = any (v_sessions)
      ) t),
    'contresignatures_formateur', (
      select coalesce(json_agg(t order by t.signed_at), '[]'::json) from (
        select session_id, trainer_id, trainer_name, attested, signed_at, content_sha256, signatures_sha256, signature_svg
        from public.attendance_countersignatures where session_id = any (v_sessions)
      ) t),
    'evaluations_validees', (
      select coalesce(json_agg(t order by t.validated_at), '[]'::json) from (
        select e.id, e.participant_id, e.session_id, e.revision, e.evaluator_id, e.validated_at, e.validated_by
        from public.evaluations e where e.id = any (v_evaluations)
      ) t),
    'evaluations_scores', (
      select coalesce(json_agg(t order by t.evaluation_id, t.skill_code), '[]'::json) from (
        select sc.evaluation_id, sk.code as skill_code, sk.name as skill_name, sc.score, sc.score_source, sc.comment
        from public.evaluation_scores sc join public.skills sk on sk.id = sc.skill_id
        where sc.evaluation_id = any (v_evaluations)
      ) t),
    'evaluations_criteres', (
      select coalesce(json_agg(t order by t.evaluation_id), '[]'::json) from (
        select evaluation_id, criterion_id, observed, score
        from public.evaluation_criterion_scores where evaluation_id = any (v_evaluations)
      ) t),
    'evaluations_commentaires', (
      select coalesce(json_agg(t order by t.evaluation_id, t.created_at), '[]'::json) from (
        select evaluation_id, kind, body, author_id, created_at, updated_at
        from public.evaluation_comments where evaluation_id = any (v_evaluations)
      ) t),
    'bilans_finaux', (
      select coalesce(json_agg(t order by t.participant_id, t.version), '[]'::json) from (
        select id, participant_id, version, finalized_at, finalized_by, engine_version, content_source, content, data
        from public.participant_reports where status = 'final' and participant_id = any (v_participants)
      ) t),
    'situations', (
      select coalesce(json_agg(t order by t.participant_id, t.observed_on), '[]'::json) from (
        select id, participant_id, group_id, kind, situation, details, observed_on, recorded_by, created_at, updated_at
        from public.participant_outcomes where participant_id = any (v_participants)
      ) t),
    'satisfaction_reponses', (
      select coalesce(json_agg(t order by t.submitted_at), '[]'::json) from (
        select id, survey_version_id, audience, moment, group_id, organization_id, participant_id, submitted_at
        from public.satisfaction_responses where id = any (v_responses)
      ) t),
    'satisfaction_reponses_detail', (
      select coalesce(json_agg(t order by t.response_id, t.position), '[]'::json) from (
        select a.response_id, q.position, q.text as question, q.kind, a.value, a.choice, a.text_value
        from public.satisfaction_answers a join public.satisfaction_questions q on q.id = a.question_id
        where a.response_id = any (v_responses)
      ) t)
  );

  select coalesce(jsonb_object_agg(key, json_array_length(value)), '{}') into v_counts
  from json_each(v_data) where json_typeof(value) = 'array';

  perform private.audit(
    case when p_organization_id is null then 'export.platform_data' else 'export.organization_data' end,
    'organization', p_organization_id::text, p_organization_id, null,
    jsonb_build_object('counts', v_counts)
  );

  -- json (et non jsonb) : l'ordre des tables et des colonnes est conservé dans l'export.
  return json_build_object(
    'format', 'happi-reversibilite',
    'format_version', 1,
    'exported_at', now(),
    'scope', case when p_organization_id is null then 'plateforme' else 'organisme' end,
    'organization_id', p_organization_id,
    'counts', v_counts,
    'data', v_data
  );
end;
$$;
comment on function public.export_platform_data(uuid) is
  'Réversibilité : export complet d''un organisme (ou de toute la plateforme), administrateur uniquement, journalisé.';
revoke execute on function public.export_platform_data(uuid) from public, anon;
grant execute on function public.export_platform_data(uuid) to authenticated, service_role;
