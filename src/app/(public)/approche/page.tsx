import { Eye, Gamepad2, HeartHandshake, Scale, ShieldCheck, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';

import { Reveal } from '@/components/public/reveal';
import { PageHero, Section, SectionHeading } from '@/components/public/sections';
import { mission, pillars, vision } from '@/config/site-content';

export const metadata: Metadata = {
  title: 'Notre approche',
  description: 'Le jeu vidéo comme support d’observation, de mise en situation et de développement des compétences transversales.',
};

const principles = [
  {
    icon: Gamepad2,
    title: 'Le jeu comme situation réelle',
    text: 'Désamorcer une bombe à plusieurs, faire tourner une cuisine, résoudre une énigme : le jeu crée des situations où l’on coopère, décide et gère la pression pour de vrai. Il ne s’agit pas de former des joueurs.',
  },
  {
    icon: Eye,
    title: 'Observer plutôt que déclarer',
    text: 'Les formateurs observent des comportements, à partir de critères partagés. Une compétence est notée parce qu’elle a été vue, pas parce qu’elle a été affirmée.',
  },
  {
    icon: Scale,
    title: 'Deux regards, jamais confondus',
    text: 'L’auto-évaluation initiale du participant est conservée telle quelle. Les observations des formateurs s’y ajoutent : on compare, on ne remplace pas.',
  },
  {
    icon: HeartHandshake,
    title: 'Un cadre bienveillant',
    text: 'Chacun s’exprime sans être jugé. Les débriefings servent à mettre des mots sur ce qui s’est passé et à relier le jeu au monde professionnel.',
  },
  {
    icon: Sparkles,
    title: 'Valoriser, pas classer',
    text: 'Un score décrit un niveau observé à un moment donné. Ce n’est ni un diagnostic psychologique ni une mesure de la valeur d’une personne.',
  },
  {
    icon: ShieldCheck,
    title: 'Des repères reconnus',
    text: 'L’identification des habiletés socio-cognitives s’appuie sur les travaux de normalisation AFNOR XP X50-766.',
  },
];

export default function ApprochePage() {
  return (
    <>
      <PageHero title="Notre approche" intro={vision} />

      <Section tone="white">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <SectionHeading title="Notre mission" intro={mission} />
          <dl className="grid gap-4 sm:grid-cols-2">
            {pillars.map((pillar, index) => (
              <Reveal key={pillar.title} delay={index * 0.06}>
                <div className="h-full rounded-lg bg-paper p-6">
                  <dt className="font-display text-lg font-semibold">{pillar.title}</dt>
                  <dd className="mt-2 text-ink-muted">{pillar.text}</dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>
      </Section>

      <Section>
        <SectionHeading title="Nos principes" />
        <div className="mt-10 grid gap-x-10 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
          {principles.map((principle, index) => (
            <Reveal key={principle.title} delay={(index % 3) * 0.06}>
              <principle.icon className="size-6 text-orange-600" aria-hidden />
              <h3 className="mt-4 text-title">{principle.title}</h3>
              <p className="mt-2 text-ink-muted">{principle.text}</p>
            </Reveal>
          ))}
        </div>
      </Section>
    </>
  );
}
