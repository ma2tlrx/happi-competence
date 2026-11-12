-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — satisfaction à chaud et à froid, auto-évaluation finale
--
-- 1. Enquêtes de satisfaction versionnées (indicateur Qualiopi 30) :
--    une enquête par destinataire (participant, prescripteur) et par moment
--    (à chaud : fin du programme ; à froid : 90 jours après la fin). Une version
--    brouillon est modifiable ; une version publiée est figée.
--    Les réponses ne s'écrivent que par public.submit_satisfaction_response, qui
--    vérifie le rôle, l'appartenance au groupe et l'ouverture de l'enquête. Les
--    formateurs et organismes ne lisent que des agrégats anonymes
--    (public.satisfaction_results) ; seul l'administrateur voit l'auteur.
-- 2. Auto-évaluation finale : même version de questionnaire que l'initiale,
--    ouverte en fin de parcours, une seule fois, figée une fois terminée.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Enquêtes et versions ────────────────────────────────────────────────────
create table public.satisfaction_surveys (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[a-z_]+$'),
  name        text not null check (char_length(name) between 2 and 160),
  description text check (description is null or char_length(description) <= 1000),
  audience    text not null check (audience in ('participant', 'prescriber')),
  moment      text not null check (moment in ('hot', 'cold')),
  created_at  timestamptz not null default now(),
  unique (audience, moment)
);
comment on table public.satisfaction_surveys is 'Enquêtes de satisfaction : une par destinataire (participant, prescripteur) et par moment (à chaud, à froid).';
comment on column public.satisfaction_surveys.moment is 'hot : dès la fin du programme ; cold : à partir de 90 jours après la fin.';

create table public.satisfaction_survey_versions (
  id             uuid primary key default gen_random_uuid(),
  survey_id      uuid not null references public.satisfaction_surveys (id) on delete cascade,
  version_number int  not null check (version_number >= 1),
  label          text not null check (char_length(label) between 2 and 160),
  status         text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_provisional boolean not null default false,
  intro          text check (intro is null or char_length(intro) <= 2000),
  -- Libellés des cinq niveaux des questions « note de 1 à 5 ».
  rating_labels  text[] not null default array['Pas du tout', 'Peu', 'Moyennement', 'Plutôt', 'Tout à fait']
                 check (cardinality(rating_labels) = 5),
  published_at   timestamptz,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (survey_id, version_number)
);
create unique index satisfaction_versions_single_published
  on public.satisfaction_survey_versions (survey_id) where status = 'published';
create trigger satisfaction_survey_versions_set_updated_at before update on public.satisfaction_survey_versions
  for each row execute function private.set_updated_at();

create table public.satisfaction_questions (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references public.satisfaction_survey_versions (id) on delete cascade,
  position    int  not null default 0,
  kind        text not null check (kind in ('rating', 'choice', 'text', 'nps')),
  text        text not null check (char_length(text) between 2 and 400),
  help        text check (help is null or char_length(help) <= 400),
  options     text[] not null default '{}',
  is_required boolean not null default true,
  is_active   boolean not null default true,
  -- Un choix unique propose au moins deux options ; les autres types n'en ont pas.
  check ((kind = 'choice') = (cardinality(options) >= 2)),
  check (cardinality(options) <= 10)
);
comment on column public.satisfaction_questions.kind is 'rating : note de 1 à 5 ; choice : choix unique ; text : texte libre (1 000 caractères) ; nps : « recommanderiez-vous » de 0 à 10.';
create index satisfaction_questions_version_idx on public.satisfaction_questions (version_id, position);

-- ── Réponses ────────────────────────────────────────────────────────────────
create table public.satisfaction_responses (
  id                uuid primary key default gen_random_uuid(),
  survey_version_id uuid not null references public.satisfaction_survey_versions (id) on delete restrict,
  group_id          uuid not null references public.groups (id) on delete cascade,
  audience          text not null check (audience in ('participant', 'prescriber')),
  moment            text not null check (moment in ('hot', 'cold')),
  -- Compte qui a répondu. Mis à nul si le compte est supprimé : la réponse reste, anonyme.
  respondent_id     uuid references public.profiles (id) on delete set null,
  -- Fiche du participant (destinataire participant) : l'effacement de la fiche emporte la réponse.
  participant_id    uuid references public.participants (id) on delete cascade,
  -- Organisme du prescripteur au moment de la réponse.
  organization_id   uuid references public.organizations (id) on delete set null,
  submitted_at      timestamptz not null default now(),
  check (audience = 'prescriber' or participant_id is not null)
);
comment on table public.satisfaction_responses is 'Réponses aux enquêtes de satisfaction. Écriture par submit_satisfaction_response uniquement ; jamais modifiées.';
create unique index satisfaction_responses_one_per_respondent
  on public.satisfaction_responses (group_id, moment, respondent_id) where respondent_id is not null;
