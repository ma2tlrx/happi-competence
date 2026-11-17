-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — prescription en ligne (axe D de docs/audit-strategique.md)
--
-- Un conseiller (membre d'un organisme prescripteur) oriente une personne vers
-- HAPPI sans ressaisie ; l'équipe HAPPI traite la file des orientations et
-- remplit ses groupes, avec une liste d'attente par programme.
--
-- 1. groups.capacity : nombre de places proposées (facultatif, administrateur).
-- 2. Permissions : org.referrals.write (organisme), referrals.manage (formateur ;
--    l'administrateur les possède toutes).
-- 3. referrals : fiche d'orientation minimale (pas de date de naissance, pas de
--    détail de santé), consentements horodatés, statut de traitement.
-- 4. referral_events : historique en ajout seul (statuts et consentements).
-- 5. Fonctions : set_referral_status, cancel_referral, assign_referral_to_group,
--    my_referral_consents, confirm_referral_consents.
-- 6. E-mails : nouveau modèle « referral_update » dans email_outbox.
--
-- Droits : un organisme ne voit que ses orientations ; l'équipe HAPPI habilitée
-- voit la file (comptes de démonstration et comptes réels cloisonnés) ; un
-- participant ne lit aucune orientation, il confirme seulement ses consentements
-- par fonction dédiée. Aucune modification directe : tout passe par les fonctions.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Capacité des groupes ─────────────────────────────────────────────────
alter table public.groups add column capacity int check (capacity is null or capacity between 1 and 100);
comment on column public.groups.capacity is 'Places proposées pour ce groupe (nul : taille maximale du programme). Modifiable par l''administrateur.';

create or replace function private.groups_capacity_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and not private.is_admin()
     and ((tg_op = 'INSERT' and new.capacity is not null) or (tg_op = 'UPDATE' and new.capacity is distinct from old.capacity)) then
    raise exception 'Seul un administrateur peut fixer le nombre de places d’un groupe.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger groups_capacity_guard before insert or update on public.groups
  for each row execute function private.groups_capacity_guard();

create or replace function private.groups_capacity_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.capacity is distinct from old.capacity then
    perform private.audit('group.capacity_changed', 'group', new.id::text, new.organization_id, null,
      jsonb_build_object('from', old.capacity, 'to', new.capacity));
  end if;
  return null;
end;
$$;
create trigger groups_capacity_audit after update of capacity on public.groups
  for each row execute function private.groups_capacity_audit();

-- Places effectives : la capacité du groupe, bornée par la taille maximale du programme
-- (que le déclencheur group_members_guard fait toujours respecter).
create or replace function private.group_free_seats(p_group_id uuid)
returns int language sql stable security definer set search_path = '' as $$
  select least(coalesce(g.capacity, p.max_group_size), p.max_group_size)
       - (select count(*)::int from public.group_members gm where gm.group_id = g.id and gm.status = 'active')
  from public.groups g join public.programs p on p.id = g.program_id
  where g.id = p_group_id;
$$;

-- ── 2. Permissions ──────────────────────────────────────────────────────────
insert into public.permissions (code, label, description, applicable_roles, position) values
  ('referrals.manage', 'Traiter les orientations',
   'Consulter la file des orientations des prescripteurs, changer leur statut et affecter les personnes à un groupe.', '{formateur}', 20),
  ('org.referrals.write', 'Orienter des personnes vers HAPPI',
   'Remplir une fiche d’orientation et suivre les orientations de l’organisme.', '{organisme}', 21)
on conflict (code) do nothing;

insert into public.role_permissions (role_code, permission_code) values
  ('formateur', 'referrals.manage'),
  ('organisme', 'org.referrals.write')
on conflict do nothing;

-- ── 3. Orientations ─────────────────────────────────────────────────────────
create table public.referrals (
  id                          uuid primary key default gen_random_uuid(),
  organization_id             uuid not null references public.organizations (id) on delete cascade,
  referent_id                 uuid references public.profiles (id) on delete set null,
  -- Identité minimale : de quoi inviter la personne, rien de plus.
  first_name                  text not null check (char_length(first_name) between 1 and 80),
  last_name                   text not null check (char_length(last_name) between 1 and 80),
  email                       text not null check (char_length(email) <= 254 and email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone                       text check (phone is null or char_length(phone) <= 30),
  -- Tranche d'âge plutôt que date de naissance (minimisation). Tranches provisoires — à valider.
  age_band                    text check (age_band in ('16_17', '18_25', '26_29', '30_49', '50_plus')),
  reason                      text not null check (char_length(reason) between 10 and 1000),
  objectives                  text check (objectives is null or char_length(objectives) <= 1000),
  availability_days           text[] not null default '{}'
                              check (availability_days <@ array['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']),
  availability_slots          text[] not null default '{}' check (availability_slots <@ array['matin', 'apres_midi']),
  practical_constraints       text[] not null default '{}'
                              check (practical_constraints <@ array['transport', 'garde_enfants', 'horaires', 'autre']),
  constraints_details         text check (constraints_details is null or char_length(constraints_details) <= 300),
  -- Oui / non seulement : aucun détail de santé n'est collecté.
  needs_accommodation         boolean not null default false,
  program_id                  uuid references public.programs (id) on delete set null,
  desired_start_date          date,
  -- Consentements. L'information est certifiée par le conseiller (horodatée), les choix
  -- sont ensuite confirmés ou modifiés par la personne elle-même depuis son compte.
  information_acknowledged_at timestamptz not null,
  information_version         text not null check (char_length(information_version) between 1 and 20),
  consent_image               boolean not null default false,
  consent_share_results       boolean not null default false,
  participant_confirmed_at    timestamptz,
  -- Traitement par l'équipe HAPPI.
  status                      text not null default 'sent'
                              check (status in ('sent', 'received', 'interview_scheduled', 'accepted', 'waitlisted', 'refused', 'cancelled')),
  status_reason               text check (status_reason is null or char_length(status_reason) <= 500),
  status_changed_at           timestamptz not null default now(),
  status_changed_by           uuid references public.profiles (id) on delete set null,
  interview_at                timestamptz,
  group_id                    uuid references public.groups (id) on delete set null,
  participant_id              uuid references public.participants (id) on delete set null,
  possible_duplicate          boolean not null default false,
  is_demo                     boolean not null default false,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  check (status not in ('refused', 'cancelled') or status_reason is not null)
);
comment on table public.referrals is 'Orientations des prescripteurs vers HAPPI. Données minimales : ni date de naissance, ni information de santé.';
comment on column public.referrals.information_acknowledged_at is 'Le conseiller certifie avoir informé la personne du traitement de ses données (texte information_version).';
comment on column public.referrals.consent_image is 'Droit à l''image (distinct, révocable par la personne). Historique dans referral_events.';
comment on column public.referrals.consent_share_results is 'Partage des résultats avec le prescripteur : conditionne le rattachement de la fiche participant à l''organisme.';
comment on column public.referrals.possible_duplicate is 'Une fiche ou une orientation en cours existe peut-être pour cette adresse : vérification par l''équipe HAPPI.';
create index referrals_organization_idx on public.referrals (organization_id, created_at desc);
create index referrals_status_idx on public.referrals (status, created_at);
create index referrals_program_idx on public.referrals (program_id);
create index referrals_email_idx on public.referrals (email);
create index referrals_participant_idx on public.referrals (participant_id);
create trigger referrals_set_updated_at before update on public.referrals
  for each row execute function private.set_updated_at();
create trigger referrals_mark_demo before insert on public.referrals
  for each row execute function private.mark_demo_from_author();

-- ── 4. Historique ───────────────────────────────────────────────────────────
create table public.referral_events (
  id            bigint generated always as identity primary key,
  referral_id   uuid not null references public.referrals (id) on delete cascade,
  kind          text not null check (kind in ('created', 'status', 'consent')),
  from_status   text,
  to_status     text,
  consent_kind  text check (consent_kind in ('information', 'image', 'share_results')),
  consent_value boolean,
  source        text not null check (source in ('prescriber', 'participant', 'staff', 'system')),
  reason        text check (reason is null or char_length(reason) <= 500),
  actor_id      uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
comment on table public.referral_events is 'Historique des orientations (statuts et consentements), en ajout seul.';
create index referral_events_referral_idx on public.referral_events (referral_id, created_at);
create trigger referral_events_append_only before update or delete on public.referral_events
  for each row execute function private.append_only();

-- ── Machine d'états (miroir de src/lib/referrals/status.ts) ─────────────────
create or replace function private.referral_transition_allowed(p_from text, p_to text)
returns boolean language sql immutable set search_path = '' as $$
  select case p_from
    when 'sent' then p_to in ('received', 'interview_scheduled', 'accepted', 'waitlisted', 'refused', 'cancelled')
    when 'received' then p_to in ('interview_scheduled', 'accepted', 'waitlisted', 'refused', 'cancelled')
    when 'interview_scheduled' then p_to in ('interview_scheduled', 'accepted', 'waitlisted', 'refused', 'cancelled')
    when 'waitlisted' then p_to in ('interview_scheduled', 'accepted', 'refused', 'cancelled')
    else false
  end;
$$;

create or replace function private.referral_status_label(p_status text)
returns text language sql immutable set search_path = '' as $$
  select case p_status
    when 'sent' then 'envoyée'
    when 'received' then 'reçue'
    when 'interview_scheduled' then 'entretien planifié'
    when 'accepted' then 'acceptée'
    when 'waitlisted' then 'en liste d’attente'
    when 'refused' then 'refusée'
    when 'cancelled' then 'annulée'
    else p_status end;
$$;

create or replace function private.caller_is_demo()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_demo from public.profiles p where p.id = (select auth.uid())), false);
$$;

-- Lecture : l'organisme prescripteur, ou l'équipe HAPPI habilitée. Démonstration et réel sont
-- cloisonnés pour tous, administrateurs compris : un compte de démonstration ne voit que des
-- orientations de démonstration, un compte réel que des orientations réelles.
create or replace function private.can_see_referral(p_organization_id uuid, p_is_demo boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select (private.has_permission('org.referrals.write') and p_organization_id = any (private.my_organization_ids()))
      or (private.is_staff() and private.has_permission('referrals.manage')
          and p_is_demo = private.caller_is_demo());
$$;

create or replace function private.can_manage_referral(p_referral_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_staff() and private.has_permission('referrals.manage') and exists (
    select 1 from public.referrals r
    where r.id = p_referral_id and r.is_demo = private.caller_is_demo()
  );
$$;

create or replace function private.referral_source()
returns text language sql stable security definer set search_path = '' as $$
  select case private.current_role_code()
    when 'organisme' then 'prescriber'
    when 'participant' then 'participant'
    when 'formateur' then 'staff'
    when 'admin' then 'staff'
    else 'system' end;
$$;

-- ── Déclencheurs ────────────────────────────────────────────────────────────
-- Lectures au-delà des droits du conseiller (fiches participants, autres orientations),
-- isolées dans des fonctions qui ne renvoient qu'un booléen.
create or replace function private.referral_possible_duplicate(p_email text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.participants p where p.email = lower(trim(p_email)))
      or exists (select 1 from public.referrals r where r.email = lower(trim(p_email))
                 and r.status in ('sent', 'received', 'interview_scheduled', 'waitlisted'));
$$;

create or replace function private.program_is_active(p_program_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.programs p where p.id = p_program_id and p.status = 'active');
$$;

create or replace function private.organization_is_demo(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select o.is_demo from public.organizations o where o.id = p_organization_id), false);
$$;

-- Déclencheur exécuté avec les droits de l'appelant : current_user distingue une session
-- utilisateur (authenticated) d'une fonction métier (propriétaire) ou du serveur.
create or replace function private.referrals_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if current_user in ('authenticated', 'anon') then
      raise exception 'Une orientation se modifie par les actions prévues (statut, affectation, consentements).' using errcode = '42501';
    end if;
    if new.organization_id is distinct from old.organization_id or new.email is distinct from old.email
       or new.information_acknowledged_at is distinct from old.information_acknowledged_at or new.created_at is distinct from old.created_at then
      raise exception 'Ces informations de l’orientation ne peuvent pas être modifiées.' using errcode = 'P0001';
    end if;
    if new.status is distinct from old.status then
      new.status_changed_at := now();
      new.status_changed_by := (select auth.uid());
    end if;
    return new;
  end if;

  -- Insertion : seul le conseiller d'un organisme actif oriente, au nom de sa structure.
  if current_user in ('authenticated', 'anon') then
    new.referent_id := (select auth.uid());
    new.status := 'sent';
    new.status_reason := null;
    new.interview_at := null;
    new.group_id := null;
    new.participant_id := null;
    new.participant_confirmed_at := null;
    new.created_at := now();
  end if;
  if new.information_acknowledged_at is null then
    raise exception 'Confirmez que la personne a été informée du traitement de ses données.' using errcode = '22023';
  end if;
  new.information_acknowledged_at := now();
  new.status_changed_at := now();
  new.status_changed_by := (select auth.uid());
  new.first_name := trim(new.first_name);
  new.last_name := trim(new.last_name);
  new.email := lower(trim(new.email));
  new.phone := nullif(trim(new.phone), '');
  new.reason := trim(new.reason);
  new.objectives := nullif(trim(new.objectives), '');
  new.constraints_details := nullif(trim(new.constraints_details), '');
  new.availability_days := coalesce(new.availability_days, '{}');
  new.availability_slots := coalesce(new.availability_slots, '{}');
  new.practical_constraints := coalesce(new.practical_constraints, '{}');
  if new.desired_start_date is not null and new.desired_start_date < current_date then
    raise exception 'La date de démarrage souhaitée ne peut pas être passée.' using errcode = '22023';
  end if;
  if new.program_id is not null and not private.program_is_active(new.program_id) then
    raise exception 'Ce programme n’est pas proposé actuellement.' using errcode = 'P0001';
  end if;
  new.is_demo := new.is_demo or private.organization_is_demo(new.organization_id);
  -- Doublon possible : fiche participant ou orientation en cours pour la même adresse. Le
  -- prescripteur n'en voit que l'indication ; l'équipe HAPPI vérifie.
  new.possible_duplicate := private.referral_possible_duplicate(new.email);
  return new;
end;
$$;
create trigger referrals_guard before insert or update on public.referrals
  for each row execute function private.referrals_guard();

create or replace function private.referrals_after_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_source text := private.referral_source();
  v_actor uuid := (select auth.uid());
  v_person text := new.first_name || ' ' || left(new.last_name, 1) || '.';
  v_link text := '/organisme/orientations/' || new.id::text;
begin
  if tg_op = 'INSERT' then
    insert into public.referral_events (referral_id, kind, to_status, source, actor_id)
    values (new.id, 'created', new.status, v_source, v_actor);
    insert into public.referral_events (referral_id, kind, consent_kind, consent_value, source, actor_id) values
      (new.id, 'consent', 'information', true, v_source, v_actor),
      (new.id, 'consent', 'image', new.consent_image, v_source, v_actor),
      (new.id, 'consent', 'share_results', new.consent_share_results, v_source, v_actor);
    -- Aucune donnée d'identité dans le journal.
    perform private.audit('referral.created', 'referral', new.id::text, new.organization_id, null,
      jsonb_build_object('program_id', new.program_id, 'possible_duplicate', new.possible_duplicate,
                         'consent_image', new.consent_image, 'consent_share_results', new.consent_share_results));
    if not new.is_demo then
      perform private.notify_admins('referral.created', 'Nouvelle orientation reçue',
        'Un prescripteur a orienté une personne vers HAPPI.', '/admin/orientations/' || new.id::text);
    end if;
    return null;
  end if;

  if new.status is distinct from old.status then
    insert into public.referral_events (referral_id, kind, from_status, to_status, source, reason, actor_id)
    values (new.id, 'status', old.status, new.status, v_source, new.status_reason, v_actor);
    perform private.audit('referral.status_changed', 'referral', new.id::text, new.organization_id, new.participant_id,
      jsonb_build_object('from', old.status, 'to', new.status, 'group_id', new.group_id));
    if new.referent_id is distinct from v_actor then
      perform private.notify(new.referent_id, 'referral.status',
        'Orientation de ' || v_person || ' : ' || private.referral_status_label(new.status),
        case new.status
          when 'refused' then 'L’équipe HAPPI n’a pas retenu cette orientation. Consultez le motif.'
          when 'accepted' then 'La personne est inscrite dans un groupe. Elle reçoit une invitation à créer son compte.'
          when 'waitlisted' then 'La personne est en liste d’attente : elle sera proposée dès qu’une place se libère.'
          when 'interview_scheduled' then 'Un entretien est planifié avec la personne.'
          else 'Le statut de votre orientation a changé.' end,
        v_link);
    end if;
    if new.status = 'cancelled' and not new.is_demo then
      perform private.notify_admins('referral.cancelled', 'Orientation annulée par le prescripteur',
        'Une orientation de la file a été annulée.', '/admin/orientations/' || new.id::text);
    end if;
  elsif new.status = 'interview_scheduled' and new.interview_at is distinct from old.interview_at then
    insert into public.referral_events (referral_id, kind, from_status, to_status, source, actor_id)
    values (new.id, 'status', old.status, new.status, v_source, v_actor);
  end if;

  if new.consent_image is distinct from old.consent_image or new.consent_share_results is distinct from old.consent_share_results
     or new.participant_confirmed_at is distinct from old.participant_confirmed_at then
    -- Chaque confirmation de la personne est tracée, même sans changement de choix.
    if new.consent_image is distinct from old.consent_image or new.participant_confirmed_at is distinct from old.participant_confirmed_at then
      insert into public.referral_events (referral_id, kind, consent_kind, consent_value, source, actor_id)
      values (new.id, 'consent', 'image', new.consent_image, v_source, v_actor);
    end if;
    if new.consent_share_results is distinct from old.consent_share_results or new.participant_confirmed_at is distinct from old.participant_confirmed_at then
      insert into public.referral_events (referral_id, kind, consent_kind, consent_value, source, actor_id)
      values (new.id, 'consent', 'share_results', new.consent_share_results, v_source, v_actor);
    end if;
    perform private.audit('referral.consent_changed', 'referral', new.id::text, new.organization_id, new.participant_id,
      jsonb_build_object('image', new.consent_image, 'previous_image', old.consent_image,
                         'share_results', new.consent_share_results, 'previous_share_results', old.consent_share_results,
                         'source', v_source));
    if v_source = 'participant' then
      perform private.notify(new.referent_id, 'referral.consent',
        'Orientation de ' || v_person || ' : consentements mis à jour',
        'La personne a confirmé ou modifié ses choix (droit à l’image, partage des résultats).', v_link);
    end if;
  end if;
  return null;
end;
$$;
create trigger referrals_after_write after insert or update on public.referrals
  for each row execute function private.referrals_after_write();

-- ── RLS ─────────────────────────────────────────────────────────────────────
revoke all on public.referrals, public.referral_events from anon, authenticated;
grant select, insert, delete on public.referrals to authenticated;
grant select on public.referral_events to authenticated;
grant all on public.referrals, public.referral_events to service_role;
alter table public.referrals enable row level security;
alter table public.referrals force row level security;
alter table public.referral_events enable row level security;
alter table public.referral_events force row level security;

create policy referrals_select on public.referrals for select to authenticated
  using (private.can_see_referral(organization_id, is_demo));
create policy referrals_insert on public.referrals for insert to authenticated
  with check (
    (select private.current_role_code()) = 'organisme'
    and (select private.has_permission('org.referrals.write'))
    and organization_id = any (private.my_organization_ids())
  );
-- Effacement (RGPD) : administrateur seulement.
create policy referrals_delete on public.referrals for delete to authenticated
  using ((select private.is_admin()));
create policy referral_events_select on public.referral_events for select to authenticated
  using (exists (select 1 from public.referrals r where r.id = referral_id));

-- ── 5. Fonctions métier ─────────────────────────────────────────────────────
-- Changement de statut par l'équipe HAPPI (l'acceptation passe par l'affectation à un groupe).
create or replace function public.set_referral_status(
  p_referral_id uuid,
  p_status text,
  p_reason text default null,
  p_interview_at timestamptz default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_referral public.referrals%rowtype;
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  if not private.can_manage_referral(p_referral_id) then
    raise exception 'Vous n’êtes pas autorisé à traiter cette orientation.' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('received', 'interview_scheduled', 'waitlisted', 'refused') then
    raise exception 'Statut invalide.' using errcode = '22023';
  end if;
  select * into v_referral from public.referrals where id = p_referral_id for update;
  if not private.referral_transition_allowed(v_referral.status, p_status) then
    raise exception 'Cette orientation ne peut pas passer de « % » à « % ».',
      private.referral_status_label(v_referral.status), private.referral_status_label(p_status) using errcode = 'P0001';
  end if;
  if p_status = 'refused' and (v_reason is null or char_length(v_reason) < 3) then
    raise exception 'Indiquez le motif du refus.' using errcode = '22023';
  end if;
  update public.referrals
     set status = p_status,
         status_reason = case when p_status = 'refused' then v_reason else null end,
         interview_at = case when p_status = 'interview_scheduled' then p_interview_at else interview_at end
   where id = p_referral_id;
end;
$$;

-- Annulation par le prescripteur (organisme de l'orientation).
create or replace function public.cancel_referral(p_referral_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_referral public.referrals%rowtype;
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  select * into v_referral from public.referrals where id = p_referral_id for update;
  if not found or not (private.has_permission('org.referrals.write') and v_referral.organization_id = any (private.my_organization_ids())) then
    raise exception 'Vous n’êtes pas autorisé à annuler cette orientation.' using errcode = '42501';
  end if;
  if not private.referral_transition_allowed(v_referral.status, 'cancelled') then
    raise exception 'Cette orientation ne peut plus être annulée (statut « % »).', private.referral_status_label(v_referral.status) using errcode = 'P0001';
  end if;
  if v_reason is null or char_length(v_reason) < 3 then
    raise exception 'Indiquez le motif de l’annulation.' using errcode = '22023';
  end if;
  update public.referrals set status = 'cancelled', status_reason = v_reason where id = p_referral_id;
end;
$$;

-- Affectation à un groupe : crée ou rattache la fiche participant avec les règles de
-- add_participant_to_group (droits sur le groupe et sur une fiche existante compris),
-- puis rattache la personne à l'organisme prescripteur si elle a accepté le partage.
create or replace function public.assign_referral_to_group(p_referral_id uuid, p_group_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_referral public.referrals%rowtype;
  v_group public.groups%rowtype;
  v_result jsonb;
  v_participant public.participants%rowtype;
  v_final_org uuid;
begin
  if not private.can_manage_referral(p_referral_id) then
    raise exception 'Vous n’êtes pas autorisé à traiter cette orientation.' using errcode = '42501';
  end if;
  select * into v_referral from public.referrals where id = p_referral_id for update;
  if not private.referral_transition_allowed(v_referral.status, 'accepted') then
    raise exception 'Cette orientation ne peut plus être affectée (statut « % »).', private.referral_status_label(v_referral.status) using errcode = 'P0001';
  end if;
  select * into v_group from public.groups where id = p_group_id;
  if not found then raise exception 'Groupe introuvable.' using errcode = 'P0002'; end if;
  if v_group.is_demo is distinct from v_referral.is_demo then
    raise exception 'Une orientation de démonstration ne peut rejoindre qu’un groupe de démonstration, et inversement.' using errcode = 'P0001';
  end if;
  if v_group.status in ('completed', 'archived') then
    raise exception 'Ce groupe est terminé ou archivé.' using errcode = 'P0001';
  end if;
  if coalesce(private.group_free_seats(p_group_id), 0) <= 0 then
    raise exception 'Ce groupe n’a plus de place disponible.' using errcode = 'P0001';
  end if;

  -- Mêmes contrôles qu'un ajout manuel : droits sur le groupe, fiche existante d'une autre équipe refusée.
  v_result := public.add_participant_to_group(p_group_id, null, v_referral.first_name, v_referral.last_name, v_referral.email);
  select * into v_participant from public.participants where id = (v_result ->> 'participant_id')::uuid for update;

  if (v_result ->> 'created')::boolean and v_participant.phone is null and v_referral.phone is not null then
    update public.participants set phone = v_referral.phone where id = v_participant.id;
  end if;
  -- Rattachement au prescripteur : seulement si la personne accepte le partage de ses résultats,
  -- et sans écraser le rattachement d'une fiche déjà suivie par un autre organisme.
  if v_referral.consent_share_results
     and ((v_result ->> 'created')::boolean or v_participant.organization_id is null) then
    update public.participants set organization_id = v_referral.organization_id where id = v_participant.id;
  end if;
  select p.organization_id into v_final_org from public.participants p where p.id = v_participant.id;

  update public.referrals
     set status = 'accepted', status_reason = null, group_id = p_group_id, participant_id = v_participant.id
   where id = p_referral_id;

  return v_result || jsonb_build_object(
    'attached_to_prescriber', v_final_org is not distinct from v_referral.organization_id,
    'other_organization', v_final_org is not null and v_final_org <> v_referral.organization_id);
end;
$$;

-- Le participant voit ses consentements (et rien d'autre de l'orientation).
create or replace function public.my_referral_consents()
returns table (
  referral_id uuid,
  organization_name text,
  program_name text,
  information_version text,
  information_acknowledged_at timestamptz,
  consent_image boolean,
  consent_share_results boolean,
  participant_confirmed_at timestamptz
) language sql stable security definer set search_path = '' as $$
  select r.id, o.name, p.name, r.information_version, r.information_acknowledged_at,
         r.consent_image, r.consent_share_results, r.participant_confirmed_at
  from public.referrals r
  join public.organizations o on o.id = r.organization_id
  left join public.programs p on p.id = r.program_id
  where r.participant_id is not null and r.participant_id = private.my_participant_id()
    and private.current_role_code() = 'participant'
  order by r.created_at desc;
$$;

create or replace function public.confirm_referral_consents(p_referral_id uuid, p_image boolean, p_share_results boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_referral public.referrals%rowtype;
  v_participant public.participants%rowtype;
begin
  if p_image is null or p_share_results is null then
    raise exception 'Répondez à chacune des questions.' using errcode = '22023';
  end if;
  select * into v_referral from public.referrals where id = p_referral_id for update;
  if not found or private.current_role_code() <> 'participant' or v_referral.participant_id is null
     or v_referral.participant_id is distinct from private.my_participant_id() then
    raise exception 'Orientation introuvable.' using errcode = 'P0002';
  end if;
  update public.referrals
     set consent_image = p_image, consent_share_results = p_share_results, participant_confirmed_at = now()
   where id = p_referral_id;

  -- Le partage des résultats ouvre (ou ferme) l'accès du prescripteur à la fiche.
  select * into v_participant from public.participants where id = v_referral.participant_id for update;
  if p_share_results and v_participant.organization_id is null then
    update public.participants set organization_id = v_referral.organization_id where id = v_participant.id;
  elsif not p_share_results and v_participant.organization_id = v_referral.organization_id then
    update public.participants set organization_id = null where id = v_participant.id;
  end if;
end;
$$;

-- ── 6. E-mails : modèle « referral_update » ─────────────────────────────────
alter table public.email_outbox drop constraint if exists email_outbox_template_check;
alter table public.email_outbox add constraint email_outbox_template_check check (template in (
  'session_convocation', 'session_reminder', 'session_updated', 'session_cancelled',
  'report_available', 'participant_invitation', 'referral_update', 'test'));

-- ── Droits d'exécution ──────────────────────────────────────────────────────
revoke execute on function public.set_referral_status(uuid, text, text, timestamptz) from public, anon;
revoke execute on function public.cancel_referral(uuid, text) from public, anon;
revoke execute on function public.assign_referral_to_group(uuid, uuid) from public, anon;
revoke execute on function public.my_referral_consents() from public, anon;
revoke execute on function public.confirm_referral_consents(uuid, boolean, boolean) from public, anon;
grant execute on function public.set_referral_status(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.cancel_referral(uuid, text) to authenticated;
grant execute on function public.assign_referral_to_group(uuid, uuid) to authenticated;
grant execute on function public.my_referral_consents() to authenticated;
grant execute on function public.confirm_referral_consents(uuid, boolean, boolean) to authenticated;

grant execute on function private.groups_capacity_guard() to authenticated, service_role;
grant execute on function private.group_free_seats(uuid) to authenticated, service_role;
grant execute on function private.referral_transition_allowed(text, text) to authenticated, service_role;
grant execute on function private.referral_status_label(text) to authenticated, service_role;
grant execute on function private.caller_is_demo() to authenticated, service_role;
grant execute on function private.can_see_referral(uuid, boolean) to authenticated, service_role;
grant execute on function private.can_manage_referral(uuid) to authenticated, service_role;
grant execute on function private.referral_source() to authenticated, service_role;
grant execute on function private.referral_possible_duplicate(text) to authenticated, service_role;
grant execute on function private.program_is_active(uuid) to authenticated, service_role;
grant execute on function private.organization_is_demo(uuid) to authenticated, service_role;
grant execute on function private.referrals_guard() to authenticated, service_role;
