# Prescription en ligne

Chantier P1 de l'axe D (`docs/audit-strategique.md`) : un conseiller d'un organisme prescripteur (Mission Locale,
France Travail…) oriente une personne vers HAPPI sans ressaisie ; l'équipe HAPPI traite la file et remplit ses groupes.

## Parcours

1. **Le conseiller** (rôle organisme, permission `org.referrals.write`) remplit « Orienter une personne »
   (`/organisme/orientations/nouvelle`). Il certifie avoir informé la personne (case obligatoire, horodatée, version du
   texte d'information enregistrée) et indique ses choix : droit à l'image, partage des résultats.
2. **L'équipe HAPPI** (administrateur, formateurs avec `referrals.manage`) traite la file (`/admin/orientations`,
   `/formateur/orientations`) : reçue → entretien planifié → liste d'attente → acceptée / refusée (motif obligatoire).
   « Affecter au groupe » appelle `assign_referral_to_group`, qui réutilise `add_participant_to_group` (mêmes droits,
   y compris le refus d'ouvrir une fiche suivie par une autre équipe) : la fiche est créée au statut `invited`, l'e-mail
   d'invitation et les convocations partent comme pour un ajout manuel.
3. **La personne** crée son compte avec la même adresse (flux d'inscription existant), puis confirme ou modifie elle-même
   ses consentements (`/participant/consentements`, rappel sur son tableau de bord). Elle peut les révoquer à tout moment.
4. **Le conseiller** est prévenu à chaque changement de statut (notification in-app par déclencheur, e-mail
   `referral_update` sans motif ni donnée personnelle autre que le prénom et l'initiale).

Le prescripteur peut annuler une orientation tant qu'aucune décision n'est prise. Sur la page d'un groupe, l'équipe voit
les places restantes (`groups.capacity`, modifiable par l'administrateur, bornée par la taille maximale du programme) et
les personnes en attente compatibles (programme, créneaux des séances à venir, date souhaitée).

## Minimisation

- Pas de date de naissance : une tranche d'âge facultative (tranches **provisoires — à valider**).
- Pas d'information de santé : besoin d'adaptation en oui/non seulement ; les textes libres qui en contiennent sont refusés.
- Doublons : si l'adresse correspond à une fiche ou à une orientation en cours, le prescripteur voit seulement « une fiche
  existe peut-être déjà, l'équipe HAPPI vérifiera ».
- Le partage des résultats conditionne le rattachement de la fiche à l'organisme prescripteur (c'est ce rattachement qui
  ouvre à l'organisme la lecture des présences et des évaluations). Un refus ultérieur détache la fiche si elle était
  rattachée à cet organisme.
- Historique complet en ajout seul (`referral_events`) et journal d'activité sans donnée d'identité.

## Points à valider

- **Base légale à valider par un juriste.** La personne orientée par France Travail ou une Mission Locale n'est pas en
  position de consentir librement au traitement principal : le traitement de la fiche relève plutôt de l'exécution d'une
  mission d'intérêt public ou du contrat de prestation avec le prescripteur. Le « consentement » recueilli ici n'est donc
  qu'une **information** pour le traitement principal ; seuls le droit à l'image et le partage des résultats avec le
  prescripteur sont de vrais consentements, distincts et révocables. À confirmer, avec la mise à jour du registre des
  traitements et de l'AIPD.
- Texte d'information (`INFORMATION_POINTS`, version `v1-2026-11`), tranches d'âge et liste des contraintes pratiques :
  provisoires.
- Rattachement conditionné au partage des résultats (choix de conception à confirmer).
- La capacité d'un groupe est contrôlée à l'affectation d'une orientation ; l'ajout manuel reste borné par la seule taille
  maximale du programme.
