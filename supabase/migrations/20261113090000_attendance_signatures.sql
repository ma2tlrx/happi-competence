-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — émargement électronique et contre-signature du formateur
--
-- Une signature par participant et par séance, déposée soit sur la tablette du
-- formateur, soit par le participant depuis son compte, le jour de la séance (ou
-- pendant qu'elle est en cours). La base fixe elle-même l'horodatage, l'auteur,
-- le mode et l'empreinte SHA-256 ; une signature ne se modifie jamais.
--
-- Le formateur contre-signe ensuite la feuille : elle est alors figée (plus de
-- nouvelle signature, plus de changement de présence ni d'horaires), sauf
-- correction tracée par un administrateur (public.correct_attendance).
--
-- Format des signatures : tracé vectoriel « M x y L x y … » en coordonnées
-- entières dans un cadre de 600 × 200 (voir src/lib/attendance/signature.ts).
-- Valeur probante : à valider avec chaque financeur.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Fonctions d'aide ────────────────────────────────────────────────────────
-- Tracé de signature valide : syntaxe stricte, taille bornée, coordonnées dans le cadre.
create or replace function private.valid_signature_path(p_path text)
returns boolean language sql immutable set search_path = '' as $$
  select p_path is not null
     and char_length(p_path) between 20 and 24000
     and p_path ~ '^M[0-9]{1,3} [0-9]{1,3}( [ML][0-9]{1,3} [0-9]{1,3})*$'
     and (select count(*) from regexp_matches(p_path, '[ML]', 'g')) >= 5
     and not exists (
       select 1 from regexp_matches(p_path, '[ML]([0-9]+) ([0-9]+)', 'g') as m
       where m[1]::int > 600 or m[2]::int > 200
     );
$$;

-- Empreinte d'une signature : liée à la séance, au participant et à l'instant de signature.
-- Formule reproduite côté application (src/lib/attendance/fingerprint.ts) pour la vérification.
create or replace function private.signature_sha256(
  p_session_id uuid, p_participant_id uuid, p_signed_at timestamptz, p_kind text, p_content text
) returns text language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(concat_ws('|',
    'happi-emargement-v1', p_session_id::text, coalesce(p_participant_id::text, 'formateur'),
    to_char(p_signed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), p_kind, p_content), 'UTF8')), 'hex');
$$;

create or replace function private.paris_today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Paris')::date;
$$;

-- ── Contre-signatures (une par séance) ──────────────────────────────────────
create table public.attendance_countersignatures (
  session_id        uuid primary key references public.sessions (id) on delete cascade,
  trainer_id        uuid references public.profiles (id) on delete set null,
  -- Nom figé au moment de la contre-signature : la preuve reste lisible si le compte disparaît.
  trainer_name      text not null check (char_length(trainer_name) between 1 and 170),
  signature_svg     text not null check (private.valid_signature_path(signature_svg)),
  content_sha256    text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  -- Liste attestée : statut de présence et signature de chaque participant à l'instant T.
  attested          jsonb not null default '[]'::jsonb check (jsonb_typeof(attested) = 'array'),
  -- Empreinte de l'ensemble des signatures attestées (participant:empreinte, triés).
  signatures_sha256 text not null check (signatures_sha256 ~ '^[0-9a-f]{64}$'),
  signed_at         timestamptz not null default now(),
  ip_hmac           text check (ip_hmac is null or ip_hmac ~ '^[0-9a-f]{64}$'),
  user_agent        text check (user_agent is null or char_length(user_agent) <= 200)
);
comment on table public.attendance_countersignatures is 'Contre-signature de la feuille d''émargement par le formateur : la feuille est ensuite figée.';

create or replace function private.attendance_sheet_frozen(p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.attendance_countersignatures c where c.session_id = p_session_id);
$$;

-- Fenêtre d'émargement : le jour de la séance (heure de Paris) ou pendant qu'elle est en cours.
create or replace function private.signature_window_open(p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sessions s
    where s.id = p_session_id and s.status <> 'cancelled'
      and (s.status = 'in_progress' or s.scheduled_date = private.paris_today())
  );
$$;