create unique index satisfaction_responses_one_per_participant
  on public.satisfaction_responses (group_id, moment, participant_id) where participant_id is not null;
create index satisfaction_responses_group_idx on public.satisfaction_responses (group_id, audience, moment);
create index satisfaction_responses_respondent_idx on public.satisfaction_responses (respondent_id);

create table public.satisfaction_answers (
  id          uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.satisfaction_responses (id) on delete cascade,
  question_id uuid not null references public.satisfaction_questions (id) on delete restrict,
  value       int check (value is null or value between 0 and 10),
  choice      text check (choice is null or char_length(choice) <= 200),
  text_value  text check (text_value is null or char_length(text_value) <= 1000),
  unique (response_id, question_id),
  check (num_nonnulls(value, choice, text_value) = 1)
);
create index satisfaction_answers_question_idx on public.satisfaction_answers (question_id);

-- ── Garde-fous des versions (même logique que les questionnaires) ───────────
create or replace function private.satisfaction_versions_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' and exists (select 1 from public.satisfaction_surveys s where s.id = old.survey_id) then
      raise exception 'Une enquête publiée ne peut pas être supprimée : archivez-la.' using errcode = 'P0001';
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
    if not exists (select 1 from public.satisfaction_questions q where q.version_id = new.id and q.is_active) then
      raise exception 'Ajoutez au moins une question avant de publier.' using errcode = 'P0001';
    end if;
    update public.satisfaction_survey_versions set status = 'archived'
     where survey_id = new.survey_id and status = 'published' and id <> new.id;
    new.published_at := now();
  elsif old.status <> 'draft' then
    if new.status = 'draft' then
      raise exception 'Une enquête publiée ne peut pas redevenir un brouillon.' using errcode = 'P0001';
    end if;
    if (new.survey_id, new.version_number, new.rating_labels) is distinct from (old.survey_id, old.version_number, old.rating_labels) then
      raise exception 'Cette enquête est publiée : son contenu est figé. Créez une nouvelle version.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger satisfaction_versions_guard before insert or update or delete on public.satisfaction_survey_versions
  for each row execute function private.satisfaction_versions_guard();

create or replace function private.satisfaction_questions_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_version uuid := case when tg_op = 'DELETE' then old.version_id else new.version_id end;
  v_status text;
begin
  select v.status into v_status from public.satisfaction_survey_versions v where v.id = v_version;
  if v_status is null and tg_op = 'DELETE' then return old; end if;
  if v_status is distinct from 'draft' then
    raise exception 'Cette enquête est publiée : ses questions ne peuvent plus être modifiées. Créez une nouvelle version.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.version_id is distinct from old.version_id then
    raise exception 'Une question ne change pas de version.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger satisfaction_questions_guard before insert or update or delete on public.satisfaction_questions
  for each row execute function private.satisfaction_questions_guard();

