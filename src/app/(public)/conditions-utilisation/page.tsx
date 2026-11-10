import type { Metadata } from 'next';

import { LegalPage } from '@/components/public/legal-page';

export const metadata: Metadata = { title: 'Conditions d’utilisation' };

export default function ConditionsPage() {
  return (
    <LegalPage title="Conditions d’utilisation" updated="novembre 2026">
      <h2>Objet</h2>
      <p>
        La plateforme HAPPI Compétence permet aux participants de suivre leur parcours et de consulter leur passeport de
        compétences, aux organismes partenaires de suivre les participants qui leur sont rattachés, et à l’équipe HAPPI d’animer et
        d’évaluer les sessions.
      </p>
      <h2>Accès et comptes</h2>
      <ul>
        <li>Les comptes participants sont personnels. Vous êtes responsable de la confidentialité de votre mot de passe.</li>
        <li>Les espaces organismes sont ouverts après validation par HAPPI. Les comptes formateurs et administrateurs sont créés uniquement à l’aide d’un code d’accès délivré par HAPPI.</li>
        <li>HAPPI peut suspendre un compte en cas d’usage contraire aux présentes conditions.</li>
      </ul>
      <h2>Nature des évaluations</h2>
      <p>
        Les niveaux affichés décrivent des comportements observés pendant le programme, à un moment donné. Ils ne constituent ni un
        diagnostic psychologique, ni une certification, ni une mesure de la valeur d’une personne.
      </p>
      <h2>Engagements des organismes</h2>
      <p>
        Les organismes s’engagent à n’utiliser les informations consultées que pour l’accompagnement des personnes concernées et à
        ne pas les communiquer à des tiers.
      </p>
      <h2>Données personnelles</h2>
      <p>
        Leur traitement est décrit dans la <a href="/confidentialite">politique de confidentialité</a>.
      </p>
    </LegalPage>
  );
}
