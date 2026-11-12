import type { Metadata } from 'next';

import { LegalPage, LegalValue, ToValidate } from '@/components/public/legal-page';
import { siteConfig } from '@/config/site';
import { getPublicCatalog, settingString } from '@/lib/public-catalog';

export const metadata: Metadata = { title: 'Politique de confidentialité' };

/**
 * Politique de confidentialité. Les traitements décrits correspondent au schéma réel
 * (voir docs/conformite/registre-traitements.md). Les points de droit (bases légales,
 * durées, AIPD) restent à faire valider : ils sont signalés sur la page.
 */
export default async function ConfidentialitePage() {
  const catalog = await getPublicCatalog();
  const email = settingString(catalog, 'contact.email') || siteConfig.contactEmail;
  const company = settingString(catalog, 'legal.company_name');
  const address = settingString(catalog, 'legal.address');
  const dpo = settingString(catalog, 'legal.dpo_contact');
  return (
    <LegalPage title="Politique de confidentialité" updated="novembre 2026">
      <p>
        La plateforme HAPPI Compétence contient des informations personnelles et des évaluations individuelles. Cette page explique
        quelles données sont collectées, pourquoi, qui peut les consulter, où elles sont hébergées, combien de temps elles sont
        conservées et comment exercer vos droits (règlement général sur la protection des données, RGPD).
      </p>

      <h2>Responsable du traitement</h2>
      <p>
        <LegalValue value={company} />, <LegalValue value={address} /> — contact : {email}.
      </p>
      <p>
        Délégué ou référent à la protection des données : <LegalValue value={dpo} />.
      </p>
      <p>
        Lorsque la plateforme est utilisée par un organisme de formation ou une structure d’accompagnement pour ses propres
        participants, cette structure peut être responsable du traitement et HAPPI son sous-traitant. La répartition des rôles est
        précisée dans le contrat conclu avec chaque structure. <ToValidate />
      </p>

      <h2>Données collectées et finalités</h2>
      <ul>
        <li>
          <strong>Compte</strong> : prénom, nom, adresse e-mail, téléphone (facultatif), mot de passe (jamais stocké en clair), rôle,
          dates d’acceptation des conditions et de consentement. Si vous activez la double authentification, le secret de votre
          application d’authentification est conservé par le service d’authentification. Finalité : vous permettre d’accéder à
          votre espace de façon sécurisée.
        </li>
        <li>
          <strong>Parcours</strong> : groupes, sessions suivies, présences (avec leur historique de modification), notes
          d’apprentissage que vous rédigez. Finalité : organiser et suivre le programme, justifier la réalisation de l’accompagnement.
        </li>
        <li>
          <strong>Compétences</strong> : auto-évaluation, évaluations, niveaux et commentaires des formateurs, historique des
          corrections. Finalité : établir votre passeport de compétences.
        </li>
        <li>
          <strong>Bilans</strong> : bilans individuels versionnés (résultats observés et texte du bilan). Finalité : vous remettre une
          synthèse de votre parcours, transmissible à la structure qui vous accompagne.
        </li>
        <li>
          <strong>Organismes</strong> : nom de la structure, SIRET, ville, coordonnées professionnelles des personnes habilitées,
          historique des rattachements des participants.
        </li>
        <li>
          <strong>Contact</strong> : nom, e-mail, structure, message envoyés via le formulaire, et une empreinte chiffrée de l’adresse
          IP (l’adresse elle-même n’est pas conservée). Finalité : répondre à votre demande et limiter les envois abusifs.
        </li>
        <li>
          <strong>Sécurité</strong> : journal des actions sensibles (connexions, modifications, exports, consultations de fiche) avec
          leur date et leur auteur ; compteurs temporaires de tentatives (connexion, inscription, mot de passe oublié, codes d’accès),
          tenus sous forme d’empreintes chiffrées de l’adresse IP ou de l’adresse e-mail et effacés après deux jours au plus.
          Finalité : sécurité du service et traçabilité.
        </li>
        <li>
          <strong>Demandes relatives à vos données</strong> : demandes d’export ou de suppression et leur traitement. Finalité :
          répondre à l’exercice de vos droits et en garder la preuve.
        </li>
        <li>
          <strong>Notifications</strong> : messages affichés dans votre espace (par exemple le traitement d’une demande).
        </li>
      </ul>
      <p>
        Aucune donnée n’est vendue ni utilisée à des fins publicitaires. Les polices du site sont hébergées localement : aucun service
        tiers n’est contacté lors de votre visite du site public. Les formateurs ont pour consigne de ne saisir aucune information de
        santé, de situation judiciaire ou autre donnée sensible dans les commentaires.
      </p>

      <h2>Rédaction des bilans avec l’aide d’une intelligence artificielle</h2>
      <p>
        Le texte des bilans peut être préparé avec l’aide d’une intelligence artificielle. Elle reçoit uniquement les résultats
        validés par les formateurs, les commentaires partagés et la liste des activités : jamais votre nom, celui de votre structure
        ni celui des formateurs. Avant tout envoi, les adresses e-mail, numéros de téléphone, numéros d’identification et adresses
        éventuellement présents dans les commentaires sont automatiquement masqués. L’IA n’attribue aucun niveau : elle rédige un
        texte que le formateur relit, corrige et valide. Le bilan l’indique clairement (« Texte rédigé avec l’aide d’une
        intelligence artificielle, relu et validé par le formateur »). Le formateur peut aussi rédiger le bilan entièrement à la main.
      </p>
      <p>
        Ces données, bien que privées de nom, restent des données personnelles (pseudonymisées). Elles sont transmises au service
        OpenRouter, qui les achemine vers le modèle d’Anthropic, deux prestataires établis aux États-Unis : il s’agit d’un
        transfert hors de l’Union européenne, encadré par les garanties prévues par le RGPD (décision d’adéquation ou clauses
        contractuelles types) et par un accord de sous-traitance. <ToValidate /> Les prestataires sont configurés pour ne pas
        conserver ces données ni s’en servir pour entraîner leurs modèles. <ToValidate>à vérifier dans les contrats</ToValidate>
      </p>

      <h2>Bases légales</h2>
      <p>
        <ToValidate /> Les traitements liés à l’accompagnement (compte, parcours, présences, évaluations, bilans) reposent sur
        l’exécution de la mission d’accompagnement confiée à HAPPI par vous-même ou par la structure qui vous oriente (contrat ou
        mission d’intérêt public selon les cas) ; la sécurité et la traçabilité reposent sur l’intérêt légitime et sur les
        obligations de preuve liées au financement des formations ; le formulaire de contact repose sur votre demande. Le
        consentement recueilli à la création du compte reste utilisé pour les usages facultatifs. Ces bases légales sont en cours de
        validation et pourront être précisées.
      </p>

      <h2>Qui peut voir vos données ?</h2>
      <ul>
        <li>Vous-même, pour l’ensemble de vos informations.</li>
        <li>Les formateurs des groupes auxquels vous participez.</li>
        <li>L’organisme auquel vous êtes rattaché, pour vos présences, vos évaluations et vos bilans validés uniquement. Aucun autre organisme n’y a accès.</li>
        <li>Les administrateurs de la plateforme HAPPI, pour la gestion du service.</li>
      </ul>
      <p>Les notes privées des formateurs et les brouillons d’évaluation ou de bilan ne sont visibles que de l’équipe HAPPI.</p>

      <h2>Hébergement et sous-traitants</h2>
      <ul>
        <li><strong>Supabase</strong> (base de données, authentification) : données hébergées dans l’Union européenne (Irlande). Société de droit américain : un accès depuis les États-Unis ne peut être exclu, il est encadré contractuellement. <ToValidate /></li>
        <li><strong>Vercel</strong> (hébergement de l’application) : traitements exécutés dans l’Union européenne (Dublin). Société de droit américain. <ToValidate /></li>
        <li><strong>OpenRouter</strong> et <strong>Anthropic</strong> (rédaction des bilans avec l’aide de l’IA, si elle est utilisée) : États-Unis, voir ci-dessus.</li>
        <li><strong>Envoi des e-mails</strong> (confirmation de compte, mot de passe oublié) : <LegalValue value="" /></li>
      </ul>

      <h2>Durées de conservation</h2>
      <p>
        <ToValidate /> Les durées par catégorie sont <strong>à définir</strong>, notamment pour tenir compte des obligations de
        preuve des financeurs et de la certification qualité des formations. À titre provisoire :
      </p>
      <ul>
        <li>Compte, parcours, évaluations et bilans : durée de l’accompagnement, puis une durée à définir (paramétrée aujourd’hui à 36 mois), avant suppression ou anonymisation.</li>
        <li>Messages de contact : durée à définir.</li>
        <li>Journal de sécurité : durée à définir.</li>
        <li>Compteurs de tentatives : deux jours au plus.</li>
        <li>Demandes relatives aux données : durée à définir, pour garder la preuve de leur traitement.</li>
      </ul>

      <h2>Vos droits</h2>
      <p>
        Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, de portabilité et d’opposition, ainsi que
        du droit de définir des directives sur le sort de vos données après votre décès. Vous pouvez exporter vos données ou demander
        leur suppression depuis la page « Mon compte » de votre espace, ou écrire à {email}
        {dpo ? <> ou au référent protection des données ({dpo})</> : null}. Une réponse vous est apportée dans un délai d’un mois.
      </p>
      <p>
        Si vous estimez, après nous avoir contactés, que vos droits ne sont pas respectés, vous pouvez introduire une réclamation
        auprès de la Commission nationale de l’informatique et des libertés (CNIL), 3 place de Fontenoy, TSA 80715, 75334 Paris
        Cedex 07, ou en ligne sur cnil.fr.
      </p>

      <h2>Analyse d’impact</h2>
      <p>
        Le service évalue des compétences de personnes accompagnées vers l’emploi et utilise une intelligence artificielle pour la
        rédaction : une analyse d’impact relative à la protection des données (AIPD) est en cours de préparation. <ToValidate />
      </p>

      <h2>Sécurité</h2>
      <p>
        Les accès sont contrôlés au niveau de la base de données : chaque organisme ne peut consulter que ses propres participants.
        Les échanges sont chiffrés, les mots de passe et codes d’accès ne sont jamais stockés en clair, les tentatives de connexion
        répétées sont limitées, la double authentification est proposée à tous les comptes (et peut être exigée pour les
        administrateurs et formateurs), et les actions sensibles sont journalisées. En cas de violation de données, la CNIL et, si
        nécessaire, les personnes concernées sont informées dans les délais prévus par le RGPD.
      </p>
    </LegalPage>
  );
}