-- ── Signatures des participants ─────────────────────────────────────────────
create table public.attendance_signatures (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.sessions (id) on delete cascade,
  participant_id    uuid not null references public.participants (id) on delete cascade,
  -- trainer_device : tablette du formateur ; own_account : depuis le compte du participant.
  method            text not null check (method in ('trainer_device', 'own_account')),
  -- drawn : signature tracée ; unable : signature impossible, motif saisi par le formateur.
  kind              text not null check (kind in ('drawn', 'unable')),
  signature_svg     text check (signature_svg is null or private.valid_signature_path(signature_svg)),
  unable_reason     text check (unable_reason is null or char_length(unable_reason) between 3 and 300),
  -- Statut de présence au moment de la signature.
  attendance_status text not null check (attendance_status in ('present', 'late', 'left_early')),
  content_sha256    text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  signed_at         timestamptz not null default now(),
  collected_by      uuid references public.profiles (id) on delete set null,
  ip_hmac           text check (ip_hmac is null or ip_hmac ~ '^[0-9a-f]{64}$'),
  user_agent        text check (user_agent is null or char_length(user_agent) <= 200),
  unique (session_id, participant_id),
  check ((kind = 'drawn' and signature_svg is not null and unable_reason is null)
      or (kind = 'unable' and signature_svg is null and unable_reason is not null)),
  check (kind = 'drawn' or method = 'trainer_device')
);
comment on table public.attendance_signatures is 'Émargement : une signature immuable par participant et par séance.';
comment on column public.attendance_signatures.ip_hmac is 'Empreinte HMAC de l''adresse IP (clé serveur) : l''adresse elle-même n''est jamais conservée.';
create index attendance_signatures_participant_idx on public.attendance_signatures (participant_id);

-- Droit de signer : participant actif pour lui-même (signature tracée uniquement),
-- formateur du groupe ou administrateur pour un participant présent. Feuille non figée,
-- fenêtre d'émargement ouverte, participant membre actif du groupe et noté présent.
create or replace function private.can_sign_attendance(p_session_id uuid, p_participant_id uuid, p_kind text)
returns boolean language sql stable security definer set search_path = '' as $$
  select not private.attendance_sheet_frozen(p_session_id)
     and private.signature_window_open(p_session_id)
     and exists (
       select 1 from public.sessions s
       join public.group_members gm on gm.group_id = s.group_id and gm.participant_id = p_participant_id and gm.status = 'active'
       join public.attendance a on a.session_id = s.id and a.participant_id = p_participant_id
       where s.id = p_session_id and a.status in ('present', 'late', 'left_early')
     )
     and (
       (private.current_role_code() = 'participant' and p_participant_id = private.my_participant_id() and p_kind = 'drawn')
       or (private.has_permission('attendance.write')
           and (private.is_admin() or private.trains_group(private.session_group_id(p_session_id))))
     );
$$;

-- Intégrité : valeurs fixées par la base, immuabilité, suppression par cascade ou administrateur.
create or replace function private.attendance_signatures_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 or current_setting('app.erasure', true) = 'on' or private.is_admin() then
      return old;
    end if;
    raise exception 'Une signature d''émargement ne peut pas être supprimée.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    -- Seule la mise à nul de l'auteur, par cascade lors de la suppression d'un compte, est tolérée.
    if pg_trigger_depth() > 1 and new.collected_by is null
       and (to_jsonb(new) - 'collected_by') = (to_jsonb(old) - 'collected_by') then
      return new;
    end if;
    raise exception 'Une signature d''émargement ne se modifie pas.' using errcode = '42501';
  end if;

  if private.attendance_sheet_frozen(new.session_id) then
    raise exception 'Cette feuille d''émargement est contre-signée : aucune nouvelle signature n''est possible.' using errcode = 'P0001';
  end if;
  select a.status into v_status from public.attendance a
  where a.session_id = new.session_id and a.participant_id = new.participant_id;
  if v_status is null or v_status not in ('present', 'late', 'left_early') then
    raise exception 'Seul un participant noté présent, en retard ou parti plus tôt peut signer.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.sessions s
    join public.group_members gm on gm.group_id = s.group_id
    where s.id = new.session_id and gm.participant_id = new.participant_id and gm.status = 'active'
  ) then
    raise exception 'Ce participant ne fait pas partie du groupe de la séance.' using errcode = 'P0001';
  end if;

  new.id := gen_random_uuid();
  new.attendance_status := v_status;
  new.signed_at := date_trunc('milliseconds', now());
  new.collected_by := (select auth.uid());
  new.method := case when new.participant_id = private.my_participant_id() then 'own_account' else 'trainer_device' end;
  new.unable_reason := nullif(trim(new.unable_reason), '');
  new.user_agent := left(new.user_agent, 200);
  if new.kind = 'unable' and new.method <> 'trainer_device' then
    raise exception 'La mention « signature impossible » est saisie par le formateur.' using errcode = 'P0001';
  end if;
  new.content_sha256 := private.signature_sha256(new.session_id, new.participant_id, new.signed_at, new.kind,
    case when new.kind = 'drawn' then new.signature_svg else new.unable_reason end);
  return new;
