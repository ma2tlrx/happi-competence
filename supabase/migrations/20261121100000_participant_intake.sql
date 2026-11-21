-- ════════════════════════════════════════════════════════════════════════════
-- Questionnaire d'accueil du participant (« Formulaire HaPPi », repris de l'ancien outil formateur.happicompetence.fr)
--
-- Étapes 1 à 5 de l'ancien formulaire : informations personnelles, parcours scolaire, bénévolat et
-- expériences, ambitions professionnelles, aptitudes personnelles. L'étape 6 (les 15 affirmations) est
-- l'auto-évaluation déjà en place (questionnaire_versions « reprise de l'ancien formulaire »).
--
-- Une ligne par participant, écrite par lui seul. Lecture : lui-même, ses formateurs, l'administration.
-- L'organisme n'y a pas accès. Le téléphone reste dans participants.phone (déjà modifiable par la personne).
-- Les codes et leurs libellés (mot pour mot ceux de l'ancien formulaire) sont dans src/lib/intake/codes.ts.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.participant_intakes (
  participant_id uuid primary key references public.participants (id) on delete cascade,
  -- Étape 1 : informations personnelles
  age_band text check (age_band in ('15_17', '18_21', '22_24', '25_plus')),
  situation text check (situation in ('lyceen', 'etudiant', 'formation', 'demandeur_emploi', 'salarie', 'autre')),
  residence text check (residence in ('beziers', 'villages_alentours', 'autre_ville')),
  residence_detail text check (char_length(residence_detail) <= 120),
  -- Étape 2 : parcours académique
  study_level text check (study_level in (
    'sans_diplome', 'cap', 'bep', 'bac_general', 'bac_techno', 'bac_pro', 'daeu', 'bac_2', 'licence', 'maitrise', 'master', 'doctorat', 'autre'
  )),
  study_field text check (char_length(study_field) <= 200),
  school text check (char_length(school) <= 200),
  -- Étape 3 : bénévolat et expériences
  volunteering text check (volunteering in ('regulier', 'ponctuel', 'jamais')),
  volunteering_fields text[] not null default '{}' check (volunteering_fields <@ array[
    'sport_loisirs', 'education_formation', 'social_humanitaire', 'culture_art', 'environnement', 'sante',
    'associatif_citoyen', 'autre'
  ]::text[]),
  experience text check (experience in ('meme_domaine', 'autre_domaine', 'aucune')),
  experience_detail text check (char_length(experience_detail) <= 1000),
  -- Étape 4 : ambitions professionnelles
  sectors text[] not null default '{}' check (sectors <@ array[
    'commerce_vente', 'informatique_numerique', 'sante_social', 'securite_defense', 'art_design', 'hotellerie_restauration',
    'btp_artisanat', 'sport_animation', 'finance_gestion', 'education_formation', 'transport_logistique', 'industrie_production', 'autre'
  ]::text[]),
  ambitions text check (char_length(ambitions) <= 1000),
  two_year_plan text check (two_year_plan in ('emploi', 'etudes', 'creation', 'alternance', 'ne_sait_pas')),
  -- Étape 5 : aptitudes personnelles (1 = très faible, 5 = excellent), facultatives
  aptitude_punctuality smallint check (aptitude_punctuality between 1 and 5),
  aptitude_motivation smallint check (aptitude_motivation between 1 and 5),
  aptitude_communication smallint check (aptitude_communication between 1 and 5),
  aptitude_initiative smallint check (aptitude_initiative between 1 and 5),
  -- Avancement : dernière étape enregistrée, fin du questionnaire
  last_step smallint not null default 0 check (last_step between 0 and 5),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.participant_intakes is
  'Questionnaire d''accueil (étapes 1 à 5 du « Formulaire HaPPi »). Écrit par le participant, lu par lui, ses formateurs et l''administration.';

drop trigger if exists participant_intakes_set_updated_at on public.participant_intakes;
create trigger participant_intakes_set_updated_at before update on public.participant_intakes
  for each row execute function private.set_updated_at();

alter table public.participant_intakes enable row level security;
alter table public.participant_intakes force row level security;

drop policy if exists participant_intakes_select on public.participant_intakes;
create policy participant_intakes_select on public.participant_intakes for select to authenticated using (
  participant_id = (select private.my_participant_id())
  or (select private.is_admin())
  or private.trains_participant(participant_id)
);

drop policy if exists participant_intakes_insert on public.participant_intakes;
create policy participant_intakes_insert on public.participant_intakes for insert to authenticated
  with check (participant_id = (select private.my_participant_id()));

drop policy if exists participant_intakes_update on public.participant_intakes;
create policy participant_intakes_update on public.participant_intakes for update to authenticated
  using (participant_id = (select private.my_participant_id()))
  with check (participant_id = (select private.my_participant_id()));

drop policy if exists participant_intakes_delete on public.participant_intakes;
create policy participant_intakes_delete on public.participant_intakes for delete to authenticated
  using ((select private.is_admin()));

grant select, insert, update on public.participant_intakes to authenticated;
grant delete on public.participant_intakes to authenticated;

-- Journal : seulement le fait que le questionnaire est terminé (jamais les réponses).
create or replace function private.participant_intakes_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.completed_at is not null and (tg_op = 'INSERT' or old.completed_at is null) then
    perform private.audit('participant_intake.completed', 'participant', new.participant_id::text, null, new.participant_id);
  end if;
  return null;
end;
$$;

drop trigger if exists participant_intakes_audit on public.participant_intakes;
create trigger participant_intakes_audit after insert or update on public.participant_intakes
  for each row execute function private.participant_intakes_audit();
