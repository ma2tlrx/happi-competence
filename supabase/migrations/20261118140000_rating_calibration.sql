-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — fidélité de la mesure : seconde cotation, étalonnage,
-- publication des statistiques d'accord (voir docs/fiabilite.md)
--
-- 1. calibration_ratings / calibration_scores : seconde cotation d'un participant
--    pour une séance, par un autre formateur. Stockée À PART de l'évaluation
--    officielle : rien ici n'entre dans le passeport, le bilan ni les exports.
--    Deux origines : un formateur affecté au groupe qui cote en second
--    (start_second_rating), ou un formateur invité par l'administrateur dans un
--    exercice d'étalonnage (create_calibration_exercise).
-- 2. Cotation à l'aveugle, garantie par la base : tant que sa seconde cotation
--    n'est pas soumise, le formateur ne lit ni l'évaluation officielle (ligne,
--    notes, critères, commentaires, historique), ni les bilans et versions
--    faciles à lire du participant ; il ne peut pas non plus écrire dans
--    l'évaluation officielle. Une seconde cotation ne peut commencer que si
--    l'évaluation officielle est encore vide (ou si le formateur invité n'est pas
--    formateur du groupe), sinon l'aveugle ne serait pas garanti.
-- 3. calibration_exercises : exercice d'étalonnage (même séance, mêmes
--    participants, plusieurs formateurs), sur données réelles ou de démonstration.
-- 4. reliability_settings : seuil d'effectif minimal (modifiable par
--    l'administrateur) et instantané publié sur la page publique « Notre méthode »
--    (désactivé par défaut), lu par get_public_reliability().
-- Écritures uniquement par des fonctions SECURITY DEFINER ; journal : private.audit.
-- Démonstration : suppression en cascade avec la séance, le participant, le compte.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Tables ───────────────────────────────────────────────────────────────
create table public.calibration_exercises (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.sessions (id) on delete cascade,
  title        text not null check (char_length(title) between 3 and 160),
  -- Support et consignes d'observation communs aux formateurs (vidéo, vignette écrite…).
  instructions text check (instructions is null or char_length(instructions) <= 4000),
  status       text not null default 'open' check (status in ('open', 'closed')),
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  closed_at    timestamptz,
  check ((status = 'closed') = (closed_at is not null))
);
comment on table public.calibration_exercises is 'Exercices d''étalonnage : une même séance cotée par plusieurs formateurs, comparée à l''évaluation officielle.';
create index calibration_exercises_session_idx on public.calibration_exercises (session_id);

create table public.calibration_ratings (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.sessions (id) on delete cascade,
  participant_id    uuid not null references public.participants (id) on delete cascade,
  rater_id          uuid not null references public.profiles (id) on delete cascade,
  exercise_id       uuid references public.calibration_exercises (id) on delete cascade,
  origin            text not null check (origin in ('co_trainer', 'exercise')),
  status            text not null default 'draft' check (status in ('draft', 'submitted', 'cancelled')),
  -- Observations des critères (modes de notation par critères) : { "<criterion_id>": { observed, score } }.
  criteria          jsonb not null default '{}'::jsonb check (jsonb_typeof(criteria) = 'object' and pg_column_size(criteria) < 65536),
  comment           text check (comment is null or char_length(comment) <= 2000),
  -- Révision de l'évaluation officielle au moment de la soumission (null si elle n'existait pas).
  official_revision int,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  submitted_at      timestamptz,
  unique (session_id, participant_id, rater_id),
  check ((status = 'submitted') = (submitted_at is not null)),
  check ((origin = 'exercise') = (exercise_id is not null))
);
comment on table public.calibration_ratings is 'Secondes cotations (fidélité inter-observateurs). Jamais prises en compte dans le passeport, le bilan ni les exports.';
create index calibration_ratings_rater_idx on public.calibration_ratings (rater_id, status);
create index calibration_ratings_target_idx on public.calibration_ratings (session_id, participant_id);
create index calibration_ratings_participant_idx on public.calibration_ratings (participant_id);
create index calibration_ratings_exercise_idx on public.calibration_ratings (exercise_id);
create trigger calibration_ratings_set_updated_at before update on public.calibration_ratings
  for each row execute function private.set_updated_at();

