-- Catalogue public : expose, pour chaque compétence, les sessions du programme
-- où elle est mobilisée (table session_skill_map de la version publiée).
-- Utilisé par la constellation animée du site vitrine.

create or replace function public.get_public_catalog()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'program', (
      select jsonb_build_object(
        'name', p.name, 'description', p.description,
        'sessions_count', p.sessions_count, 'session_duration_minutes', p.session_duration_minutes,
        'min_group_size', p.min_group_size, 'max_group_size', p.max_group_size,
        'sessions', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'number', ps.number, 'title', ps.title, 'summary', ps.summary, 'is_provisional', ps.is_provisional
          ) order by ps.number), '[]'::jsonb)
          from public.program_sessions ps where ps.program_id = p.id
        )
      )
      from public.programs p where p.is_public and p.status = 'active' limit 1
    ),
    'frameworks', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'code', f.code, 'name', f.name, 'short_name', f.short_name, 'description', f.description,
        'scale_min', v.scale_min, 'scale_max', v.scale_max, 'is_provisional', v.is_provisional,
        'levels', (
          select coalesce(jsonb_agg(jsonb_build_object('value', l.value, 'label', l.label) order by l.value), '[]'::jsonb)
          from public.scale_levels l where l.version_id = v.id
        ),
        'categories', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'code', c.code, 'name', c.name, 'description', c.description,
            'skills', (
              select coalesce(jsonb_agg(jsonb_build_object(
                'code', s.code, 'name', s.name, 'description', s.description,
                'sessions', (
                  select coalesce(jsonb_agg(distinct m.session_number), '[]'::jsonb)
                  from public.session_skill_map m where m.skill_id = s.id and m.version_id = v.id
                )
              ) order by s.position), '[]'::jsonb)
              from public.skills s where s.category_id = c.id and s.is_active
            )
          ) order by c.position), '[]'::jsonb)
          from public.skill_categories c where c.version_id = v.id
        )
      ) order by f.position), '[]'::jsonb)
      from public.programs p
      join public.program_frameworks pf on pf.program_id = p.id
      join public.framework_versions v on v.id = pf.framework_version_id and v.status = 'published'
      join public.frameworks f on f.id = v.framework_id
      where p.is_public and p.status = 'active'
    ),
    'settings', (
      select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb) from public.app_settings s where s.is_public
    )
  );
$$;
