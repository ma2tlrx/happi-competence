-- ════════════════════════════════════════════════════════════════════════════
-- Sécurité des comptes
-- 1. Limitation de débit sans service externe : compteurs par fenêtre fixe dans le
--    schéma privé (jamais exposé par l'API), incrémentés par public.rate_limit_hit,
--    réservée à la clé de service (appelée par le serveur Next.js uniquement).
-- 2. Double authentification (TOTP, Supabase Auth MFA) :
--    - paramètre « security.mfa_required_staff » (désactivé par défaut) ;
--    - private.current_role_code() ne reconnaît plus le rôle d'un compte dont la
--      session n'a pas le niveau d'assurance requis (aal2) : tous les droits
--      dérivés (is_admin, is_staff, has_permission, organismes…) tombent alors au
--      niveau de la base, même si l'API est appelée directement ;
--    - public.my_mfa_status() renseigne l'application (redirections) ;
--    - journalisation de l'activation et de la désactivation d'un facteur.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Limitation de débit ──────────────────────────────────────────────────
-- Aucune donnée en clair : la clé est une empreinte HMAC (clé secrète serveur) de
-- l'adresse IP, de l'adresse e-mail ou de l'identifiant du compte.
create table private.rate_limit_counters (
  action       text not null check (action ~ '^[a-z_]+(\.[a-z_]+)*$' and char_length(action) <= 60),
  key_hash     text not null check (key_hash ~ '^[0-9a-f]{32,128}$'),
  window_start timestamptz not null,
  hits         integer not null default 0 check (hits >= 0),
  primary key (action, key_hash, window_start)
);
comment on table private.rate_limit_counters is
  'Compteurs de limitation de débit (fenêtre fixe). Empreintes HMAC uniquement ; lignes de plus de deux jours purgées automatiquement.';
create index rate_limit_counters_window_idx on private.rate_limit_counters (window_start);

alter table private.rate_limit_counters enable row level security;
alter table private.rate_limit_counters force row level security;
revoke all on table private.rate_limit_counters from public, anon, authenticated;

/**
 * Enregistre une tentative et indique si elle est autorisée.
 * Retour : { allowed, hits, limit, remaining, retry_after } (retry_after en secondes).
 * Une tentative refusée est tout de même comptée : insister ne raccourcit pas l'attente.
 */
create or replace function public.rate_limit_hit(
  p_action text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_window_start timestamptz;
  v_hits integer;
  v_retry integer;
begin
  if p_action is null or p_action !~ '^[a-z_]+(\.[a-z_]+)*$' or char_length(p_action) > 60 then
    raise exception 'Action de limitation invalide.' using errcode = '22023';
  end if;
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{32,128}$' then
    raise exception 'Empreinte invalide.' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception 'Limite invalide.' using errcode = '22023';
  end if;
  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Fenêtre invalide.' using errcode = '22023';
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into private.rate_limit_counters as c (action, key_hash, window_start, hits)
  values (p_action, p_key_hash, v_window_start, 1)
  on conflict (action, key_hash, window_start) do update set hits = c.hits + 1
  returning c.hits into v_hits;

  -- Nettoyage : fenêtres échues de cette clé, puis, de temps en temps, toutes les vieilles lignes.
  delete from private.rate_limit_counters
   where action = p_action and key_hash = p_key_hash and window_start < v_window_start;
  if random() < 0.02 then
    delete from private.rate_limit_counters where window_start < now() - interval '2 days';
  end if;

  v_retry := greatest(1, ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - now())))::integer);

  -- Premier dépassement de la fenêtre : une trace dans le journal (sans l'empreinte).
  if v_hits = p_limit + 1 then
    perform private.audit('security.rate_limited', 'rate_limit', p_action, null, null,
      jsonb_build_object('limit', p_limit, 'window_seconds', p_window_seconds));
  end if;

  return jsonb_build_object(
    'allowed', v_hits <= p_limit,
    'hits', v_hits,
    'limit', p_limit,
    'remaining', greatest(p_limit - v_hits, 0),
    'retry_after', case when v_hits <= p_limit then 0 else v_retry end
  );
end;
$$;

revoke execute on function public.rate_limit_hit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, text, integer, integer) to service_role;

-- ── 2. Double authentification ──────────────────────────────────────────────
insert into public.app_settings (key, value, is_public) values ('security.mfa_required_staff', 'false', false)
on conflict (key) do nothing;

/**
 * Vrai si la session courante a le niveau d'assurance exigé pour ce compte :
 * - un compte qui a un facteur vérifié doit s'être authentifié en aal2 ;
 * - si le paramètre « security.mfa_required_staff » est actif, un administrateur ou
 *   un formateur (hors comptes de démonstration) doit avoir un facteur et être en aal2.
 */
create or replace function private.mfa_satisfied(p_user_id uuid, p_role text, p_is_demo boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
    or (
      not exists (select 1 from auth.mfa_factors f where f.user_id = p_user_id and f.status = 'verified')
      and not (
        p_role in ('admin', 'formateur') and not coalesce(p_is_demo, false)
        and coalesce((select s.value = 'true'::jsonb from public.app_settings s where s.key = 'security.mfa_required_staff'), false)
      )
    );
$$;

-- Rôle reconnu pour la session : nul si le compte est désactivé ou si la double
-- authentification exigée n'a pas été faite. Les fonctions qui en dépendent
-- (is_admin, is_staff, has_permission, my_organization_ids…) refusent alors l'accès.
create or replace function private.current_role_code()
returns text language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p
  where p.id = (select auth.uid()) and p.status = 'active'
    and private.mfa_satisfied(p.id, p.role, p.is_demo);
$$;

/** État de la double authentification du compte connecté (pour les redirections de l'application). */
create or replace function public.my_mfa_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'aal', coalesce((select auth.jwt() ->> 'aal'), 'aal1'),
    'verified', exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified'),
    'required', coalesce((
      select p.role in ('admin', 'formateur') and not p.is_demo
        and coalesce((select s.value = 'true'::jsonb from public.app_settings s where s.key = 'security.mfa_required_staff'), false)
      from public.profiles p where p.id = (select auth.uid())
    ), false)
  );
$$;

revoke execute on function public.my_mfa_status() from public, anon;
grant execute on function public.my_mfa_status() to authenticated;
revoke execute on function private.mfa_satisfied(uuid, text, boolean) from public, anon;
grant execute on function private.mfa_satisfied(uuid, text, boolean) to authenticated, service_role;

-- Journal : activation (facteur vérifié) et désactivation d'un facteur. Les écritures
-- viennent du serveur d'authentification : l'auteur est le titulaire du facteur.
create or replace function private.mfa_factors_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.status = 'verified' and old.status is distinct from 'verified' then
    insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
    values (new.user_id, (select p.role from public.profiles p where p.id = new.user_id), 'auth.mfa_enabled', 'profile', new.user_id::text,
            jsonb_build_object('factor_type', new.factor_type::text));
  elsif tg_op = 'DELETE' and old.status = 'verified' then
    insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
    values (old.user_id, (select p.role from public.profiles p where p.id = old.user_id), 'auth.mfa_disabled', 'profile', old.user_id::text,
            jsonb_build_object('factor_type', old.factor_type::text));
  end if;
  return null;
end;
$$;
revoke execute on function private.mfa_factors_audit() from public, anon, authenticated;
grant execute on function private.mfa_factors_audit() to supabase_auth_admin;

drop trigger if exists happi_mfa_factors_audit on auth.mfa_factors;
create trigger happi_mfa_factors_audit after update or delete on auth.mfa_factors
  for each row execute function private.mfa_factors_audit();
