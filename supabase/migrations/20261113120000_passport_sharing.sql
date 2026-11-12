-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — partage du passeport par lien et vérification par QR code
--
-- Le participant, et lui seul, crée des liens de partage de son passeport :
-- durée limitée (7, 30 ou 90 jours), libellé personnel, contenu choisi. Le lien
-- porte un jeton de 32 octets aléatoires ; la base n'en garde que l'empreinte
-- SHA-256 (recherche) et une copie chiffrée côté serveur (AES-256-GCM, clé hors
-- base) pour que le participant puisse recopier son lien ou réafficher le QR code.
-- Le jeton en clair n'est jamais stocké ni journalisé.
--
-- La page publique /verifier/[jeton] résout le lien côté serveur avec la clé de
-- service : consume_passport_share n'est exécutable que par service_role, vérifie
-- validité et expiration, compte la consultation et l'inscrit au journal (date et
-- empreinte HMAC de l'adresse IP, jamais l'adresse en clair).
-- ════════════════════════════════════════════════════════════════════════════

create table public.passport_shares (
  id                     uuid primary key default gen_random_uuid(),
  participant_id         uuid not null references public.participants (id) on delete cascade,
  -- Empreinte SHA-256 (hexadécimal) du jeton : seule clé de recherche.
  token_hash             text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  -- Jeton chiffré par le serveur (clé absente de la base) : réaffichage par le seul titulaire.
  token_ciphertext       text not null check (char_length(token_ciphertext) between 20 and 200),
  label                  text not null check (char_length(label) between 1 and 80),
  duration_days          int  not null check (duration_days in (7, 30, 90)),
  include_sociocognitive boolean not null default false,
  include_report         boolean not null default false,
  created_by             uuid references public.profiles (id) on delete set null,
  created_at             timestamptz not null default now(),
  expires_at             timestamptz not null,
  revoked_at             timestamptz,
  revoked_by             uuid references public.profiles (id) on delete set null,
  revoked_reason         text check (revoked_reason in ('participant', 'moderation')),
  view_count             int not null default 0 check (view_count >= 0),
  last_viewed_at         timestamptz,
  check ((revoked_at is null) = (revoked_reason is null)),
  check (expires_at > created_at)
);
comment on table public.passport_shares is 'Liens de partage du passeport créés par le participant. Le jeton n''est jamais stocké en clair.';
comment on column public.passport_shares.token_hash is 'Empreinte SHA-256 du jeton (hexadécimal). Jamais exposée aux clients.';
comment on column public.passport_shares.token_ciphertext is 'Jeton chiffré côté serveur (clé hors base). Jamais exposé aux clients.';
create index passport_shares_participant_idx on public.passport_shares (participant_id, created_at desc);

