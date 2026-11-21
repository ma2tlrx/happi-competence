# Espace organisme : « Mes groupes »

Demande du propriétaire : un espace organisme simple, ludique et rapide. Les structures (Missions Locales,
France Travail, écoles, organismes de formation…) consultent les groupes qui accueillent leurs participants,
les résultats de chaque membre, et relancent les absents. Trois écrans, aucun onglet.

## Les trois écrans

| Écran | Adresse | Contenu |
| --- | --- | --- |
| Mes groupes | `/organisme/dashboard` | Nom de la structure, une phrase, trois jalons compacts (personnes accompagnées, séances réalisées, parcours menés à terme). Carte « Donnez votre avis » quand une enquête prescripteur attend une réponse (fin de programme, Qualiopi). Une carte par groupe : nom, programme, période, formateurs, membres, avancement en cases, présence, prochaine séance, badge « n à relancer ». Groupes en cours, puis à venir ; groupes terminés repliés. |
| Page d'un groupe | `/organisme/groupes/[id]` | En-tête pétrole : nom, programme, période, formateurs, membres, présence et les séances du programme (date, horaire, faite / en cours / à venir / annulée / à planifier). Puis les membres : présence en cases, compétences révélées, « Voir ses résultats », « Relancer » ou « Relancé·e le … », mention « Parcours interrompu ». |
| Résultats d'un membre | `/organisme/participants/[id]` | Bilans validés et passeport de compétences. Retour vers le groupe d'origine (`?groupe=<id>`, si ce groupe est visible), sinon vers « Mes groupes ». |

Menu : « Mes groupes » et « Aide ». Sur téléphone, pas de barre de navigation basse (elle n'aurait qu'un élément) :
le menu reste accessible par le bouton en haut à gauche.

## Ce que la structure voit

Tout est lu avec la session de l'utilisateur, sous RLS (`src/lib/organisme/load.ts`) :

- **Groupes** : ceux de la structure, et ceux qui accueillent l'une de ses personnes (`private.org_sees_group`).
- **Membres** : seulement les personnes rattachées à la structure (`private.org_sees_participant`). Les autres membres d'un
  groupe partagé ne sont pas affichés. Une personne dont la fiche n'est pas lisible n'apparaît que dans un décompte
  (« n autres personnes de ce groupe : résultats non partagés avec votre structure »).
- **Présences** : avec la permission `org.attendance.read` seulement. Sans elle, ni cases de présence ni relance, et un
  message l'indique.
- **Compétences révélées** : avec `org.evaluations.read` seulement. Une compétence est révélée dès sa première
  observation validée, quel que soit le niveau (même règle que l'album du participant, clé stable référentiel + code).
- **Résultats** : bilans validés et passeport. Les situations de sortie, la fiche d'entrée FSE+ et l'analyse du besoin
  ne sont plus affichées sur cet écran ; elles restent côté formateur et administration.

Cases de présence (une par séance terminée) : orange coché = présent ; moitié orange = retard ou départ anticipé ;
pétrole barré = absent ; tiret = absence justifiée ; pointillés = non saisi. Même grammaire que la carte du parcours du
participant (orange = séance suivie), jamais de rouge ; chaque état a aussi sa forme et son texte (lecteurs d'écran, survol).

Taux de présence d'un groupe : présent, retard et départ anticipé comptent comme présents, sur les séances terminées
renseignées des membres de la structure (règle `attendanceRate` du moteur d'évaluation).

## Règle de relance

Une personne peut être relancée quand, à la fois :

1. elle est rattachée à la structure et inscrite (statut actif) dans le groupe de la séance ;
2. la séance est terminée et sa présence y est « absent » (une absence justifiée ne se relance pas) ;
3. c'est sa dernière séance terminée renseignée : revenue depuis, elle n'est plus relancée ; une nouvelle absence ouvre
   une nouvelle relance ;
4. elle n'a pas déjà été relancée pour cette absence (une relance par séance et par personne).

Seul un compte organisme d'une structure active, autorisé à consulter les présences, peut relancer. Un parcours
interrompu (abandon) n'est jamais relancé.

La règle est écrite deux fois, à l'identique : dans l'interface (`followupState`, `src/lib/organisme/groups.ts`, testée)
et dans la base (`public.relaunch_absent_participant`, qui fait foi). L'interface n'est qu'un reflet : le bouton peut
être contourné, pas la fonction.

### Ce qui se passe au clic sur « Relancer »

1. Action serveur `relaunchAbsent` (`src/app/organisme/groupes/[id]/actions.ts`) : rôle organisme, structure active,
   permission présences, identifiants valides, limite de 30 relances par 10 minutes et par compte.
2. `public.relaunch_absent_participant(séance, participant)` (SECURITY DEFINER, `search_path` vide) revérifie la règle
   et enregistre la relance dans `public.absence_followups`. Messages d'erreur explicites et stables ; l'appelant et le
   rattachement de la personne sont vérifiés avant tout, pour ne rien révéler d'une personne d'une autre structure.
3. Un déclencheur trace la relance dans le journal d'activité (`absence_followup.sent`, identifiants seulement).
4. `notifyAbsenceFollowup` (`src/lib/email/events.ts`) met en file l'e-mail `absence_followup` et crée la notification
   in-app du participant, une seule fois (clé `absence_followup:<relance>`). Données de démonstration : rien n'est envoyé.
5. La page se met à jour : « Relance envoyée à Lucas », puis « Relancé·e le 21 nov. ».

Contenu de l'e-mail, ton chaleureux et sans reproche (« On vous attend à la prochaine séance ») : prénom, nom de la
structure, numéro et date de la séance manquée, prochaine séance prévue si elle existe (date, horaire, lieu), lien vers
« Mon parcours ». Ni motif, ni présences, ni évaluation. Sans prochaine séance : « On pense à vous » et une invitation à
faire le point avec le formateur.

### Table `absence_followups`

Une ligne par relance, unique par (séance, participant), en ajout seul (suppression par cascade uniquement :
effacement d'un participant, purge de la démonstration). RLS activée et forcée ; lecture par la structure qui a
relancé, les formateurs du participant et l'administration ; aucune écriture directe (la fonction est la seule entrée).

## Pages retirées du menu

Ces pages existent toujours (liens d'anciennes notifications et d'e-mails, retour possible), mais plus aucun lien du
menu ni de l'accueil n'y mène :

`/organisme/impact`, `/organisme/financements`, `/organisme/orientations` (dont « Orienter une personne »),
`/organisme/programmes`, `/organisme/sessions`, `/organisme/presences`, `/organisme/satisfaction`
(toujours atteinte depuis la carte « Donnez votre avis »), `/organisme/suivis`, `/organisme/signalements`,
`/organisme/participants` (la liste ; la fiche d'un participant reste l'écran « Résultats »).

## À valider

- La règle « dernière séance terminée renseignée » (une personne revenue n'est plus relançable) et l'exigence de la
  permission `org.attendance.read` pour relancer.
- L'e-mail part même si la personne a désactivé les rappels J-1 (une relance n'est pas un rappel automatique).
- Le retrait du menu de la prescription (« Orienter une personne ») et des pages d'impact, de financements et de suivis.
- Les textes de l'e-mail et des guides d'aide.