create table public.calibration_scores (
  rating_id    uuid not null references public.calibration_ratings (id) on delete cascade,
  skill_id     uuid not null references public.skills (id) on delete restrict,
  score        numeric(4, 2),
  score_source text not null default 'direct' check (score_source in ('direct', 'derived')),
  comment      text check (comment is null or char_length(comment) <= 1500),
  updated_at   timestamptz not null default now(),
  primary key (rating_id, skill_id)
);
comment on column public.calibration_scores.score is 'Nul = compétence non observée (jamais comptée comme zéro).';
create index calibration_scores_skill_idx on public.calibration_scores (skill_id);

create table public.reliability_settings (
  id          boolean primary key default true check (id),
  -- Effectif minimal de paires pour conclure (30 par défaut : Koo et Li 2016) ; voir docs/fiabilite.md.
  min_pairs   int not null default 30 check (min_pairs between 10 and 1000),
  publish     boolean not null default false,
  snapshot    jsonb check (snapshot is null or (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) < 16000)),
  computed_at timestamptz,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now(),
  check (not publish or (snapshot is not null and computed_at is not null))
);
comment on table public.reliability_settings is 'Seuil d''effectif des statistiques d''accord et instantané publié (agrégats seulement). Publication désactivée par défaut.';
insert into public.reliability_settings (id) values (true) on conflict (id) do nothing;

-- ── 2. Fonctions d'aide ─────────────────────────────────────────────────────
-- Vrai si l'appelant a une seconde cotation EN COURS (non soumise) pour ce participant et
-- cette séance : il ne doit alors rien voir de l'évaluation officielle correspondante.
create or replace function private.calibration_blind(p_session_id uuid, p_participant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.calibration_ratings r
    where r.rater_id = (select auth.uid()) and r.status = 'draft'
      and r.session_id = p_session_id and r.participant_id = p_participant_id
  );
$$;

-- Même règle pour les documents de synthèse du participant (bilans), qui reprennent les évaluations validées.
create or replace function private.calibration_blind_participant(p_participant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.calibration_ratings r
    where r.rater_id = (select auth.uid()) and r.status = 'draft' and r.participant_id = p_participant_id
  );
$$;

create or replace function private.owns_calibration_rating(p_rating_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.calibration_ratings r
    where r.id = p_rating_id and r.rater_id = (select auth.uid()) and private.current_role_code() = 'formateur'
  );
$$;

-- L'évaluation officielle contient-elle déjà quelque chose (note, critère, commentaire) ?
create or replace function private.official_has_content(p_session_id uuid, p_participant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.evaluations e
    where e.session_id = p_session_id and e.participant_id = p_participant_id
      and (
        exists (select 1 from public.evaluation_scores s where s.evaluation_id = e.id and (s.score is not null or s.comment is not null))
        or exists (select 1 from public.evaluation_criterion_scores c where c.evaluation_id = e.id and (c.observed is not null or c.score is not null))
        or exists (select 1 from public.evaluation_comments m where m.evaluation_id = e.id)
      )
  );
$$;

