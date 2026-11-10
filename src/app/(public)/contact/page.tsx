import { Mail, Phone } from 'lucide-react';
import type { Metadata } from 'next';

import { PageHero, Section } from '@/components/public/sections';
import { siteConfig } from '@/config/site';
import { getPublicCatalog, settingList, settingString } from '@/lib/public-catalog';

import { ContactForm } from './contact-form';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contactez l’équipe HAPPI pour mettre en place le programme dans votre structure.',
};

export default async function ContactPage() {
  const catalog = await getPublicCatalog();
  const email = settingString(catalog, 'contact.email') || siteConfig.contactEmail;
  const phones = settingList(catalog, 'contact.phones');
  return (
    <>
      <PageHero title="Nous contacter" intro="Une question sur le programme, un projet pour votre structure ? Écrivez-nous, nous vous répondons par e-mail." />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <div className="space-y-8">
            <div>
              <h2 className="text-title">Par e-mail ou par téléphone</h2>
              <ul className="mt-4 space-y-3">
                <li>
                  <a href={`mailto:${email}`} className="inline-flex items-center gap-3 font-medium text-ink hover:text-petrol-700">
                    <Mail className="size-5 text-petrol-500" aria-hidden />
                    {email}
                  </a>
                </li>
                {phones.map((phone) => (
                  <li key={phone}>
                    <a href={`tel:${phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-3 font-medium text-ink hover:text-petrol-700">
                      <Phone className="size-5 text-petrol-500" aria-hidden />
                      {phone}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-title">Les porteurs du projet</h2>
              <ul className="mt-4 space-y-3">
                {siteConfig.team.map((member) => (
                  <li key={member.email}>
                    <p className="font-semibold">{member.name}</p>
                    <a href={`mailto:${member.email}`} className="text-[0.9375rem] text-petrol-700 underline-offset-4 hover:underline">
                      {member.email}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <ContactForm />
        </div>
      </Section>
    </>
  );
}
