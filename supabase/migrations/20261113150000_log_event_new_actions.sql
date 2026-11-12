-- Nouvelles actions journalisables : exports d'émargement, de certificat, d'impact et de satisfaction,
-- réinitialisation de la double authentification par un administrateur.
create or replace function public.log_event(
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_participant uuid;
  v_org uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;
  if p_action not in (
    'participant_file.viewed', 'export.passport_pdf', 'export.attendance_pdf', 'export.attendance_csv',
    'export.participants_csv', 'export.personal_data', 'auth.signed_in', 'auth.password_changed', 'export.report_pdf',
    'demo.created', 'demo.deleted', 'demo.space_opened',
    'export.signature_sheet_pdf', 'export.certificate_pdf', 'export.impact_csv', 'export.satisfaction_csv', 'auth.mfa_reset'
  ) then
    raise exception 'Action non journalisable.' using errcode = '22023';
  end if;
  -- Les actions de démonstration sont réservées aux administrateurs.
  if (p_action like 'demo.%' or p_action = 'auth.mfa_reset') and not private.is_admin() then
    raise exception 'Action réservée aux administrateurs.' using errcode = '42501';
  end if;
  if p_entity_type = 'participant' and p_entity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_participant := p_entity_id::uuid;
    select p.organization_id into v_org from public.participants p where p.id = v_participant;
  end if;
  perform private.audit(p_action, left(p_entity_type, 40), left(p_entity_id, 80), v_org, v_participant,
    case when pg_column_size(coalesce(p_metadata, '{}'::jsonb)) > 1500 then '{}'::jsonb else coalesce(p_metadata, '{}'::jsonb) end);
end;
$$;
