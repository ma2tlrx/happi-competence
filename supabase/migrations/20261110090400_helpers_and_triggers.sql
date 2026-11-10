-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — 5/7 : fonctions d'aide, déclencheurs d'intégrité,
-- historisation, journal d'activité et notifications
--
-- Convention : les fonctions du schéma private sont SECURITY DEFINER lorsqu'elles
-- doivent lire au-delà des droits de l'appelant (elles sont alors la seule porte
-- d'entrée et vérifient elles-mêmes l'identité via auth.uid()).
-- ════════════════════════════════════════════════════════════════════════════

-- ── Identité et périmètre de l'appelant ─────────────────────────────────────
create or replace function private.current_role_code()
returns text language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p
  where p.id = (select auth.uid()) and p.status = 'active';
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.current_role_code() = 'admin', false);
$$;

-- Équipe HAPPI : formateurs et administrateurs.
create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.current_role_code() in ('admin', 'formateur'), false);
$$;

create or replace function private.has_permission(p_code text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when private.current_role_code() is null then false
    when private.current_role_code() = 'admin' then true
    else exists (
      select 1 from public.role_permissions rp
      where rp.role_code = private.current_role_code() and rp.permission_code = p_code
    )
  end;
$$;

-- Organismes actifs dont l'appelant est membre (vide pour tout autre rôle).
create or replace function private.my_organization_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(om.organization_id), '{}'::uuid[])
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  where om.user_id = (select auth.uid())
    and o.status = 'active'
    and private.current_role_code() = 'organisme';
$$;

