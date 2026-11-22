# Skills Claude externes installés (22 novembre 2026)

Lus en entier avant installation : uniquement du texte (aucun script), licence MIT, publiés par les éditeurs eux-mêmes.

| Skill (dossier) | Source (commit) | Usage dans HAPPI |
| --- | --- | --- |
| `.claude/skills/supabase` | [supabase/agent-skills](https://github.com/supabase/agent-skills) `c9be0e9` | liste de contrôle sécurité Supabase (RLS, SECURITY DEFINER, clés) |
| `.claude/skills/supabase-postgres-best-practices` | [supabase/agent-skills](https://github.com/supabase/agent-skills) `c9be0e9` | règles Postgres : index, RLS performante, verrous, types |
| `.claude/skills/react-best-practices` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `5a37a63` | performance React / Next.js (cascades d'await, bundle, serveur) |
| `.claude/skills/web-accessibility` | [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills) `afa8da9` | accessibilité WCAG 2.2 |

Non versionné (licence du fichier de règles non indiquée) : `web-design-guidelines` de Vercel (règles figées dans le skill,
empreinte SHA-256 vérifiée `d246b026…`), installé seulement dans l'environnement de travail.

Écartés : `vercel-optimize`, `deploy-to-vercel`, `vercel-cli-with-tokens` (scripts exécutables et/ou jetons, et l'hébergement cible est LWS).
Mise à jour : re-télécharger depuis la source, relire le diff, puis remplacer le dossier.

## Premier usage : trois audits (22 novembre 2026)

Trois agents ont appliqué chacun un skill au projet (lecture seule), puis les constats vérifiés ont été corrigés.

**Base de données** (`supabase-postgres-best-practices`, `supabase`) — migration `20261123100000_rls_initplan_fk_indexes.sql` :
- 21 règles d'accès appelaient des fonctions (`is_admin()`, `my_participant_id()`…) pour chaque ligne : enveloppées dans `(select …)`,
  calculées une fois par requête. Instructions générées depuis `pg_policies` : logique d'accès strictement identique (262 tests de sécurité verts).
- 83 clés étrangères sans index : indexées (jointures, règles d'accès, suppressions en cascade).
- Vérifiés conformes : RLS forcée sur 96 tables, `TO authenticated` partout, `WITH CHECK` sur toutes les mises à jour, aucune fonction
  SECURITY DEFINER sans contrôle de l'appelant, `search_path` vide partout, types de dates corrects.
- Non traité (choix assumé) : la vue `staff_directory` (noms et rôles de l'équipe lisibles par un compte connecté, voulu pour les certificats).

**Performance React / Next.js** (`react-best-practices`) :
- écrans de chargement (`loading.tsx`) pour les espaces participant et formateur (pas organisme ni admin : avec un chargement en continu, une page introuvable répond 200 au lieu de 404) : retour visuel immédiat au clic, la coque reste en place ;
- correspondances publiques chargées dès le début du passeport (au lieu de la 4e vague de requêtes) ;
- lecteur pédagogique : seule la version en cours du support est lue (plus tout l'historique) ;
- défis : simple test d'existence d'une partie jouée au lieu de lire 14 colonnes ;
- `radix-ui` ajouté aux paquets optimisés de Next.
- Reportés (gain réel mais modifications plus larges) : parallélisation du tableau de bord participant et des pages de session,
  liste des bilans sans le JSON complet, `motion` chargé à la demande, rendu Markdown du lecteur côté serveur.

**Accessibilité WCAG 2.2** (`web-accessibility`, `web-design-guidelines`) :
- bordures des champs et cases à cocher : contraste 1,5:1 → 4,3:1 (critère 1.4.11) ; textes d'exemple 2,8:1 → 5,1:1 ;
- chiffre de note sélectionné (questionnaire d'accueil) : 3,3:1 → 5,2:1 ;
- l'élément qui a le focus n'est plus caché sous la barre basse du téléphone (2.4.11) ;
- auto-évaluation sur téléphone : les réponses sont annoncées avec leur libellé, plus seulement « 1 » à « 5 » ;
- erreurs des cases à cocher et des choix multiples reliées à leur contrôle ; focus sur le premier champ à corriger dans les trois
  formulaires d'inscription ;
- les messages d'erreur (toasts) ne disparaissent plus tout seuls (2.2.1).
- Reportés : menu mobile en vrai dialogue (piège du focus, Échap), tailles tactiles de 44 px sur quelques petits boutons, focus des cartes Undercover.
