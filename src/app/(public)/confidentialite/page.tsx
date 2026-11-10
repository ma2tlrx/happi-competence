import type { Metadata } from 'next';

import { LegalPage, LegalValue } from '@/components/public/legal-page';
import { siteConfig } from '@/config/site';
import { getPublicCatalog, settingString } from '@/lib/public-catalog';

export const metadata: Metadata = { title: 'Politique de confidentialité' };

export default async function ConfidentialitePage() {
  const catalog = await getPublicCatalog();
  const email = settingString(catalog, 'contact.email') || siteConfig.contactEmail;
  const retention = 36;
  return (
    <LegalPage title="Politique de confidentialité" updated="novembre 2026">
      <p>
        La plateforme HAPPI Compétence contient des informations personnelles et des évaluations individuelles. Cette page explique
        quelles données sont collectées, pourquoi, qui peut les consulter et comment exercer vos droits (règlement général sur la
        protection des données, RGPD).
      </p>
      <h2>Responsable du traitement</h2>
      <p>
        <LegalValue value={settingString(catalog, 'legal.company_name')} /> — contact : {email}. Délégué ou référent à la protection
        des données : <LegalValue value={settingString(catalog, 'legal.dpo_contact')} />.
      </p>
      <h2>Données collectées et finalités</h2>
      <ul>
        <li><strong>Compte</strong> : prénom, nom, adresse e-mail, mot de passe (chiffré), date d’acceptation des conditions. Finalité : vous permettre d’accéder à votre espace.</li>
        <li><strong>Parcours</strong> : groupe, sessions, présences. Finalité : organiser et suivre le programme.</li>
        <li><strong>Compétences</strong> : auto-évaluation, évaluations et commentaires des formateurs. Finalité : établir votre passeport de compétences.</li>
        <li><strong>Organismes</strong> : nom de la structure et coordonnées professionnelles des personnes habilitées.</li>
        <li><strong>Contact</strong> : nom, e-mail et message envoyés via le formulaire. Finalité : répondre à votre demande.</li>
        <li><strong>Journal de sécurité</strong> : actions sensibles (connexions, modifications, exports) avec leur date et leur auteur. Finalité : sécurité et traçabilité.</li>
      </ul>
      <p>Aucune donnée n’est vendue ni utilisée à des fins publicitaires. Les polices du site sont hébergées localement : aucun service tiers n’est contacté lors de votre visite.</p>
      <h2>Base légale</h2>
      <p>
        Le traitement repose sur votre consentement, recueilli à la création du compte, et sur l’exécution de l’accompagnement
        proposé par HAPPI et votre structure d’accompagnement.
      </p>
      <h2>Qui peut voir vos données ?</h2>
      <ul>
        <li>Vous-même, pour l’ensemble de vos informations.</li>
        <li>Les formateurs des groupes auxquels vous participez.</li>
        <li>L’organisme auquel vous êtes rattaché, pour vos présences et vos évaluations validées uniquement. Aucun autre organisme n’y a accès.</li>
        <li>Les administrateurs de la plateforme HAPPI, pour la gestion du service.</li>
      </ul>
      <p>Les notes privées des formateurs et les brouillons d’évaluation ne sont visibles que de l’équipe HAPPI.</p>
      <h2>Durée de conservation</h2>
      <p>
        Les données sont conservées pendant la durée de l’accompagnement puis {retention} mois au maximum, avant suppression ou
        anonymisation, sauf demande de suppression anticipée.
      </p>
      <h2>Vos droits</h2>
      <p>
        Vous pouvez accéder à vos données, les rectifier, les exporter ou demander leur suppression depuis la page « Mon compte » de
        votre espace, ou en écrivant à {email}. Vous pouvez également introduire une réclamation auprès de la CNIL (cnil.fr).
      </p>
      <h2>Sécurité</h2>
      <p>
        Les accès sont contrôlés au niveau de la base de données : chaque organisme ne peut consulter que ses propres participants.
        Les échanges sont chiffrés, les mots de passe et codes d’accès ne sont jamais stockés en clair, et les actions sensibles sont
        journalisées.
      </p>
    </LegalPage>
  );
}
