-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — référentiel ROME structuré, pour les pistes métiers du bilan
--
-- Les pistes métiers (src/lib/career-paths, docs/pistes-metiers.md) rapprochent les
-- points d'appui d'un participant des savoir-être attendus dans les fiches métiers de
-- France Travail. Il leur faut l'arborescence du ROME sous forme exploitable :
--
-- 1. rome_domains : 14 grands domaines (code « K ») et 110 domaines professionnels
--    (code « K12 », parent « K »), libellés officiels.
-- 2. rome_fiches : 1 923 fiches (code « K1206 »), leur domaine professionnel et leurs
--    appellations officielles (le fichier ne donne pas d'intitulé de fiche).
-- 3. rome_fiche_savoir_etre : pour chaque savoir-être professionnel (6D101 à 6D116),
--    les fiches qui le mobilisent (colonne « Liste des fiches ROME mobilisant l'objet »
--    du fichier « arborescence simplifiée des compétences », version 26M10).
--
-- Données de référence publiques, sans donnée personnelle. Alimentées par
-- scripts/rome/build-reference-sql.py à partir des fichiers officiels (hors dépôt) ;
-- aucune valeur n'est saisie ici. Lecture : comptes connectés. Écriture : aucune
-- (clé de service ou migration seulement).
--
-- Rejouable : chaque instruction peut être exécutée une seconde fois sans erreur.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.rome_domains (
  code        text primary key check (code ~ '^[A-N]([0-9]{2})?$'),
  parent_code text references public.rome_domains (code) on delete cascade,
  label       text not null check (char_length(label) between 2 and 300),
  check ((char_length(code) = 1 and parent_code is null) or (char_length(code) = 3 and parent_code = left(code, 1)))
);
comment on table public.rome_domains is 'ROME : grands domaines (1 lettre) et domaines professionnels (lettre + 2 chiffres), libellés officiels de France Travail.';

create table if not exists public.rome_fiches (
  code           text primary key check (code ~ '^[A-N][0-9]{4}$'),
  subdomain_code text not null references public.rome_domains (code) on delete cascade,
  appellations   text[] not null default '{}',
  check (subdomain_code = left(code, 3))
);
comment on table public.rome_fiches is 'ROME : fiches métiers et leurs appellations officielles (ordre du fichier source).';
create index if not exists rome_fiches_subdomain_idx on public.rome_fiches (subdomain_code);

create table if not exists public.rome_fiche_savoir_etre (
  fiche_code        text not null references public.rome_fiches (code) on delete cascade,
  savoir_etre_code  text not null check (savoir_etre_code ~ '^6D1[0-9]{2}$'),
  primary key (fiche_code, savoir_etre_code)
);
comment on table public.rome_fiche_savoir_etre is 'ROME 4.0 : fiches métiers mobilisant chaque savoir-être professionnel (6D101 à 6D116).';
create index if not exists rome_fiche_savoir_etre_code_idx on public.rome_fiche_savoir_etre (savoir_etre_code);

do $$
declare t text;
begin
  foreach t in array array['rome_domains', 'rome_fiches', 'rome_fiche_savoir_etre'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
  end loop;
end $$;
