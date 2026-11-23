# Calendrier des sessions

Un calendrier par espace, un seul composant : `/admin/calendrier`, `/formateur/calendrier`, `/organisme/calendrier`, `/participant/calendrier`. Une entrée « Calendrier » (icône CalendarDays) dans le menu de chaque espace, sans onglet supplémentaire.

## Périmètre par rôle

Aucune table ni migration : les sessions sont lues avec le client de l'appelant, la sécurité au niveau des lignes (RLS, policy `sessions_select`) décide seule de ce qui est visible.

| Espace | Voit | Lien de détail | Filtres |
| --- | --- | --- | --- |
| Administrateur | toutes les sessions (démonstration comprise) | `/formateur/sessions/[id]` | organisme, formateur, groupe, statut |
| Formateur | sessions des groupes dont il est formateur | `/formateur/sessions/[id]` | groupe |
| Organisme | sessions des groupes de sa structure | `/organisme/groupes/[groupId]` | groupe |
| Participant | sessions de ses groupes | `/participant/parcours` | groupe |

Le cloisonnement démonstration / réel vient de l'appartenance aux groupes : un compte réel n'est membre d'aucun groupe de démonstration. Vérifié par `tests/security/calendar.test.ts`.

## Fonctionnement

- Paramètres d'URL : `vue` (`mois` par défaut, `semaine`, `agenda`), `date` (AAAA-MM-JJ, ancre), `organisme`, `formateur`, `groupe`, `statut` (`a-venir`, `en-cours`, `terminee`, `annulee`). Rendu serveur.
- Une plage de dates par affichage : deux requêtes en parallèle (sessions de la plage, groupes avec formateurs pour les filtres), jamais une par session. Un filtre organisme ou formateur ajoute une attente des groupes avant les sessions.
- Les sessions sans date ne s'affichent pas.
- Vue Mois : grille lundi → dimanche, jours listés avec un libellé complet (« mardi 24 novembre 2026, 2 sessions »). Sous 768 px elle devient la liste Agenda du mois. Vue Semaine : sept colonnes, une pile de jours sur téléphone. Au-delà de 3 sessions un jour renvoie à la vue Semaine.
- Statut : à venir, en cours, terminée, annulée, toujours en icône + texte. « Annulée » et « terminée » et « en cours » viennent de la base ; une session « planifiée » est déduite de l'heure de Paris (à venir, en cours pendant son créneau, terminée une fois passée). Une session planifiée dont la date est passée et non clôturée s'affiche donc « Terminée ».
- Clic sur une session : dialogue (clavier, Échap) avec date, horaire, groupe, organisme, formateurs, lieu et lien de détail.

## Export ICS

`GET /api/calendrier/ics` (formateur, organisme, participant ; 403 pour l'administrateur, 401 sans session). Sessions de -60 jours à +365 jours visibles par l'appelant, heures converties de Paris vers UTC (changements d'heure gérés), journée entière si aucun horaire. Pas de lien public ni de jeton d'abonnement : le fichier est téléchargé, il ne se met pas à jour tout seul.

## Code

- `src/lib/calendar/calendar.ts` : dates, grille, fuseau, statut, regroupement (pur).
- `src/lib/calendar/ics.ts` : export iCalendar (pur). `format.ts` : libellés français.
- `src/lib/calendar/queries.ts` : chargeur serveur ; `access.ts` : espace d'un rôle.
- `src/components/calendar/calendar-page.tsx` (serveur : barre, filtres, légende) et `calendar-view.tsx` (client : vues et dialogue).

## Tests

- Unitaires : `npx vitest run src/lib/calendar` (grille, mois à cheval, fuseau et changements d'heure 25 octobre / 29 mars, statuts, ICS).
- Sécurité : `npx vitest run --project security tests/security/calendar.test.ts` (pile locale requise).
- E2E : `E2E_BASE_URL=http://localhost:3140 npx playwright test tests/e2e/calendrier.spec.ts --trace off --project=desktop` (`E2E_SHOTS=<dossier>` pour les captures), avec contrôle axe WCAG 2 A/AA.

## Limites

Pas de glisser-déposer ni de création de session depuis le calendrier ; pas de vue « jour » ; pas d'abonnement ICS à mise à jour automatique.
