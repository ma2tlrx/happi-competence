-- ════════════════════════════════════════════════════════════════════════════
-- Deux programmes : « HAPPI Compétence » et « Passeport Numérique »
--
-- - programs.kind : type de programme. Le Passeport Numérique est une application d'exercices
--   (src/lib/passeport-numerique) ; il apparaît dans « Programmes » à côté de HAPPI Compétence.
-- - participants.program_kind : programme choisi par la personne à la création de son compte
--   (étape d'inscription). Le programme du groupe, s'il y en a un, prime à l'affichage
--   (src/lib/programmes/kind.ts).
-- ════════════════════════════════════════════════════════════════════════════

alter table public.programs
  add column if not exists kind text not null default 'happi_competence'
  check (kind in ('happi_competence', 'passeport_numerique'));

alter table public.participants
  add column if not exists program_kind text not null default 'happi_competence'
  check (program_kind in ('happi_competence', 'passeport_numerique'));

comment on column public.programs.kind is 'Type de programme : happi_competence (6 sessions évaluées) ou passeport_numerique (application d''exercices).';
comment on column public.participants.program_kind is 'Programme choisi à l''inscription ; le programme du groupe prime à l''affichage.';

-- Le choix fait à l'inscription arrive dans les métadonnées du compte (valeur contrôlée ici : seules
-- les deux valeurs connues sont retenues, tout le reste devient « happi_competence »).
create or replace function private.link_or_create_participant(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_confirmed timestamptz;
  v_account_type text;
  v_is_demo boolean;
  v_program text;
  v_profile public.profiles%rowtype;
  v_invited uuid;
begin
  select lower(u.email), u.email_confirmed_at,
         coalesce(u.raw_user_meta_data ->> 'account_type', 'participant'),
         coalesce((u.raw_app_meta_data ->> 'is_demo')::boolean, false),
         case when u.raw_user_meta_data ->> 'program_kind' = 'passeport_numerique' then 'passeport_numerique' else 'happi_competence' end
    into v_email, v_confirmed, v_account_type, v_is_demo, v_program
  from auth.users u where u.id = p_user_id;
  if not found or v_account_type <> 'participant' or v_email is null then return; end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if not found or v_profile.role <> 'participant' then return; end if;
  if exists (select 1 from public.participants where user_id = p_user_id) then return; end if;

  select id into v_invited from public.participants where email = v_email and user_id is null for update;
  if v_invited is not null then
    -- Une fiche existe déjà pour cette adresse : on attend la preuve de possession de la boîte.
    if v_confirmed is null then return; end if;
    update public.participants
       set user_id = p_user_id,
           status = 'active',
           program_kind = v_program,
           first_name = coalesce(nullif(v_profile.first_name, ''), first_name),
           last_name = coalesce(nullif(v_profile.last_name, ''), last_name)
     where id = v_invited;
    return;
  end if;

  insert into public.participants (user_id, first_name, last_name, email, status, is_demo, program_kind)
  values (
    p_user_id,
    coalesce(nullif(v_profile.first_name, ''), 'Prénom'),
    coalesce(nullif(v_profile.last_name, ''), 'Nom'),
    v_email, 'active', v_is_demo, v_program
  )
  on conflict do nothing;
end;
$$;

-- Le programme « Passeport Numérique », prêt à l'emploi (un seul). Ses ateliers se gèrent dans l'espace
-- animateur de l'application : la trame de sessions de la plateforme reste vide.
insert into public.programs (name, description, sessions_count, session_duration_minutes, status, kind)
select
  'Passeport Numérique',
  'Un atelier ludique pour découvrir le numérique pas à pas, à son rythme : 19 mondes d''exercices (gestes de base, clavier, arnaques, mails, photos, démarches en ligne, intelligence artificielle…), des défis chrono facultatifs et des attestations. Une heure d''exercices, puis une heure d''entraide.',
  1, 120, 'active', 'passeport_numerique'
where not exists (select 1 from public.programs where kind = 'passeport_numerique');