-- Réponses et détails figés : seules les cascades (suppression d'un groupe, d'une fiche,
-- d'un compte) et l'effacement RGPD explicitement signalé peuvent les toucher.
create or replace function private.satisfaction_frozen()
returns trigger language plpgsql set search_path = '' as $$
begin
  if pg_trigger_depth() > 1 or current_setting('app.erasure', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'Une réponse à une enquête de satisfaction ne se modifie pas.' using errcode = '42501';
end;
$$;
create trigger satisfaction_responses_frozen before update or delete on public.satisfaction_responses
  for each row execute function private.satisfaction_frozen();
create trigger satisfaction_answers_frozen before update or delete on public.satisfaction_answers
  for each row execute function private.satisfaction_frozen();

-- ── Fin de programme et ouverture des enquêtes ──────────────────────────────
-- Fin du programme d'un groupe : la dernière séance (hors séances annulées) est terminée,
-- ou le groupe est marqué terminé. Renvoie la date de fin, nulle tant que le programme court.
-- Règle reproduite dans src/lib/satisfaction/window.ts (affichage) ; la base fait foi.
create or replace function private.group_programme_end(p_group_id uuid)
returns date language sql stable security definer set search_path = '' as $$
  select case
    when l.status = 'completed' then coalesce(l.scheduled_date, (l.completed_at at time zone 'Europe/Paris')::date, g.end_date)
    when g.status = 'completed' then coalesce(g.end_date, l.scheduled_date, (g.updated_at at time zone 'Europe/Paris')::date)
  end
  from public.groups g
  left join lateral (
    select s.status, s.scheduled_date, s.completed_at from public.sessions s
    where s.group_id = g.id and s.status <> 'cancelled'
    order by s.number desc
    limit 1
  ) l on true
  where g.id = p_group_id;
$$;

-- À chaud : de la fin du programme jusqu'à l'ouverture de l'enquête à froid (fin + 90 jours).
-- À froid : à partir de fin + 90 jours.
create or replace function private.satisfaction_is_open(p_group_id uuid, p_moment text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(case p_moment
    when 'hot' then x.end_date is not null and x.today < x.end_date + 90
    when 'cold' then x.end_date is not null and x.today >= x.end_date + 90
    else false
  end, false)
  from (select private.group_programme_end(p_group_id) as end_date, (now() at time zone 'Europe/Paris')::date as today) x;
$$;

-- Résultats d'un groupe : administrateur, formateurs du groupe, membres de l'organisme du groupe.
create or replace function private.can_view_satisfaction(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin()
    or private.trains_group(p_group_id)
    or exists (
      select 1 from public.groups g
      where g.id = p_group_id and g.organization_id = any (private.my_organization_ids())
    );
$$;

-- ── Enquêtes à remplir par l'appelant ───────────────────────────────────────
create or replace function public.my_satisfaction_surveys()
returns table (
  group_id uuid, group_name text, program_name text, audience text, moment text,
  survey_version_id uuid, survey_name text, end_date date, answered boolean
)
language sql stable security definer set search_path = '' as $$
  with candidates as (
    select g.id, 'participant'::text as audience from public.groups g
    where private.current_role_code() = 'participant' and private.member_of_group(g.id)
    union
    select g.id, 'prescriber'::text from public.groups g
    where private.current_role_code() = 'organisme' and g.organization_id = any (private.my_organization_ids())
  )
  select g.id, g.name, p.name, c.audience, m.moment, v.id, s.name, private.group_programme_end(g.id),
         exists (
           select 1 from public.satisfaction_responses r
           where r.group_id = g.id and r.moment = m.moment and r.respondent_id = (select auth.uid())
         )
  from candidates c
  join public.groups g on g.id = c.id
  join public.programs p on p.id = g.program_id
  cross join (values ('hot'), ('cold')) as m (moment)
  join public.satisfaction_surveys s on s.audience = c.audience and s.moment = m.moment
  join public.satisfaction_survey_versions v on v.survey_id = s.id and v.status = 'published'
  where private.satisfaction_is_open(g.id, m.moment)
  order by private.group_programme_end(g.id) desc, g.name, m.moment desc;
$$;

-- ── Réponse (seule porte d'écriture) ────────────────────────────────────────
-- p_answers : objet { "<question_id>": valeur } — nombre pour rating (1–5) et nps (0–10),
-- texte pour choice (une des options) et text (1 000 caractères au plus).
create or replace function public.submit_satisfaction_response(p_group_id uuid, p_moment text, p_answers jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_role text := private.current_role_code();
  v_audience text;
  v_participant uuid;
  v_org uuid;
  v_version uuid;
  v_response uuid;
  v_question record;
  v_raw jsonb;
  v_text text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;
  if p_moment is null or p_moment not in ('hot', 'cold') then
    raise exception 'Moment d’enquête invalide.' using errcode = '22023';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Réponses invalides.' using errcode = '22023';
  end if;

  if v_role = 'participant' then
    v_audience := 'participant';
    v_participant := private.my_participant_id();
    if v_participant is null or not private.member_of_group(p_group_id) then
      raise exception 'Vous ne faites pas partie de ce groupe.' using errcode = '42501';
    end if;
    select p.organization_id into v_org from public.participants p where p.id = v_participant;
  elsif v_role = 'organisme' then
    v_audience := 'prescriber';
    select g.organization_id into v_org from public.groups g
    where g.id = p_group_id and g.organization_id = any (private.my_organization_ids());
    if v_org is null then
      raise exception 'Ce groupe n’est pas suivi par votre structure.' using errcode = '42501';
    end if;
  else
    raise exception 'Seuls les participants et les organismes répondent aux enquêtes de satisfaction.' using errcode = '42501';
  end if;

  if not private.satisfaction_is_open(p_group_id, p_moment) then
    raise exception 'Cette enquête n’est pas ouverte pour ce groupe.' using errcode = 'P0001';
  end if;
  select v.id into v_version
  from public.satisfaction_survey_versions v
  join public.satisfaction_surveys s on s.id = v.survey_id
  where s.audience = v_audience and s.moment = p_moment and v.status = 'published';
  if v_version is null then
    raise exception 'Aucune enquête n’est publiée pour le moment.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.satisfaction_responses r
    where r.group_id = p_group_id and r.moment = p_moment
      and (r.respondent_id = (select auth.uid()) or (v_participant is not null and r.participant_id = v_participant))
  ) then
    raise exception 'Vous avez déjà répondu à cette enquête. Merci !' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_answers) k
    where not exists (select 1 from public.satisfaction_questions q where q.version_id = v_version and q.is_active and q.id::text = k)
  ) then
    raise exception 'Réponse à une question qui ne fait pas partie de l’enquête.' using errcode = '22023';
  end if;

  insert into public.satisfaction_responses (survey_version_id, group_id, audience, moment, respondent_id, participant_id, organization_id)
  values (v_version, p_group_id, v_audience, p_moment, (select auth.uid()), v_participant, v_org)
  returning id into v_response;

  for v_question in
    select q.* from public.satisfaction_questions q where q.version_id = v_version and q.is_active order by q.position
  loop
    v_raw := p_answers -> v_question.id::text;
    if v_raw is null or v_raw = 'null'::jsonb or (jsonb_typeof(v_raw) = 'string' and btrim(v_raw #>> '{}') = '') then
      if v_question.is_required then
        raise exception 'Répondez à la question « % ».', v_question.text using errcode = 'P0001';
      end if;
      continue;
    end if;
    if v_question.kind in ('rating', 'nps') then
      if jsonb_typeof(v_raw) <> 'number' or (v_raw #>> '{}') !~ '^[0-9]{1,2}$'
         or (v_question.kind = 'rating' and (v_raw #>> '{}')::int not between 1 and 5)
         or (v_question.kind = 'nps' and (v_raw #>> '{}')::int not between 0 and 10) then
        raise exception 'Réponse invalide à la question « % ».', v_question.text using errcode = '22023';
      end if;
      insert into public.satisfaction_answers (response_id, question_id, value) values (v_response, v_question.id, (v_raw #>> '{}')::int);
    elsif v_question.kind = 'choice' then
      if jsonb_typeof(v_raw) <> 'string' or not ((v_raw #>> '{}') = any (v_question.options)) then
        raise exception 'Réponse invalide à la question « % ».', v_question.text using errcode = '22023';
      end if;
      insert into public.satisfaction_answers (response_id, question_id, choice) values (v_response, v_question.id, v_raw #>> '{}');
    else
      if jsonb_typeof(v_raw) <> 'string' then
        raise exception 'Réponse invalide à la question « % ».', v_question.text using errcode = '22023';
      end if;
      v_text := btrim(v_raw #>> '{}');
      if char_length(v_text) > 1000 then
        raise exception 'Votre commentaire dépasse 1 000 caractères.' using errcode = '22023';
      end if;
      insert into public.satisfaction_answers (response_id, question_id, text_value) values (v_response, v_question.id, v_text);
    end if;
  end loop;
  return v_response;
end;
$$;

-- ── Résultats ───────────────────────────────────────────────────────────────
-- Seuil d'anonymat des verbatims pour les formateurs et organismes : les commentaires
-- libres ne sont restitués qu'à partir de 3 réponses pour un même groupe, destinataire
-- et moment. L'administrateur voit tout, auteur compris.
create or replace function public.satisfaction_results(p_group_ids uuid[])
returns table (
  group_id uuid, audience text, moment text, survey_version_id uuid, question_id uuid,
  value int, choice text, text_value text, text_hidden boolean,
  response_id uuid, submitted_at timestamptz, respondent text
)
language sql stable security definer set search_path = '' as $$
  with visible as (
    select g.id from public.groups g
    where g.id = any (coalesce(p_group_ids, '{}'::uuid[])) and private.can_view_satisfaction(g.id)
  ), counts as (
    select r.group_id, r.audience, r.moment, count(*) as n
    from public.satisfaction_responses r join visible v on v.id = r.group_id
    group by r.group_id, r.audience, r.moment
  ), me as (select private.is_admin() as admin)
  select r.group_id, r.audience, r.moment, r.survey_version_id, a.question_id, a.value, a.choice,
         case when (select admin from me) or c.n >= 3 then a.text_value end,
         a.text_value is not null and not (select admin from me) and c.n < 3,
         case when (select admin from me) then r.id end,
         case when (select admin from me) then r.submitted_at end,
         case when (select admin from me) then coalesce(nullif(btrim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''), 'Compte supprimé') end
  from public.satisfaction_responses r
  join visible v on v.id = r.group_id
  join counts c on c.group_id = r.group_id and c.audience = r.audience and c.moment = r.moment
  join public.satisfaction_answers a on a.response_id = r.id
  left join public.profiles pr on pr.id = r.respondent_id
  -- Ordre sans lien avec la chronologie : un verbatim ne se rattache pas à un répondant.
  order by r.group_id, a.question_id, md5(a.id::text);
$$;

-- Invités, réponses et ouverture par groupe, destinataire et moment.
-- Invités participants : membres actifs du groupe, plus les répondants qui l'ont quitté depuis.
-- Invités prescripteurs : comptes organisme actifs de la structure du groupe, plus les répondants.
create or replace function public.satisfaction_overview(p_group_ids uuid[])
returns table (group_id uuid, audience text, moment text, invited int, responses int, end_date date, is_open boolean)
language sql stable security definer set search_path = '' as $$
  select g.id, a.audience, m.moment,
    case a.audience
      when 'participant' then (
        select count(*) from (
          select gm.participant_id as who from public.group_members gm where gm.group_id = g.id and gm.status = 'active'
          union
          select r.participant_id from public.satisfaction_responses r
          where r.group_id = g.id and r.audience = 'participant' and r.moment = m.moment and r.participant_id is not null
        ) x)
      else (
        select count(*) from (
          select om.user_id as who from public.organization_members om
          join public.profiles pr on pr.id = om.user_id
          where om.organization_id = g.organization_id and pr.role = 'organisme' and pr.status = 'active'
          union
          select r.respondent_id from public.satisfaction_responses r
          where r.group_id = g.id and r.audience = 'prescriber' and r.moment = m.moment and r.respondent_id is not null
        ) x)
    end::int,
    (select count(*) from public.satisfaction_responses r where r.group_id = g.id and r.audience = a.audience and r.moment = m.moment)::int,
    private.group_programme_end(g.id),
    private.satisfaction_is_open(g.id, m.moment)
  from public.groups g
  cross join (values ('participant'), ('prescriber')) as a (audience)
  cross join (values ('hot'), ('cold')) as m (moment)
  where g.id = any (coalesce(p_group_ids, '{}'::uuid[])) and private.can_view_satisfaction(g.id);
$$;

-- ── Nouvelle version d'enquête (administrateur) ─────────────────────────────
create or replace function public.clone_satisfaction_version(p_source_version_id uuid, p_label text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_src public.satisfaction_survey_versions%rowtype;
  v_new uuid;
  v_next int;
begin
  if not private.is_admin() then
    raise exception 'Seul un administrateur peut créer une version d’enquête.' using errcode = '42501';
  end if;
  select * into v_src from public.satisfaction_survey_versions where id = p_source_version_id;
  if not found then raise exception 'Version introuvable.' using errcode = 'P0002'; end if;
  if exists (select 1 from public.satisfaction_survey_versions v where v.survey_id = v_src.survey_id and v.status = 'draft') then
    raise exception 'Un brouillon existe déjà pour cette enquête.' using errcode = 'P0001';
  end if;
  select coalesce(max(v.version_number), 0) + 1 into v_next
  from public.satisfaction_survey_versions v where v.survey_id = v_src.survey_id;
  insert into public.satisfaction_survey_versions (survey_id, version_number, label, status, is_provisional, intro, rating_labels, created_by)
  values (v_src.survey_id, v_next, coalesce(nullif(btrim(p_label), ''), 'Version ' || v_next), 'draft',
          v_src.is_provisional, v_src.intro, v_src.rating_labels, (select auth.uid()))
  returning id into v_new;
  insert into public.satisfaction_questions (version_id, position, kind, text, help, options, is_required, is_active)
  select v_new, q.position, q.kind, q.text, q.help, q.options, q.is_required, q.is_active
  from public.satisfaction_questions q where q.version_id = v_src.id;
  return v_new;
end;
$$;

-- ── Journal ─────────────────────────────────────────────────────────────────
create or replace function private.satisfaction_responses_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Identifiants uniquement : jamais le contenu des réponses.
  perform private.audit('satisfaction.submitted', 'satisfaction_response', new.id::text, new.organization_id, new.participant_id,
    jsonb_build_object('group_id', new.group_id, 'audience', new.audience, 'moment', new.moment));
  return null;
end;
$$;
create trigger satisfaction_responses_audit after insert on public.satisfaction_responses
  for each row execute function private.satisfaction_responses_audit();

create or replace function private.satisfaction_versions_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.audit('satisfaction.version_created', 'satisfaction_survey_version', new.id::text, null, null,
      jsonb_build_object('version', new.version_number));
  elsif new.status = 'published' and old.status = 'draft' then
    perform private.audit('satisfaction.version_published', 'satisfaction_survey_version', new.id::text, null, null,
      jsonb_build_object('version', new.version_number));
  end if;
  return null;
end;
$$;
create trigger satisfaction_versions_audit after insert or update on public.satisfaction_survey_versions
  for each row execute function private.satisfaction_versions_audit();

-- ── Droits ──────────────────────────────────────────────────────────────────
alter table public.satisfaction_surveys enable row level security;
alter table public.satisfaction_surveys force row level security;
alter table public.satisfaction_survey_versions enable row level security;
alter table public.satisfaction_survey_versions force row level security;
alter table public.satisfaction_questions enable row level security;
alter table public.satisfaction_questions force row level security;
alter table public.satisfaction_responses enable row level security;
alter table public.satisfaction_responses force row level security;
alter table public.satisfaction_answers enable row level security;
alter table public.satisfaction_answers force row level security;

revoke all on public.satisfaction_surveys, public.satisfaction_survey_versions, public.satisfaction_questions,
  public.satisfaction_responses, public.satisfaction_answers from anon, authenticated;
grant select on public.satisfaction_surveys to authenticated;
grant select, insert, update, delete on public.satisfaction_survey_versions, public.satisfaction_questions to authenticated;
-- Réponses : lecture seule (filtrée par RLS) ; l'écriture passe par submit_satisfaction_response.
grant select on public.satisfaction_responses, public.satisfaction_answers to authenticated;

create policy satisfaction_surveys_select on public.satisfaction_surveys for select to authenticated using (true);

create policy satisfaction_versions_select on public.satisfaction_survey_versions for select to authenticated
  using (status <> 'draft' or (select private.is_admin()));
create policy satisfaction_versions_insert on public.satisfaction_survey_versions for insert to authenticated
  with check ((select private.is_admin()));
create policy satisfaction_versions_update on public.satisfaction_survey_versions for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy satisfaction_versions_delete on public.satisfaction_survey_versions for delete to authenticated
  using ((select private.is_admin()));

create or replace function private.satisfaction_version_visible(p_version_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.satisfaction_survey_versions v
    where v.id = p_version_id and (v.status <> 'draft' or private.is_admin())
  );
$$;
create policy satisfaction_questions_select on public.satisfaction_questions for select to authenticated
  using (private.satisfaction_version_visible(version_id));
create policy satisfaction_questions_write on public.satisfaction_questions for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Une réponse brute n'est lisible que par son auteur et l'administrateur.
create policy satisfaction_responses_select on public.satisfaction_responses for select to authenticated
  using (respondent_id = (select auth.uid()) or (select private.is_admin()));

create or replace function private.owns_satisfaction_response(p_response_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.satisfaction_responses r
    where r.id = p_response_id and (r.respondent_id = (select auth.uid()) or private.is_admin())
  );
$$;
create policy satisfaction_answers_select on public.satisfaction_answers for select to authenticated
  using (private.owns_satisfaction_response(response_id));

revoke execute on function public.my_satisfaction_surveys() from public, anon;
revoke execute on function public.submit_satisfaction_response(uuid, text, jsonb) from public, anon;
revoke execute on function public.satisfaction_results(uuid[]) from public, anon;
revoke execute on function public.satisfaction_overview(uuid[]) from public, anon;
revoke execute on function public.clone_satisfaction_version(uuid, text) from public, anon;
grant execute on function public.my_satisfaction_surveys() to authenticated;
grant execute on function public.submit_satisfaction_response(uuid, text, jsonb) to authenticated;
grant execute on function public.satisfaction_results(uuid[]) to authenticated;
grant execute on function public.satisfaction_overview(uuid[]) to authenticated;
grant execute on function public.clone_satisfaction_version(uuid, text) to authenticated;

-- ── Contenu par défaut : provisoire, à valider et modifiable par l'administrateur ──
-- Questions génériques de satisfaction de formation (pas des critères pédagogiques).
do $seed$
declare
  v_survey uuid;
  v_version uuid;
  v_def record;
begin
  for v_def in
    select * from (values
      ('participants_a_chaud', 'Satisfaction des participants — à chaud', 'participant', 'hot',
       'Proposée à chaque participant dès la fin de la dernière séance du groupe.',
       'Quelques questions sur le programme que vous venez de terminer. Vos réponses aident l’équipe à l’améliorer. Les formateurs et votre structure ne voient que des résultats regroupés, jamais votre nom.',
       '[
         {"kind": "rating", "text": "Les objectifs annoncés du programme ont-ils été atteints pour vous ?"},
         {"kind": "rating", "text": "Les explications et les consignes étaient-elles claires ?"},
         {"kind": "rating", "text": "L’animation des séances vous a-t-elle convenu ?"},
         {"kind": "choice", "text": "Le rythme des séances était…", "options": ["Trop lent", "Adapté", "Trop rapide"]},
         {"kind": "rating", "text": "Ce que vous avez vécu pendant le programme vous sera-t-il utile ?"},
         {"kind": "nps", "text": "Recommanderiez-vous ce programme à une personne de votre entourage ?"},
         {"kind": "text", "text": "Un commentaire, une suggestion ?", "required": false}
       ]'::jsonb),
      ('participants_a_froid', 'Satisfaction des participants — à froid (3 mois)', 'participant', 'cold',
       'Proposée à chaque participant à partir de 90 jours après la fin du programme.',
       'Trois mois après la fin du programme, nous aimerions savoir ce que vous en retenez. Les formateurs et votre structure ne voient que des résultats regroupés, jamais votre nom.',
       '[
         {"kind": "rating", "text": "Avec le recul, le programme vous a-t-il été utile ?"},
         {"kind": "rating", "text": "Vous arrive-t-il d’utiliser ce que vous avez travaillé pendant le programme ?"},
         {"kind": "nps", "text": "Recommanderiez-vous ce programme à une personne de votre entourage ?"},
         {"kind": "text", "text": "Un commentaire, une suggestion ?", "required": false}
       ]'::jsonb),
      ('prescripteurs_a_chaud', 'Satisfaction des prescripteurs — à chaud', 'prescriber', 'hot',
       'Proposée aux comptes de la structure du groupe dès la fin de la dernière séance.',
       'Votre avis sur le programme suivi par les personnes que vous avez orientées.',
       '[
         {"kind": "rating", "text": "Le programme a-t-il répondu à vos attentes pour les personnes orientées ?"},
         {"kind": "rating", "text": "Les informations de suivi (présences, évaluations, bilans) vous ont-elles été utiles ?"},
         {"kind": "rating", "text": "Les échanges avec l’équipe HAPPI ont-ils été satisfaisants ?"},
         {"kind": "nps", "text": "Recommanderiez-vous ce programme à une autre structure ?"},
         {"kind": "text", "text": "Un commentaire, une suggestion ?", "required": false}
       ]'::jsonb),
      ('prescripteurs_a_froid', 'Satisfaction des prescripteurs — à froid (3 mois)', 'prescriber', 'cold',
       'Proposée aux comptes de la structure du groupe à partir de 90 jours après la fin du programme.',
       'Trois mois après la fin du programme, votre regard sur ce qu’il a apporté aux personnes orientées.',
       '[
         {"kind": "rating", "text": "Avec le recul, le programme a-t-il été utile aux personnes orientées ?"},
         {"kind": "nps", "text": "Recommanderiez-vous ce programme à une autre structure ?"},
         {"kind": "text", "text": "Un commentaire, une suggestion ?", "required": false}
       ]'::jsonb)
    ) as t (code, name, audience, moment, description, intro, questions)
  loop
    insert into public.satisfaction_surveys (code, name, audience, moment, description)
    values (v_def.code, v_def.name, v_def.audience, v_def.moment, v_def.description)
    returning id into v_survey;
    insert into public.satisfaction_survey_versions (survey_id, version_number, label, status, is_provisional, intro)
    values (v_survey, 1, 'Provisoire — à valider', 'draft', true, v_def.intro)
    returning id into v_version;
    insert into public.satisfaction_questions (version_id, position, kind, text, options, is_required)
    select v_version, q.ordinality::int, q.value ->> 'kind', q.value ->> 'text',
           coalesce(array(select jsonb_array_elements_text(q.value -> 'options')), '{}'),
           coalesce((q.value ->> 'required')::boolean, true)
    from jsonb_array_elements(v_def.questions) with ordinality as q (value, ordinality);
    update public.satisfaction_survey_versions set status = 'published' where id = v_version;
  end loop;
end
$seed$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Auto-évaluation finale
-- ════════════════════════════════════════════════════════════════════════════
-- Ouverte quand le parcours du participant arrive à son terme : groupe actif terminé,
-- dernière séance (hors annulées) terminée, ou séance 6 commencée ou terminée.
-- Règle reproduite dans src/lib/evolution.ts (affichage) ; la base fait foi.
create or replace function private.final_self_assessment_open(p_participant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.participant_id = p_participant_id and gm.status = 'active'
      and (
        g.status = 'completed'
        or exists (
          select 1 from public.sessions s
          where s.group_id = g.id and s.number >= 6 and s.status in ('in_progress', 'completed')
        )
        or (
          select s.status from public.sessions s
          where s.group_id = g.id and s.status <> 'cancelled'
          order by s.number desc limit 1
        ) = 'completed'
      )
  );
$$;

-- Garde-fou des auto-évaluations, étendu à l'auto-évaluation finale. Inchangé pour
-- l'initiale et l'intermédiaire.
create or replace function private.self_assessments_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_missing int;
  v_initial_version uuid;
begin
  if tg_op = 'INSERT' then
    if new.kind = 'final' then
      if (select auth.uid()) is not null and not private.is_admin() then
        select sa.questionnaire_version_id into v_initial_version
        from public.self_assessments sa
        where sa.participant_id = new.participant_id and sa.kind = 'initial' and sa.status = 'completed'
        order by sa.completed_at desc limit 1;
        if v_initial_version is null then
          raise exception 'L’auto-évaluation finale s’ouvre après l’auto-évaluation initiale.' using errcode = 'P0001';
        end if;
        if new.questionnaire_version_id is distinct from v_initial_version then
          raise exception 'L’auto-évaluation finale reprend le questionnaire de l’auto-évaluation initiale.' using errcode = 'P0001';
        end if;
        if not private.final_self_assessment_open(new.participant_id) then
          raise exception 'L’auto-évaluation finale s’ouvre à la fin de votre parcours.' using errcode = 'P0001';
        end if;
      end if;
      if exists (select 1 from public.self_assessments sa where sa.participant_id = new.participant_id and sa.kind = 'final') then
        raise exception 'L’auto-évaluation finale a déjà été ouverte.' using errcode = 'P0001';
      end if;
    elsif not exists (select 1 from public.questionnaire_versions v where v.id = new.questionnaire_version_id and v.status = 'published')
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

-- Le participant sait si son auto-évaluation finale est ouverte (sans lire les séances d'autres groupes).
create or replace function public.my_final_self_assessment_open()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.final_self_assessment_open(private.my_participant_id()), false);
$$;
revoke execute on function public.my_final_self_assessment_open() from public, anon;
grant execute on function public.my_final_self_assessment_open() to authenticated;

-- Fonctions d'aide appelées par les politiques : exécutables par les utilisateurs connectés.
grant execute on function private.group_programme_end(uuid) to authenticated, service_role;
grant execute on function private.satisfaction_is_open(uuid, text) to authenticated, service_role;
grant execute on function private.can_view_satisfaction(uuid) to authenticated, service_role;
grant execute on function private.satisfaction_version_visible(uuid) to authenticated, service_role;
grant execute on function private.owns_satisfaction_response(uuid) to authenticated, service_role;
grant execute on function private.final_self_assessment_open(uuid) to authenticated, service_role;