-- Raison pour laquelle ce formateur ne peut pas coter en second (null = possible).
create or replace function private.second_rating_obstacle(p_rater_id uuid, p_session_id uuid, p_participant_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when not exists (select 1 from public.profiles p where p.id = p_rater_id and p.role = 'formateur' and p.status = 'active') then 'not_trainer'
    when exists (
      select 1 from public.calibration_ratings r
      where r.session_id = p_session_id and r.participant_id = p_participant_id and r.rater_id = p_rater_id
    ) then 'exists'
    when not exists (
      select 1 from public.sessions s join public.group_members gm on gm.group_id = s.group_id
      where s.id = p_session_id and gm.participant_id = p_participant_id and gm.status = 'active'
    ) then 'not_member'
    when exists (select 1 from public.sessions s where s.id = p_session_id and s.trainer_id = p_rater_id) then 'session_trainer'
    when exists (
      select 1 from public.evaluations e
      where e.session_id = p_session_id and e.participant_id = p_participant_id and e.evaluator_id = p_rater_id
    ) then 'official_evaluator'
    when exists (
      select 1 from public.sessions s join public.group_trainers gt on gt.group_id = s.group_id
      where s.id = p_session_id and gt.trainer_id = p_rater_id
    ) and private.official_has_content(p_session_id, p_participant_id) then 'not_blind'
  end;
$$;

-- ── 3. Aveugle : lecture et écriture de l'évaluation officielle ─────────────
-- Les fonctions et politiques existantes sont redéfinies avec la même logique,
-- complétée de la condition d'aveugle.
create or replace function private.can_read_evaluation(p_evaluation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.evaluations e
    where e.id = p_evaluation_id
      and not private.calibration_blind(e.session_id, e.participant_id)
      and (
        private.is_admin()
        or private.trains_group(private.session_group_id(e.session_id))
        or (e.status = 'validated' and e.participant_id = private.my_participant_id())
        or (e.status = 'validated' and private.has_permission('org.evaluations.read') and private.org_sees_participant(e.participant_id))
      )
  );
$$;

create or replace function private.can_write_evaluation_draft(p_evaluation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.evaluations e
    where e.id = p_evaluation_id and e.status = 'draft' and private.can_write_evaluation(e.session_id)
      and not private.calibration_blind(e.session_id, e.participant_id)
  );
$$;

drop policy evaluations_select on public.evaluations;
create policy evaluations_select on public.evaluations for select to authenticated using (
  not private.calibration_blind(session_id, participant_id)
  and (
    (select private.is_admin())
    or private.trains_group(private.session_group_id(session_id))
    or (status = 'validated' and participant_id = (select private.my_participant_id()))
    or (status = 'validated' and (select private.has_permission('org.evaluations.read')) and private.org_sees_participant(participant_id))
  )
);

drop policy participant_reports_select on public.participant_reports;
create policy participant_reports_select on public.participant_reports for select to authenticated
  using (
    private.is_admin()
    or (private.trains_participant(participant_id) and not private.calibration_blind_participant(participant_id))
    or (status = 'final' and (participant_id = private.my_participant_id() or private.org_sees_participant(participant_id)))
  );

drop policy participant_report_easy_reads_select on public.participant_report_easy_reads;
create policy participant_report_easy_reads_select on public.participant_report_easy_reads for select to authenticated
  using (
    private.is_admin()
    or (private.trains_participant(participant_id) and not private.calibration_blind_participant(participant_id))
    or (status = 'validated' and (participant_id = private.my_participant_id() or private.org_sees_participant(participant_id)))
  );

-- Écritures : les fonctions de validation et de modification tracée sont SECURITY DEFINER ;
-- ces déclencheurs ferment aussi ces chemins. Un formateur qui a coté en second (même soumis)
-- ne peut pas devenir l'auteur de l'évaluation officielle de ce participant pour cette séance.
create or replace function private.calibration_official_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if;
  if private.calibration_blind(new.session_id, new.participant_id) then
    raise exception 'Vous cotez ce participant en second pour cette séance : l’évaluation officielle vous reste fermée jusqu’à la soumission de votre cotation.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and exists (
    select 1 from public.calibration_ratings r
    where r.session_id = new.session_id and r.participant_id = new.participant_id
      and r.rater_id = (select auth.uid()) and r.status = 'submitted'
  ) then
    raise exception 'Vous avez coté ce participant en second : l’évaluation officielle doit être faite par un autre formateur.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger calibration_official_guard before insert or update on public.evaluations
  for each row execute function private.calibration_official_guard();

