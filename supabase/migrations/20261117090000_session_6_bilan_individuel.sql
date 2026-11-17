-- Session 6 : bilan individuel.
-- Précision donnée par le porteur du programme : rendez-vous avec chaque participant, qui retrace l'ensemble des
-- compétences vues pendant le programme et explique le bilan. Aucune durée, aucun barème ni aucun objectif
-- supplémentaire n'est inventé ici : le support officiel reste à importer.
update public.program_sessions ps
set title = 'Bilan individuel',
    summary = 'Rendez-vous individuel avec chaque participant : retour sur l''ensemble des compétences vues pendant le programme et explication du bilan.',
    objectives = array[
      'Retracer l''ensemble des compétences vues lors du programme.',
      'Expliquer le bilan au participant.'
    ],
    is_provisional = false
from public.programs p
where p.id = ps.program_id and p.is_public and ps.number = 6;