create table public.passport_share_views (
  id         bigint generated always as identity primary key,
  share_id   uuid not null references public.passport_shares (id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  -- HMAC-SHA256 de l'adresse IP (clé serveur) : repérer des consultations répétées sans conserver l'adresse.
  ip_hash    text check (ip_hash ~ '^[0-9a-f]{32,64}$')
);
comment on table public.passport_share_views is 'Journal des consultations d''un lien de partage : date et empreinte HMAC de l''adresse IP.';
create index passport_share_views_share_idx on public.passport_share_views (share_id, viewed_at desc);

-- ── Droits ──────────────────────────────────────────────────────────────────
-- Lecture : le participant titulaire et les administrateurs (modération), sans les
-- colonnes secrètes. Aucune écriture directe : tout passe par les fonctions ci-dessous.
alter table public.passport_shares enable row level security;
alter table public.passport_shares force row level security;
alter table public.passport_share_views enable row level security;
alter table public.passport_share_views force row level security;

create policy passport_shares_select on public.passport_shares for select to authenticated
  using (participant_id = private.my_participant_id() or private.is_admin());

create policy passport_share_views_select on public.passport_share_views for select to authenticated
  using (exists (
    select 1 from public.passport_shares s
    where s.id = share_id and (s.participant_id = private.my_participant_id() or private.is_admin())
  ));

revoke all on public.passport_shares from public, anon, authenticated;
revoke all on public.passport_share_views from public, anon, authenticated;
grant select (id, participant_id, label, duration_days, include_sociocognitive, include_report, created_at, expires_at,
              revoked_at, revoked_reason, view_count, last_viewed_at)
  on public.passport_shares to authenticated;
grant select (id, share_id, viewed_at) on public.passport_share_views to authenticated;
grant all on public.passport_shares, public.passport_share_views to service_role;

-- ── Création (participant uniquement) ───────────────────────────────────────
create or replace function public.create_passport_share(
  p_token_hash text,
  p_token_ciphertext text,
  p_label text,
  p_duration_days int,
  p_include_sociocognitive boolean default false,
  p_include_report boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_participant uuid := private.my_participant_id();
  v_label text := left(trim(regexp_replace(coalesce(p_label, ''), '[[:cntrl:]]+', ' ', 'g')), 80);
  v_id uuid;
begin
  if (select auth.uid()) is null or v_participant is null or private.current_role_code() is distinct from 'participant' then
    raise exception 'Seul le participant peut partager son passeport.' using errcode = '42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_token_ciphertext is null
     or char_length(p_token_ciphertext) not between 20 and 200 then
    raise exception 'Lien invalide.' using errcode = '22023';
  end if;
  if p_duration_days is null or p_duration_days not in (7, 30, 90) then
    raise exception 'Choisissez une durée de 7, 30 ou 90 jours.' using errcode = '22023';
  end if;
  if v_label = '' then
    raise exception 'Indiquez pour qui est ce lien.' using errcode = '22023';
  end if;
  if coalesce(p_include_report, false) and not exists (
    select 1 from public.participant_reports r where r.participant_id = v_participant and r.status = 'final'
  ) then
    raise exception 'Aucun bilan validé à partager pour le moment.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('passport_shares:' || v_participant::text));
  if (select count(*) from public.passport_shares s
       where s.participant_id = v_participant and s.revoked_at is null and s.expires_at > now()) >= 10 then
    raise exception 'Vous avez déjà 10 liens actifs. Révoquez-en un avant d’en créer un nouveau.' using errcode = 'P0001';
  end if;
  -- Garde-fou contre la création en rafale (créer, révoquer, recommencer).
  if (select count(*) from public.passport_shares s
       where s.participant_id = v_participant and s.created_at > now() - interval '1 day') >= 30 then
    raise exception 'Trop de liens créés aujourd’hui. Réessayez demain.' using errcode = 'P0001';
  end if;

  insert into public.passport_shares (participant_id, token_hash, token_ciphertext, label, duration_days,
                                      include_sociocognitive, include_report, created_by, expires_at)
  values (v_participant, p_token_hash, p_token_ciphertext, v_label, p_duration_days,
          coalesce(p_include_sociocognitive, false), coalesce(p_include_report, false), (select auth.uid()),
          now() + make_interval(days => p_duration_days))
  returning id into v_id;
  return v_id;
end;
$$;

-- ── Révocation : le titulaire, ou un administrateur (modération) ───────────
create or replace function public.revoke_passport_share(p_share_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_share public.passport_shares%rowtype;
  v_owner boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;
  select * into v_share from public.passport_shares where id = p_share_id;
  v_owner := coalesce(found and v_share.participant_id = private.my_participant_id(), false);
  if not found or not (v_owner or coalesce(private.is_admin(), false)) then
    -- Même réponse pour un lien inexistant et un lien d'autrui.
    raise exception 'Lien introuvable.' using errcode = 'P0002';
  end if;
  if v_share.revoked_at is not null then return; end if;
  update public.passport_shares
     set revoked_at = now(), revoked_by = (select auth.uid()), revoked_reason = case when v_owner then 'participant' else 'moderation' end
   where id = p_share_id;
end;
$$;

-- ── Jeton chiffré d'un lien actif, pour son seul titulaire ──────────────────
-- Le serveur le déchiffre pour recopier le lien, afficher le QR code ou l'ajouter au PDF.
create or replace function public.my_passport_share_secret(p_share_id uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select s.token_ciphertext from public.passport_shares s
   where s.id = p_share_id
     and s.participant_id = private.my_participant_id()
     and private.current_role_code() = 'participant'
     and s.revoked_at is null and s.expires_at > now();
$$;

-- ── Consultation publique (clé de service uniquement) ───────────────────────
-- Une seule requête pour tous les cas : lien inconnu, expiré ou révoqué renvoient
-- le même résultat (null), sans trace ni compteur.
create or replace function public.consume_passport_share(p_token_hash text, p_ip_hash text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_share public.passport_shares%rowtype;
begin
  update public.passport_shares s
     set view_count = s.view_count + 1, last_viewed_at = now()
   where s.token_hash = coalesce(p_token_hash, '') and s.revoked_at is null and s.expires_at > now()
  returning s.* into v_share;
  if not found then return null; end if;
  insert into public.passport_share_views (share_id, ip_hash)
  values (v_share.id, case when p_ip_hash ~ '^[0-9a-f]{32,64}$' then p_ip_hash end);
  return jsonb_build_object(
    'participant_id', v_share.participant_id,
    'include_sociocognitive', v_share.include_sociocognitive,
    'include_report', v_share.include_report,
    'created_at', v_share.created_at,
    'expires_at', v_share.expires_at
  );
end;
$$;

revoke execute on function public.create_passport_share(text, text, text, int, boolean, boolean) from public, anon;
revoke execute on function public.revoke_passport_share(uuid) from public, anon;
revoke execute on function public.my_passport_share_secret(uuid) from public, anon;
revoke execute on function public.consume_passport_share(text, text) from public, anon, authenticated;
grant execute on function public.create_passport_share(text, text, text, int, boolean, boolean) to authenticated;
grant execute on function public.revoke_passport_share(uuid) to authenticated;
grant execute on function public.my_passport_share_secret(uuid) to authenticated;
grant execute on function public.consume_passport_share(text, text) to service_role;

-- ── Journal ─────────────────────────────────────────────────────────────────
-- Création et révocation seulement : les consultations ont leur propre journal.
-- Ni le jeton ni son empreinte ne sont copiés dans le journal d'activité.
create or replace function private.passport_shares_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  select p.organization_id into v_org from public.participants p where p.id = new.participant_id;
  if tg_op = 'INSERT' then
    perform private.audit('passport_share.created', 'passport_share', new.id::text, v_org, new.participant_id,
      jsonb_build_object('duration_days', new.duration_days, 'include_sociocognitive', new.include_sociocognitive,
                         'include_report', new.include_report));
  elsif old.revoked_at is null and new.revoked_at is not null then
    perform private.audit('passport_share.revoked', 'passport_share', new.id::text, v_org, new.participant_id,
      jsonb_build_object('reason', new.revoked_reason));
  end if;
  return null;
end;
$$;

create trigger passport_shares_audit after insert or update on public.passport_shares
  for each row execute function private.passport_shares_audit();
