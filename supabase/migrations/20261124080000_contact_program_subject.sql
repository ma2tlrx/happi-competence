-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — formulaire de contact : programme concerné et objet du message
--
-- Le formulaire demande maintenant à quel programme la demande se rapporte (HAPPI Compétence,
-- Passeport Numérique, les deux, ou pas de programme précis) et pourquoi la personne écrit (objet).
-- Colonnes facultatives pour les anciens messages. La fonction d'enregistrement reçoit les deux
-- nouveaux paramètres ; l'ancienne signature est retirée (un seul point d'entrée, serveur seulement).
-- Rejouable.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.contact_messages add column if not exists program text;
alter table public.contact_messages add column if not exists subject text;
alter table public.contact_messages drop constraint if exists contact_messages_program_check;
alter table public.contact_messages add constraint contact_messages_program_check
  check (program is null or program in ('happi_competence', 'passeport_numerique', 'les_deux', 'autre'));
alter table public.contact_messages drop constraint if exists contact_messages_subject_check;
alter table public.contact_messages add constraint contact_messages_subject_check
  check (subject is null or char_length(subject) between 2 and 160);
comment on column public.contact_messages.program is 'Programme concerné : happi_competence, passeport_numerique, les_deux ou autre (facultatif).';
comment on column public.contact_messages.subject is 'Objet du message : pourquoi la personne nous contacte (texte libre court).';

drop function if exists public.submit_contact_message(text, text, text, text, text, text);
create or replace function public.submit_contact_message(
  p_name text,
  p_email text,
  p_organization text,
  p_audience text,
  p_message text,
  p_origin_hash text,
  p_program text default '',
  p_subject text default ''
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if p_origin_hash is not null and (
    select count(*) from public.contact_messages m
    where m.origin_hash = p_origin_hash and m.created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  if (select count(*) from public.contact_messages m where m.created_at > now() - interval '1 day') >= 300 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  insert into public.contact_messages (name, email, organization, audience, message, origin_hash, program, subject)
  values (trim(p_name), lower(trim(p_email)), nullif(trim(p_organization), ''), nullif(p_audience, ''), trim(p_message), p_origin_hash,
          nullif(p_program, ''), nullif(trim(p_subject), ''))
  returning id into v_id;
  perform private.notify_admins('contact.message', 'Nouveau message de contact',
    'Un message a été envoyé depuis le site.', '/admin/parametres');
  return v_id;
end;
$$;

revoke all on function public.submit_contact_message(text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_contact_message(text, text, text, text, text, text, text, text) to service_role;
