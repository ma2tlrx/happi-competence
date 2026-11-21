/**
 * Contenu du centre d'aide (/aide). Rédigé à partir du fonctionnement réel des pages :
 * à mettre à jour quand un écran change (libellés de boutons et de menus entre guillemets).
 */
import { normalizeText } from '@/lib/utils';

export type HelpAudience = 'participant' | 'formateur' | 'organisme' | 'admin';
export type HelpGuide = { id: string; audience: HelpAudience; title: string; steps: string[]; tip?: string };
export type HelpQuestion = { id: string; question: string; answer: string };

export const HELP_AUDIENCES: Record<HelpAudience, string> = {
  participant: 'Participant',
  formateur: 'Formateur',
  organisme: 'Organisme',
  admin: 'Administrateur',
};

export const HELP_GUIDES: HelpGuide[] = [
  // ── Participant ──────────────────────────────────────────────────────────
  {
    id: 'se-connecter',
    audience: 'participant',
    title: 'Se connecter',
    steps: [
      'Cliquez sur « Connexion » en haut du site.',
      'Saisissez votre adresse e-mail et votre mot de passe, puis « Me connecter ».',
      'Pas encore de compte ? Cliquez sur « Créer mon compte » sous le formulaire.',
      'Mot de passe oublié ? Cliquez sur « Mot de passe oublié ? » : vous recevez un lien par e-mail pour en choisir un nouveau.',
      'Si vous avez activé la double authentification, saisissez ensuite le code à 6 chiffres de votre application.',
    ],
    tip: 'Après plusieurs essais manqués, la connexion est bloquée quelques minutes pour protéger votre compte. Patientez, puis réessayez.',
  },
  {
    id: 'questionnaire-accueil',
    audience: 'participant',
    title: 'Le questionnaire d’accueil',
    steps: [
      'Juste après la création de votre compte, un questionnaire en 5 étapes vous est proposé : informations personnelles, parcours scolaire, bénévolat et expériences, ambitions, aptitudes.',
      'L’étape 6 est votre auto-évaluation. Comptez environ 5 minutes en tout.',
      'Vous pouvez le passer et le reprendre plus tard depuis votre accueil, puis modifier vos réponses dans « Mon profil ».',
    ],
    tip: 'Seuls vous, vos formateurs et l’équipe HAPPI voient vos réponses. Votre organisme n’y a pas accès.',
  },
  {
    id: 'auto-evaluation',
    audience: 'participant',
    title: 'Remplir mon auto-évaluation',
    steps: [
      'Au début du programme, ouvrez « Mes compétences », onglet « Mon auto-évaluation ». Votre accueil vous y mène aussi.',
      'Pour chaque affirmation, indiquez à quel point elle vous correspond aujourd’hui. Il n’y a ni bonne ni mauvaise réponse.',
      'Une fois envoyée, elle est conservée telle quelle : c’est votre point de départ.',
      'À la fin du parcours, une auto-évaluation de fin de parcours s’ouvre, avec les mêmes affirmations.',
    ],
  },
  {
    id: 'emarger',
    audience: 'participant',
    title: 'Signer la feuille de présence (émarger)',
    steps: [
      'Le jour de la séance, votre formateur note votre présence.',
      'Un encadré « Émargement du jour » apparaît alors sur votre « Accueil ».',
      'Cliquez sur « Signer », signez dans le cadre avec le doigt, un stylet ou la souris, puis « Valider ma signature ».',
      'Vous pouvez aussi signer sur la tablette de votre formateur, pendant la séance.',
    ],
    tip: 'Vous ne pouvez pas signer à l’écran ? Votre formateur l’indique sur sa feuille. Une fois la feuille contre-signée par le formateur, plus aucune signature n’est possible.',
  },
  {
    id: 'evolution',
    audience: 'participant',
    title: 'Voir mon évolution',
    steps: [
      'Ouvrez « Mes compétences », onglet « Mon évolution ».',
      'Vous y voyez ce que vous avez déclaré au départ, ce que vos formateurs ont observé pendant les séances, et ce que vous déclarez à la fin.',
      'Les onglets « Transversales » et « Habiletés socio-cognitives » détaillent chaque compétence observée.',
    ],
  },
  {
    id: 'defis',
    audience: 'participant',
    title: 'Mes défis et ma collection de compétences',
    steps: [
      'Votre accueil montre votre parcours session par session : la mascotte HAPPI se pose sur votre prochaine étape.',
      'Ouvrez « Mes réussites » : chaque défi réussi vous donne des étoiles. Certains dépendent de vous (auto-évaluation, avis), d’autres se débloquent pendant les sessions.',
      'La collection de compétences s’allume case par case quand vos formateurs observent une compétence, quel que soit le niveau.',
    ],
    tip: 'Rien ne se perd : une absence ralentit un défi, elle ne le ferme jamais. Les défis et les étoiles ne comptent pas dans votre bilan.',
  },
  {
    id: 'partager',
    audience: 'participant',
    title: 'Partager mon passeport',
    steps: [
      'Ouvrez « Mon bilan », onglet « Partager mon passeport ».',
      'Indiquez pour qui est le lien (par exemple le nom d’une entreprise) et sa durée : 7, 30 ou 90 jours.',
      'Cliquez sur « Créer le lien ». Copiez le lien ou téléchargez le QR code.',
      'La personne qui ouvre le lien voit votre prénom, l’initiale de votre nom et vos compétences observées. Elle ne voit pas vos coordonnées.',
      'Vous voyez combien de fois le lien a été consulté. Cliquez sur « Révoquer » pour le couper à tout moment.',
    ],
  },
  {
    id: 'avis',
    audience: 'participant',
    title: 'Donner mon avis sur le programme',
    steps: [
      'À la fin de la dernière séance de votre groupe, une enquête « à chaud » s’ouvre. Une enquête « à froid » s’ouvre 90 jours plus tard.',
      'Ouvrez « Mon avis », puis « Répondre ».',
      'Répondez aux questions obligatoires, puis « Envoyer mon avis ».',
    ],
    tip: 'Une seule réponse par enquête, non modifiable. Les formateurs et votre structure ne voient que des résultats regroupés, jamais votre nom.',
  },
  // ── Formateur ────────────────────────────────────────────────────────────
  {
    id: 'planifier',
    audience: 'formateur',
    title: 'Créer un groupe et planifier les séances',
    steps: [
      'Dans « Groupes », cliquez sur « Nouveau groupe » : nom, programme, organisme, dates.',
      'Ouvrez le groupe et ajoutez les participants (une fiche est créée si la personne n’en a pas).',
      'Toujours dans le groupe, chaque séance a sa ligne : date, début, fin et lieu. Réglez la première, puis cliquez sur « Recopier sur les suivantes » : une semaine plus tard, mêmes horaires, même lieu.',
      'Ajustez ce qui change d’une séance à l’autre, puis cliquez sur « Créer les 6 sessions ». Une date dans le désordre est signalée sur sa ligne.',
      'Chaque séance se modifie ensuite depuis « Sessions ».',
    ],
    tip: 'Les convocations partent par e-mail dès qu’une séance datée est planifiée. Un rappel est envoyé la veille.',
  },
  {
    id: 'presences',
    audience: 'formateur',
    title: 'Présences et émargement',
    steps: [
      'Ouvrez la séance, puis « Présences ». Indiquez pour chacun : présent, en retard, départ anticipé, absent ou absence justifiée.',
      'Le jour de la séance, cliquez sur « Émargement » : l’écran passe en plein écran, à tendre aux participants.',
      'Chaque personne présente touche son nom (« Faire signer »), signe dans le cadre, puis « Valider la signature ».',
      'Une personne ne peut pas signer ? Choisissez « Signature impossible ? Saisir un motif » : la mention est enregistrée à votre nom.',
      'À la fin, contre-signez, cochez l’attestation, puis « Contre-signer et figer la feuille ».',
      '« Feuille d’émargement » télécharge le PDF de la séance.',
    ],
    tip: 'Une feuille contre-signée est figée : plus de signature ni de changement de présence. Seul un administrateur peut corriger, et la correction est tracée.',
  },
  {
    id: 'evaluer',
    audience: 'formateur',
    title: 'Évaluer les participants',
    steps: [
      'Ouvrez la séance, puis « Évaluations ».',
      'Pour chaque participant présent, choisissez le niveau observé de chaque compétence de la séance et notez vos observations.',
      'Le brouillon s’enregistre tout seul. À la fin de la séance, cliquez sur « Valider l’évaluation ».',
      'Une évaluation validée se corrige avec un motif, conservé dans l’historique avec les anciennes et les nouvelles valeurs.',
    ],
    tip: 'N’évaluez que des comportements observés pendant la séance. La note privée n’est visible ni du participant ni de son organisme.',
  },
  {
    id: 'bilans',
    audience: 'formateur',
    title: 'Rédiger un bilan',
    steps: [
      'Ouvrez la fiche du participant, puis « Bilan ».',
      'Cliquez sur « Générer le bilan » : les résultats validés à cette date sont figés.',
      'Rédigez le texte vous-même ou avec « Rédiger avec l’IA », puis relisez et corrigez.',
      'Cliquez sur « Valider le bilan » : il est figé, et le participant comme son organisme peuvent le télécharger.',
    ],
  },
  {
    id: 'abandons-suivis',
    audience: 'formateur',
    title: 'Abandons et suivis',
    steps: [
      'Une personne quitte le parcours : dans la fiche du groupe, cliquez sur « Abandon » sur sa ligne. Indiquez le motif, des précisions et la date.',
      'Elle ne figure plus sur les feuilles de présence, mais reste dans l’historique et les statistiques.',
      '« Retirer » est réservé à une erreur d’inscription.',
      '« Suivi des parcours », onglet « Suivis », liste les situations à saisir : la sortie (à la fin du groupe ou à l’abandon), puis les suivis à 3 et 6 mois.',
      'Cliquez sur « Saisir » : situation, date de l’observation, précisions, puis « Enregistrer ».',
    ],
    tip: 'Un suivi passe « en retard » 30 jours après son échéance. Les catégories de situations sont provisoires.',
  },
  // ── Organisme ────────────────────────────────────────────────────────────
  {
    id: 'suivre-mes-groupes',
    audience: 'organisme',
    title: 'Suivre mes groupes',
    steps: [
      'Ouvrez « Mes groupes » : une carte par groupe qui accueille des personnes de votre structure.',
      'Les groupes en cours sont en haut, puis ceux à venir. Les groupes terminés sont rangés sous « Groupes terminés ».',
      'Chaque carte montre l’avancement (une case orange par séance faite), la présence, la prochaine séance et, si besoin, le badge « à relancer ».',
      'Cliquez sur une carte : les séances du groupe (date, horaire, faite ou à venir) et chacun de ses membres.',
    ],
    tip: 'Vous ne voyez que les personnes de votre structure, sans rien pouvoir modifier. En fin de programme, une carte « Donnez votre avis » peut apparaître : deux minutes suffisent.',
  },
  {
    id: 'resultats-participant',
    audience: 'organisme',
    title: 'Voir les résultats d’un participant',
    steps: [
      'Dans la page d’un groupe, chaque personne a ses cases de présence (une par séance terminée) et son nombre de compétences révélées.',
      'Cliquez sur « Voir ses résultats » : bilans validés, auto-évaluation, évolution et évaluations validées.',
      'Si votre structure y est autorisée, téléchargez la fiche de compétences ou le bilan en PDF.',
      'Le lien en haut de la page vous ramène au groupe.',
    ],
    tip: 'Une compétence est « révélée » dès sa première observation validée par un formateur, quel que soit le niveau.',
  },
  {
    id: 'relancer-absent',
    audience: 'organisme',
    title: 'Relancer une personne absente',
    steps: [
      'Dans la page d’un groupe, « Relancer » apparaît à côté d’une personne absente, sans justificatif, à sa dernière séance terminée.',
      'Cliquez sur « Relancer » : la personne reçoit un e-mail et une notification « On vous attend à la prochaine séance », avec la date de cette séance.',
      'Le bouton laisse la place à « Relancé·e le … » : une absence ne se relance qu’une fois.',
      'Pas de relance pour une absence justifiée, un parcours interrompu ou une personne revenue depuis.',
    ],
    tip: 'Le message, chaleureux et sans reproche, cite votre structure. Il ne contient ni motif, ni présences, ni résultats.',
  },
  // ── Administrateur ───────────────────────────────────────────────────────
  {
    id: 'comptes',
    audience: 'admin',
    title: 'Gérer les comptes',
    steps: [
      '« Comptes et accès », onglet « Utilisateurs », liste tous les comptes, leurs rôles et leur statut.',
      'L’onglet « Organismes » permet de valider les demandes d’espace organisme.',
      'Les onglets « Formateurs » et « Participants » donnent le détail par rôle.',
    ],
  },
  {
    id: 'codes',
    audience: 'admin',
    title: 'Créer un code d’accès',
    steps: [
      'Ouvrez « Comptes et accès », onglet « Codes d’accès », indiquez un libellé et le type de compte, puis « Générer un code ».',
      'Transmettez le code par un canal sûr. La personne l’utilise sur la page « Activer un accès professionnel » (lien « Activer mon accès avec un code »).',
      'Chaque code ne sert qu’une fois.',
    ],
    tip: 'Seule une empreinte du code est conservée : notez-le au moment de sa création.',
  },
  {
    id: 'demo',
    audience: 'admin',
    title: 'Utiliser la démonstration',
    steps: [
      'Ouvrez « Paramètres », onglet « Démonstration », puis créez le jeu de données (comptez 20 à 60 secondes).',
      'Tous les comptes et données sont fictifs et marqués « démo ».',
      'Ouvrez les espaces formateur, organisme et participant pour les présenter.',
      'Supprimez tout en un clic quand vous avez terminé.',
    ],
  },
  {
    id: 'emails',
    audience: 'admin',
    title: 'Suivre les e-mails',
    steps: [
      'Ouvrez « Paramètres », onglet « E-mails » : convocations, rappels la veille, modifications de séance, bilans disponibles et invitations.',
      'Chaque message passe par une file d’envoi : il n’est jamais envoyé deux fois.',
      'Consultez les messages envoyés et ceux qui n’ont pas pu partir.',
    ],
  },
  {
    id: 'double-authentification',
    audience: 'admin',
    title: 'Double authentification',
    steps: [
      'Chaque personne l’active dans « Mon compte », puis « Sécurité » : elle scanne le QR code avec une application d’authentification et saisit le premier code.',
      'Dans « Paramètres », vous pouvez l’exiger pour les administrateurs et les formateurs.',
      'Téléphone perdu ? Dans « Comptes et accès », onglet « Utilisateurs », réinitialisez la double authentification de la personne, après avoir vérifié son identité par un autre moyen.',
    ],
  },
  {
    id: 'observatoire',
    audience: 'admin',
    title: 'Lire l’observatoire des compétences',
    steps: [
      'Ouvrez « Observatoire » : chaque ligne est une compétence, avec la répartition par niveau, la moyenne et sa marge, la progression et le regard sur soi. n compte les personnes.',
      'Choisissez le référentiel, puis « Filtrer » (organisme, ville, cohorte, tranche d’âge…) : chaque valeur indique son nombre de personnes.',
      'Choisissez un axe dans « Comparer par » pour voir la carte de chaleur : plus la case est foncée, plus la moyenne observée est haute.',
      'Cliquez une compétence pour ouvrir sa fiche : courbe par session et détail selon l’axe comparé.',
      '« Copier le lien » garde vos filtres ; « Exporter (CSV) » télécharge exactement ce qui est affiché.',
    ],
    tip: 'Sous 5 personnes, une case affiche « moins de 5 » : rien n’est montré ni exporté, pour que personne ne soit reconnaissable.',
  },
];

