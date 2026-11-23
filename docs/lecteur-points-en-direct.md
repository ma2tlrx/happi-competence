# Points en direct dans le lecteur pédagogique

Aide-mémoire du formateur : pendant l'animation, un appui sur un participant enregistre un « + » horodaté, relié à l'endroit de la séance où il a eu lieu. La notation se fait après, dans l'écran d'évaluation, où le repère est rappelé. **Aucun score, niveau ou barème n'est créé ; rien n'entre dans le bilan automatiquement.**

## Usage

- Lecteur : bouton « Points » (icône plus entourée, avec compteur) à côté des notes ; raccourci clavier `P`.
- Le panneau liste les participants du groupe de la session (prénom + initiale du nom). Les participants non pointés présents sont grisés mais restent cliquables.
- Un appui = un « + » immédiat (compteur animé, vibration si disponible, `prefers-reduced-motion` respecté).
- Juste après, un sélecteur reste 4 s pour rattacher le « + » à une compétence de la session (compétences évaluées pour cette session via `session_skill_map`, toutes celles des référentiels activés si aucune correspondance). Sans choix : « Général ».
- « Annuler » retire le dernier « + ».
- Sur grand écran, le panneau est une colonne à droite du contenu ; sur téléphone, une feuille basse (46 % de la hauteur au plus), fermable.
- Évaluation : bloc repliable « Points en direct pour … » (par compétence, avec « pendant « Titre » (bloc 3), à 14 min »), et pastille « n en direct » sous chaque compétence concernée. Lecture seule ; le formateur reste décideur. « Masquer » / « Tout masquer » / « Afficher les masqués » : confort de lecture, mémorisé sur l'appareil (stockage local), rien n'est supprimé en base.

## Données

Table `public.session_live_marks` (migration `supabase/migrations/20261124090000_session_live_marks.sql`) : `session_id`, `participant_id`, `skill_code` (nul = général, `^[a-z0-9_]+$`), `kind` (`'plus'`, extensible), `block_index`, `block_title` (200 car. max), `elapsed_seconds` (chronomètre de session, nul s'il n'a pas servi), `created_by`, `created_at` (horodatage serveur). Index sur chaque clé étrangère ; suppression en cascade avec la session ou le participant.

Le repère vient du lecteur : séquence en cours (`parseSessionScript`) et minutes écoulées du chronomètre de session.

## Droits

RLS activée et forcée. Lecture, insertion et suppression : formateurs de CETTE session (`private.trains_group`) et administrateurs. Jamais le participant, l'organisme, un autre formateur ni un anonyme. L'insertion exige `created_by = auth.uid()` et que le participant fasse partie du groupe de la session (`private.live_mark_participant_ok`). Pas de mise à jour. Droits `revoke all … from public, anon, authenticated` puis `grant select, insert, delete to authenticated`. Pas de journal d'audit : volume élevé et aide-mémoire sans effet sur les résultats.

## Fiabilité hors ligne

Mise à jour optimiste, envoi en arrière-plan. Chaque « + » a un identifiant généré côté client (renvoi sans doublon). La file est conservée dans le stockage local de l'appareil, relancée au retour du réseau, toutes les 15 s et à la réouverture du lecteur. Un refus définitif du serveur (droit retiré, participant hors groupe) est signalé dans le panneau.

## Limites

- Pas d'appui long : le sélecteur de compétence après le « + » (4 s) est le seul second geste.
- On ne rattache pas un « + » à une compétence après coup (annuler puis recommencer).
- Le masquage dans l'évaluation est propre à l'appareil, non partagé entre formateurs.
- Si le stockage local est indisponible (navigation privée), la file reste en mémoire : fermer l'onglet hors ligne perdrait les « + » non envoyés.
- Si le chronomètre de session n'a pas été lancé, le repère se limite au bloc.

## Tests

- Unitaires : `src/lib/live-marks/live-marks.test.ts` (formatage, regroupement, file hors ligne).
- Sécurité : `tests/security/session-live-marks.test.ts`.
- Bout en bout : `tests/e2e/lecteur-points.spec.ts`.
