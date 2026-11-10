-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — 6/7 : fonctions métier exposées à l'API (RPC)
--
-- Chaque fonction SECURITY DEFINER vérifie elle-même les droits de l'appelant.
-- Les droits d'exécution sont accordés explicitement en fin de fichier.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Codes d'accès à usage unique ────────────────────────────────────────────
create or replace function private.normalize_code(p_code text)
returns text language sql immutable set search_path = '' as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create or replace function private.hash_code(p_code text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(private.normalize_code(p_code), 'sha256'), 'hex');
$$;

-- Génère un code (≈ 100 bits d'aléa), n'en conserve que l'empreinte et le renvoie
-- une seule fois à l'administrateur.
create or replace function public.create_invitation_code(
  p_role text,
  p_label text default null,
  p_expires_at timestamptz default null,
  p_organization_id uuid default null
) returns table (id uuid, code text)
language plpgsql security definer set search_path = '' as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(20);
  v_raw text := '';
  v_code text;
  v_id uuid;
begin
  if not private.is_admin() then
    raise exception 'Seul un administrateur peut créer un code d’accès.' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('admin', 'formateur', 'organisme') then
    raise exception 'Rôle invalide pour un code d’accès.' using errcode = '22023';
  end if;
  if p_role = 'organisme' then
    if p_organization_id is null or not exists (select 1 from public.organizations o where o.id = p_organization_id) then
      raise exception 'Sélectionnez l’organisme concerné par ce code.' using errcode = '22023';
    end if;
  else
    p_organization_id := null;
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'La date d’expiration doit être dans le futur.' using errcode = '22023';
  end if;

  for i in 0..19 loop
    v_raw := v_raw || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  v_code := 'HAPPI-' || substr(v_raw, 1, 5) || '-' || substr(v_raw, 6, 5) || '-' || substr(v_raw, 11, 5) || '-' || substr(v_raw, 16, 5);

  insert into public.invitation_codes (code_hash, code_hint, role, organization_id, label, expires_at, created_by)
  values (private.hash_code(v_code), right(v_raw, 4), p_role, p_organization_id, nullif(trim(p_label), ''), p_expires_at, (select auth.uid()))
  returning invitation_codes.id into v_id;

  perform private.audit('invitation_code.created', 'invitation_code', v_id::text, p_organization_id, null,
    jsonb_build_object('role', p_role, 'expires_at', p_expires_at));

  id := v_id;
  code := v_code;
  return next;
end;
$$;

create or replace function public.revoke_invitation_code(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Seul un administrateur peut révoquer un code d’accès.' using errcode = '42501';
  end if;
  update public.invitation_codes
     set revoked_at = now(), revoked_by = (select auth.uid())
   where id = p_id and used_at is null and revoked_at is null;
  if not found then
    raise exception 'Ce code est déjà utilisé ou révoqué.' using errcode = 'P0001';
  end if;
  perform private.audit('invitation_code.revoked', 'invitation_code', p_id::text);
end;
$$;

-- Vérification sans effet de bord (appelée par le serveur avant de créer le compte).
create or replace function public.check_invitation_code(p_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_inv public.invitation_codes%rowtype;
begin
  select * into v_inv from public.invitation_codes where code_hash = private.hash_code(p_code);
  if not found then return jsonb_build_object('valid', false, 'reason', 'invalid'); end if;
  if v_inv.revoked_at is not null then return jsonb_build_object('valid', false, 'reason', 'revoked'); end if;
  if v_inv.used_at is not null then return jsonb_build_object('valid', false, 'reason', 'used'); end if;
  if v_inv.expires_at is not null and v_inv.expires_at <= now() then return jsonb_build_object('valid', false, 'reason', 'expired'); end if;
  return jsonb_build_object('valid', true, 'role', v_inv.role, 'organization_id', v_inv.organization_id);
end;
$$;

-- Consomme le code de façon atomique et attribue le rôle au compte fraîchement créé.
create or replace function public.redeem_invitation_code(p_code text, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.invitation_codes%rowtype;
  v_profile public.profiles%rowtype;
begin
  select * into v_inv from public.invitation_codes where code_hash = private.hash_code(p_code) for update;
  if not found then raise exception 'INVALID_CODE' using errcode = 'P0001'; end if;
  if v_inv.revoked_at is not null then raise exception 'REVOKED_CODE' using errcode = 'P0001'; end if;
  if v_inv.used_at is not null then raise exception 'USED_CODE' using errcode = 'P0001'; end if;
  if v_inv.expires_at is not null and v_inv.expires_at <= now() then raise exception 'EXPIRED_CODE' using errcode = 'P0001'; end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then raise exception 'UNKNOWN_USER' using errcode = 'P0001'; end if;
  -- Seul un compte neutre (ni fiche participant, ni organisme) peut recevoir un rôle par code.
  if v_profile.role <> 'participant'
     or exists (select 1 from public.participants p where p.user_id = p_user_id)
     or exists (select 1 from public.organization_members om where om.user_id = p_user_id) then
    raise exception 'ACCOUNT_NOT_ELIGIBLE' using errcode = 'P0001';
  end if;

  if v_inv.role = 'organisme' then
    insert into public.organization_members (organization_id, user_id, member_role)
    values (v_inv.organization_id, p_user_id, 'member');
  end if;
  update public.profiles set role = v_inv.role where id = p_user_id;
  update public.invitation_codes set used_at = now(), used_by = p_user_id where id = v_inv.id;

  perform private.audit('invitation_code.used', 'invitation_code', v_inv.id::text, v_inv.organization_id, null,
    jsonb_build_object('role', v_inv.role, 'user_id', p_user_id));
  return jsonb_build_object('role', v_inv.role, 'organization_id', v_inv.organization_id);
end;
$$;

-- ── Groupes : ajout d'un participant (existant ou invité par e-mail) ────────
create or replace function public.add_participant_to_group(
  p_group_id uuid,
  p_participant_id uuid default null,
  p_first_name text default null,
  p_last_name text default null,
  p_email text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_group public.groups%rowtype;
  v_participant public.participants%rowtype;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_created boolean := false;
begin
  if not (private.has_permission('groups.manage') and (private.is_admin() or private.trains_group(p_group_id))) then
    raise exception 'Vous n’êtes pas autorisé à modifier ce groupe.' using errcode = '42501';
  end if;
  select * into v_group from public.groups where id = p_group_id;
  if not found then raise exception 'Groupe introuvable.' using errcode = 'P0002'; end if;

  if p_participant_id is not null then
    select * into v_participant from public.participants where id = p_participant_id;
    if not found then raise exception 'Participant introuvable.' using errcode = 'P0002'; end if;
    if not (private.is_admin() or private.trains_participant(p_participant_id)
            or (private.has_permission('participants.directory') and private.is_unassigned(p_participant_id))) then
      raise exception 'Vous n’avez pas accès à ce participant.' using errcode = '42501';
    end if;
  else
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
      raise exception 'Adresse e-mail invalide.' using errcode = '22023';
    end if;
    select * into v_participant from public.participants where email = v_email;
    if not found then
      if nullif(trim(p_first_name), '') is null or nullif(trim(p_last_name), '') is null then
        raise exception 'Indiquez le prénom et le nom du participant.' using errcode = '22023';
      end if;
      insert into public.participants (first_name, last_name, email, status, invited_by, organization_id, is_demo)
      values (left(trim(p_first_name), 80), left(trim(p_last_name), 80), v_email, 'invited', (select auth.uid()), v_group.organization_id, v_group.is_demo)
      returning * into v_participant;
      v_created := true;
    end if;
  end if;

  -- Sans rattachement, le participant rejoint l'organisme du groupe.
  if v_participant.organization_id is null and v_group.organization_id is not null then
    update public.participants set organization_id = v_group.organization_id where id = v_participant.id
    returning * into v_participant;
  end if;

  insert into public.group_members (group_id, participant_id, status, added_by)
  values (p_group_id, v_participant.id, 'active', (select auth.uid()))
  on conflict (group_id, participant_id)
  do update set status = 'active', left_at = null, added_by = excluded.added_by;

  return jsonb_build_object(
    'participant_id', v_participant.id,
    'created', v_created,
    'has_account', v_participant.user_id is not null,
    'other_organization', v_group.organization_id is not null and v_participant.organization_id is distinct from v_group.organization_id
  );
end;
$$;

-- ── Évaluations ─────────────────────────────────────────────────────────────
-- Applique un lot de notes, d'observations de critères et de commentaires.
-- SECURITY INVOKER : s'exécute avec les droits de la fonction appelante
-- (RLS active pour un brouillon, contrôle explicite pour une modification tracée).
create or replace function private.apply_evaluation_payload(
  p_evaluation_id uuid,
  p_scores jsonb,
  p_criteria jsonb,
  p_comments jsonb
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_item jsonb;
  v_kind text;
  v_body text;
  v_author uuid := (select auth.uid());
begin
  if jsonb_typeof(coalesce(p_scores, '[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_criteria, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_comments, '{}'::jsonb)) <> 'object' then
    raise exception 'Format de données invalide.' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) loop
    insert into public.evaluation_scores (evaluation_id, skill_id, score, score_source, comment)
    values (
      p_evaluation_id,
      (v_item ->> 'skill_id')::uuid,
      nullif(v_item ->> 'score', '')::numeric,
      case when v_item ->> 'source' = 'derived' then 'derived' else 'direct' end,
      nullif(trim(v_item ->> 'comment'), '')
    )
    on conflict (evaluation_id, skill_id)
    do update set score = excluded.score, score_source = excluded.score_source, comment = excluded.comment
    where (evaluation_scores.score, evaluation_scores.score_source, evaluation_scores.comment)
          is distinct from (excluded.score, excluded.score_source, excluded.comment);
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_criteria, '[]'::jsonb)) loop
    insert into public.evaluation_criterion_scores (evaluation_id, criterion_id, observed, score)
    values (
      p_evaluation_id,
      (v_item ->> 'criterion_id')::uuid,
      (v_item ->> 'observed')::boolean,
      nullif(v_item ->> 'score', '')::numeric
    )
    on conflict (evaluation_id, criterion_id)
    do update set observed = excluded.observed, score = excluded.score
    where (evaluation_criterion_scores.observed, evaluation_criterion_scores.score)
          is distinct from (excluded.observed, excluded.score);
  end loop;

  for v_kind, v_body in select key, value from jsonb_each_text(coalesce(p_comments, '{}'::jsonb)) loop
    if v_kind not in ('observation', 'advice', 'private') then
      raise exception 'Type de commentaire inconnu : %.', v_kind using errcode = '22023';
    end if;
    if nullif(trim(v_body), '') is null then
      delete from public.evaluation_comments where evaluation_id = p_evaluation_id and kind = v_kind;
    else
      insert into public.evaluation_comments (evaluation_id, kind, body, author_id)
      values (p_evaluation_id, v_kind, trim(v_body), v_author)
      on conflict (evaluation_id, kind)
      do update set body = excluded.body, author_id = excluded.author_id, updated_at = now()
      where evaluation_comments.body is distinct from excluded.body;
    end if;
  end loop;
end;
$$;

-- Enregistrement d'un brouillon (sauvegarde automatique). Soumis aux politiques RLS.
create or replace function public.save_evaluation_draft(
  p_session_id uuid,
  p_participant_id uuid,
  p_scores jsonb default '[]'::jsonb,
  p_criteria jsonb default '[]'::jsonb,
  p_comments jsonb default '{}'::jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
  v_status text;
begin
  select e.id, e.status into v_id, v_status
  from public.evaluations e where e.session_id = p_session_id and e.participant_id = p_participant_id;
  if v_id is null then
    insert into public.evaluations (session_id, participant_id, evaluator_id, status)
    values (p_session_id, p_participant_id, (select auth.uid()), 'draft')
    returning id into v_id;
  elsif v_status <> 'draft' then
    raise exception 'Cette évaluation est validée : toute modification doit être motivée et tracée.' using errcode = 'P0001';
  end if;
  perform private.apply_evaluation_payload(v_id, p_scores, p_criteria, p_comments);
  update public.evaluations set updated_at = now() where id = v_id;
  return v_id;
end;
$$;

create or replace function private.build_framework_snapshot(p_evaluation_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'framework_code', f.code,
    'framework_name', f.name,
    'version_id', v.id,
    'version_number', v.version_number,
    'version_label', v.label,
    'is_provisional', v.is_provisional,
    'scale', jsonb_build_object(
      'min', v.scale_min, 'max', v.scale_max, 'step', v.scale_step,
      'levels', (
        select coalesce(jsonb_agg(jsonb_build_object('value', l.value, 'label', l.label, 'description', l.description) order by l.value), '[]'::jsonb)
        from public.scale_levels l where l.version_id = v.id
      )
    ),
    'rules', jsonb_build_object('scoring_mode', v.scoring_mode, 'aggregation', v.aggregation, 'rounding', v.rounding),
    'skills', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'skill_id', s.id, 'code', s.code, 'name', s.name, 'description', s.description,
        'category', c.name, 'weight', s.weight,
        'levels', (
          select coalesce(jsonb_agg(jsonb_build_object('value', d.level_value, 'description', d.description) order by d.level_value), '[]'::jsonb)
          from public.skill_level_descriptors d where d.skill_id = s.id
        ),
        'criteria', (
          select coalesce(jsonb_agg(jsonb_build_object('criterion_id', k.id, 'label', k.label, 'description', k.description, 'weight', k.weight) order by k.position), '[]'::jsonb)
          from public.skill_criteria k where k.skill_id = s.id and k.is_active
        )
      ) order by s.position), '[]'::jsonb)
      from public.evaluation_scores es
      join public.skills s on s.id = es.skill_id
      left join public.skill_categories c on c.id = s.category_id
      where es.evaluation_id = p_evaluation_id and s.version_id = v.id
    )
  ) order by f.position), '[]'::jsonb)
  from public.evaluation_frameworks ef
  join public.framework_versions v on v.id = ef.framework_version_id
  join public.frameworks f on f.id = v.framework_id
  where ef.evaluation_id = p_evaluation_id;