end;
$$;
create trigger attendance_signatures_guard before insert or update or delete on public.attendance_signatures
  for each row execute function private.attendance_signatures_guard();

create or replace function private.attendance_signatures_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then return null; end if;
    perform private.audit('attendance.signature_deleted', 'session', old.session_id::text, null, old.participant_id,
      jsonb_build_object('signature_id', old.id));
    return null;
  end if;
  select p.organization_id into v_org from public.participants p where p.id = new.participant_id;
  perform private.audit('attendance.signed', 'session', new.session_id::text, v_org, new.participant_id,
    jsonb_build_object('method', new.method, 'kind', new.kind, 'sha256', new.content_sha256));
  return null;
end;
$$;
create trigger attendance_signatures_audit after insert or delete on public.attendance_signatures
  for each row execute function private.attendance_signatures_audit();

-- ── Contre-signature : contrôle, figement de la liste attestée ──────────────
create or replace function private.attendance_countersignatures_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_session public.sessions%rowtype;
  v_missing int;
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 or current_setting('app.erasure', true) = 'on' or private.is_admin() then
      return old;
    end if;
    raise exception 'Une contre-signature ne peut être retirée que par un administrateur.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if pg_trigger_depth() > 1 and new.trainer_id is null
       and (to_jsonb(new) - 'trainer_id') = (to_jsonb(old) - 'trainer_id') then
      return new;
    end if;
    raise exception 'Une contre-signature ne se modifie pas.' using errcode = '42501';
  end if;

  select * into v_session from public.sessions where id = new.session_id;
  if v_session.status = 'cancelled' then
    raise exception 'Une séance annulée ne se contre-signe pas.' using errcode = 'P0001';
  end if;
  if v_session.scheduled_date is not null and v_session.scheduled_date > private.paris_today() then
    raise exception 'La feuille ne peut être contre-signée qu''à partir du jour de la séance.' using errcode = 'P0001';
  end if;
  select count(*) into v_missing
  from public.group_members gm
  where gm.group_id = v_session.group_id and gm.status = 'active'
    and not exists (select 1 from public.attendance a where a.session_id = new.session_id and a.participant_id = gm.participant_id);
  if v_missing > 0 then
    raise exception 'Renseignez la présence de tous les participants avant de contre-signer (% restant(s)).', v_missing using errcode = 'P0001';
  end if;

  new.trainer_id := (select auth.uid());
  new.trainer_name := coalesce(
    (select nullif(trim(p.first_name || ' ' || p.last_name), '') from public.profiles p where p.id = new.trainer_id),
    'Équipe HAPPI');
  new.signed_at := date_trunc('milliseconds', now());
  new.user_agent := left(new.user_agent, 200);
  new.attested := coalesce((
    select jsonb_agg(jsonb_build_object(
      'participant_id', a.participant_id, 'status', a.status, 'signature_sha256', sig.content_sha256) order by a.participant_id)
    from public.attendance a
    left join public.attendance_signatures sig on sig.session_id = a.session_id and sig.participant_id = a.participant_id
    where a.session_id = new.session_id
  ), '[]'::jsonb);
  new.signatures_sha256 := encode(sha256(convert_to(coalesce((
    select string_agg(sig.participant_id::text || ':' || sig.content_sha256, ',' order by sig.participant_id)
    from public.attendance_signatures sig where sig.session_id = new.session_id
  ), ''), 'UTF8')), 'hex');
  new.content_sha256 := private.signature_sha256(new.session_id, null, new.signed_at, 'countersign',
    new.signature_svg || '|' || new.signatures_sha256);
  return new;
end;
$$;
create trigger attendance_countersignatures_guard before insert or update or delete on public.attendance_countersignatures
  for each row execute function private.attendance_countersignatures_guard();

create or replace function private.attendance_countersignatures_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_session uuid := coalesce(new.session_id, old.session_id);
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return null; end if;
  select g.organization_id into v_org from public.sessions s join public.groups g on g.id = s.group_id where s.id = v_session;
  if tg_op = 'INSERT' then
    perform private.audit('attendance.countersigned', 'session', v_session::text, v_org, null,
      jsonb_build_object('participants', jsonb_array_length(new.attested), 'sha256', new.content_sha256));
  else
    perform private.audit('attendance.countersignature_removed', 'session', v_session::text, v_org, null, '{}'::jsonb);
  end if;
  return null;
