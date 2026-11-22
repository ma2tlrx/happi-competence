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
