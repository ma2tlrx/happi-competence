import type { Metadata } from 'next';

import { LegalPage, LegalValue } from '@/components/public/legal-page';
import { siteConfig } from '@/config/site';
import { getPublicCatalog, settingString } from '@/lib/public-catalog';

export const metadata: Metadata = { title: 'Mentions légales' };

export default async function MentionsLegalesPage() {
  const catalog = await getPublicCatalog();
  const get = (key: string) => settingString(catalog, key);
  return (
    <LegalPage title="Mentions légales" updated="novembre 2026">
      <h2>Éditeur du site</h2>
      <ul>
        <li>Raison sociale : <LegalValue value={get('legal.company_name')} /></li>
        <li>Forme juridique : <LegalValue value={get('legal.legal_form')} /></li>
        <li>SIRET : <LegalValue value={get('legal.siret')} /></li>
        <li>Adresse : <LegalValue value={get('legal.address')} /></li>
        <li>Contact : {get('contact.email') || siteConfig.contactEmail}</li>
        <li>Directeur de la publication : <LegalValue value={get('legal.publication_director')} /></li>
      </ul>
      <h2>Hébergement</h2>
      <p>
        Hébergeur du site : <LegalValue value={get('legal.host')} />
      </p>
      <h2>Propriété intellectuelle</h2>
      <p>
        Les textes, visuels, logotypes, la mascotte HAPPI et les supports pédagogiques sont la propriété de HAPPI Compétence. Toute
        reproduction sans autorisation écrite est interdite. Les noms de jeux vidéo cités appartiennent à leurs éditeurs respectifs.
      </p>
      <h2>Données personnelles</h2>
      <p>
        Le traitement des données personnelles est décrit dans la <a href="/confidentialite">politique de confidentialité</a>.
      </p>
    </LegalPage>
  );
}
