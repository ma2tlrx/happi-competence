/**
 * Textes du site vitrine. Les formulations sont reprises du site happicompetence.fr
 * (vision, mission, offres, déroulé, témoignages, questions fréquentes) puis
 * complétées pour la présentation de la plateforme.
 */

export const vision =
  'Explorer un nouveau vecteur de lien social, permettant d’activer, de mobiliser et de dynamiser les compétences transversales ainsi que les habiletés socio-cognitives de chacun.';

export const mission =
  'Renforcer l’employabilité en révélant et en valorisant les compétences transversales ainsi que les habiletés socio-cognitives grâce à l’usage innovant du jeu vidéo.';

/** Les quatre piliers affichés sur le site actuel. */
export const pillars = [
  { title: 'Identification', text: 'Repérer, en situation, les compétences que chacun mobilise sans toujours les connaître.' },
  { title: 'Évaluation', text: 'Croiser l’auto-évaluation du participant et les observations des formateurs.' },
  { title: 'Employabilité', text: 'Transformer ces observations en arguments concrets pour un parcours professionnel.' },
  { title: 'Gamification', text: 'Utiliser le jeu vidéo comme terrain d’observation commun, accessible aux non-joueurs.' },
];

/** Déroulé d'un parcours (séquence réelle, d'où la numérotation). */
export const journey = [
  { title: 'Questionnaire d’auto-évaluation', text: 'Le participant indique comment il perçoit ses compétences. Ce point de départ est conservé tel quel.' },
  { title: 'Présentation du programme', text: 'Le cadre, les six sessions et le rôle de l’observation sont expliqués au groupe.' },
  { title: 'Sessions de jeu et analyse des compétences', text: 'Mises en situation ludiques, débats et débriefings, observés par les formateurs.' },
  { title: 'Réalisation du passeport de compétences', text: 'Les observations validées alimentent le passeport personnel du participant.' },
  { title: 'Rendez-vous individuel et conclusion', text: 'Un échange pour relire le parcours, les points forts et les pistes de progression.' },
  { title: 'Transmission des résultats', text: 'Le participant présente son passeport ; l’organisme qui l’accompagne y accède s’il y est rattaché.' },
];

export const offers = [
  {
    title: 'Cycle complet',
    duration: '18 heures',
    text: 'L’offre complète propose un accompagnement utilisant le jeu vidéo, des ateliers participatifs et un suivi individualisé pour identifier, évaluer et développer les compétences transversales et les habiletés socio-cognitives des participants.',
  },
  {
    title: 'Teambuilding',
    duration: '5 heures, repas compris',
    text: 'Une expérience ludique et collaborative où les participants renforcent leur cohésion, mobilisent leurs compétences transversales et partagent un moment convivial favorisant la communication et l’esprit d’équipe.',
  },
  {
    title: 'Bloc individuel',
    duration: '3 heures',
    text: 'Une séance personnalisée pour travailler en profondeur une seule compétence ciblée, mêlant analyse, mise en situation ludique et accompagnement dédié.',
  },
  {
    title: 'Sur-mesure',
    duration: 'Durée adaptable',
    text: 'Une évaluation ludique et concrète, adaptable en compétences et en heures, pour un programme construit avec vous et centré sur l’employabilité.',
  },
];

export const audiences = [
  { title: 'Missions Locales', text: 'Accompagner les jeunes vers l’emploi avec un support qui les engage.' },
  { title: 'France Travail', text: 'Rendre visibles des savoir-être difficiles à objectiver en entretien.' },
  { title: 'Écoles et organismes de formation', text: 'Compléter les apprentissages par l’observation des compétences transversales.' },
  { title: 'Structures d’insertion', text: 'Redonner confiance en révélant des ressources souvent ignorées.' },
  { title: 'Entreprises', text: 'Renforcer la cohésion d’équipe et repérer les talents autrement.' },
];

export const participantBenefits = [
  'Mieux connaître ses forces et les mots pour les décrire.',
  'Comparer sa perception de soi et le regard des formateurs.',
  'Suivre sa progression session après session.',
  'Disposer d’un passeport de compétences à présenter.',
];

export const organizationBenefits = [
  'Un suivi clair de la présence et de l’avancement de chaque participant.',
  'Des fiches de compétences lisibles, fondées sur des observations datées.',
  'Des feuilles de présence téléchargeables.',
  'Des données isolées : chaque structure ne voit que ses participants.',
];

export const testimonials = [
  { quote: '10/10, programme au top ! Je me suis régalé !', author: 'Emma H.' },
  { quote: 'Je recommande vraiment ce programme ! Merci aux animateurs.', author: 'Chrystoffer E.' },
  { quote: 'Merci de m’avoir fait découvrir le leadership présent en moi.', author: 'Noham H.' },
  { quote: 'J’ai découvert de nouvelles compétences sur moi, merci !', author: 'Anthony F.' },
];

export const faq = [
  {
    question: 'Qu’est-ce que le programme HAPPI ?',
    answer:
      'HAPPI (Human Abilities & Professional Progress Integration) est un programme qui utilise le jeu vidéo pour évaluer, révéler et développer les compétences transversales et les habiletés socio-cognitives des participants.',
  },
  {
    question: 'Pourquoi utiliser le jeu vidéo pour développer les compétences ?',
    answer:
      'Le jeu vidéo place les participants dans des situations immersives, dynamiques et engageantes. Ces scénarios favorisent l’observation et la mobilisation naturelle des compétences : collaboration, gestion du stress, adaptabilité, leadership…',
  },
  {
    question: 'Faut-il être joueur pour participer ?',
    answer:
      'Non. Il ne s’agit pas de former des joueurs : les jeux sont choisis pour être accessibles à tous, et c’est la manière d’agir, de coopérer et de décider qui est observée, pas la performance.',
  },
  {
    question: 'Que sont les habiletés socio-cognitives ?',
    answer:
      'Ce sont des aptitudes combinant les ressources émotionnelles et intellectuelles d’une personne pour apprendre, interagir et s’adapter dans différentes situations. Leur identification s’appuie sur la norme AFNOR XP X50-766.',
  },
  {
    question: 'Le programme débouche-t-il sur une certification ?',
    answer:
      'HAPPI fournit un passeport de compétences fondé sur des observations, des analyses et une auto-évaluation, qui permet de valoriser ses compétences dans un parcours professionnel ou scolaire. Il ne s’agit ni d’un diplôme ni d’un diagnostic.',
  },
  {
    question: 'Qui peut consulter mes résultats ?',
    answer:
      'Vous, les formateurs de votre groupe et, si vous y êtes rattaché, l’organisme qui vous accompagne. Aucune autre structure n’y a accès.',
  },
];