create or replace function private.calibration_official_content_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_evaluation_id uuid := case when tg_op = 'DELETE' then old.evaluation_id else new.evaluation_id end;
begin
  -- Suppressions en cascade (effacement d'un participant) : jamais bloquées.
  if (select auth.uid()) is null or (tg_op = 'DELETE' and pg_trigger_depth() > 1) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if exists (
    select 1 from public.evaluations e
    where e.id = v_evaluation_id and private.calibration_blind(e.session_id, e.participant_id)
  ) then
    raise exception 'Vous cotez ce participant en second pour cette séance : l’évaluation officielle vous reste fermée jusqu’à la soumission de votre cotation.' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger calibration_official_content_guard before insert or update or delete on public.evaluation_scores
  for each row execute function private.calibration_official_content_guard();
create trigger calibration_official_content_guard before insert or update or delete on public.evaluation_criterion_scores
  for each row execute function private.calibration_official_content_guard();
create trigger calibration_official_content_guard before insert or update or delete on public.evaluation_comments
  for each row execute function private.calibration_official_content_guard();

-- ── 4. Seconde cotation par un formateur du groupe ──────────────────────────
-- Crée une seconde cotation (brouillon) pour chaque participant actif du groupe dont
-- l'évaluation officielle est encore vide. Renvoie { created, existing, skipped: [{participant_id, reason}] }.
create or replace function public.start_second_rating(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_session public.sessions%rowtype;
  v_member record;
  v_reason text;
  v_created int := 0;
  v_existing int := 0;
  v_skipped jsonb := '[]'::jsonb;
begin
  if private.current_role_code() is distinct from 'formateur' or not private.has_permission('evaluations.write') then
    raise exception 'La seconde cotation est réservée aux formateurs habilités à évaluer.' using errcode = '42501';
  end if;
  select * into v_session from public.sessions s where s.id = p_session_id;
  if not found or not private.trains_group(v_session.group_id) then
    raise exception 'Vous ne pouvez coter en second que les séances de vos groupes.' using errcode = '42501';
  end if;
  if v_session.status = 'cancelled' then
    raise exception 'Cette séance est annulée.' using errcode = 'P0001';
  end if;
  if v_session.trainer_id = (select auth.uid()) then
    raise exception 'Vous animez cette séance : l’évaluation officielle vous revient. La seconde cotation est faite par un autre formateur.' using errcode = 'P0001';
  end if;
  for v_member in
    select gm.participant_id from public.group_members gm where gm.group_id = v_session.group_id and gm.status = 'active'
  loop
    v_reason := private.second_rating_obstacle((select auth.uid()), p_session_id, v_member.participant_id);
    if v_reason = 'exists' then
      v_existing := v_existing + 1;
    elsif v_reason is not null then
      v_skipped := v_skipped || jsonb_build_object('participant_id', v_member.participant_id, 'reason', v_reason);
    else
      insert into public.calibration_ratings (session_id, participant_id, rater_id, origin, created_by)
      values (p_session_id, v_member.participant_id, (select auth.uid()), 'co_trainer', (select auth.uid()));
      v_created := v_created + 1;
    end if;
  end loop;
  if v_created > 0 then
    perform private.audit('calibration.started', 'session', p_session_id::text, null, null,
      jsonb_build_object('created', v_created, 'skipped', jsonb_array_length(v_skipped)));
  end if;
  return jsonb_build_object('created', v_created, 'existing', v_existing, 'skipped', v_skipped);
end;
$$;

-- Une seconde cotation modifiable par son auteur : brouillon, exercice encore ouvert.
create or replace function private.editable_rating(p_rating_id uuid)
returns public.calibration_ratings language plpgsql stable security definer set search_path = '' as $$
declare
  v_rating public.calibration_ratings%rowtype;
begin
  select * into v_rating from public.calibration_ratings r where r.id = p_rating_id;
  if not found or v_rating.rater_id is distinct from (select auth.uid()) or private.current_role_code() is distinct from 'formateur' then
    raise exception 'Seconde cotation introuvable.' using errcode = '42501';
  end if;
  if v_rating.status <> 'draft' then
    raise exception 'Cette seconde cotation est soumise : elle ne se modifie plus.' using errcode = 'P0001';
  end if;
  if v_rating.exercise_id is not null and exists (
    select 1 from public.calibration_exercises x where x.id = v_rating.exercise_id and x.status <> 'open'
  ) then
    raise exception 'Cet exercice d’étalonnage est clos.' using errcode = 'P0001';
  end if;
  return v_rating;
end;
$$;

-- Enregistrement du brouillon. p_scores : [{ skill_id, score, source, comment }] (score nul = non observé).
create or replace function public.save_second_rating(
  p_rating_id uuid,
  p_scores jsonb default '[]'::jsonb,
  p_criteria jsonb default '{}'::jsonb,
  p_comment text default null
) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  v_rating public.calibration_ratings%rowtype;
  v_versions uuid[];
  v_item jsonb;
  v_skill uuid;
  v_score numeric;
  v_source text;
  v_version public.framework_versions%rowtype;
begin
  v_rating := private.editable_rating(p_rating_id);
  if jsonb_typeof(coalesce(p_scores, '[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_criteria, '{}'::jsonb)) <> 'object'
     or jsonb_array_length(coalesce(p_scores, '[]'::jsonb)) > 200 then
    raise exception 'Format de données invalide.' using errcode = '22023';
  end if;
  -- Versions applicables : celles de l'évaluation officielle si elle existe, sinon celles du programme.
  select coalesce(array_agg(ef.framework_version_id), '{}') into v_versions
  from public.evaluations e join public.evaluation_frameworks ef on ef.evaluation_id = e.id
  where e.session_id = v_rating.session_id and e.participant_id = v_rating.participant_id;
  if cardinality(v_versions) = 0 then
    select coalesce(array_agg(pf.framework_version_id), '{}') into v_versions
    from public.sessions s join public.groups g on g.id = s.group_id join public.program_frameworks pf on pf.program_id = g.program_id
    where s.id = v_rating.session_id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) loop
    v_skill := (v_item ->> 'skill_id')::uuid;
    v_score := nullif(v_item ->> 'score', '')::numeric;
    v_source := case when v_item ->> 'source' = 'derived' then 'derived' else 'direct' end;
    select fv.* into v_version from public.skills s join public.framework_versions fv on fv.id = s.version_id where s.id = v_skill;
    if not found or not (v_version.id = any (v_versions)) then
      raise exception 'Cette compétence n’appartient pas aux référentiels de la séance.' using errcode = 'P0001';
    end if;
    if v_score is not null then
      if v_score < v_version.scale_min or v_score > v_version.scale_max then
        raise exception 'La note doit être comprise entre % et %.', v_version.scale_min, v_version.scale_max using errcode = 'P0001';
      end if;
      if v_source = 'direct' and mod(v_score - v_version.scale_min, v_version.scale_step) <> 0 then
        raise exception 'La note doit respecter le pas de l’échelle (%).', v_version.scale_step using errcode = 'P0001';
      end if;
    end if;
    insert into public.calibration_scores (rating_id, skill_id, score, score_source, comment)
    values (v_rating.id, v_skill, v_score, v_source, left(nullif(trim(v_item ->> 'comment'), ''), 1500))
    on conflict (rating_id, skill_id) do update
      set score = excluded.score, score_source = excluded.score_source, comment = excluded.comment, updated_at = now();
  end loop;

  update public.calibration_ratings
     set criteria = coalesce(p_criteria, '{}'::jsonb), comment = left(nullif(trim(p_comment), ''), 2000)
   where id = v_rating.id;
  return now();
end;
$$;

-- Soumission : la cotation est figée ; l'aveugle est levé pour son auteur.
create or replace function public.submit_second_rating(p_rating_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_rating public.calibration_ratings%rowtype;
  v_revision int;
begin
  v_rating := private.editable_rating(p_rating_id);
  if not exists (select 1 from public.calibration_scores s where s.rating_id = v_rating.id and s.score is not null) then
    raise exception 'Renseignez au moins une compétence avant de soumettre.' using errcode = 'P0001';
  end if;
  select e.revision into v_revision from public.evaluations e
  where e.session_id = v_rating.session_id and e.participant_id = v_rating.participant_id;
  update public.calibration_ratings
     set status = 'submitted', submitted_at = now(), official_revision = v_revision
   where id = v_rating.id;
  perform private.audit('calibration.submitted', 'calibration_rating', v_rating.id::text, null, v_rating.participant_id,
    jsonb_build_object('session_id', v_rating.session_id, 'origin', v_rating.origin, 'exercise_id', v_rating.exercise_id));
end;
$$;

-- Secondes cotations de l'appelant, avec le contexte nécessaire pour coter (y compris pour un
-- formateur invité qui n'a pas accès au groupe) : prénom et initiale du nom, séance, consignes.
create or replace function public.get_my_second_ratings(p_session_id uuid default null)
returns table (
  rating_id uuid,
  status text,
  origin text,
  submitted_at timestamptz,
  updated_at timestamptz,
  session_id uuid,
  session_number int,
  session_title text,
  session_date date,
  session_status text,
  group_name text,
  program_id uuid,
  participant_id uuid,
  participant_label text,
  exercise_id uuid,
  exercise_title text,
  exercise_instructions text,
  exercise_status text,
  criteria jsonb,
  comment text
) language sql stable security definer set search_path = '' as $$
  select r.id, r.status, r.origin, r.submitted_at, r.updated_at,
         s.id, s.number, ps.title, s.scheduled_date, s.status, g.name, g.program_id,
         p.id, p.first_name || ' ' || left(p.last_name, 1) || '.',
         x.id, x.title, x.instructions, x.status, r.criteria, r.comment
  from public.calibration_ratings r
  join public.sessions s on s.id = r.session_id
  join public.program_sessions ps on ps.id = s.program_session_id
  join public.groups g on g.id = s.group_id
  join public.participants p on p.id = r.participant_id
  left join public.calibration_exercises x on x.id = r.exercise_id
  where r.rater_id = (select auth.uid()) and private.current_role_code() = 'formateur'
    and r.status <> 'cancelled'
    and (p_session_id is null or r.session_id = p_session_id)
  order by s.scheduled_date desc nulls last, s.number, p.first_name;
$$;

-- Retour après soumission : niveaux de l'évaluation officielle validée (sans commentaire),
-- pour que le formateur compare et s'étalonne. Refusé tant que la cotation n'est pas soumise.
create or replace function public.get_second_rating_feedback(p_rating_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_rating public.calibration_ratings%rowtype;
begin
  select * into v_rating from public.calibration_ratings r where r.id = p_rating_id;
  if not found or v_rating.rater_id is distinct from (select auth.uid()) or private.current_role_code() is distinct from 'formateur' then
    raise exception 'Seconde cotation introuvable.' using errcode = '42501';
  end if;
  if v_rating.status <> 'submitted' then
    raise exception 'Le retour n’est disponible qu’après la soumission de votre cotation.' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'validated', e.id is not null,
      'scores', coalesce((
        select jsonb_object_agg(es.skill_id, es.score) from public.evaluation_scores es where es.evaluation_id = e.id
      ), '{}'::jsonb)
    )
    from (select 1) one
    left join public.evaluations e
      on e.session_id = v_rating.session_id and e.participant_id = v_rating.participant_id and e.status = 'validated'
  );
end;
$$;

-- ── 5. Exercices d'étalonnage (administrateur) ──────────────────────────────
create or replace function public.create_calibration_exercise(
  p_session_id uuid,
  p_title text,
  p_instructions text,
  p_participant_ids uuid[],
  p_rater_ids uuid[]
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_exercise uuid;
  v_participant uuid;
  v_rater uuid;
  v_reason text;
  v_created int := 0;
  v_skipped jsonb := '[]'::jsonb;
begin
  if not private.is_admin() then
    raise exception 'Action réservée aux administrateurs.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.sessions s where s.id = p_session_id) then
    raise exception 'Séance introuvable.' using errcode = 'P0002';
  end if;
  if coalesce(cardinality(p_participant_ids), 0) = 0 or coalesce(cardinality(p_rater_ids), 0) = 0
     or cardinality(p_participant_ids) > 30 or cardinality(p_rater_ids) > 30 then
    raise exception 'Choisissez de 1 à 30 participants et de 1 à 30 formateurs.' using errcode = '22023';
  end if;
  insert into public.calibration_exercises (session_id, title, instructions, created_by)
  values (p_session_id, trim(p_title), nullif(trim(p_instructions), ''), (select auth.uid()))
  returning id into v_exercise;
  foreach v_participant in array (select array_agg(distinct x) from unnest(p_participant_ids) x) loop
    foreach v_rater in array (select array_agg(distinct x) from unnest(p_rater_ids) x) loop
      v_reason := private.second_rating_obstacle(v_rater, p_session_id, v_participant);
      if v_reason is not null then
        v_skipped := v_skipped || jsonb_build_object('participant_id', v_participant, 'rater_id', v_rater, 'reason', v_reason);
      else
        insert into public.calibration_ratings (session_id, participant_id, rater_id, exercise_id, origin, created_by)
        values (p_session_id, v_participant, v_rater, v_exercise, 'exercise', (select auth.uid()));
        v_created := v_created + 1;
      end if;
    end loop;
  end loop;
  if v_created = 0 then
    raise exception 'Aucune cotation n’a pu être attribuée (formateurs non éligibles ou aveugle impossible à garantir).' using errcode = 'P0001';
  end if;
  perform private.audit('calibration.exercise_created', 'calibration_exercise', v_exercise::text, null, null,
    jsonb_build_object('session_id', p_session_id, 'created', v_created, 'skipped', jsonb_array_length(v_skipped)));
  return jsonb_build_object('exercise_id', v_exercise, 'created', v_created, 'skipped', v_skipped);
end;
$$;

-- Clôture : les cotations non soumises sont annulées (elles ne comptent pas).
create or replace function public.close_calibration_exercise(p_exercise_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cancelled int;
begin
  if not private.is_admin() then
    raise exception 'Action réservée aux administrateurs.' using errcode = '42501';
  end if;
  update public.calibration_exercises set status = 'closed', closed_at = now() where id = p_exercise_id and status = 'open';
  if not found then
    raise exception 'Exercice introuvable ou déjà clos.' using errcode = 'P0002';
  end if;
  update public.calibration_ratings set status = 'cancelled' where exercise_id = p_exercise_id and status = 'draft';
  get diagnostics v_cancelled = row_count;
  perform private.audit('calibration.exercise_closed', 'calibration_exercise', p_exercise_id::text, null, null,
    jsonb_build_object('cancelled', v_cancelled));
end;
$$;

create or replace function public.cancel_second_rating(p_rating_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_participant uuid;
begin
  if not private.is_admin() then
    raise exception 'Action réservée aux administrateurs.' using errcode = '42501';
  end if;
  update public.calibration_ratings set status = 'cancelled' where id = p_rating_id and status = 'draft'
  returning participant_id into v_participant;
  if not found then
    raise exception 'Seconde cotation introuvable ou déjà soumise.' using errcode = 'P0002';
  end if;
  perform private.audit('calibration.cancelled', 'calibration_rating', p_rating_id::text, null, v_participant, '{}'::jsonb);
end;
$$;

-- ── 6. Réglages, publication, export ────────────────────────────────────────
create or replace function private.reliability_settings_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  new.updated_at := now();
  perform private.audit('reliability.settings_updated', 'reliability_settings', 'singleton', null, null,
    jsonb_build_object('min_pairs', new.min_pairs, 'previous_min_pairs', old.min_pairs,
      'publish', new.publish, 'previous_publish', old.publish, 'computed_at', new.computed_at));
  return new;
end;
$$;
create trigger reliability_settings_audit before update on public.reliability_settings
  for each row execute function private.reliability_settings_audit();

/** Statistiques d'accord publiées (page « Notre méthode ») ; null si la publication est désactivée. */
create or replace function public.get_public_reliability()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when r.publish and r.snapshot is not null then r.snapshot end
  from public.reliability_settings r where r.id;
$$;

/** Trace l'export anonymisé pour la recherche (administrateur uniquement). */
create or replace function public.log_reliability_export(p_rows int, p_include_demo boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Action réservée aux administrateurs.' using errcode = '42501';
  end if;
  perform private.audit('export.reliability_research_csv', 'reliability', 'export', null, null,
    jsonb_build_object('rows', p_rows, 'include_demo', p_include_demo));
end;
$$;

-- ── 7. Droits ───────────────────────────────────────────────────────────────
revoke all on public.calibration_exercises, public.calibration_ratings, public.calibration_scores, public.reliability_settings
  from anon, authenticated;
grant select on public.calibration_exercises, public.calibration_ratings, public.calibration_scores to authenticated;
grant select, update on public.reliability_settings to authenticated;

alter table public.calibration_exercises enable row level security;
alter table public.calibration_exercises force row level security;
alter table public.calibration_ratings enable row level security;
alter table public.calibration_ratings force row level security;
alter table public.calibration_scores enable row level security;
alter table public.calibration_scores force row level security;
alter table public.reliability_settings enable row level security;
alter table public.reliability_settings force row level security;

-- Une seconde cotation n'est lisible que par son auteur et par l'administrateur : ni le
-- formateur officiel, ni le participant, ni l'organisme ne la voient.
create policy calibration_ratings_select on public.calibration_ratings for select to authenticated
  using ((select private.is_admin()) or (rater_id = (select auth.uid()) and (select private.current_role_code()) = 'formateur'));
create policy calibration_scores_select on public.calibration_scores for select to authenticated
  using ((select private.is_admin()) or private.owns_calibration_rating(rating_id));
create policy calibration_exercises_select on public.calibration_exercises for select to authenticated
  using ((select private.is_admin()) or exists (
    select 1 from public.calibration_ratings r where r.exercise_id = calibration_exercises.id and r.rater_id = (select auth.uid())
  ));
create policy reliability_settings_select on public.reliability_settings for select to authenticated
  using ((select private.is_admin()));
create policy reliability_settings_update on public.reliability_settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

revoke execute on function
  private.calibration_blind(uuid, uuid), private.calibration_blind_participant(uuid), private.owns_calibration_rating(uuid),
  private.official_has_content(uuid, uuid), private.second_rating_obstacle(uuid, uuid, uuid), private.editable_rating(uuid)
  from public, anon;
grant execute on function
  private.calibration_blind(uuid, uuid), private.calibration_blind_participant(uuid), private.owns_calibration_rating(uuid),
  private.official_has_content(uuid, uuid), private.second_rating_obstacle(uuid, uuid, uuid), private.editable_rating(uuid)
  to authenticated, service_role;

revoke execute on function
  public.start_second_rating(uuid), public.save_second_rating(uuid, jsonb, jsonb, text), public.submit_second_rating(uuid),
  public.get_my_second_ratings(uuid), public.get_second_rating_feedback(uuid),
  public.create_calibration_exercise(uuid, text, text, uuid[], uuid[]), public.close_calibration_exercise(uuid),
  public.cancel_second_rating(uuid), public.log_reliability_export(int, boolean)
  from public, anon;
grant execute on function
  public.start_second_rating(uuid), public.save_second_rating(uuid, jsonb, jsonb, text), public.submit_second_rating(uuid),
  public.get_my_second_ratings(uuid), public.get_second_rating_feedback(uuid),
  public.create_calibration_exercise(uuid, text, text, uuid[], uuid[]), public.close_calibration_exercise(uuid),
  public.cancel_second_rating(uuid), public.log_reliability_export(int, boolean)
  to authenticated;
revoke execute on function public.get_public_reliability() from public;
grant execute on function public.get_public_reliability() to anon, authenticated;
