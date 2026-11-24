-- ════════════════════════════════════════════════════════════════════════════
-- REMISE À ZÉRO DES DONNÉES (démonstration, essais, participants, organismes…)
--
-- À coller dans Supabase › SQL Editor, puis « Run ». IRRÉVERSIBLE.
--
-- Conservé :
--   · votre compte administrateur (adresse indiquée ci-dessous) ;
--   · les programmes (HAPPI Compétence, Passeport Numérique), leurs sessions-types, les référentiels de
--     compétences, les questionnaires, les paramètres du site, les fiches métiers ROME, les droits des rôles.
-- Supprimé :
--   · tous les autres comptes (formateurs, organismes, participants, comptes de démonstration) ;
--   · participants et leurs données (évaluations, présences, questionnaires, bilans, partages, badges) ;
--   · groupes, sessions, organismes, financeurs et conventions, orientations ;
--   · messages de contact, demandes RGPD, courriels en file, notifications, codes d'accès ;
--   · parties de jeux, réponses de satisfaction, journal d'activité (donc compteurs du tableau de bord).
--
-- Tout se fait dans un seul bloc : en cas d'erreur, RIEN n'est supprimé.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_keep_email constant text := 'm.loriaux@happicompetence.fr';   -- ← votre adresse administrateur
  v_keep uuid;
begin
  select u.id into v_keep from auth.users u where lower(u.email) = lower(v_keep_email);
  if v_keep is null then
    raise exception 'Compte % introuvable : arrêt, rien n''a été supprimé.', v_keep_email;
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_keep and p.role = 'admin') then
    raise exception 'Le compte % n''est pas administrateur : arrêt, rien n''a été supprimé.', v_keep_email;
  end if;

  -- Effacement signalé : les tables « en ajout seul » acceptent d'être vidées par cascade.
  perform set_config('app.erasure', 'on', true);

  -- Personnes et leurs données (cascade : évaluations, présences, questionnaires, bilans, partages…).
  delete from public.participants;
  -- Groupes (cascade : sessions, membres, formateurs, présences, conventions liées…).
  delete from public.groups;
  delete from public.organizations;

  -- Financements.
  delete from public.funding_conventions;
  delete from public.funders;

  -- Orientations, messages, demandes, notifications, courriels.
  delete from public.referrals;
  delete from public.contact_messages;
  delete from public.data_requests;
  delete from public.email_outbox;
  delete from public.notifications;
  delete from public.passport_shares;
  delete from public.badge_assertions;

  -- Jeux, satisfaction, étalonnage, qualité.
  delete from public.game_sessions;
  delete from public.game_results;
  delete from public.satisfaction_responses;
  delete from public.calibration_ratings;
  delete from public.calibration_scores;
  delete from public.quality_complaints;
  delete from public.quality_improvement_actions;

  -- Codes d'accès non utilisés.
  delete from public.invitation_codes;

  -- Tous les comptes, sauf le vôtre (les profils suivent par cascade).
  delete from auth.users where id <> v_keep;

  -- Journal d'activité (ajout seul : seul TRUNCATE le vide) : remet à zéro « connexions » et « activité récente ».
  truncate table public.audit_logs;
end $$;

-- Contrôle : tout doit être à 0, sauf 1 compte et 1 profil.
select
  (select count(*) from auth.users)          as comptes,
  (select count(*) from public.profiles)     as profils,
  (select count(*) from public.participants) as participants,
  (select count(*) from public.organizations) as organismes,
  (select count(*) from public.groups)       as groupes,
  (select count(*) from public.sessions)     as sessions,
  (select count(*) from public.programs)     as programmes_conserves;
