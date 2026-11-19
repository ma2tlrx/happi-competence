-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — fiche d'entrée du participant (FSE+ et dispositifs publics)
-- Chantier F2. Sources et règles de calcul : docs/fse-plus.md.
--
-- 1. Permission org.entry_profile.manage (organisme) : lire et saisir la fiche
--    d'entrée des participants rattachés à l'organisme.
-- 2. participant_entry_profiles : profil d'entrée, une ligne par (participant,
--    groupe). Données sensibles (art. 9 RGPD : handicap, RQTH, origine, minorité)
--    → table séparée, RLS forcée. Lecture et écriture : administrateur, organisme
--    du participant avec la permission dédiée, participant lui-même. JAMAIS le
--    formateur (aucune clause trains_participant / trains_group).
-- 3. participant_outcomes : situation « autre formation ou reprise d'études »
--    (EECR02) et « qualification obtenue » (EECR03), provisoires — à valider.
--    Aucune donnée existante n'est modifiée.
-- 4. Journal : déclencheur d'audit (noms des champs modifiés, jamais les valeurs)
--    et fonction log_entry_profile_event pour les consultations et exports.
--
-- Conservation : aucune suppression automatique (voir docs/fse-plus.md).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Permission ───────────────────────────────────────────────────────────
insert into public.permissions (code, label, description, applicable_roles, position) values
  ('org.entry_profile.manage', 'Fiche d’entrée FSE+ des participants',
   'Lire et saisir la fiche d’entrée (situation à l’entrée, diplôme, dispositifs, données facultatives sensibles) des participants rattachés à l’organisme, pour les rapports aux financeurs.',
   '{organisme}', 22)
on conflict (code) do nothing;

-- Accordée par défaut à l'organisme prescripteur (provisoire — à valider ; retirable dans Paramètres).
insert into public.role_permissions (role_code, permission_code) values ('organisme', 'org.entry_profile.manage')
on conflict do nothing;