create or replace function private.is_org_member(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id and om.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_org_owner(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    where om.organization_id = p_organization_id and om.user_id = (select auth.uid())
      and om.member_role = 'owner' and o.status = 'active'
  );
$$;

create or replace function private.my_participant_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.id from public.participants p where p.user_id = (select auth.uid());
$$;

create or replace function private.my_participant_org_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.organization_id from public.participants p where p.user_id = (select auth.uid());
$$;

create or replace function private.trains_group(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_staff() and exists (
    select 1 from public.group_trainers gt
    where gt.group_id = p_group_id and gt.trainer_id = (select auth.uid())
  );
$$;

create or replace function private.trains_participant(p_participant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_staff() and exists (
    select 1 from public.group_members gm
    join public.group_trainers gt on gt.group_id = gm.group_id
    where gm.participant_id = p_participant_id and gt.trainer_id = (select auth.uid())
  );
$$;

-- Participant sans groupe actif : visible des formateurs habilités pour pouvoir l'affecter.
create or replace function private.is_unassigned(p_participant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.group_members gm
    where gm.participant_id = p_participant_id and gm.status = 'active'
  );
$$;

create or replace function private.org_sees_participant(p_participant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.participants p
    where p.id = p_participant_id and p.organization_id = any (private.my_organization_ids())
  );
$$;

create or replace function private.org_sees_group(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.groups g
    where g.id = p_group_id and g.organization_id = any (private.my_organization_ids())
  ) or exists (
    select 1 from public.group_members gm
    join public.participants p on p.id = gm.participant_id
    where gm.group_id = p_group_id and gm.status = 'active'
      and p.organization_id = any (private.my_organization_ids())
  );
$$;

create or replace function private.member_of_group(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members gm
    join public.participants p on p.id = gm.participant_id
    where gm.group_id = p_group_id and gm.status = 'active' and p.user_id = (select auth.uid())
  );
$$;

create or replace function private.session_group_id(p_session_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select s.group_id from public.sessions s where s.id = p_session_id;
$$;

create or replace function private.can_read_evaluation(p_evaluation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.evaluations e
    where e.id = p_evaluation_id and (
      private.is_admin()
      or private.trains_group(private.session_group_id(e.session_id))
      or (e.status = 'validated' and e.participant_id = private.my_participant_id())
      or (e.status = 'validated' and private.has_permission('org.evaluations.read') and private.org_sees_participant(e.participant_id))
    )
  );
$$;

create or replace function private.can_write_evaluation(p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_permission('evaluations.write')
     and (private.is_admin() or private.trains_group(private.session_group_id(p_session_id)));
$$;

create or replace function private.can_write_evaluation_draft(p_evaluation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.evaluations e
    where e.id = p_evaluation_id and e.status = 'draft' and private.can_write_evaluation(e.session_id)
  );
$$;

create or replace function private.framework_version_visible(p_version_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.framework_versions v
    where v.id = p_version_id and (v.status <> 'draft' or private.is_admin())
  );
$$;

create or replace function private.questionnaire_version_visible(p_version_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.questionnaire_versions v
    where v.id = p_version_id and (v.status <> 'draft' or private.is_admin())
  );
$$;

create or replace function private.can_read_self_assessment(p_self_assessment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.self_assessments sa
    where sa.id = p_self_assessment_id and (
      sa.participant_id = private.my_participant_id()
      or private.is_admin()
      or private.trains_participant(sa.participant_id)
      or private.org_sees_participant(sa.participant_id)
    )
  );
$$;

create or replace function private.owns_open_self_assessment(p_self_assessment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.self_assessments sa
    where sa.id = p_self_assessment_id and sa.status = 'in_progress'
      and sa.participant_id = private.my_participant_id()
  );
$$;

-- ── Journal d'activité et notifications ─────────────────────────────────────
create or replace function private.audit(
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_organization_id uuid default null,
  p_participant_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, organization_id, participant_id, metadata)
  values (
    (select auth.uid()),
    coalesce(private.current_role_code(), (select auth.role()), 'system'),
    p_action, p_entity_type, p_entity_id, p_organization_id, p_participant_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function private.notify(p_user_id uuid, p_type text, p_title text, p_body text default null, p_link text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user_id is null then return; end if;
  insert into public.notifications (user_id, type, title, body, link) values (p_user_id, p_type, p_title, p_body, p_link);
end;
$$;

create or replace function private.notify_admins(p_type text, p_title text, p_body text default null, p_link text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, type, title, body, link)
  select p.id, p_type, p_title, p_body, p_link
  from public.profiles p where p.role = 'admin' and p.status = 'active';
end;
$$;

-- Tables en ajout seul. La suppression n'est tolérée que par cascade (effacement
-- d'un participant) ou lors d'un effacement RGPD explicitement signalé.
create or replace function private.append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and tg_table_name <> 'audit_logs'
     and (pg_trigger_depth() > 1 or current_setting('app.erasure', true) = 'on') then
    return old;
  end if;
  raise exception 'La table % est en ajout seul : opération % refusée.', tg_table_name, tg_op using errcode = '42501';
end;
$$;

create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function private.append_only();
create trigger evaluation_history_append_only before update or delete on public.evaluation_history
  for each row execute function private.append_only();
create trigger attendance_history_append_only before update or delete on public.attendance_history
  for each row execute function private.append_only();

-- ── Création des comptes (déclencheurs sur auth.users) ──────────────────────
-- Rattache le compte à une fiche participant pré-créée (invitation) une fois
-- l'adresse e-mail confirmée, ou crée la fiche si elle n'existe pas.
create or replace function private.link_or_create_participant(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_confirmed timestamptz;
  v_account_type text;
  v_is_demo boolean;
  v_profile public.profiles%rowtype;
  v_invited uuid;
begin
  select lower(u.email), u.email_confirmed_at,
         coalesce(u.raw_user_meta_data ->> 'account_type', 'participant'),
         coalesce((u.raw_app_meta_data ->> 'is_demo')::boolean, false)
    into v_email, v_confirmed, v_account_type, v_is_demo
  from auth.users u where u.id = p_user_id;
  if not found or v_account_type <> 'participant' or v_email is null then return; end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if not found or v_profile.role <> 'participant' then return; end if;
  if exists (select 1 from public.participants where user_id = p_user_id) then return; end if;

  select id into v_invited from public.participants where email = v_email and user_id is null for update;
  if v_invited is not null then
    -- Une fiche existe déjà pour cette adresse : on attend la preuve de possession de la boîte.
    if v_confirmed is null then return; end if;
    update public.participants
       set user_id = p_user_id,
           status = 'active',
           first_name = coalesce(nullif(v_profile.first_name, ''), first_name),
           last_name = coalesce(nullif(v_profile.last_name, ''), last_name)
     where id = v_invited;
    return;
  end if;

  insert into public.participants (user_id, first_name, last_name, email, status, is_demo)
  values (
    p_user_id,
    coalesce(nullif(v_profile.first_name, ''), 'Prénom'),
    coalesce(nullif(v_profile.last_name, ''), 'Nom'),
    v_email, 'active', v_is_demo
  )
  on conflict do nothing;
end;
$$;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_type text := coalesce(v_meta ->> 'account_type', 'participant');
  v_is_demo boolean := coalesce((new.raw_app_meta_data ->> 'is_demo')::boolean, false);
  v_org_id uuid;
  v_org_type text;
  v_siret text;
begin
  -- Les métadonnées viennent du client : seuls « participant » et « organisme » ouvrent
  -- un rôle ici. Les rôles formateur et administrateur ne s'obtiennent que par code d'accès.
  insert into public.profiles (id, role, first_name, last_name, email, terms_accepted_at, privacy_consent_at, consent_version, is_demo)
  values (
    new.id,
    case when v_type = 'organisme' then 'organisme' else 'participant' end,
    left(trim(coalesce(v_meta ->> 'first_name', '')), 80),
    left(trim(coalesce(v_meta ->> 'last_name', '')), 80),
    lower(coalesce(new.email, '')),
    case when (v_meta ->> 'terms_accepted') = 'true' then now() end,
    case when (v_meta ->> 'privacy_consent') = 'true' then now() end,
    nullif(left(v_meta ->> 'consent_version', 20), ''),
    v_is_demo
  );

  if v_type = 'organisme' then
    v_org_type := v_meta ->> 'organization_type';
    if v_org_type is null or v_org_type not in ('mission_locale', 'france_travail', 'ecole', 'organisme_formation', 'structure_insertion', 'entreprise', 'autre') then
      v_org_type := 'autre';
    end if;
    v_siret := regexp_replace(coalesce(v_meta ->> 'organization_siret', ''), '\s', '', 'g');
    insert into public.organizations (name, type, siret, city, contact_email, status, created_by, is_demo)
    values (
      coalesce(nullif(left(trim(v_meta ->> 'organization_name'), 160), ''), 'Organisme à renseigner'),
      v_org_type,
      case when v_siret ~ '^[0-9]{14}$' then v_siret end,
      nullif(left(trim(v_meta ->> 'organization_city'), 120), ''),
      lower(new.email), 'pending', new.id, v_is_demo
    ) returning id into v_org_id;
    insert into public.organization_members (organization_id, user_id, member_role) values (v_org_id, new.id, 'owner');
    perform private.notify_admins('organization.pending', 'Nouvelle demande d’organisme',
      'Une structure a demandé l’ouverture de son espace. Validez ou refusez la demande.', '/admin/organismes');
    perform private.audit('organization.requested', 'organization', v_org_id::text, v_org_id);
  elsif v_type = 'participant' then
    perform private.link_or_create_participant(new.id);
  end if;
  return new;
end;
$$;

create or replace function private.handle_user_updated()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(coalesce(new.email, '')) where id = new.id;
    update public.participants set email = lower(new.email) where user_id = new.id and new.email is not null;
  end if;
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform private.link_or_create_participant(new.id);
  end if;
  return new;
end;
$$;

grant execute on function private.handle_new_user() to supabase_auth_admin;
grant execute on function private.handle_user_updated() to supabase_auth_admin;
grant usage on schema private to supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated after update of email, email_confirmed_at on auth.users
  for each row execute function private.handle_user_updated();

-- ── Profils : colonnes protégées, dernier administrateur, synchronisation ───
create or replace function private.profiles_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and not private.is_admin() then
    if new.role is distinct from old.role or new.status is distinct from old.status
       or new.email is distinct from old.email or new.is_demo is distinct from old.is_demo then
      raise exception 'Vous ne pouvez pas modifier ces informations de compte.' using errcode = '42501';
    end if;
    -- Un consentement enregistré ne se retire pas par simple mise à jour du profil.
    new.terms_accepted_at := coalesce(old.terms_accepted_at, new.terms_accepted_at);
    new.privacy_consent_at := coalesce(old.privacy_consent_at, new.privacy_consent_at);
  end if;
  if old.role = 'admin' and old.status = 'active' and (new.role <> 'admin' or new.status <> 'active') then
    if not exists (select 1 from public.profiles p where p.role = 'admin' and p.status = 'active' and p.id <> old.id) then
      raise exception 'Impossible de retirer le dernier administrateur actif.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_guard before update on public.profiles
  for each row execute function private.profiles_guard();

create or replace function private.profiles_after_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.first_name is distinct from old.first_name or new.last_name is distinct from old.last_name
     or new.phone is distinct from old.phone then
    update public.participants
       set first_name = coalesce(nullif(new.first_name, ''), first_name),
           last_name = coalesce(nullif(new.last_name, ''), last_name),
           phone = new.phone
     where user_id = new.id;
  end if;
  if new.role is distinct from old.role then
    perform private.audit('user.role_changed', 'profile', new.id::text, null, null,
      jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  if new.status is distinct from old.status then
    perform private.audit('user.status_changed', 'profile', new.id::text, null, null,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return null;
end;
$$;
create trigger profiles_after_update after update on public.profiles
  for each row execute function private.profiles_after_update();

-- ── Permissions : une permission ne s'accorde qu'aux rôles prévus ───────────
create or replace function private.role_permissions_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.permissions p
    where p.code = new.permission_code and new.role_code = any (p.applicable_roles)
  ) then
    raise exception 'Cette permission ne peut pas être accordée au rôle « % ».', new.role_code using errcode = 'P0001';
  end if;
  new.granted_by := coalesce((select auth.uid()), new.granted_by);
  return new;
end;
$$;
create trigger role_permissions_guard before insert or update on public.role_permissions
  for each row execute function private.role_permissions_guard();

create or replace function private.role_permissions_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform private.audit('permission.revoked', 'role', old.role_code, null, null, jsonb_build_object('permission', old.permission_code));
  else
    perform private.audit('permission.granted', 'role', new.role_code, null, null, jsonb_build_object('permission', new.permission_code));
  end if;
  return null;
end;
$$;
create trigger role_permissions_audit after insert or delete on public.role_permissions
  for each row execute function private.role_permissions_audit();

-- ── Organismes : statut réservé à l'administrateur, notifications ───────────
create or replace function private.organizations_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and not private.is_admin() then
    if new.status is distinct from old.status or new.status_reason is distinct from old.status_reason
       or new.validated_at is distinct from old.validated_at or new.validated_by is distinct from old.validated_by
       or new.is_demo is distinct from old.is_demo or new.created_by is distinct from old.created_by then
      raise exception 'Seul un administrateur peut modifier le statut d’un organisme.' using errcode = '42501';
    end if;
  end if;
  if new.status is distinct from old.status and new.status = 'active' then
    new.validated_at := now();
    new.validated_by := (select auth.uid());
  end if;
  return new;
end;
$$;
create trigger organizations_guard before update on public.organizations
  for each row execute function private.organizations_guard();

create or replace function private.organizations_after_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
  v_body text;
begin
  if tg_op = 'INSERT' then
    if new.created_by is distinct from (select auth.uid()) or private.is_admin() then
      perform private.audit('organization.created', 'organization', new.id::text, new.id, null, jsonb_build_object('status', new.status));
    end if;
    return null;
  end if;
  if new.status is distinct from old.status then
    perform private.audit('organization.status_changed', 'organization', new.id::text, new.id, null,
      jsonb_build_object('from', old.status, 'to', new.status));
    v_title := case new.status
      when 'active' then 'Votre espace organisme est activé'
      when 'suspended' then 'Votre espace organisme est suspendu'
      when 'rejected' then 'Votre demande d’espace organisme n’a pas été retenue'
      else null end;
    v_body := case new.status
      when 'active' then 'Vous pouvez maintenant consulter vos programmes et vos participants.'
      else nullif(new.status_reason, '') end;
    if v_title is not null then
      insert into public.notifications (user_id, type, title, body, link)
      select om.user_id, 'organization.status', v_title, v_body, '/organisme/dashboard'
      from public.organization_members om where om.organization_id = new.id;
    end if;
  end if;
  return null;
end;
$$;
create trigger organizations_after_write after insert or update on public.organizations
  for each row execute function private.organizations_after_write();

-- ── Participants : colonnes protégées et historique des rattachements ───────
create or replace function private.participants_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and not private.is_admin() then
    if new.user_id is distinct from old.user_id or new.is_demo is distinct from old.is_demo
       or new.invited_by is distinct from old.invited_by then
      raise exception 'Modification non autorisée de la fiche participant.' using errcode = '42501';
    end if;
    if old.user_id is not null and old.user_id = (select auth.uid()) then
      -- Le participant ne modifie que son identité et son téléphone.
      if new.organization_id is distinct from old.organization_id or new.status is distinct from old.status
         or new.email is distinct from old.email then
        raise exception 'Ces informations sont gérées par l’équipe HAPPI.' using errcode = '42501';
      end if;
    else
      -- Formateur : rattachement à un organisme ; identité seulement tant que le compte n'existe pas.
      if new.organization_id is distinct from old.organization_id then
        if not private.has_permission('participants.link_organization') then
          raise exception 'Vous n’êtes pas autorisé à modifier les rattachements.' using errcode = '42501';
        end if;
        if new.organization_id is not null and not exists (
          select 1 from public.organizations o where o.id = new.organization_id and o.status = 'active'
        ) then
          raise exception 'Cet organisme n’est pas actif.' using errcode = 'P0001';
        end if;
      end if;
      if old.user_id is not null and (
        new.first_name is distinct from old.first_name or new.last_name is distinct from old.last_name
        or new.email is distinct from old.email or new.phone is distinct from old.phone
        or new.status is distinct from old.status
      ) then
        raise exception 'L’identité d’un participant inscrit ne peut être modifiée que par lui-même ou un administrateur.' using errcode = '42501';
      end if;
    end if;
  end if;
  if new.email is not null then new.email := lower(trim(new.email)); end if;
  return new;
end;
$$;
create trigger participants_guard before update on public.participants
  for each row execute function private.participants_guard();

create or replace function private.participants_after_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_previous uuid := case when tg_op = 'UPDATE' then old.organization_id end;
  v_org_name text;
begin
  if tg_op = 'INSERT' then
    perform private.audit('participant.created', 'participant', new.id::text, new.organization_id, new.id,
      jsonb_build_object('status', new.status));
  end if;
  if (tg_op = 'INSERT' and new.organization_id is not null)
     or (tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id) then
    insert into public.participant_organization_history (participant_id, organization_id, previous_organization_id, changed_by)
    values (new.id, new.organization_id, v_previous, (select auth.uid()));
    perform private.audit('participant.organization_changed', 'participant', new.id::text, new.organization_id, new.id,
      jsonb_build_object('from', v_previous, 'to', new.organization_id));
    if new.user_id is not null and new.organization_id is not null then
      select o.name into v_org_name from public.organizations o where o.id = new.organization_id;
      perform private.notify(new.user_id, 'participant.organization', 'Votre organisme de rattachement a été mis à jour',
        'Vous êtes désormais rattaché(e) à ' || coalesce(v_org_name, 'un organisme') || '.', '/participant/profil');
    end if;
  end if;
  return null;
end;
$$;
create trigger participants_after_write after insert or update on public.participants
  for each row execute function private.participants_after_write();

create or replace function private.participants_after_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.audit('participant.deleted', 'participant', old.id::text, old.organization_id, old.id);
  return null;
end;
$$;
create trigger participants_after_delete after delete on public.participants
  for each row execute function private.participants_after_delete();

-- ── Groupes : le créateur devient formateur référent, taille maximale ───────
create or replace function private.groups_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null and exists (
    select 1 from public.profiles p where p.id = new.created_by and p.role in ('formateur', 'admin')
  ) then
    insert into public.group_trainers (group_id, trainer_id, is_lead, assigned_by)
    values (new.id, new.created_by, true, new.created_by)
    on conflict do nothing;
  end if;
  perform private.audit('group.created', 'group', new.id::text, new.organization_id, null,
    jsonb_build_object('program_id', new.program_id));
  return null;
end;
$$;
create trigger groups_after_insert after insert on public.groups
  for each row execute function private.groups_after_insert();

create or replace function private.groups_after_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform private.audit('group.deleted', 'group', old.id::text, old.organization_id);
  elsif new.organization_id is distinct from old.organization_id then
    perform private.audit('group.organization_changed', 'group', new.id::text, new.organization_id, null,
      jsonb_build_object('from', old.organization_id, 'to', new.organization_id));
  end if;
  return null;
end;
$$;
create trigger groups_after_change after update or delete on public.groups
  for each row execute function private.groups_after_change();

create or replace function private.group_members_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_max int;
  v_count int;
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    select p.max_group_size into v_max
    from public.groups g join public.programs p on p.id = g.program_id
    where g.id = new.group_id
    for update of g;
    select count(*) into v_count from public.group_members gm
    where gm.group_id = new.group_id and gm.status = 'active' and gm.id <> new.id;
    if v_count >= v_max then
      raise exception 'Ce groupe est complet : % participants au maximum pour ce programme.', v_max using errcode = 'P0001';
    end if;
    new.left_at := null;
  elsif new.status = 'removed' and new.left_at is null then
    new.left_at := now();
  end if;
  if tg_op = 'INSERT' then
    new.added_by := coalesce(new.added_by, (select auth.uid()));
  end if;
  return new;
end;
$$;
create trigger group_members_guard before insert or update on public.group_members
  for each row execute function private.group_members_guard();

create or replace function private.group_members_after_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_group public.groups%rowtype;
  v_user uuid;
begin
  if tg_op = 'DELETE' then
    perform private.audit('group.member_deleted', 'group', old.group_id::text, null, old.participant_id);
    return null;
  end if;
  select * into v_group from public.groups where id = new.group_id;
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    perform private.audit(
      case when new.status = 'active' then 'group.member_added' else 'group.member_removed' end,
      'group', new.group_id::text, v_group.organization_id, new.participant_id);
    if new.status = 'active' then
      select p.user_id into v_user from public.participants p where p.id = new.participant_id;
      perform private.notify(v_user, 'group.joined', 'Vous avez rejoint un groupe',
        'Vous faites maintenant partie du groupe « ' || v_group.name || ' ». Retrouvez vos sessions dans votre parcours.',
        '/participant/parcours');
    end if;
  end if;
  return null;
end;
$$;
create trigger group_members_after_write after insert or update or delete on public.group_members
  for each row execute function private.group_members_after_write();

create or replace function private.group_trainers_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform private.audit('group.trainer_removed', 'group', old.group_id::text, null, null, jsonb_build_object('trainer_id', old.trainer_id));
  else
    perform private.audit('group.trainer_assigned', 'group', new.group_id::text, null, null, jsonb_build_object('trainer_id', new.trainer_id));
    if new.trainer_id is distinct from (select auth.uid()) then
      perform private.notify(new.trainer_id, 'group.assigned', 'Un groupe vous a été attribué',
        (select 'Vous intervenez désormais sur le groupe « ' || g.name || ' ».' from public.groups g where g.id = new.group_id),
        '/formateur/groupes/' || new.group_id::text);
    end if;
  end if;
  return null;
end;
$$;
create trigger group_trainers_audit after insert or delete on public.group_trainers
  for each row execute function private.group_trainers_audit();

-- ── Sessions : numéro issu de la trame, horodatage des changements d'état ───
create or replace function private.sessions_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_number int;
  v_program uuid;
begin
  select ps.number, ps.program_id into v_number, v_program
  from public.program_sessions ps where ps.id = new.program_session_id;
  if not exists (select 1 from public.groups g where g.id = new.group_id and g.program_id = v_program) then
    raise exception 'Cette session n’appartient pas au programme du groupe.' using errcode = 'P0001';
  end if;
  new.number := v_number;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, (select auth.uid()));
  else
    if new.group_id is distinct from old.group_id then
      raise exception 'Une session ne peut pas changer de groupe.' using errcode = 'P0001';
    end if;
  end if;
  if new.status = 'in_progress' and new.started_at is null then new.started_at := now(); end if;
  if new.status = 'completed' and new.completed_at is null then new.completed_at := now(); end if;
  if new.status in ('planned', 'in_progress') then new.completed_at := null; end if;
  return new;
end;
$$;
create trigger sessions_guard before insert or update on public.sessions
  for each row execute function private.sessions_guard();

create or replace function private.sessions_after_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  if tg_op = 'DELETE' then
    perform private.audit('session.deleted', 'session', old.id::text);
    return null;
  end if;
  select g.organization_id into v_org from public.groups g where g.id = new.group_id;
  if tg_op = 'INSERT' then
    perform private.audit('session.created', 'session', new.id::text, v_org, null, jsonb_build_object('number', new.number));
  elsif new.status is distinct from old.status then
    perform private.audit('session.status_changed', 'session', new.id::text, v_org, null,
      jsonb_build_object('from', old.status, 'to', new.status));
  elsif new.scheduled_date is distinct from old.scheduled_date or new.start_time is distinct from old.start_time then
    perform private.audit('session.rescheduled', 'session', new.id::text, v_org, null,
      jsonb_build_object('date', new.scheduled_date));
  end if;
  return null;
end;
$$;
create trigger sessions_after_write after insert or update or delete on public.sessions
  for each row execute function private.sessions_after_write();

-- ── Présences : appartenance au groupe, horodatage, historique ──────────────
create or replace function private.attendance_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.session_id is distinct from old.session_id or new.participant_id is distinct from old.participant_id) then
    raise exception 'Une présence ne peut pas être déplacée vers une autre session ou un autre participant.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.sessions s
    join public.group_members gm on gm.group_id = s.group_id
    where s.id = new.session_id and gm.participant_id = new.participant_id
  ) then
    raise exception 'Ce participant ne fait pas partie du groupe de la session.' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' or new.status is distinct from old.status or new.comment is distinct from old.comment then
    new.recorded_by := coalesce((select auth.uid()), new.recorded_by);
    new.recorded_at := now();
  end if;
  new.comment := nullif(trim(new.comment), '');
  new.updated_at := now();
  return new;
end;
$$;
create trigger attendance_guard before insert or update on public.attendance
  for each row execute function private.attendance_guard();

create or replace function private.attendance_after_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  if tg_op = 'DELETE' then
    insert into public.attendance_history (attendance_id, session_id, participant_id, old_status, new_status, old_comment, changed_by)
    values (old.id, old.session_id, old.participant_id, old.status, null, old.comment, (select auth.uid()));
    perform private.audit('attendance.deleted', 'session', old.session_id::text, null, old.participant_id);
    return null;
  end if;
  if tg_op = 'INSERT' or new.status is distinct from old.status or new.comment is distinct from old.comment then
    insert into public.attendance_history (attendance_id, session_id, participant_id, old_status, new_status, old_comment, new_comment, changed_by)
    values (new.id, new.session_id, new.participant_id,
            case when tg_op = 'UPDATE' then old.status end, new.status,
            case when tg_op = 'UPDATE' then old.comment end, new.comment, (select auth.uid()));
    select p.organization_id into v_org from public.participants p where p.id = new.participant_id;
    perform private.audit(
      case when tg_op = 'INSERT' then 'attendance.recorded' else 'attendance.updated' end,
      'session', new.session_id::text, v_org, new.participant_id,
      jsonb_build_object('status', new.status, 'previous', case when tg_op = 'UPDATE' then old.status end));
  end if;
  return null;
end;
$$;
create trigger attendance_after_write after insert or update or delete on public.attendance
  for each row execute function private.attendance_after_write();

-- ── Référentiels : une version publiée est figée ────────────────────────────
create or replace function private.framework_versions_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_levels int;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' and exists (select 1 from public.frameworks f where f.id = old.framework_id) then
      raise exception 'Une version publiée ne peut pas être supprimée : archivez-la.' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, (select auth.uid()));
    if new.status <> 'draft' and (select auth.uid()) is not null then
      raise exception 'Une nouvelle version commence toujours en brouillon.' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if old.status = 'draft' and new.status = 'published' then
    if not exists (select 1 from public.skills s where s.version_id = new.id and s.is_active) then
      raise exception 'Ajoutez au moins une compétence active avant de publier.' using errcode = 'P0001';
    end if;
    select count(*) into v_levels from public.scale_levels l
    where l.version_id = new.id and l.value between new.scale_min and new.scale_max;
    if v_levels < (new.scale_max - new.scale_min + 1) then
      raise exception 'Chaque niveau de l’échelle (de % à %) doit avoir un libellé avant la publication.', new.scale_min, new.scale_max using errcode = 'P0001';
    end if;
    new.published_at := now();
    new.published_by := (select auth.uid());
  elsif old.status <> 'draft' then
    if new.status = 'draft' then
      raise exception 'Une version publiée ne peut pas redevenir un brouillon. Créez une nouvelle version.' using errcode = 'P0001';
    end if;
    if (new.framework_id, new.version_number, new.scale_min, new.scale_max, new.scale_step, new.scoring_mode, new.aggregation, new.rounding)
       is distinct from
       (old.framework_id, old.version_number, old.scale_min, old.scale_max, old.scale_step, old.scoring_mode, old.aggregation, old.rounding) then
      raise exception 'Cette version est publiée : son échelle et ses règles de calcul sont figées. Créez une nouvelle version.' using errcode = 'P0001';
    end if;
  elsif new.status = 'archived' then
    raise exception 'Seule une version publiée peut être archivée.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger framework_versions_guard before insert or update or delete on public.framework_versions
  for each row execute function private.framework_versions_guard();

create or replace function private.framework_versions_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    perform private.audit('framework.version_' || new.status, 'framework_version', new.id::text, null, null,
      jsonb_build_object('framework_id', new.framework_id, 'version', new.version_number));
  end if;
  return null;
end;
$$;
create trigger framework_versions_audit after update on public.framework_versions
  for each row execute function private.framework_versions_audit();

-- Contenu d'une version (niveaux, catégories, compétences, critères, correspondances).
create or replace function private.framework_content_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_version_id uuid;
  v_skill_id uuid;
  v_status text;
begin
  if tg_table_name in ('skill_level_descriptors', 'skill_criteria') then
    v_skill_id := case when tg_op = 'DELETE' then old.skill_id else new.skill_id end;
    select s.version_id into v_version_id from public.skills s where s.id = v_skill_id;
  else
    v_version_id := case when tg_op = 'DELETE' then old.version_id else new.version_id end;
  end if;
  select v.status into v_status from public.framework_versions v where v.id = v_version_id;
  -- Ligne parente déjà supprimée : il s'agit de la cascade d'un brouillon, on laisse passer.
  if v_status is null and tg_op = 'DELETE' then return old; end if;
  if v_status is distinct from 'draft' then
    raise exception 'Cette version du référentiel est publiée : elle ne peut plus être modifiée. Créez une nouvelle version.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and tg_table_name not in ('skill_level_descriptors', 'skill_criteria')
     and new.version_id is distinct from old.version_id then
    raise exception 'Un élément ne peut pas changer de version.' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger scale_levels_guard before insert or update or delete on public.scale_levels
  for each row execute function private.framework_content_guard();
create trigger skill_categories_guard before insert or update or delete on public.skill_categories
  for each row execute function private.framework_content_guard();
create trigger skills_guard before insert or update or delete on public.skills
  for each row execute function private.framework_content_guard();
create trigger skill_level_descriptors_guard before insert or update or delete on public.skill_level_descriptors
  for each row execute function private.framework_content_guard();
create trigger skill_criteria_guard before insert or update or delete on public.skill_criteria
  for each row execute function private.framework_content_guard();
create trigger session_skill_map_guard before insert or update or delete on public.session_skill_map
  for each row execute function private.framework_content_guard();

-- Un programme n'active que des versions publiées du bon référentiel.
create or replace function private.program_frameworks_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.framework_versions v
    where v.id = new.framework_version_id and v.framework_id = new.framework_id and v.status = 'published'
  ) then
    raise exception 'Seule une version publiée de ce référentiel peut être activée pour un programme.' using errcode = 'P0001';
  end if;
  new.activated_by := coalesce((select auth.uid()), new.activated_by);
  new.activated_at := now();
  return new;
end;
$$;
create trigger program_frameworks_guard before insert or update on public.program_frameworks
  for each row execute function private.program_frameworks_guard();

create or replace function private.program_frameworks_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.audit('program.framework_activated', 'program', new.program_id::text, null, null,
    jsonb_build_object('framework_version_id', new.framework_version_id));
  return null;
end;
$$;
create trigger program_frameworks_audit after insert or update on public.program_frameworks
  for each row execute function private.program_frameworks_audit();

-- ── Questionnaires : même logique de versions figées ────────────────────────
create or replace function private.questionnaire_versions_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' and exists (select 1 from public.questionnaires q where q.id = old.questionnaire_id) then
      raise exception 'Un questionnaire publié ne peut pas être supprimé : archivez-le.' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, (select auth.uid()));
    if new.status <> 'draft' and (select auth.uid()) is not null then
      raise exception 'Une nouvelle version commence toujours en brouillon.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if old.status = 'draft' and new.status = 'published' then
    if not exists (select 1 from public.questionnaire_questions q where q.version_id = new.id and q.is_active) then
      raise exception 'Ajoutez au moins une question avant de publier.' using errcode = 'P0001';
    end if;
    -- La version précédemment publiée est archivée : une seule version est proposée à la fois.
    update public.questionnaire_versions set status = 'archived'
     where questionnaire_id = new.questionnaire_id and status = 'published' and id <> new.id;
    new.published_at := now();
  elsif old.status <> 'draft' then
    if new.status = 'draft' then
      raise exception 'Un questionnaire publié ne peut pas redevenir un brouillon.' using errcode = 'P0001';
    end if;
    if (new.scale_min, new.scale_max, new.questionnaire_id, new.version_number)
       is distinct from (old.scale_min, old.scale_max, old.questionnaire_id, old.version_number) then
      raise exception 'Ce questionnaire est publié : son échelle est figée.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger questionnaire_versions_guard before insert or update or delete on public.questionnaire_versions
  for each row execute function private.questionnaire_versions_guard();

create or replace function private.questionnaire_content_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_version_id uuid := case when tg_op = 'DELETE' then old.version_id else new.version_id end;
  v_status text;
begin
  select v.status into v_status from public.questionnaire_versions v where v.id = v_version_id;
  if v_status is null and tg_op = 'DELETE' then return old; end if;
  if v_status is distinct from 'draft' then
    raise exception 'Ce questionnaire est publié : il ne peut plus être modifié. Créez une nouvelle version.' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger questionnaire_questions_guard before insert or update or delete on public.questionnaire_questions
  for each row execute function private.questionnaire_content_guard();
create trigger questionnaire_scale_labels_guard before insert or update or delete on public.questionnaire_scale_labels
  for each row execute function private.questionnaire_content_guard();

-- ── Auto-évaluations : figées une fois terminées ────────────────────────────
create or replace function private.self_assessments_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_missing int;
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.questionnaire_versions v where v.id = new.questionnaire_version_id and v.status = 'published')
       and (select auth.uid()) is not null and not private.is_admin() then
      raise exception 'Ce questionnaire n’est pas ouvert.' using errcode = 'P0001';
    end if;
    new.status := 'in_progress';
    new.completed_at := null;
    return new;
  end if;
  if old.status = 'completed' then
    raise exception 'Une auto-évaluation terminée ne peut plus être modifiée : elle sert de référence.' using errcode = 'P0001';
  end if;
  if (new.participant_id, new.questionnaire_version_id, new.kind) is distinct from (old.participant_id, old.questionnaire_version_id, old.kind) then
    raise exception 'Modification non autorisée de l’auto-évaluation.' using errcode = 'P0001';
  end if;
  if new.status = 'completed' then
    select count(*) into v_missing from public.questionnaire_questions q
    where q.version_id = new.questionnaire_version_id and q.is_active
      and not exists (select 1 from public.self_assessment_answers a where a.self_assessment_id = new.id and a.question_id = q.id);
    if v_missing > 0 then
      raise exception 'Il reste % question(s) sans réponse.', v_missing using errcode = 'P0001';
    end if;
    new.completed_at := now();
  end if;
  return new;
end;
$$;
create trigger self_assessments_guard before insert or update on public.self_assessments
  for each row execute function private.self_assessments_guard();

create or replace function private.self_assessments_after_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  if new.status = 'completed' and old.status <> 'completed' then
    select p.organization_id into v_org from public.participants p where p.id = new.participant_id;
    perform private.audit('self_assessment.completed', 'self_assessment', new.id::text, v_org, new.participant_id);
  end if;
  return null;
end;
$$;
create trigger self_assessments_after_update after update on public.self_assessments
  for each row execute function private.self_assessments_after_update();

create or replace function private.self_assessment_answers_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_assessment_id uuid := case when tg_op = 'DELETE' then old.self_assessment_id else new.self_assessment_id end;
  v_status text;
  v_version uuid;
  v_min int;
  v_max int;
begin
  select sa.status, sa.questionnaire_version_id into v_status, v_version
  from public.self_assessments sa where sa.id = v_assessment_id;
  if v_status is null and tg_op = 'DELETE' then return old; end if;
  if v_status is distinct from 'in_progress' then
    raise exception 'Cette auto-évaluation est terminée : ses réponses sont figées.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if not exists (select 1 from public.questionnaire_questions q where q.id = new.question_id and q.version_id = v_version) then
    raise exception 'Cette question n’appartient pas au questionnaire.' using errcode = 'P0001';
  end if;
  select v.scale_min, v.scale_max into v_min, v_max from public.questionnaire_versions v where v.id = v_version;
  if new.value < v_min or new.value > v_max then
    raise exception 'La réponse doit être comprise entre % et %.', v_min, v_max using errcode = 'P0001';
  end if;
  new.answered_at := now();
  return new;
end;
$$;
create trigger self_assessment_answers_guard before insert or update or delete on public.self_assessment_answers
  for each row execute function private.self_assessment_answers_guard();

-- ── Évaluations : intégrité, référentiels figés à la création, historique ───
create or replace function private.evaluations_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.sessions s
      join public.group_members gm on gm.group_id = s.group_id
      where s.id = new.session_id and gm.participant_id = new.participant_id
    ) then
      raise exception 'Ce participant ne fait pas partie du groupe de la session.' using errcode = 'P0001';
    end if;
    new.evaluator_id := coalesce(new.evaluator_id, (select auth.uid()));
    return new;
  end if;
  if (new.session_id, new.participant_id) is distinct from (old.session_id, old.participant_id) then
    raise exception 'Une évaluation ne peut pas être déplacée.' using errcode = 'P0001';
  end if;
  if old.status = 'validated' and new.status <> 'validated' then
    raise exception 'Une évaluation validée ne peut pas redevenir un brouillon.' using errcode = 'P0001';
  end if;
  if old.status = 'validated' and new.framework_snapshot is distinct from old.framework_snapshot then
    raise exception 'La photographie du référentiel d’une évaluation validée est figée.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger evaluations_guard before insert or update on public.evaluations
  for each row execute function private.evaluations_guard();

create or replace function private.evaluations_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.evaluation_frameworks (evaluation_id, framework_version_id)
  select new.id, pf.framework_version_id
  from public.sessions s
  join public.groups g on g.id = s.group_id
  join public.program_frameworks pf on pf.program_id = g.program_id
  where s.id = new.session_id
  on conflict do nothing;
  return null;
end;
$$;
create trigger evaluations_after_insert after insert on public.evaluations
  for each row execute function private.evaluations_after_insert();

create or replace function private.evaluation_scores_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_version public.framework_versions%rowtype;
begin
  select fv.* into v_version
  from public.skills s join public.framework_versions fv on fv.id = s.version_id
  where s.id = new.skill_id;
  if not exists (
    select 1 from public.evaluation_frameworks ef
    where ef.evaluation_id = new.evaluation_id and ef.framework_version_id = v_version.id
  ) then
    raise exception 'Cette compétence n’appartient pas à un référentiel associé à l’évaluation.' using errcode = 'P0001';
  end if;
  if new.score is not null then
    if new.score < v_version.scale_min or new.score > v_version.scale_max then
      raise exception 'La note doit être comprise entre % et %.', v_version.scale_min, v_version.scale_max using errcode = 'P0001';
    end if;
    if new.score_source = 'direct' and mod(new.score - v_version.scale_min, v_version.scale_step) <> 0 then
      raise exception 'La note doit respecter le pas de l’échelle (%).', v_version.scale_step using errcode = 'P0001';
    end if;
  end if;
  new.comment := nullif(trim(new.comment), '');
  new.updated_at := now();
  return new;
end;
$$;
create trigger evaluation_scores_guard before insert or update on public.evaluation_scores
  for each row execute function private.evaluation_scores_guard();

create or replace function private.evaluation_criterion_scores_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_version public.framework_versions%rowtype;
begin
  select fv.* into v_version
  from public.skill_criteria c
  join public.skills s on s.id = c.skill_id
  join public.framework_versions fv on fv.id = s.version_id
  where c.id = new.criterion_id;
  if not exists (
    select 1 from public.evaluation_frameworks ef
    where ef.evaluation_id = new.evaluation_id and ef.framework_version_id = v_version.id
  ) then
    raise exception 'Ce critère n’appartient pas à un référentiel associé à l’évaluation.' using errcode = 'P0001';
  end if;
  if new.score is not null and (new.score < v_version.scale_min or new.score > v_version.scale_max) then
    raise exception 'La note du critère doit être comprise entre % et %.', v_version.scale_min, v_version.scale_max using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger evaluation_criterion_scores_guard before insert or update on public.evaluation_criterion_scores
  for each row execute function private.evaluation_criterion_scores_guard();

-- Toute écriture sur une évaluation validée est tracée (ancienne et nouvelle valeur).
create or replace function private.track_evaluation_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_evaluation_id uuid := case when tg_op = 'DELETE' then old.evaluation_id else new.evaluation_id end;
  v_status text;
  v_reason text := nullif(current_setting('app.change_reason', true), '');
  v_actor uuid := (select auth.uid());
begin
  select e.status into v_status from public.evaluations e where e.id = v_evaluation_id;
  if v_status is distinct from 'validated' then return null; end if;

  if tg_table_name = 'evaluation_scores' then
    if tg_op = 'INSERT' then
      insert into public.evaluation_history (evaluation_id, change_type, skill_id, old_value, new_value, reason, changed_by)
      values (v_evaluation_id, 'score', new.skill_id, null, new.score::text, v_reason, v_actor);
      if new.comment is not null then
        insert into public.evaluation_history (evaluation_id, change_type, skill_id, old_value, new_value, reason, changed_by)
        values (v_evaluation_id, 'score_comment', new.skill_id, null, new.comment, v_reason, v_actor);
      end if;
    elsif tg_op = 'UPDATE' then
      if new.score is distinct from old.score then
        insert into public.evaluation_history (evaluation_id, change_type, skill_id, old_value, new_value, reason, changed_by)
        values (v_evaluation_id, 'score', new.skill_id, old.score::text, new.score::text, v_reason, v_actor);
      end if;
      if new.comment is distinct from old.comment then
        insert into public.evaluation_history (evaluation_id, change_type, skill_id, old_value, new_value, reason, changed_by)
        values (v_evaluation_id, 'score_comment', new.skill_id, old.comment, new.comment, v_reason, v_actor);
      end if;
    else
      insert into public.evaluation_history (evaluation_id, change_type, skill_id, old_value, new_value, reason, changed_by)
      values (v_evaluation_id, 'score', old.skill_id, old.score::text, null, v_reason, v_actor);
    end if;
  elsif tg_table_name = 'evaluation_criterion_scores' then
    if tg_op = 'DELETE' then
      insert into public.evaluation_history (evaluation_id, change_type, criterion_id, old_value, new_value, reason, changed_by)
      values (v_evaluation_id, 'criterion', old.criterion_id,
              coalesce(old.score::text, old.observed::text), null, v_reason, v_actor);
    elsif tg_op = 'INSERT' or new.observed is distinct from old.observed or new.score is distinct from old.score then
      insert into public.evaluation_history (evaluation_id, change_type, criterion_id, old_value, new_value, reason, changed_by)
      values (v_evaluation_id, 'criterion', new.criterion_id,
              case when tg_op = 'UPDATE' then coalesce(old.score::text, old.observed::text) end,
              coalesce(new.score::text, new.observed::text), v_reason, v_actor);
    end if;
  else
    if tg_op = 'DELETE' then
      insert into public.evaluation_history (evaluation_id, change_type, comment_kind, old_value, new_value, reason, changed_by)
      values (v_evaluation_id, 'comment', old.kind, old.body, null, v_reason, v_actor);
    elsif tg_op = 'INSERT' or new.body is distinct from old.body then
      insert into public.evaluation_history (evaluation_id, change_type, comment_kind, old_value, new_value, reason, changed_by)
      values (v_evaluation_id, 'comment', new.kind, case when tg_op = 'UPDATE' then old.body end, new.body, v_reason, v_actor);
    end if;
  end if;
  return null;
end;
$$;
create trigger evaluation_scores_track after insert or update or delete on public.evaluation_scores
  for each row execute function private.track_evaluation_changes();
create trigger evaluation_criterion_scores_track after insert or update or delete on public.evaluation_criterion_scores
  for each row execute function private.track_evaluation_changes();
create trigger evaluation_comments_track after insert or update or delete on public.evaluation_comments
  for each row execute function private.track_evaluation_changes();

create or replace function private.evaluations_after_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.audit('evaluation.deleted', 'evaluation', old.id::text, null, old.participant_id,
    jsonb_build_object('status', old.status, 'session_id', old.session_id));
  return null;
end;
$$;
create trigger evaluations_after_delete after delete on public.evaluations
  for each row execute function private.evaluations_after_delete();

-- ── Supports pédagogiques : une version importée ne se réécrit pas ──────────
create or replace function private.pedagogical_versions_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.content_id, new.version_number, new.markdown) is distinct from (old.content_id, old.version_number, old.markdown) then
    raise exception 'Une version de support ne se modifie pas : importez une nouvelle version.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger pedagogical_versions_guard before update on public.pedagogical_content_versions
  for each row execute function private.pedagogical_versions_guard();

-- ── Demandes RGPD et paramètres : traçabilité ───────────────────────────────
create or replace function private.data_requests_after_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.audit('data_request.created', 'data_request', new.id::text, null, null, jsonb_build_object('type', new.type));
    if new.type = 'deletion' then
      perform private.notify_admins('data_request.deletion', 'Demande de suppression de données',
        'Un utilisateur demande la suppression de ses données personnelles.', '/admin/parametres');
    end if;
  elsif new.status is distinct from old.status then
    perform private.audit('data_request.' || new.status, 'data_request', new.id::text, null, null, jsonb_build_object('type', new.type));
    perform private.notify(new.user_id, 'data_request.status', 'Votre demande concernant vos données a été traitée',
      nullif(new.resolution_note, ''), '/compte');
  end if;
  return null;
end;
$$;
create trigger data_requests_after_write after insert or update on public.data_requests
  for each row execute function private.data_requests_after_write();

create or replace function private.app_settings_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  new.updated_at := now();
  perform private.audit('settings.updated', 'app_setting', new.key);
  return new;
end;
$$;
create trigger app_settings_guard before insert or update on public.app_settings
  for each row execute function private.app_settings_guard();