$$;

-- Validation explicite : fige l'évaluation et la photographie du référentiel appliqué.
create or replace function public.validate_evaluation(p_evaluation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_eval public.evaluations%rowtype;
  v_user uuid;
  v_org uuid;
  v_number int;
begin
  select * into v_eval from public.evaluations where id = p_evaluation_id for update;
  if not found then raise exception 'Évaluation introuvable.' using errcode = 'P0002'; end if;
  if not private.can_write_evaluation(v_eval.session_id) then
    raise exception 'Vous n’êtes pas autorisé à valider cette évaluation.' using errcode = '42501';
  end if;
  if v_eval.status = 'validated' then
    raise exception 'Cette évaluation est déjà validée.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.evaluation_scores es where es.evaluation_id = v_eval.id and es.score is not null) then
    raise exception 'Renseignez au moins une compétence avant de valider.' using errcode = 'P0001';
  end if;

  update public.evaluations
     set status = 'validated', validated_at = now(), validated_by = (select auth.uid()),
         framework_snapshot = private.build_framework_snapshot(v_eval.id)
   where id = v_eval.id;
  insert into public.evaluation_history (evaluation_id, change_type, new_value, changed_by)
  values (v_eval.id, 'validated', 'validated', (select auth.uid()));

  select p.user_id, p.organization_id into v_user, v_org from public.participants p where p.id = v_eval.participant_id;
  select s.number into v_number from public.sessions s where s.id = v_eval.session_id;
  perform private.notify(v_user, 'evaluation.validated', 'Une nouvelle évaluation est disponible',
    'Les observations de la session ' || v_number || ' ont été ajoutées à votre passeport de compétences.',
    '/participant/dashboard');
  perform private.audit('evaluation.validated', 'evaluation', v_eval.id::text, v_org, v_eval.participant_id,
    jsonb_build_object('session_id', v_eval.session_id));
end;
$$;

-- Modification d'une évaluation validée : motif obligatoire, chaque valeur
-- remplacée est conservée dans evaluation_history par les déclencheurs.
create or replace function public.amend_evaluation(
  p_evaluation_id uuid,
  p_reason text,
  p_scores jsonb default '[]'::jsonb,
  p_criteria jsonb default '[]'::jsonb,
  p_comments jsonb default '{}'::jsonb
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_eval public.evaluations%rowtype;
  v_before bigint;
  v_changes bigint;
  v_org uuid;
  v_user uuid;
begin
  select * into v_eval from public.evaluations where id = p_evaluation_id for update;
  if not found then raise exception 'Évaluation introuvable.' using errcode = 'P0002'; end if;
  if not private.can_write_evaluation(v_eval.session_id) then
    raise exception 'Vous n’êtes pas autorisé à modifier cette évaluation.' using errcode = '42501';
  end if;
  if v_eval.status <> 'validated' then
    raise exception 'Cette évaluation est encore un brouillon.' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indiquez le motif de la modification (5 caractères minimum).' using errcode = '22023';
  end if;

  select count(*) into v_before from public.evaluation_history h where h.evaluation_id = v_eval.id;
  perform set_config('app.change_reason', left(trim(p_reason), 500), true);
  perform private.apply_evaluation_payload(v_eval.id, p_scores, p_criteria, p_comments);
  perform set_config('app.change_reason', '', true);
  select count(*) - v_before into v_changes from public.evaluation_history h where h.evaluation_id = v_eval.id;

  if v_changes > 0 then
    update public.evaluations set revision = revision + 1 where id = v_eval.id;
    select p.user_id, p.organization_id into v_user, v_org from public.participants p where p.id = v_eval.participant_id;
    perform private.notify(v_user, 'evaluation.amended', 'Une évaluation a été mise à jour',
      'Votre formateur a corrigé une évaluation de votre passeport.', '/participant/dashboard');
    perform private.audit('evaluation.amended', 'evaluation', v_eval.id::text, v_org, v_eval.participant_id,
      jsonb_build_object('changes', v_changes));
  end if;
  return v_changes::int;
end;
$$;

-- ── Référentiels : nouvelle version en brouillon à partir d'une version existante
create or replace function public.clone_framework_version(p_source_version_id uuid, p_label text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_src public.framework_versions%rowtype;
  v_new uuid;
  v_next int;
begin
  if not private.is_admin() then
    raise exception 'Seul un administrateur peut créer une version de référentiel.' using errcode = '42501';
  end if;
  select * into v_src from public.framework_versions where id = p_source_version_id;
  if not found then raise exception 'Version introuvable.' using errcode = 'P0002'; end if;
  if exists (select 1 from public.framework_versions v where v.framework_id = v_src.framework_id and v.status = 'draft') then
    raise exception 'Un brouillon existe déjà pour ce référentiel : publiez-le ou supprimez-le d’abord.' using errcode = 'P0001';
  end if;
  select coalesce(max(v.version_number), 0) + 1 into v_next
  from public.framework_versions v where v.framework_id = v_src.framework_id;

  insert into public.framework_versions (
    framework_id, version_number, label, status, is_provisional, scale_min, scale_max, scale_step,
    scoring_mode, aggregation, rounding, settings, based_on_version_id, created_by)
  values (
    v_src.framework_id, v_next, coalesce(nullif(trim(p_label), ''), 'Version ' || v_next), 'draft', v_src.is_provisional,
    v_src.scale_min, v_src.scale_max, v_src.scale_step, v_src.scoring_mode, v_src.aggregation, v_src.rounding,
    v_src.settings, v_src.id, (select auth.uid()))
  returning id into v_new;

  insert into public.scale_levels (version_id, value, label, description)
  select v_new, l.value, l.label, l.description from public.scale_levels l where l.version_id = v_src.id;

  insert into public.skill_categories (version_id, code, name, description, position)
  select v_new, c.code, c.name, c.description, c.position from public.skill_categories c where c.version_id = v_src.id;

  insert into public.skills (version_id, category_id, code, name, description, position, weight, is_active)
  select v_new, nc.id, s.code, s.name, s.description, s.position, s.weight, s.is_active
  from public.skills s
  left join public.skill_categories oc on oc.id = s.category_id
  left join public.skill_categories nc on nc.version_id = v_new and nc.code = oc.code
  where s.version_id = v_src.id;

  insert into public.skill_level_descriptors (skill_id, level_value, description)
  select ns.id, d.level_value, d.description
  from public.skill_level_descriptors d
  join public.skills os on os.id = d.skill_id and os.version_id = v_src.id
  join public.skills ns on ns.version_id = v_new and ns.code = os.code;

  insert into public.skill_criteria (skill_id, label, description, position, weight, is_active)
  select ns.id, k.label, k.description, k.position, k.weight, k.is_active
  from public.skill_criteria k
  join public.skills os on os.id = k.skill_id and os.version_id = v_src.id
  join public.skills ns on ns.version_id = v_new and ns.code = os.code;

  insert into public.session_skill_map (version_id, session_number, skill_id, weight)
  select v_new, m.session_number, ns.id, m.weight
  from public.session_skill_map m
  join public.skills os on os.id = m.skill_id
  join public.skills ns on ns.version_id = v_new and ns.code = os.code
  where m.version_id = v_src.id;

  perform private.audit('framework.version_created', 'framework_version', v_new::text, null, null,
    jsonb_build_object('based_on', v_src.id, 'version', v_next));
  return v_new;
end;
$$;

create or replace function public.clone_questionnaire_version(p_source_version_id uuid, p_label text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_src public.questionnaire_versions%rowtype;
  v_new uuid;
  v_next int;
begin
  if not private.is_admin() then
    raise exception 'Seul un administrateur peut créer une version de questionnaire.' using errcode = '42501';
  end if;
  select * into v_src from public.questionnaire_versions where id = p_source_version_id;
  if not found then raise exception 'Version introuvable.' using errcode = 'P0002'; end if;
  if exists (select 1 from public.questionnaire_versions v where v.questionnaire_id = v_src.questionnaire_id and v.status = 'draft') then
    raise exception 'Un brouillon existe déjà pour ce questionnaire.' using errcode = 'P0001';
  end if;
  select coalesce(max(v.version_number), 0) + 1 into v_next
  from public.questionnaire_versions v where v.questionnaire_id = v_src.questionnaire_id;

  insert into public.questionnaire_versions (questionnaire_id, version_number, label, status, is_provisional, intro, scale_min, scale_max, created_by)
  values (v_src.questionnaire_id, v_next, coalesce(nullif(trim(p_label), ''), 'Version ' || v_next), 'draft',
          v_src.is_provisional, v_src.intro, v_src.scale_min, v_src.scale_max, (select auth.uid()))
  returning id into v_new;
  insert into public.questionnaire_scale_labels (version_id, value, label)
  select v_new, l.value, l.label from public.questionnaire_scale_labels l where l.version_id = v_src.id;
  insert into public.questionnaire_questions (version_id, position, text, help, framework_code, skill_code, is_active)
  select v_new, q.position, q.text, q.help, q.framework_code, q.skill_code, q.is_active
  from public.questionnaire_questions q where q.version_id = v_src.id;

  perform private.audit('questionnaire.version_created', 'questionnaire_version', v_new::text);
  return v_new;
end;
$$;

-- ── Supports pédagogiques : import et publication versionnés ────────────────
create or replace function public.publish_pedagogical_version(p_version_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_content uuid;
begin
  if not private.is_admin() then
    raise exception 'Seul un administrateur peut publier un support.' using errcode = '42501';
  end if;
  select content_id into v_content from public.pedagogical_content_versions where id = p_version_id;
  if not found then raise exception 'Version introuvable.' using errcode = 'P0002'; end if;
  update public.pedagogical_content_versions set published_at = now() where id = p_version_id;
  update public.pedagogical_contents set current_version_id = p_version_id where id = v_content;
  perform private.audit('content.published', 'pedagogical_content', v_content::text, null, null,
    jsonb_build_object('version_id', p_version_id));
end;
$$;

create or replace function public.import_pedagogical_version(
  p_program_session_id uuid,
  p_markdown text,
  p_source_filename text default null,
  p_change_note text default null,
  p_is_provisional boolean default false,
  p_publish boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_content uuid;
  v_version uuid;
  v_next int;
begin
  if not private.is_admin() then
    raise exception 'Seul un administrateur peut importer un support.' using errcode = '42501';
  end if;
  if nullif(trim(p_markdown), '') is null then
    raise exception 'Le fichier est vide.' using errcode = '22023';
  end if;
  insert into public.pedagogical_contents (program_session_id) values (p_program_session_id)
  on conflict (program_session_id) do nothing;
  select id into v_content from public.pedagogical_contents where program_session_id = p_program_session_id;
  select coalesce(max(version_number), 0) + 1 into v_next
  from public.pedagogical_content_versions where content_id = v_content;

  insert into public.pedagogical_content_versions (content_id, version_number, markdown, source_filename, change_note, is_provisional, created_by)
  values (v_content, v_next, p_markdown, nullif(left(trim(p_source_filename), 200), ''), nullif(left(trim(p_change_note), 500), ''),
          coalesce(p_is_provisional, false), (select auth.uid()))
  returning id into v_version;
  perform private.audit('content.imported', 'pedagogical_content', v_content::text, null, null,
    jsonb_build_object('version_id', v_version, 'version', v_next));
  if p_publish then
    perform public.publish_pedagogical_version(v_version);
  end if;
  return v_version;
end;
$$;

-- ── Catalogue public (site vitrine) : programme et référentiels publiés ─────
create or replace function public.get_public_catalog()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'program', (
      select jsonb_build_object(
        'name', p.name, 'description', p.description,
        'sessions_count', p.sessions_count, 'session_duration_minutes', p.session_duration_minutes,
        'min_group_size', p.min_group_size, 'max_group_size', p.max_group_size,
        'sessions', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'number', ps.number, 'title', ps.title, 'summary', ps.summary, 'is_provisional', ps.is_provisional
          ) order by ps.number), '[]'::jsonb)
          from public.program_sessions ps where ps.program_id = p.id
        )
      )
      from public.programs p where p.is_public and p.status = 'active' limit 1
    ),
    'frameworks', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'code', f.code, 'name', f.name, 'short_name', f.short_name, 'description', f.description,
        'scale_min', v.scale_min, 'scale_max', v.scale_max, 'is_provisional', v.is_provisional,
        'levels', (
          select coalesce(jsonb_agg(jsonb_build_object('value', l.value, 'label', l.label) order by l.value), '[]'::jsonb)
          from public.scale_levels l where l.version_id = v.id
        ),
        'categories', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'code', c.code, 'name', c.name, 'description', c.description,
            'skills', (
              select coalesce(jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'description', s.description) order by s.position), '[]'::jsonb)
              from public.skills s where s.category_id = c.id and s.is_active
            )
          ) order by c.position), '[]'::jsonb)
          from public.skill_categories c where c.version_id = v.id
        )
      ) order by f.position), '[]'::jsonb)
      from public.programs p
      join public.program_frameworks pf on pf.program_id = p.id
      join public.framework_versions v on v.id = pf.framework_version_id and v.status = 'published'
      join public.frameworks f on f.id = v.framework_id
      where p.is_public and p.status = 'active'
    ),
    'settings', (
      select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb) from public.app_settings s where s.is_public
    )
  );