end;
$$;
create trigger attendance_countersignatures_audit after insert or delete on public.attendance_countersignatures
  for each row execute function private.attendance_countersignatures_audit();

-- ── Feuille figée : présences et horaires verrouillés ───────────────────────
-- Exceptions : suppressions en cascade (participant ou séance effacés), effacement RGPD,
-- correction tracée par un administrateur via public.correct_attendance.
create or replace function private.attendance_freeze_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_session uuid := case when tg_op = 'DELETE' then old.session_id else new.session_id end;
  v_participant uuid := case when tg_op = 'DELETE' then old.participant_id else new.participant_id end;
  v_status text := case when tg_op = 'DELETE' then null else new.status end;
  v_bypass boolean := pg_trigger_depth() > 1 or current_setting('app.erasure', true) = 'on'
    or (current_setting('app.attendance_correction', true) = 'on' and private.is_admin());
begin
  if v_bypass then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status and new.comment is distinct from old.comment
     and not private.attendance_sheet_frozen(v_session) then
    return new;
  end if;
  if private.attendance_sheet_frozen(v_session) then
    raise exception 'La feuille d''émargement de cette séance est contre-signée : la présence ne peut plus être modifiée (correction par un administrateur).'
      using errcode = 'P0001';
  end if;
  if (v_status is null or v_status not in ('present', 'late', 'left_early'))
     and exists (select 1 from public.attendance_signatures sig where sig.session_id = v_session and sig.participant_id = v_participant) then
    raise exception 'Ce participant a signé la feuille d''émargement : il ne peut pas être noté absent (correction par un administrateur).'
      using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger attendance_freeze_guard before insert or update or delete on public.attendance
  for each row execute function private.attendance_freeze_guard();

create or replace function private.sessions_freeze_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.attendance_sheet_frozen(new.id)
     and not (current_setting('app.attendance_correction', true) = 'on' and private.is_admin())
     and ((new.scheduled_date, new.start_time, new.end_time, new.location) is distinct from (old.scheduled_date, old.start_time, old.end_time, old.location)
          or new.status = 'cancelled') then
    raise exception 'La feuille d''émargement de cette séance est contre-signée : la date, les horaires et le lieu sont figés.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger sessions_freeze_guard before update on public.sessions
  for each row execute function private.sessions_freeze_guard();