export const HELP_FAQ: HelpQuestion[] = [
  {
    id: 'mot-de-passe',
    question: 'J’ai oublié mon mot de passe.',
    answer: 'Sur la page de connexion, cliquez sur « Mot de passe oublié ? ». Saisissez votre adresse : vous recevez un lien pour choisir un nouveau mot de passe.',
  },
  {
    id: 'trop-de-tentatives',
    question: 'Le site indique « Trop de tentatives ».',
    answer: 'Après plusieurs essais manqués, la connexion est bloquée quelques minutes. Le message indique le délai. Patientez, puis réessayez.',
  },
  {
    id: 'telephone-perdu',
    question: 'J’ai perdu le téléphone qui génère mes codes.',
    answer: 'Contactez l’équipe HAPPI. Un administrateur réinitialise la double authentification après avoir vérifié votre identité. Vous la réactivez ensuite.',
  },
  {
    id: 'pas-emargement',
    question: 'Je ne vois pas « Émargement du jour ».',
    answer: 'L’encadré apparaît le jour de la séance, une fois que votre formateur a noté votre présence. Si la feuille est déjà contre-signée, la signature est close.',
  },
  {
    id: 'modifier-avis',
    question: 'Puis-je modifier ma réponse à une enquête ?',
    answer: 'Non. Une seule réponse est possible par enquête, et elle ne se modifie pas.',
  },
  {
    id: 'qui-voit',
    question: 'Qui voit mes résultats ?',
    answer: 'Vos formateurs et la structure qui vous accompagne voient vos évaluations validées et votre bilan validé. Les notes privées des formateurs ne vous sont pas montrées, ni à votre structure. Un lien de partage ne montre que ce qu’il annonce, jusqu’à sa date de fin.',
  },
  {
    id: 'mes-donnees',
    question: 'Comment récupérer mes données ?',
    answer: 'Dans « Mon compte », cliquez sur « Télécharger mes données ». Pour une suppression, écrivez-nous via le formulaire de contact.',
  },
];

/** Recherche simple : tous les mots saisis doivent figurer (sans accents ni casse). */
export function matchesHelp(text: string, query: string) {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeText(text);
  return words.every((word) => haystack.includes(word));
}

export const guideText = (guide: HelpGuide) => [guide.title, ...guide.steps, guide.tip ?? ''].join(' ');
export const questionText = (item: HelpQuestion) => `${item.question} ${item.answer}`;