$$;

-- ── Formulaire de contact (appelé par le serveur uniquement) ────────────────
create or replace function public.submit_contact_message(
  p_name text,
  p_email text,
  p_organization text,
  p_audience text,
  p_message text,
  p_origin_hash text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if p_origin_hash is not null and (
    select count(*) from public.contact_messages m
    where m.origin_hash = p_origin_hash and m.created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  if (select count(*) from public.contact_messages m where m.created_at > now() - interval '1 day') >= 300 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  insert into public.contact_messages (name, email, organization, audience, message, origin_hash)
  values (trim(p_name), lower(trim(p_email)), nullif(trim(p_organization), ''), nullif(p_audience, ''), trim(p_message), p_origin_hash)
  returning id into v_id;
  perform private.notify_admins('contact.message', 'Nouveau message de contact',
    'Un message a été envoyé depuis le site.', '/admin/parametres');
  return v_id;
end;
$$;

-- ── Journalisation des accès et des exports ─────────────────────────────────
create or replace function public.log_event(
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_participant uuid;
  v_org uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;
  if p_action not in (
    'participant_file.viewed', 'export.passport_pdf', 'export.attendance_pdf', 'export.attendance_csv',
    'export.participants_csv', 'export.personal_data', 'auth.signed_in', 'auth.password_changed'
  ) then
    raise exception 'Action non journalisable.' using errcode = '22023';
  end if;
  if p_entity_type = 'participant' and p_entity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_participant := p_entity_id::uuid;
    select p.organization_id into v_org from public.participants p where p.id = v_participant;
  end if;
  perform private.audit(p_action, left(p_entity_type, 40), left(p_entity_id, 80), v_org, v_participant,
    case when pg_column_size(coalesce(p_metadata, '{}'::jsonb)) > 1500 then '{}'::jsonb else coalesce(p_metadata, '{}'::jsonb) end);
end;
$$;

-- ── Effacement des données d'un utilisateur (demande RGPD) ──────────────────
-- Supprime les données du participant ; le compte d'authentification est ensuite
-- supprimé par le serveur (clé de service). Renvoie l'identifiant du compte.
create or replace function public.process_deletion_request(p_request_id uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request public.data_requests%rowtype;
  v_participant uuid;
begin
  if not private.is_admin() then
    raise exception 'Seul un administrateur peut traiter cette demande.' using errcode = '42501';
  end if;
  select * into v_request from public.data_requests
  where id = p_request_id and type = 'deletion' and status = 'pending' for update;
  if not found then raise exception 'Demande introuvable ou déjà traitée.' using errcode = 'P0002'; end if;
  if v_request.user_id = (select auth.uid()) then
    raise exception 'Vous ne pouvez pas traiter votre propre demande de suppression.' using errcode = 'P0001';
  end if;

  select p.id into v_participant from public.participants p where p.user_id = v_request.user_id;
  if v_participant is not null then
    perform set_config('app.erasure', 'on', true);
    delete from public.attendance_history where participant_id = v_participant;
    delete from public.participants where id = v_participant;
    perform set_config('app.erasure', '', true);
  end if;
  update public.data_requests
     set status = 'completed', processed_by = (select auth.uid()), processed_at = now(), resolution_note = nullif(trim(p_note), '')
   where id = p_request_id;
  return v_request.user_id;
end;
$$;

-- ── Droits d'exécution ──────────────────────────────────────────────────────
-- Par défaut PostgreSQL autorise PUBLIC à exécuter toute fonction : on ferme tout,
-- puis on ouvre fonction par fonction.
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

grant execute on function public.get_public_catalog() to anon, authenticated, service_role;

grant execute on function public.create_invitation_code(text, text, timestamptz, uuid) to authenticated;
grant execute on function public.revoke_invitation_code(uuid) to authenticated;
grant execute on function public.add_participant_to_group(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.save_evaluation_draft(uuid, uuid, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.validate_evaluation(uuid) to authenticated;
grant execute on function public.amend_evaluation(uuid, text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.clone_framework_version(uuid, text) to authenticated;
grant execute on function public.clone_questionnaire_version(uuid, text) to authenticated;
grant execute on function public.import_pedagogical_version(uuid, text, text, text, boolean, boolean) to authenticated;
grant execute on function public.publish_pedagogical_version(uuid) to authenticated;
grant execute on function public.log_event(text, text, text, jsonb) to authenticated;
grant execute on function public.process_deletion_request(uuid, text) to authenticated;

-- Réservées au serveur (clé de service) : jamais appelables depuis un navigateur.
grant execute on function public.check_invitation_code(text) to service_role;
grant execute on function public.redeem_invitation_code(text, uuid) to service_role;
grant execute on function public.submit_contact_message(text, text, text, text, text, text) to service_role;
