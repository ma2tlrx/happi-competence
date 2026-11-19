-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — Open Badges 3.0 vérifiables
--
-- badge_classes : modèles de badge (nom, description, critères en texte, image,
--   compétences rattachées, règle d'attribution configurable, actif/inactif).
--   Gérés par les administrateurs seuls. Un modèle « provisoire » (critère non
--   validé par l'équipe HAPPI) ne peut pas être activé, donc pas émis.
-- badge_assertions : badges émis. Émission et révocation par un administrateur
--   seul (choix le plus prudent : docs/open-badges.md), via des fonctions dédiées.
--   Le crédential est signé côté serveur (clé hors base, variable d'environnement) ;
--   la base garde son empreinte SHA-256, une copie chiffrée (clé hors base) et
--   l'empreinte de l'identifiant public (jeton de 32 octets de l'adresse de
--   vérification). Ni le jeton ni le crédential ne sont stockés en clair.
-- Lecture : le participant voit ses badges, les formateurs ceux des participants
-- qu'ils accompagnent, les administrateurs tout. La page publique de vérification
-- lit la base avec la clé de service.
-- ════════════════════════════════════════════════════════════════════════════

create table public.badge_classes (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(name) between 3 and 120),
  description        text not null check (char_length(description) between 10 and 2000),
  criteria_narrative text not null check (char_length(criteria_narrative) between 10 and 4000),
  -- Adresse https ou chemin du site (/brand/…) ; vide : pas d'image dans le badge.
  image_url          text check (image_url is null or (char_length(image_url) <= 500 and image_url ~ '^(https://[^[:space:]]+|/[A-Za-z0-9/_.-]+)$')),
  -- Compétences rattachées (facultatif) : [{ "framework": "…", "code": "…", "name": "…" }].
  related_skills     jsonb not null default '[]'::jsonb check (jsonb_typeof(related_skills) = 'array' and jsonb_array_length(related_skills) <= 20),
  -- Règle d'attribution (src/lib/badges/rules.ts) : sert uniquement à suggérer des participants éligibles.
  award_rule         jsonb not null default '{"version": 1, "conditions": []}'::jsonb check (jsonb_typeof(award_rule) = 'object'),
  is_active          boolean not null default false,
  -- Critère en attente de validation par l'équipe HAPPI : le modèle reste inactif.
  is_provisional     boolean not null default true,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (not (is_active and is_provisional))
);
comment on table public.badge_classes is 'Modèles de badge Open Badges 3.0 (Achievement). Gérés par les administrateurs.';
comment on column public.badge_classes.award_rule is 'Règle configurable à partir de faits mesurés ; ne déclenche jamais d''émission automatique.';
comment on column public.badge_classes.is_provisional is 'Critère « provisoire — à valider » : un modèle provisoire ne peut être ni activé ni émis.';
create trigger badge_classes_set_updated_at before update on public.badge_classes
  for each row execute function private.set_updated_at();

create table public.badge_assertions (
  id                    uuid primary key default gen_random_uuid(),
  badge_class_id        uuid not null references public.badge_classes (id) on delete restrict,
  participant_id        uuid not null references public.participants (id) on delete cascade,
  group_id              uuid references public.groups (id) on delete set null,
  issued_at             timestamptz not null default now(),
  issued_by             uuid references public.profiles (id) on delete set null,
  -- Empreinte SHA-256 du jeton de l'adresse de vérification : seule clé de recherche publique.
  public_id_hash        text not null unique check (public_id_hash ~ '^[0-9a-f]{64}$'),
  -- Empreinte SHA-256 du crédential signé (JWS compact) : contrôle d'intégrité.
  credential_sha256     text not null check (credential_sha256 ~ '^[0-9a-f]{64}$'),
  -- Crédential signé, chiffré côté serveur (AES-256-GCM, clé hors base).
  credential_ciphertext text not null check (char_length(credential_ciphertext) between 40 and 200000),
  -- Identifiant de la clé publique de signature (adresse du JWK).
  signing_kid           text not null check (char_length(signing_kid) between 10 and 500),
  -- Règle et faits mesurés au moment de l'émission (traçabilité de la décision).
  award_snapshot        jsonb not null default '{}'::jsonb check (jsonb_typeof(award_snapshot) = 'object'),
  revoked_at            timestamptz,
  revoked_by            uuid references public.profiles (id) on delete set null,
  revocation_reason     text check (revocation_reason is null or char_length(revocation_reason) between 3 and 500),
  check ((revoked_at is null) = (revocation_reason is null))
);
comment on table public.badge_assertions is 'Badges émis (OpenBadgeCredential signés). Ni le jeton public ni le crédential ne sont stockés en clair.';
comment on column public.badge_assertions.public_id_hash is 'Empreinte SHA-256 du jeton de vérification. Jamais exposée aux clients.';
comment on column public.badge_assertions.credential_ciphertext is 'Crédential signé chiffré côté serveur (clé hors base). Jamais exposé aux clients.';
create index badge_assertions_participant_idx on public.badge_assertions (participant_id, issued_at desc);
create index badge_assertions_class_idx on public.badge_assertions (badge_class_id);
create index badge_assertions_group_idx on public.badge_assertions (group_id);
-- Un seul badge valide d'un même modèle par participant.
create unique index badge_assertions_one_active on public.badge_assertions (badge_class_id, participant_id) where revoked_at is null;

-- ── Droits ──────────────────────────────────────────────────────────────────
alter table public.badge_classes enable row level security;
alter table public.badge_classes force row level security;
alter table public.badge_assertions enable row level security;
alter table public.badge_assertions force row level security;

-- Modèles : l'équipe HAPPI les lit (formateurs : contexte des badges de leurs participants) ;
-- un participant lit ceux des badges qu'il a reçus. Écriture : administrateurs.
create policy badge_classes_select on public.badge_classes for select to authenticated
  using (
    private.is_staff()
    or exists (select 1 from public.badge_assertions a where a.badge_class_id = badge_classes.id and a.participant_id = private.my_participant_id())
  );
create policy badge_classes_insert on public.badge_classes for insert to authenticated with check (private.is_admin());
create policy badge_classes_update on public.badge_classes for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy badge_classes_delete on public.badge_classes for delete to authenticated using (private.is_admin());

-- Badges émis : lecture seule (titulaire, formateurs du participant, administrateurs), sans
-- les colonnes secrètes. Aucune écriture directe : tout passe par les fonctions ci-dessous.
create policy badge_assertions_select on public.badge_assertions for select to authenticated
  using (participant_id = private.my_participant_id() or private.is_admin() or private.trains_participant(participant_id));

revoke all on public.badge_classes from public, anon, authenticated;
revoke all on public.badge_assertions from public, anon, authenticated;
grant select, insert, update, delete on public.badge_classes to authenticated;
grant select (id, badge_class_id, participant_id, group_id, issued_at, issued_by, signing_kid, award_snapshot,
              revoked_at, revoked_by, revocation_reason)
  on public.badge_assertions to authenticated;
grant all on public.badge_classes, public.badge_assertions to service_role;

-- ── Émission (administrateur uniquement) ───────────────────────────────────
-- Le serveur signe le crédential puis l'enregistre ici ; la base revérifie le rôle,
-- l'état du modèle, l'appartenance au groupe et l'absence de badge valide identique.
create or replace function public.issue_badge_assertion(
  p_badge_class_id uuid,
  p_participant_id uuid,
  p_group_id uuid,
  p_issued_at timestamptz,
  p_public_id_hash text,
  p_credential_sha256 text,
  p_credential_ciphertext text,
  p_signing_kid text,
  p_award_snapshot jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_class public.badge_classes%rowtype;
  v_id uuid;
begin
  if (select auth.uid()) is null or not coalesce(private.is_admin(), false) then
    raise exception 'Seul un administrateur peut émettre un badge.' using errcode = '42501';
  end if;
  select * into v_class from public.badge_classes where id = p_badge_class_id;
  if not found then
    raise exception 'Modèle de badge introuvable.' using errcode = 'P0002';
  end if;
  if not v_class.is_active or v_class.is_provisional then
    raise exception 'Ce modèle de badge n’est pas actif : validez son critère et activez-le avant d’émettre.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.participants p where p.id = p_participant_id) then
    raise exception 'Participant introuvable.' using errcode = 'P0002';
  end if;
  if p_group_id is not null and not exists (
    select 1 from public.group_members gm where gm.group_id = p_group_id and gm.participant_id = p_participant_id
  ) then
    raise exception 'Ce participant n’appartient pas à ce groupe.' using errcode = '22023';
  end if;
  if p_public_id_hash is null or p_public_id_hash !~ '^[0-9a-f]{64}$'
     or p_credential_sha256 is null or p_credential_sha256 !~ '^[0-9a-f]{64}$'
     or p_credential_ciphertext is null or char_length(p_credential_ciphertext) not between 40 and 200000
     or p_signing_kid is null or char_length(p_signing_kid) not between 10 and 500 then
    raise exception 'Badge signé invalide.' using errcode = '22023';
  end if;
  -- La date signée dans le crédential est celle de l'émission : on n'accepte qu'un léger décalage.
  if p_issued_at is null or abs(extract(epoch from (now() - p_issued_at))) > 300 then
    raise exception 'Date d’émission invalide.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('badge_assertions:' || p_badge_class_id::text || ':' || p_participant_id::text));
  if exists (
    select 1 from public.badge_assertions a
     where a.badge_class_id = p_badge_class_id and a.participant_id = p_participant_id and a.revoked_at is null
  ) then
    raise exception 'Ce participant a déjà ce badge.' using errcode = 'P0001';
  end if;

  insert into public.badge_assertions (badge_class_id, participant_id, group_id, issued_at, issued_by, public_id_hash,
                                       credential_sha256, credential_ciphertext, signing_kid, award_snapshot)
  values (p_badge_class_id, p_participant_id, p_group_id, p_issued_at, (select auth.uid()), p_public_id_hash,
          p_credential_sha256, p_credential_ciphertext, p_signing_kid,
          case when jsonb_typeof(p_award_snapshot) = 'object' then p_award_snapshot else '{}'::jsonb end)
  returning id into v_id;
  return v_id;
end;
$$;

-- ── Révocation (administrateur uniquement, motif obligatoire) ──────────────
create or replace function public.revoke_badge_assertion(p_assertion_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := left(trim(regexp_replace(coalesce(p_reason, ''), '[[:cntrl:]]+', ' ', 'g')), 500);
  v_revoked timestamptz;
begin
  if (select auth.uid()) is null or not coalesce(private.is_admin(), false) then
    raise exception 'Seul un administrateur peut révoquer un badge.' using errcode = '42501';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'Indiquez le motif de la révocation.' using errcode = '22023';
  end if;
  select a.revoked_at into v_revoked from public.badge_assertions a where a.id = p_assertion_id;
  if not found then
    raise exception 'Badge introuvable.' using errcode = 'P0002';
  end if;
  if v_revoked is not null then return; end if;
  update public.badge_assertions
     set revoked_at = now(), revoked_by = (select auth.uid()), revocation_reason = v_reason
   where id = p_assertion_id;
end;
$$;

-- ── Copie chiffrée du crédential (téléchargement) ───────────────────────────
-- Titulaire (badge non révoqué) ou administrateur. Le serveur la déchiffre.
create or replace function public.badge_credential_ciphertext(p_assertion_id uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select a.credential_ciphertext from public.badge_assertions a
   where a.id = p_assertion_id
     and (
       (a.participant_id = private.my_participant_id() and private.current_role_code() = 'participant' and a.revoked_at is null)
       or coalesce(private.is_admin(), false)
     );
$$;

revoke execute on function public.issue_badge_assertion(uuid, uuid, uuid, timestamptz, text, text, text, text, jsonb) from public, anon;
revoke execute on function public.revoke_badge_assertion(uuid, text) from public, anon;
revoke execute on function public.badge_credential_ciphertext(uuid) from public, anon;
grant execute on function public.issue_badge_assertion(uuid, uuid, uuid, timestamptz, text, text, text, text, jsonb) to authenticated;
grant execute on function public.revoke_badge_assertion(uuid, text) to authenticated;
grant execute on function public.badge_credential_ciphertext(uuid) to authenticated;

-- ── Journal et notification ─────────────────────────────────────────────────
-- Ni le jeton, ni son empreinte, ni le crédential ne sont copiés dans le journal.
create or replace function private.badge_classes_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.audit('badge_class.created', 'badge_class', new.id::text, null, null,
      jsonb_build_object('name', new.name, 'is_active', new.is_active));
  elsif tg_op = 'UPDATE' then
    perform private.audit('badge_class.updated', 'badge_class', new.id::text, null, null,
      jsonb_build_object('name', new.name, 'is_active', new.is_active, 'is_provisional', new.is_provisional,
                         'rule_changed', old.award_rule is distinct from new.award_rule,
                         'criteria_changed', old.criteria_narrative is distinct from new.criteria_narrative));
  else
    perform private.audit('badge_class.deleted', 'badge_class', old.id::text, null, null, jsonb_build_object('name', old.name));
  end if;
  return null;
end;
$$;

create trigger badge_classes_audit after insert or update or delete on public.badge_classes
  for each row execute function private.badge_classes_audit();

create or replace function private.badge_assertions_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_user uuid;
  v_name text;
begin
  select p.organization_id, p.user_id into v_org, v_user from public.participants p where p.id = new.participant_id;
  select c.name into v_name from public.badge_classes c where c.id = new.badge_class_id;
  if tg_op = 'INSERT' then
    perform private.audit('badge_assertion.issued', 'badge_assertion', new.id::text, v_org, new.participant_id,
      jsonb_build_object('badge_class_id', new.badge_class_id, 'badge', v_name, 'group_id', new.group_id,
                         'credential_sha256', new.credential_sha256));
    perform private.notify(v_user, 'badge.issued', 'Vous avez reçu un badge', v_name, '/participant/badges');
  elsif old.revoked_at is null and new.revoked_at is not null then
    perform private.audit('badge_assertion.revoked', 'badge_assertion', new.id::text, v_org, new.participant_id,
      jsonb_build_object('badge_class_id', new.badge_class_id, 'badge', v_name, 'reason', new.revocation_reason));
    perform private.notify(v_user, 'badge.revoked', 'Un de vos badges a été révoqué', v_name, '/participant/badges');
  end if;
  return null;
end;
$$;

create trigger badge_assertions_audit after insert or update on public.badge_assertions
  for each row execute function private.badge_assertions_audit();

-- ── Modèle par défaut : inactif, critère à valider ──────────────────────────
-- Aucun critère pédagogique n'est fixé ici : le texte est volontairement provisoire et la
-- règle vide (aucune suggestion). L'administrateur le complète, le valide puis l'active.
insert into public.badge_classes (name, description, criteria_narrative, image_url, is_active, is_provisional)
values (
  'Participation au programme HAPPI',
  'Atteste la participation au programme HAPPI Compétence : observation des compétences transversales et des habiletés socio-cognitives par le jeu vidéo. Description provisoire — à valider.',
  'Provisoire — à valider. Le critère d’attribution de ce badge reste à définir par l’équipe HAPPI (par exemple à partir des heures réalisées ou de la fin du programme). Tant qu’il n’est pas confirmé, ce modèle reste inactif et aucun badge n’est émis.',
  '/brand/happi-mascotte.png',
  false,
  true
);