-- Correction tracée d'une présence sur une feuille figée (administrateur uniquement).
create or replace function public.correct_attendance(p_session_id uuid, p_participant_id uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_previous text;
  v_org uuid;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not private.is_admin() then
    raise exception 'Seul un administrateur peut corriger une feuille d''émargement figée.' using errcode = '42501';
  end if;
  if p_status not in ('present', 'absent', 'late', 'left_early', 'excused') then
    raise exception 'Statut de présence invalide.' using errcode = '22023';
  end if;
  if v_reason is null or char_length(v_reason) not between 10 and 500 then
    raise exception 'Indiquez le motif de la correction (10 à 500 caractères).' using errcode = '22023';
  end if;
  select a.status into v_previous from public.attendance a where a.session_id = p_session_id and a.participant_id = p_participant_id;
  perform set_config('app.attendance_correction', 'on', true);
  insert into public.attendance (session_id, participant_id, status)
  values (p_session_id, p_participant_id, p_status)
  on conflict (session_id, participant_id) do update set status = excluded.status;
  perform set_config('app.attendance_correction', '', true);
  select p.organization_id into v_org from public.participants p where p.id = p_participant_id;
  perform private.audit('attendance.corrected', 'session', p_session_id::text, v_org, p_participant_id,
    jsonb_build_object('from', v_previous, 'to', p_status, 'reason', left(v_reason, 500),
      'frozen', private.attendance_sheet_frozen(p_session_id)));
end;
$$;

-- Séances du jour que le participant connecté peut (ou a pu) émarger.
create or replace function public.my_attendance_signing()
returns table (
  session_id uuid, session_number int, title text, group_name text, scheduled_date date, start_time time, end_time time,
  session_status text, attendance_status text, signed_at timestamptz, frozen boolean, can_sign boolean
) language sql stable security definer set search_path = '' as $$
  select s.id, s.number, ps.title, g.name, s.scheduled_date, s.start_time, s.end_time, s.status, a.status, sig.signed_at,
         private.attendance_sheet_frozen(s.id),
         sig.id is null and private.can_sign_attendance(s.id, p.id, 'drawn')
  from public.participants p
  join public.group_members gm on gm.participant_id = p.id and gm.status = 'active'
  join public.sessions s on s.group_id = gm.group_id
  join public.groups g on g.id = s.group_id
  join public.program_sessions ps on ps.id = s.program_session_id
  left join public.attendance a on a.session_id = s.id and a.participant_id = p.id
  left join public.attendance_signatures sig on sig.session_id = s.id and sig.participant_id = p.id
  where p.user_id = (select auth.uid()) and private.current_role_code() = 'participant'
    and s.status <> 'cancelled' and (s.status = 'in_progress' or s.scheduled_date = private.paris_today())
  order by s.start_time nulls last, s.number;
$$;

-- ── Droits ──────────────────────────────────────────────────────────────────
alter table public.attendance_signatures enable row level security;
alter table public.attendance_signatures force row level security;
alter table public.attendance_countersignatures enable row level security;
alter table public.attendance_countersignatures force row level security;

create policy attendance_signatures_select on public.attendance_signatures for select to authenticated using (
  (select private.is_admin())
  or private.trains_group(private.session_group_id(session_id))
  or participant_id = (select private.my_participant_id())
  or ((select private.has_permission('org.attendance.read')) and private.org_sees_participant(participant_id))
);
create policy attendance_signatures_insert on public.attendance_signatures for insert to authenticated
  with check (private.can_sign_attendance(session_id, participant_id, kind));
create policy attendance_signatures_delete on public.attendance_signatures for delete to authenticated
  using ((select private.is_admin()));

create policy attendance_countersignatures_select on public.attendance_countersignatures for select to authenticated using (
  (select private.is_admin())
  or private.trains_group(private.session_group_id(session_id))
  or ((select private.has_permission('org.attendance.read')) and private.org_sees_group(private.session_group_id(session_id)))
);
create policy attendance_countersignatures_insert on public.attendance_countersignatures for insert to authenticated with check (
  (select private.has_permission('attendance.write'))
  and ((select private.is_admin()) or private.trains_group(private.session_group_id(session_id)))
);
create policy attendance_countersignatures_delete on public.attendance_countersignatures for delete to authenticated
  using ((select private.is_admin()));

-- Colonnes : l'empreinte d'IP et le navigateur restent réservés au serveur (clé de service) ;
-- à l'insertion, seules les données saisies sont acceptées, le reste est fixé par la base.
revoke all on public.attendance_signatures, public.attendance_countersignatures from anon, authenticated;
grant select (id, session_id, participant_id, method, kind, signature_svg, unable_reason, attendance_status, content_sha256, signed_at, collected_by)
  on public.attendance_signatures to authenticated;
grant insert (session_id, participant_id, kind, signature_svg, unable_reason, ip_hmac, user_agent)
  on public.attendance_signatures to authenticated;
grant delete on public.attendance_signatures to authenticated;
grant select (session_id, trainer_id, trainer_name, signature_svg, content_sha256, attested, signatures_sha256, signed_at)
  on public.attendance_countersignatures to authenticated;
grant insert (session_id, signature_svg, ip_hmac, user_agent) on public.attendance_countersignatures to authenticated;
grant delete on public.attendance_countersignatures to authenticated;
grant all on public.attendance_signatures, public.attendance_countersignatures to service_role;

-- Les fonctions du schéma private créées après la migration initiale ne sont pas ouvertes par défaut.
grant execute on function private.valid_signature_path(text) to authenticated, service_role;
grant execute on function private.signature_sha256(uuid, uuid, timestamptz, text, text) to authenticated, service_role;
grant execute on function private.paris_today() to authenticated, service_role;
grant execute on function private.attendance_sheet_frozen(uuid) to authenticated, service_role;
grant execute on function private.signature_window_open(uuid) to authenticated, service_role;
grant execute on function private.can_sign_attendance(uuid, uuid, text) to authenticated, service_role;
revoke execute on function public.correct_attendance(uuid, uuid, text, text) from public, anon;
revoke execute on function public.my_attendance_signing() from public, anon;
grant execute on function public.correct_attendance(uuid, uuid, text, text) to authenticated;
grant execute on function public.my_attendance_signing() to authenticated;
