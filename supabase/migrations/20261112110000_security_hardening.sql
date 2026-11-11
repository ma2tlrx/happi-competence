-- ════════════════════════════════════════════════════════════════════════════
-- Durcissements issus de l'audit de sécurité
-- 1. add_participant_to_group : l'ajout par e-mail d'une fiche existante exige les
--    mêmes droits que l'ajout par identifiant (auparavant, connaître l'e-mail
--    suffisait pour s'ouvrir l'accès à la fiche d'un participant suivi ailleurs).
-- 2. is_unassigned : l'annuaire des participants sans groupe est cloisonné entre
--    comptes de démonstration et comptes réels.
-- 3. participant_reports : RLS forcée, comme pour les autres tables.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.add_participant_to_group(
  p_group_id uuid,
  p_participant_id uuid default null,
  p_first_name text default null,
  p_last_name text default null,
  p_email text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_group public.groups%rowtype;
  v_participant public.participants%rowtype;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_created boolean := false;
begin
  if not (private.has_permission('groups.manage') and (private.is_admin() or private.trains_group(p_group_id))) then
    raise exception 'Vous n’êtes pas autorisé à modifier ce groupe.' using errcode = '42501';
  end if;
  select * into v_group from public.groups where id = p_group_id;
  if not found then raise exception 'Groupe introuvable.' using errcode = 'P0002'; end if;

  if p_participant_id is not null then
    select * into v_participant from public.participants where id = p_participant_id;
    if not found then raise exception 'Participant introuvable.' using errcode = 'P0002'; end if;
    if not (private.is_admin() or private.trains_participant(p_participant_id)
            or (private.has_permission('participants.directory') and private.is_unassigned(p_participant_id))) then
      raise exception 'Vous n’avez pas accès à ce participant.' using errcode = '42501';
    end if;
  else
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
      raise exception 'Adresse e-mail invalide.' using errcode = '22023';
    end if;
    select * into v_participant from public.participants where email = v_email;
    if found then
      -- Même contrôle que pour un ajout par identifiant : connaître l'e-mail ne donne aucun accès.
      if not (private.is_admin() or private.trains_participant(v_participant.id)
              or (private.has_permission('participants.directory') and private.is_unassigned(v_participant.id))) then
        raise exception 'Cette adresse correspond à un participant suivi par une autre équipe. Demandez à un administrateur de l’ajouter au groupe.' using errcode = '42501';
      end if;
    else
      if nullif(trim(p_first_name), '') is null or nullif(trim(p_last_name), '') is null then
        raise exception 'Indiquez le prénom et le nom du participant.' using errcode = '22023';
      end if;
      insert into public.participants (first_name, last_name, email, status, invited_by, organization_id, is_demo)
      values (left(trim(p_first_name), 80), left(trim(p_last_name), 80), v_email, 'invited', (select auth.uid()), v_group.organization_id, v_group.is_demo)
      returning * into v_participant;
      v_created := true;
    end if;
  end if;

  -- Sans rattachement, le participant rejoint l'organisme du groupe.
  if v_participant.organization_id is null and v_group.organization_id is not null then
    update public.participants set organization_id = v_group.organization_id where id = v_participant.id
    returning * into v_participant;
  end if;

  insert into public.group_members (group_id, participant_id, status, added_by)
  values (p_group_id, v_participant.id, 'active', (select auth.uid()))
  on conflict (group_id, participant_id)
  do update set status = 'active', left_at = null, added_by = excluded.added_by;

  return jsonb_build_object(
    'participant_id', v_participant.id,
    'created', v_created,
    'has_account', v_participant.user_id is not null,
    'other_organization', v_group.organization_id is not null and v_participant.organization_id is distinct from v_group.organization_id
  );
end;
$$;


create or replace function private.is_unassigned(p_participant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.group_members gm
    where gm.participant_id = p_participant_id and gm.status = 'active'
  )
  -- Un compte de démonstration ne voit que des fiches de démonstration, et inversement.
  and coalesce((select p.is_demo from public.participants p where p.id = p_participant_id), false)
      = coalesce((select pr.is_demo from public.profiles pr where pr.id = (select auth.uid())), false);
$$;

alter table public.participant_reports force row level security;

-- 4. Droit d'accès (RGPD) : le participant lit l'historique de ses propres rattachements.
create policy participant_org_history_select_own on public.participant_organization_history for select to authenticated
  using (participant_id = (select private.my_participant_id()));
