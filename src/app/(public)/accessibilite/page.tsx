import type { Metadata } from 'next';

import { LegalPage, LegalValue, ToValidate } from '@/components/public/legal-page';
import { siteConfig } from '@/config/site';
import { getPublicCatalog, settingString } from '@/lib/public-catalog';

export const metadata: Metadata = { title: 'Déclaration d’accessibilité' };

/**
 * Déclaration d'accessibilité (modèle RGAA 4.1). Tant qu'aucun audit de conformité n'a
 * été réalisé, l'état de conformité est « non conforme » : c'est la règle du RGAA.
 */
export default async function AccessibilitePage() {
  const catalog = await getPublicCatalog();
  const email = settingString(catalog, 'contact.email') || siteConfig.contactEmail;
  const company = settingString(catalog, 'legal.company_name');
  return (
    <LegalPage title="Déclaration d’accessibilité" updated="novembre 2026">
      <p>
        <LegalValue value={company} /> s’engage à rendre son site et sa plateforme accessibles à tous, y compris aux personnes en
        situation de handicap. Cette déclaration s’applique au site {siteConfig.url.replace(/^https?:\/\//, '')} et aux espaces
        participant, organisme, formateur et administrateur de la plateforme HAPPI Compétence.
      </p>
      <p>
        L’obligation légale de publier cette déclaration (article 47 de la loi n° 2005-102 du 11 février 2005) dépend du statut de
        l’éditeur et de ses clients. <ToValidate /> HAPPI la publie dans tous les cas, par transparence.
      </p>

      <h2>État de conformité</h2>
      <p>
        Le site HAPPI Compétence est <strong>non conforme</strong> avec le référentiel général d’amélioration de l’accessibilité
        (RGAA), version 4.1 : aucun audit de conformité n’a encore été réalisé. Cette mention ne signifie pas que le site est
        inaccessible, mais que sa conformité n’a pas été mesurée par un audit.
      </p>

      <h2>Mesures déjà prises</h2>
      <ul>
        <li>Navigation complète au clavier, focus visible et lien d’accès direct au contenu.</li>
        <li>Champs de formulaire associés à leur intitulé, messages d’erreur reliés aux champs et annoncés aux lecteurs d’écran.</li>
        <li>Contrastes de couleur vérifiés sur les couleurs de la charte ; textes agrandissables ; affichage adapté aux téléphones.</li>
        <li>Animations réduites lorsque le système de l’utilisateur le demande.</li>
        <li>Tableaux défilants sur petit écran plutôt que tronqués ; cibles tactiles d’au moins 32 pixels.</li>
        <li>Vérifications manuelles (clavier, affichage sur téléphone, contrastes) lors du développement.</li>
      </ul>

      <h2>Contenus dont l’accessibilité n’est pas garantie</h2>
      <ul>
        <li>Documents PDF (bilans, passeports, feuilles de présence) : leur structure n’est pas encore balisée pour les lecteurs d’écran. Une version accessible peut être demandée (voir ci-dessous).</li>
        <li>Supports pédagogiques et graphiques (radar des compétences) : une alternative textuelle existe pour les niveaux, mais n’a pas été auditée.</li>
      </ul>

      <h2>Établissement de cette déclaration</h2>
      <p>
        Cette déclaration a été établie en novembre 2026 sur la base d’une auto-évaluation. Un audit par un tiers et un schéma
        pluriannuel de mise en accessibilité sont <LegalValue value="" />.
      </p>

      <h2>Retour d’information et contact</h2>
      <p>
        Si vous n’arrivez pas à accéder à un contenu ou à un service, contactez-nous pour être orienté vers une alternative
        accessible ou obtenir le contenu sous une autre forme : par e-mail à {email} ou via le <a href="/contact">formulaire de contact</a>.
      </p>

      <h2>Voies de recours</h2>
      <p>
        Si vous avez signalé un défaut d’accessibilité qui vous empêche d’accéder à un contenu ou à un service et que vous n’avez
        pas obtenu de réponse satisfaisante, vous pouvez :
      </p>
      <ul>
        <li>écrire un message au Défenseur des droits (formulaire en ligne sur defenseurdesdroits.fr) ;</li>
        <li>contacter le délégué du Défenseur des droits dans votre région ;</li>
        <li>envoyer un courrier par la poste (gratuit, ne pas mettre de timbre) : Défenseur des droits, Libre réponse 71120, 75342 Paris CEDEX 07.</li>
      </ul>
    </LegalPage>
  );
}
