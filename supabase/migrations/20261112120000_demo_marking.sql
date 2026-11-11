-- ════════════════════════════════════════════════════════════════════════════
-- Démonstration : tout ce qu'un compte de démonstration crée est marqué « démo »,
-- pour que la suppression de la démonstration emporte bien ces données et ne
-- laisse aucune trace mêlée aux données réelles.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function private.mark_demo_from_author()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select p.is_demo from public.profiles p where p.id = (select auth.uid())), false) then
    new.is_demo := true;
  end if;
  return new;
end;
$$;

create trigger groups_mark_demo before insert on public.groups
  for each row execute function private.mark_demo_from_author();
create trigger participants_mark_demo before insert on public.participants
  for each row execute function private.mark_demo_from_author();
create trigger organizations_mark_demo before insert on public.organizations
  for each row execute function private.mark_demo_from_author();
