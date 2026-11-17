-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — module qualité (preuves pour un audit Qualiopi, axe A de
-- docs/audit-strategique.md)
--
-- 1. quality_complaints : réclamations et incidents (déposés depuis l'espace
--    participant ou organisme par submit_quality_complaint, ou saisis par
--    l'administrateur pour ceux reçus par téléphone, e-mail, courrier…).
-- 2. quality_watch_entries : journal de veille.
-- 3. quality_improvement_actions : plan d'amélioration continue, relié à une
--    réclamation, une entrée de veille ou une autre origine.
-- 4. trainer_qualifications : registre des intervenants (diplômes, expériences,
--    formations suivies, dont formation à l'usage de l'IA) ; le formateur tient
--    son propre registre, l'administrateur tous.
-- 5. participant_needs_assessments : analyse du besoin / positionnement à
--    l'entrée. Aucune donnée de santé : seulement « besoin d'adaptation oui/non »
--    et l'adaptation prévue.
-- 6. quality_public_results : instantané des indicateurs publiables (page
--    publique /resultats), désactivé par défaut, lu par get_public_results().
-- 7. Paramètre « quality.training_max_age_months » (24 mois, à valider).
--
-- Toutes les tables sont en RLS forcée ; chaque écriture est tracée dans le
-- journal d'activité par des déclencheurs (sans texte libre).
-- Les correspondances avec les indicateurs du Référentiel national qualité sont
-- indicatives (docs/annexes-strategie/conformite-modele-economique.md §1.2).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Réclamations et incidents ────────────────────────────────────────────
create table public.quality_complaints (
  id              uuid primary key default gen_random_uuid(),
  source          text not null check (source in ('participant', 'prescripteur', 'financeur', 'autre')),
  channel         text not null check (channel in ('espace_en_ligne', 'telephone', 'email', 'courrier', 'entretien', 'autre')),
  received_on     date not null default current_date,
  subject         text not null check (char_length(subject) between 3 and 200),
  description     text not null check (char_length(description) between 1 and 4000),
  reporter_name   text check (reporter_name is null or char_length(reporter_name) <= 200),
  participant_id  uuid references public.participants (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  status          text not null default 'received' check (status in ('received', 'in_progress', 'resolved', 'closed')),
  response        text check (response is null or char_length(response) <= 4000),
  responded_on    date,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint quality_complaints_response_required check (
    status not in ('resolved', 'closed') or (response is not null and responded_on is not null)),
  constraint quality_complaints_dates check (responded_on is null or responded_on >= received_on)
);
comment on table public.quality_complaints is 'Registre des réclamations et incidents (réception, réponse, délai). Preuve possible pour l''audit Qualiopi (critère 7, correspondance indicative).';
comment on column public.quality_complaints.created_by is 'Auteur de la saisie : le participant ou le membre d''organisme qui l''a déposée depuis son espace, ou l''administrateur.';
create index quality_complaints_received_idx on public.quality_complaints (received_on desc);
create index quality_complaints_created_by_idx on public.quality_complaints (created_by);
create index quality_complaints_participant_idx on public.quality_complaints (participant_id);
create index quality_complaints_organization_idx on public.quality_complaints (organization_id);

create or replace function private.quality_complaints_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.subject := btrim(new.subject);
  new.description := btrim(new.description);
  new.reporter_name := nullif(btrim(new.reporter_name), '');
  new.response := nullif(btrim(new.response), '');
  if new.received_on > current_date then
    raise exception 'La date de réception ne peut pas être dans le futur.' using errcode = '22023';
  end if;
  if new.responded_on is not null and new.responded_on > current_date then
    raise exception 'La date de réponse ne peut pas être dans le futur.' using errcode = '22023';
  end if;
  if new.status in ('resolved', 'closed') and (new.response is null or new.responded_on is null) then
    raise exception 'Indiquez la réponse apportée et sa date avant de marquer la réclamation traitée.' using errcode = '22023';
  end if;
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
create trigger quality_complaints_guard before insert or update on public.quality_complaints
  for each row execute function private.quality_complaints_guard();

create or replace function private.quality_complaints_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row public.quality_complaints%rowtype := case when tg_op = 'DELETE' then old else new end;
  v_role text;
begin
  if tg_op = 'INSERT' then
    perform private.audit('quality.complaint_created', 'quality_complaint', v_row.id::text, v_row.organization_id, v_row.participant_id,
      jsonb_build_object('source', new.source, 'channel', new.channel, 'received_on', new.received_on));
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status or new.responded_on is distinct from old.responded_on
       or new.response is distinct from old.response or new.subject is distinct from old.subject
       or new.description is distinct from old.description then
      perform private.audit('quality.complaint_updated', 'quality_complaint', v_row.id::text, v_row.organization_id, v_row.participant_id,
        jsonb_build_object('status', new.status, 'previous_status', old.status, 'responded_on', new.responded_on,
          'response_changed', new.response is distinct from old.response));
    end if;
    -- Réponse apportée : l'auteur (compte participant ou organisme) en est averti dans son espace.
    if new.status in ('resolved', 'closed') and old.status not in ('resolved', 'closed') and new.channel = 'espace_en_ligne' then
      select p.role into v_role from public.profiles p where p.id = new.created_by;
      if v_role in ('participant', 'organisme') then
        perform private.notify(new.created_by, 'quality.complaint_answered', 'Réponse à votre signalement',
          'Votre signalement « ' || left(new.subject, 80) || ' » a reçu une réponse.', '/' || v_role || '/signalements');
      end if;
    end if;
  else
    perform private.audit('quality.complaint_deleted', 'quality_complaint', v_row.id::text, v_row.organization_id, v_row.participant_id,
      jsonb_build_object('status', old.status, 'source', old.source));
  end if;
  return null;
end;
$$;
create trigger quality_complaints_audit after insert or update or delete on public.quality_complaints
  for each row execute function private.quality_complaints_audit();

/**
 * Signalement d'un problème depuis l'espace participant ou organisme. La source, le canal,
 * la date et le rattachement sont déduits du compte : l'appelant ne choisit que l'objet et
 * la description. Au plus 5 signalements par compte sur 24 heures.
 */
create or replace function public.submit_quality_complaint(p_subject text, p_description text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_role text := private.current_role_code();
  v_participant uuid;
  v_org uuid;
  v_source text;
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;
  if v_role = 'participant' then
    v_participant := private.my_participant_id();
    if v_participant is null then
      raise exception 'Votre compte n’est pas encore rattaché à une fiche participant.' using errcode = '42501';
    end if;
    v_org := private.my_participant_org_id();
    v_source := 'participant';
  elsif v_role = 'organisme' then
    v_org := (private.my_organization_ids())[1];
    if v_org is null then
      raise exception 'Votre structure n’est pas encore active.' using errcode = '42501';
    end if;
    v_source := 'prescripteur';
  else
    raise exception 'Seuls les participants et les organismes signalent un problème depuis leur espace.' using errcode = '42501';
  end if;
  if p_subject is null or char_length(btrim(p_subject)) < 3 or char_length(btrim(p_subject)) > 200 then
    raise exception 'L’objet doit compter entre 3 et 200 caractères.' using errcode = '22023';
  end if;
  if p_description is null or char_length(btrim(p_description)) < 10 or char_length(btrim(p_description)) > 4000 then
    raise exception 'La description doit compter entre 10 et 4 000 caractères.' using errcode = '22023';
  end if;
  if (select count(*) from public.quality_complaints c
      where c.created_by = (select auth.uid()) and c.created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Vous avez déjà envoyé plusieurs signalements aujourd’hui. Réessayez demain ou contactez-nous.' using errcode = 'P0001';
  end if;

  insert into public.quality_complaints (source, channel, received_on, subject, description, participant_id, organization_id, status)
  values (v_source, 'espace_en_ligne', current_date, p_subject, p_description, v_participant, v_org, 'received')
  returning id into v_id;
  perform private.notify_admins('quality.complaint_received', 'Nouveau signalement',
    'Un signalement a été déposé depuis un espace ' || case v_source when 'participant' then 'participant' else 'organisme' end || '.',
    '/admin/qualite/reclamations');
  return v_id;
end;
$$;
revoke execute on function public.submit_quality_complaint(text, text) from public, anon;
grant execute on function public.submit_quality_complaint(text, text) to authenticated;

-- ── 2. Veille ───────────────────────────────────────────────────────────────
create table public.quality_watch_entries (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('legale', 'metiers', 'pedagogique', 'handicap')),
  source      text not null check (char_length(source) between 2 and 300),
  observed_on date not null default current_date,
  summary     text not null check (char_length(summary) between 3 and 4000),
  impact      text check (impact is null or char_length(impact) <= 4000),
  decision    text check (decision is null or char_length(decision) <= 2000),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.quality_watch_entries is 'Journal de veille (légale et réglementaire, métiers et emploi, pédagogique et technologique, handicap et accessibilité).';
create index quality_watch_entries_observed_idx on public.quality_watch_entries (observed_on desc);

-- ── 3. Plan d'amélioration continue ─────────────────────────────────────────
create table public.quality_improvement_actions (
  id              uuid primary key default gen_random_uuid(),
  origin          text not null check (origin in ('reclamation', 'satisfaction', 'audit', 'veille', 'retour_formateur', 'autre')),
  origin_details  text check (origin_details is null or char_length(origin_details) <= 300),
  title           text not null check (char_length(title) between 3 and 200),
  description     text check (description is null or char_length(description) <= 4000),
  owner_name      text check (owner_name is null or char_length(owner_name) <= 120),
  due_on          date,
  status          text not null default 'planned' check (status in ('planned', 'in_progress', 'done', 'abandoned')),
  closed_on       date,
  effectiveness   text check (effectiveness is null or char_length(effectiveness) <= 2000),
  complaint_id    uuid references public.quality_complaints (id) on delete set null,
  watch_entry_id  uuid references public.quality_watch_entries (id) on delete set null,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.quality_improvement_actions is 'Plan d''amélioration continue : actions, responsable, échéance, efficacité constatée.';
comment on column public.quality_improvement_actions.closed_on is 'Date de clôture (renseignée automatiquement au passage à « réalisée » ou « abandonnée »).';
create index quality_improvement_actions_status_idx on public.quality_improvement_actions (status, due_on);
create index quality_improvement_actions_complaint_idx on public.quality_improvement_actions (complaint_id);
create index quality_improvement_actions_watch_idx on public.quality_improvement_actions (watch_entry_id);

create or replace function private.quality_improvement_actions_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.title := btrim(new.title);
  new.description := nullif(btrim(new.description), '');
  new.owner_name := nullif(btrim(new.owner_name), '');
  new.origin_details := nullif(btrim(new.origin_details), '');
  new.effectiveness := nullif(btrim(new.effectiveness), '');
  if new.status in ('done', 'abandoned') then
    new.closed_on := coalesce(new.closed_on, current_date);
  else
    new.closed_on := null;
  end if;
  if new.closed_on is not null and new.closed_on > current_date then
    raise exception 'La date de clôture ne peut pas être dans le futur.' using errcode = '22023';
  end if;
  if new.origin = 'reclamation' and new.complaint_id is null then
    raise exception 'Choisissez la réclamation à l’origine de cette action.' using errcode = '22023';
  end if;
  if new.origin = 'veille' and new.watch_entry_id is null then
    raise exception 'Choisissez l’entrée de veille à l’origine de cette action.' using errcode = '22023';
  end if;
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
create trigger quality_improvement_actions_guard before insert or update on public.quality_improvement_actions
  for each row execute function private.quality_improvement_actions_guard();

create or replace function private.quality_watch_entries_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.source := btrim(new.source);
  new.summary := btrim(new.summary);
  new.impact := nullif(btrim(new.impact), '');
  new.decision := nullif(btrim(new.decision), '');
  if new.observed_on > current_date then
    raise exception 'La date ne peut pas être dans le futur.' using errcode = '22023';
  end if;
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
create trigger quality_watch_entries_guard before insert or update on public.quality_watch_entries
  for each row execute function private.quality_watch_entries_guard();

-- Journal générique des registres administratifs (veille, plan d'amélioration) : sans texte libre.
create or replace function private.quality_register_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_id text := case when tg_op = 'DELETE' then old.id::text else new.id::text end;
  v_entity text := tg_argv[0];
  v_meta jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'quality_improvement_actions' then
    v_meta := case when tg_op = 'DELETE'
      then jsonb_build_object('status', old.status, 'origin', old.origin)
      else jsonb_build_object('status', new.status, 'origin', new.origin, 'due_on', new.due_on,
        'previous_status', case when tg_op = 'UPDATE' then old.status end) end;
  elsif tg_table_name = 'quality_watch_entries' then
    v_meta := case when tg_op = 'DELETE' then jsonb_build_object('kind', old.kind)
      else jsonb_build_object('kind', new.kind, 'observed_on', new.observed_on) end;
  end if;
  perform private.audit('quality.' || v_entity || '_' || case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    'quality_' || v_entity, v_id, null, null, v_meta);
  return null;
end;
$$;
create trigger quality_improvement_actions_audit after insert or update or delete on public.quality_improvement_actions
  for each row execute function private.quality_register_audit('action');
create trigger quality_watch_entries_audit after insert or update or delete on public.quality_watch_entries
  for each row execute function private.quality_register_audit('watch');

-- ── 4. Registre des intervenants ────────────────────────────────────────────
create table public.trainer_qualifications (
  id             uuid primary key default gen_random_uuid(),
  trainer_id     uuid not null references public.profiles (id) on delete cascade,
  kind           text not null check (kind in ('diplome', 'qualification', 'experience', 'formation')),
  title          text not null check (char_length(title) between 2 and 200),
  provider       text check (provider is null or char_length(provider) <= 200),
  description    text check (description is null or char_length(description) <= 2000),
  started_on     date,
  completed_on   date,
  is_ai_training boolean not null default false,
  evidence       text check (evidence is null or char_length(evidence) <= 500),
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint trainer_qualifications_dates check (started_on is null or completed_on is null or completed_on >= started_on),
  constraint trainer_qualifications_ai_kind check (not is_ai_training or kind = 'formation')
);
comment on table public.trainer_qualifications is 'Registre des intervenants : diplômes, qualifications, expériences, formations suivies (dont formation à l''usage de l''IA, art. 4 du règlement européen sur l''IA).';
comment on column public.trainer_qualifications.completed_on is 'Date d''obtention (diplôme, qualification) ou de fin (expérience, formation).';
comment on column public.trainer_qualifications.evidence is 'Pièce justificative : référence ou adresse (URL) du document ; aucun fichier n''est stocké.';
create index trainer_qualifications_trainer_idx on public.trainer_qualifications (trainer_id, kind);

create or replace function private.trainer_qualifications_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.trainer_id is distinct from old.trainer_id then
    raise exception 'Une ligne du registre ne peut pas être déplacée vers un autre intervenant.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles p where p.id = new.trainer_id and p.role in ('formateur', 'admin')) then
    raise exception 'Le registre des intervenants ne concerne que les formateurs.' using errcode = '22023';
  end if;
  new.title := btrim(new.title);
  new.provider := nullif(btrim(new.provider), '');
  new.description := nullif(btrim(new.description), '');
  new.evidence := nullif(btrim(new.evidence), '');
  if new.completed_on is not null and new.completed_on > current_date + 366 then
    raise exception 'Date de fin invalide.' using errcode = '22023';
  end if;
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
create trigger trainer_qualifications_guard before insert or update on public.trainer_qualifications
  for each row execute function private.trainer_qualifications_guard();

create or replace function private.trainer_qualifications_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row public.trainer_qualifications%rowtype := case when tg_op = 'DELETE' then old else new end;
begin
  perform private.audit('quality.qualification_' || case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    'profile', v_row.trainer_id::text, null, null,
    jsonb_build_object('qualification_id', v_row.id, 'kind', v_row.kind, 'is_ai_training', v_row.is_ai_training, 'completed_on', v_row.completed_on));
  return null;
end;
$$;
create trigger trainer_qualifications_audit after insert or update or delete on public.trainer_qualifications
  for each row execute function private.trainer_qualifications_audit();

-- ── 5. Analyse du besoin (positionnement à l'entrée) ────────────────────────
create table public.participant_needs_assessments (
  id                  uuid primary key default gen_random_uuid(),
  participant_id      uuid not null unique references public.participants (id) on delete cascade,
  assessed_on         date not null default current_date,
  expectations        text check (expectations is null or char_length(expectations) <= 2000),
  constraints_notes   text check (constraints_notes is null or char_length(constraints_notes) <= 2000),
  prerequisites       text check (prerequisites is null or char_length(prerequisites) <= 2000),
  prerequisites_met   text check (prerequisites_met is null or prerequisites_met in ('oui', 'partiellement', 'non')),
  adaptation_needed   boolean not null default false,
  adaptation_planned  text check (adaptation_planned is null or char_length(adaptation_planned) <= 1000),
  disability_referent text check (disability_referent is null or char_length(disability_referent) <= 200),
  recorded_by         uuid references public.profiles (id) on delete set null,
  recorded_role       text check (recorded_role is null or recorded_role in ('admin', 'formateur', 'organisme')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint participant_needs_adaptation check (not adaptation_needed or adaptation_planned is not null)
);
comment on table public.participant_needs_assessments is 'Analyse du besoin à l''entrée : attentes, contraintes, prérequis, besoin d''adaptation (oui/non + adaptation prévue). Aucune donnée de santé détaillée.';
comment on column public.participant_needs_assessments.adaptation_planned is 'Adaptation prévue (aménagement d''horaires, supports…), jamais la nature d''un handicap ou d''une pathologie.';

create or replace function private.can_read_needs_assessment(p_participant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin()
      or private.trains_participant(p_participant_id)
      or (private.current_role_code() = 'organisme' and private.org_sees_participant(p_participant_id))
      or p_participant_id = private.my_participant_id();
$$;

create or replace function private.can_write_needs_assessment(p_participant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin()
      or (private.current_role_code() = 'formateur' and private.trains_participant(p_participant_id))
      or (private.current_role_code() = 'organisme' and private.org_sees_participant(p_participant_id));
$$;

create or replace function private.participant_needs_assessments_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.participant_id is distinct from old.participant_id then
    raise exception 'Une analyse du besoin ne peut pas être déplacée vers un autre participant.' using errcode = 'P0001';
  end if;
  if new.assessed_on > current_date then
    raise exception 'La date ne peut pas être dans le futur.' using errcode = '22023';
  end if;
  new.expectations := nullif(btrim(new.expectations), '');
  new.constraints_notes := nullif(btrim(new.constraints_notes), '');
  new.prerequisites := nullif(btrim(new.prerequisites), '');
  new.adaptation_planned := nullif(btrim(new.adaptation_planned), '');
  new.disability_referent := nullif(btrim(new.disability_referent), '');
  if not new.adaptation_needed then
    new.adaptation_planned := null;
  elsif new.adaptation_planned is null then
    raise exception 'Décrivez l’adaptation prévue (sans détail médical).' using errcode = '22023';
  end if;
  new.recorded_by := coalesce((select auth.uid()), new.recorded_by);
  new.recorded_role := coalesce(private.current_role_code(), new.recorded_role);
  if new.recorded_role not in ('admin', 'formateur', 'organisme') then
    new.recorded_role := null;
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger participant_needs_assessments_guard before insert or update on public.participant_needs_assessments
  for each row execute function private.participant_needs_assessments_guard();

create or replace function private.participant_needs_assessments_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row public.participant_needs_assessments%rowtype := case when tg_op = 'DELETE' then old else new end;
  v_org uuid;
begin
  select p.organization_id into v_org from public.participants p where p.id = v_row.participant_id;
  perform private.audit('quality.needs_assessment_' || case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    'participant', v_row.participant_id::text, v_org, v_row.participant_id,
    jsonb_build_object('assessed_on', v_row.assessed_on, 'adaptation_needed', v_row.adaptation_needed));
  return null;
end;
$$;
create trigger participant_needs_assessments_audit after insert or update or delete on public.participant_needs_assessments
  for each row execute function private.participant_needs_assessments_audit();

-- ── 6. Résultats publiés (page publique /resultats) ─────────────────────────
create table public.quality_public_results (
  id          boolean primary key default true check (id),
  enabled     boolean not null default false,
  period_from date,
  period_to   date,
  indicators  jsonb not null default '{}'::jsonb check (jsonb_typeof(indicators) = 'object' and pg_column_size(indicators) < 8000),
  computed_at timestamptz,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now(),
  constraint quality_public_results_period check (period_from is null or period_to is null or period_to >= period_from)
);
comment on table public.quality_public_results is 'Instantané des indicateurs de résultats publiés (agrégats seulement, effectif ≥ 10). Désactivé par défaut.';
insert into public.quality_public_results (id, enabled) values (true, false) on conflict (id) do nothing;

create or replace function private.quality_public_results_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    perform private.audit('quality.public_results_updated', 'quality_public_results', 'singleton', null, null,
      jsonb_build_object('enabled', new.enabled, 'previous_enabled', old.enabled,
        'period_from', new.period_from, 'period_to', new.period_to, 'computed_at', new.computed_at));
  end if;
  return new;
end;
$$;
create trigger quality_public_results_audit before update on public.quality_public_results
  for each row execute function private.quality_public_results_audit();

/** Indicateurs publiés, lisibles par le site public ; null si la publication est désactivée. */
create or replace function public.get_public_results()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when r.enabled and r.computed_at is not null then jsonb_build_object(
    'period_from', r.period_from, 'period_to', r.period_to, 'computed_at', r.computed_at, 'indicators', r.indicators)
  end
  from public.quality_public_results r where r.id;
$$;
revoke execute on function public.get_public_results() from public;
grant execute on function public.get_public_results() to anon, authenticated;

/** Trace l'export du dossier de preuves qualité (administrateur uniquement). */
create or replace function public.log_quality_export(p_from date, p_to date)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Action réservée aux administrateurs.' using errcode = '42501';
  end if;
  perform private.audit('export.quality_evidence_pdf', 'quality', 'dossier', null, null,
    jsonb_build_object('from', p_from, 'to', p_to));
end;
$$;
revoke execute on function public.log_quality_export(date, date) from public, anon;
grant execute on function public.log_quality_export(date, date) to authenticated;

-- ── 7. Paramètre ────────────────────────────────────────────────────────────
insert into public.app_settings (key, value, is_public) values ('quality.training_max_age_months', '24', false)
on conflict (key) do nothing;

-- ── RLS ─────────────────────────────────────────────────────────────────────
revoke all on public.quality_complaints, public.quality_watch_entries, public.quality_improvement_actions,
  public.trainer_qualifications, public.participant_needs_assessments, public.quality_public_results from anon, authenticated;
grant select, insert, update, delete on public.quality_complaints, public.quality_watch_entries, public.quality_improvement_actions,
  public.trainer_qualifications, public.participant_needs_assessments to authenticated;
grant select, update on public.quality_public_results to authenticated;

alter table public.quality_complaints enable row level security;
alter table public.quality_complaints force row level security;
alter table public.quality_watch_entries enable row level security;
alter table public.quality_watch_entries force row level security;
alter table public.quality_improvement_actions enable row level security;
alter table public.quality_improvement_actions force row level security;
alter table public.trainer_qualifications enable row level security;
alter table public.trainer_qualifications force row level security;
alter table public.participant_needs_assessments enable row level security;
alter table public.participant_needs_assessments force row level security;
alter table public.quality_public_results enable row level security;
alter table public.quality_public_results force row level security;

-- Réclamations : l'administrateur gère tout ; l'auteur relit les siennes (le dépôt passe par
-- submit_quality_complaint, qui fixe la source et le rattachement).
create policy quality_complaints_select on public.quality_complaints for select to authenticated
  using ((select private.is_admin()) or (created_by = (select auth.uid()) and private.current_role_code() in ('participant', 'organisme')));
create policy quality_complaints_insert on public.quality_complaints for insert to authenticated
  with check ((select private.is_admin()));
create policy quality_complaints_update on public.quality_complaints for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy quality_complaints_delete on public.quality_complaints for delete to authenticated
  using ((select private.is_admin()));

create policy quality_watch_entries_all on public.quality_watch_entries for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy quality_improvement_actions_all on public.quality_improvement_actions for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Registre des intervenants : le formateur tient le sien, l'administrateur tous.
create policy trainer_qualifications_select on public.trainer_qualifications for select to authenticated
  using ((select private.is_admin()) or (trainer_id = (select auth.uid()) and private.current_role_code() = 'formateur'));
create policy trainer_qualifications_insert on public.trainer_qualifications for insert to authenticated
  with check ((select private.is_admin()) or (trainer_id = (select auth.uid()) and private.current_role_code() = 'formateur'));
create policy trainer_qualifications_update on public.trainer_qualifications for update to authenticated
  using ((select private.is_admin()) or (trainer_id = (select auth.uid()) and private.current_role_code() = 'formateur'))
  with check ((select private.is_admin()) or (trainer_id = (select auth.uid()) and private.current_role_code() = 'formateur'));
create policy trainer_qualifications_delete on public.trainer_qualifications for delete to authenticated
  using ((select private.is_admin()) or (trainer_id = (select auth.uid()) and private.current_role_code() = 'formateur'));

create policy participant_needs_assessments_select on public.participant_needs_assessments for select to authenticated
  using (private.can_read_needs_assessment(participant_id));
create policy participant_needs_assessments_insert on public.participant_needs_assessments for insert to authenticated
  with check (private.can_write_needs_assessment(participant_id));
create policy participant_needs_assessments_update on public.participant_needs_assessments for update to authenticated
  using (private.can_write_needs_assessment(participant_id)) with check (private.can_write_needs_assessment(participant_id));
create policy participant_needs_assessments_delete on public.participant_needs_assessments for delete to authenticated
  using ((select private.is_admin()));

create policy quality_public_results_select on public.quality_public_results for select to authenticated
  using ((select private.is_admin()));
create policy quality_public_results_update on public.quality_public_results for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