-- ── 2. Fiche d'entrée ───────────────────────────────────────────────────────
create table public.participant_entry_profiles (
  id                       uuid primary key default gen_random_uuid(),
  participant_id           uuid not null references public.participants (id) on delete cascade,
  group_id                 uuid references public.groups (id) on delete cascade,
  entry_date               date,
  -- Données de base (FSE+ annexe I) : nul = non renseigné.
  gender                   text check (gender in ('femme', 'homme', 'non_binaire', 'ne_souhaite_pas_repondre')),
  age_band                 text check (age_band in ('moins_18', '18_29', '30_54', '55_plus')),
  labour_status            text check (labour_status in ('chomeur', 'inactif', 'en_emploi')),
  unemployment_duration    text check (unemployment_duration in ('moins_6_mois', '6_11_mois', '12_23_mois', '24_mois_plus')),
  diploma_level            text check (diploma_level in (
    'sans_diplome', 'niveau_1', 'niveau_2', 'niveau_3', 'niveau_4', 'niveau_5', 'niveau_6', 'niveau_7', 'niveau_8')),
  -- Correspondance CITE (ISCED) dérivée du niveau français : jamais saisie à part, donc toujours cohérente.
  education_isced          text generated always as (
    case
      when diploma_level in ('sans_diplome', 'niveau_1', 'niveau_2') then 'cite_0_2'
      when diploma_level in ('niveau_3', 'niveau_4') then 'cite_3_4'
      when diploma_level in ('niveau_5', 'niveau_6', 'niveau_7', 'niveau_8') then 'cite_5_8'
    end
  ) stored,
  -- Données facultatives FSE+ : toujours « ne souhaite pas répondre » possible.
  disability               text check (disability in ('oui', 'non', 'ne_sait_pas', 'ne_souhaite_pas_repondre')),
  third_country_national   text check (third_country_national in ('oui', 'non', 'ne_sait_pas', 'ne_souhaite_pas_repondre')),
  foreign_background       text check (foreign_background in ('oui', 'non', 'ne_sait_pas', 'ne_souhaite_pas_repondre')),
  minority                 text check (minority in ('oui', 'non', 'ne_sait_pas', 'ne_souhaite_pas_repondre')),
  homeless_or_housing_excl text check (homeless_or_housing_excl in ('oui', 'non', 'ne_sait_pas', 'ne_souhaite_pas_repondre')),
  rural_area               text check (rural_area in ('oui', 'non', 'ne_sait_pas', 'ne_souhaite_pas_repondre')),
  -- Dispositifs français.
  qpv_resident             text check (qpv_resident in ('oui', 'non', 'ne_sait_pas', 'ne_souhaite_pas_repondre')),
  zrr_frr_resident         text check (zrr_frr_resident in ('oui', 'non', 'ne_sait_pas', 'ne_souhaite_pas_repondre')),
  rqth                     text check (rqth in ('oui', 'non', 'ne_sait_pas', 'ne_souhaite_pas_repondre')),
  rsa_beneficiary          text check (rsa_beneficiary in ('oui', 'non', 'ne_sait_pas', 'ne_souhaite_pas_repondre')),
  france_travail_registered text check (france_travail_registered in ('oui', 'non', 'ne_sait_pas', 'ne_souhaite_pas_repondre')),
  cej                      text check (cej in ('oui', 'non', 'ne_sait_pas', 'ne_souhaite_pas_repondre')),
  -- Information et relecture par la personne.
  participant_informed_at  timestamptz,
  participant_confirmed_at timestamptz,
  recorded_by              uuid references public.profiles (id) on delete set null,
  created_by               uuid references public.profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint participant_entry_profiles_unique unique nulls not distinct (participant_id, group_id),
  constraint participant_entry_profiles_duration check (unemployment_duration is null or labour_status = 'chomeur')
);
comment on table public.participant_entry_profiles is 'Fiche d''entrée FSE+ / financeurs publics, une ligne par participant et par groupe. Données sensibles (art. 9 RGPD) : jamais lisibles par le formateur. Sources et nomenclatures : docs/fse-plus.md.';
comment on column public.participant_entry_profiles.group_id is 'Parcours concerné (groupe) ; nul pour une fiche hors groupe.';
comment on column public.participant_entry_profiles.entry_date is 'Date d''entrée dans l''opération (saisie par l''organisme ou l''administrateur).';
comment on column public.participant_entry_profiles.age_band is 'Tranche d''âge à l''entrée (aucune date de naissance n''est conservée dans HAPPI).';
comment on column public.participant_entry_profiles.unemployment_duration is 'Durée de chômage / d''inscription comme demandeur d''emploi, si chômeur.';
comment on column public.participant_entry_profiles.diploma_level is 'Plus haut niveau atteint, cadre national des certifications professionnelles (décret n° 2019-14 du 8 janvier 2019).';
comment on column public.participant_entry_profiles.education_isced is 'CITE 2011 regroupée comme les indicateurs FSE+ (0-2, 3-4, 5-8), dérivée du niveau français — correspondance à vérifier.';
comment on column public.participant_entry_profiles.zrr_frr_resident is 'Résidence en zone France Ruralités Revitalisation (ex-ZRR depuis le 1er juillet 2024).';
comment on column public.participant_entry_profiles.participant_informed_at is 'Première information de la personne sur la finalité de ces données (lecture à l''écran ou remise par le professionnel).';
comment on column public.participant_entry_profiles.participant_confirmed_at is 'Dernière relecture / complétion par la personne elle-même.';
create index participant_entry_profiles_group_idx on public.participant_entry_profiles (group_id);

-- Lecture et écriture : administrateur, organisme du participant (permission dédiée), le participant lui-même.
create or replace function private.can_access_entry_profile(p_participant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin()
      or (private.current_role_code() = 'participant' and p_participant_id = private.my_participant_id())
      or (private.current_role_code() = 'organisme' and private.has_permission('org.entry_profile.manage')
          and private.org_sees_participant(p_participant_id));
$$;

create or replace function private.participant_entry_profiles_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_self boolean := private.current_role_code() = 'participant' and new.participant_id = private.my_participant_id();
begin
  if tg_op = 'UPDATE' and (new.participant_id is distinct from old.participant_id or new.group_id is distinct from old.group_id) then
    raise exception 'Une fiche d’entrée ne peut pas être déplacée vers un autre participant ou un autre groupe.' using errcode = 'P0001';
  end if;
  if new.group_id is not null and not exists (
    select 1 from public.group_members gm
    where gm.group_id = new.group_id and gm.participant_id = new.participant_id and gm.status in ('active', 'dropped')
  ) then
    raise exception 'Ce participant ne fait pas partie de ce groupe.' using errcode = 'P0001';
  end if;
  if new.entry_date > current_date then
    raise exception 'La date d’entrée ne peut pas être dans le futur.' using errcode = '22023';
  end if;
  -- La durée de chômage n'a de sens que pour un chômeur : effacée sinon.
  if new.labour_status is distinct from 'chomeur' then
    new.unemployment_duration := null;
  end if;

  if v_self then
    -- La personne complète et corrige ses réponses ; la date d'entrée reste celle du professionnel.
    new.entry_date := case when tg_op = 'UPDATE' then old.entry_date else null end;
    new.participant_confirmed_at := now();
    new.participant_informed_at := coalesce(case when tg_op = 'UPDATE' then old.participant_informed_at end, now());
  elsif tg_op = 'UPDATE' then
    new.participant_confirmed_at := old.participant_confirmed_at;
    new.participant_informed_at := coalesce(old.participant_informed_at, new.participant_informed_at);
  else
    new.participant_confirmed_at := null;
  end if;
  if new.participant_informed_at is not null and new.participant_informed_at > now() then
    new.participant_informed_at := now();
  end if;

  new.recorded_by := coalesce((select auth.uid()), new.recorded_by);
  if tg_op = 'INSERT' then
    new.created_by := coalesce((select auth.uid()), new.created_by);
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger participant_entry_profiles_guard before insert or update on public.participant_entry_profiles
  for each row execute function private.participant_entry_profiles_guard();

-- Journal : qui a saisi ou modifié quels champs — jamais les valeurs (données sensibles).
create or replace function private.participant_entry_profiles_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row public.participant_entry_profiles%rowtype;
  v_org uuid;
  v_changed text[];
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  select p.organization_id into v_org from public.participants p where p.id = v_row.participant_id;
  if tg_op = 'INSERT' then
    perform private.audit('entry_profile.recorded', 'participant', v_row.participant_id::text, v_org, v_row.participant_id,
      jsonb_build_object('group_id', new.group_id, 'by_participant', new.participant_confirmed_at is not null));
  elsif tg_op = 'UPDATE' then
    select coalesce(array_agg(n.key order by n.key), '{}') into v_changed
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value
      and n.key not in ('updated_at', 'recorded_by', 'participant_confirmed_at', 'participant_informed_at', 'education_isced');
    if cardinality(v_changed) > 0 then
      perform private.audit('entry_profile.updated', 'participant', v_row.participant_id::text, v_org, v_row.participant_id,
        jsonb_build_object('group_id', new.group_id, 'fields', to_jsonb(v_changed),
          'by_participant', new.participant_confirmed_at is distinct from old.participant_confirmed_at));
    end if;
  else
    perform private.audit('entry_profile.deleted', 'participant', v_row.participant_id::text, v_org, v_row.participant_id,
      jsonb_build_object('group_id', old.group_id));
  end if;
  return null;
end;
$$;
create trigger participant_entry_profiles_audit after insert or update or delete on public.participant_entry_profiles
  for each row execute function private.participant_entry_profiles_audit();

-- ── RLS ─────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.participant_entry_profiles to authenticated;
revoke all on public.participant_entry_profiles from anon;
alter table public.participant_entry_profiles enable row level security;
alter table public.participant_entry_profiles force row level security;

create policy participant_entry_profiles_select on public.participant_entry_profiles for select to authenticated
  using (private.can_access_entry_profile(participant_id));
create policy participant_entry_profiles_insert on public.participant_entry_profiles for insert to authenticated
  with check (private.can_access_entry_profile(participant_id));
create policy participant_entry_profiles_update on public.participant_entry_profiles for update to authenticated
  using (private.can_access_entry_profile(participant_id))
  with check (private.can_access_entry_profile(participant_id));
create policy participant_entry_profiles_delete on public.participant_entry_profiles for delete to authenticated
  using ((select private.is_admin()));

-- ── 3. Situations de sortie : compléments FSE+ (provisoires — à valider) ─────
alter table public.participant_outcomes drop constraint participant_outcomes_situation_check;
alter table public.participant_outcomes add constraint participant_outcomes_situation_check check (situation in (
  'emploi_durable', 'emploi_transition', 'formation_qualifiante', 'formation_autre', 'creation_activite',
  'immersion_stage', 'recherche_emploi', 'autre_etape', 'sans_nouvelles'));
alter table public.participant_outcomes add column qualification_obtained boolean;
comment on column public.participant_outcomes.qualification_obtained is 'Qualification obtenue au terme de la participation (indicateur FSE+ EECR03) ; nul = non renseigné. Provisoire — à valider.';

create or replace function private.participant_outcomes_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_row public.participant_outcomes%rowtype;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  select p.organization_id into v_org from public.participants p where p.id = v_row.participant_id;
  if tg_op = 'INSERT' then
    perform private.audit('outcome.recorded', 'participant', v_row.participant_id::text, v_org, v_row.participant_id,
      jsonb_build_object('kind', new.kind, 'situation', new.situation, 'observed_on', new.observed_on, 'group_id', new.group_id,
        'qualification_obtained', new.qualification_obtained));
  elsif tg_op = 'UPDATE' then
    if new.situation is distinct from old.situation or new.observed_on is distinct from old.observed_on
       or new.details is distinct from old.details or new.qualification_obtained is distinct from old.qualification_obtained then
      perform private.audit('outcome.updated', 'participant', v_row.participant_id::text, v_org, v_row.participant_id,
        jsonb_build_object('kind', new.kind, 'situation', new.situation, 'previous_situation', old.situation,
          'observed_on', new.observed_on, 'previous_observed_on', old.observed_on,
          'qualification_obtained', new.qualification_obtained, 'previous_qualification_obtained', old.qualification_obtained,
          'details_changed', new.details is distinct from old.details, 'group_id', new.group_id));
    end if;
  else
    perform private.audit('outcome.deleted', 'participant', v_row.participant_id::text, v_org, v_row.participant_id,
      jsonb_build_object('kind', old.kind, 'situation', old.situation, 'group_id', old.group_id));
  end if;
  return null;
end;
$$;

-- ── 4. Journal des consultations et exports ─────────────────────────────────
-- Les lectures ne déclenchent pas de trigger : l'application appelle cette fonction
-- (consultation d'une fiche, export du fichier participants ou du tableau agrégé).
create or replace function public.log_entry_profile_event(p_action text, p_participant_id uuid default null, p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  if p_action not in ('entry_profile.viewed', 'export.fse_participants_csv', 'export.fse_indicators_csv') then
    raise exception 'Action non journalisable.' using errcode = '22023';
  end if;
  if not (private.is_admin()
          or (private.current_role_code() = 'organisme' and private.has_permission('org.entry_profile.manage'))
          or (p_action = 'entry_profile.viewed' and p_participant_id is not null and p_participant_id = private.my_participant_id())) then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  if p_participant_id is not null then
    if not private.can_access_entry_profile(p_participant_id) then
      raise exception 'Accès refusé.' using errcode = '42501';
    end if;
    select p.organization_id into v_org from public.participants p where p.id = p_participant_id;
  else
    v_org := (private.my_organization_ids())[1];
  end if;
  perform private.audit(p_action, case when p_participant_id is null then 'fse' else 'participant' end,
    p_participant_id::text, v_org, p_participant_id, coalesce(p_metadata, '{}'::jsonb) - 'values');
end;
$$;
revoke all on function public.log_entry_profile_event(text, uuid, jsonb) from public, anon;
grant execute on function public.log_entry_profile_event(text, uuid, jsonb) to authenticated;
