import { FileDown, Share2, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ListenButton } from '@/components/a11y/listen-button';
import { BilanView } from '@/components/passport/bilan-view';
import { SkillsCvForm } from '@/components/passport/skills-cv-form';
import { FinalReports } from '@/components/report/final-reports';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/primitives';
import { EASY_READ_MENTION, easyReadToText, easyReadWritingMention } from '@/lib/report/easy-read';
import { latestValidatedEasyRead, listReports } from '@/lib/report/load';
import { observedSkillOptions } from '@/lib/skills-cv';
import { passportListenText, reportListenText } from '@/lib/speech/texts';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

import { getMyPassport } from '../data';

export const metadata: Metadata = { title: 'Mon bilan' };

export default async function BilanPage() {
  const { passport } = await getMyPassport();
  const supabase = await createClient();
  const reports = await listReports(supabase, passport.participant.id);
  // RLS : le participant ne lit que ses bilans validés, et seules les versions faciles à lire validées.
  const latest = reports.find((report) => report.status === 'final' && report.content) ?? null;
  const easyRead = latest ? await latestValidatedEasyRead(supabase, latest.id) : null;
  const cvOptions = observedSkillOptions(passport);
  return (
    <>
      <PageHeader
        title="Mon bilan"
        description="Une synthèse de ce que vos formateurs ont observé, à consulter et à présenter dans votre parcours professionnel."
        actions={
          <>
            <ListenButton text={passportListenText(passport)} label="Écouter mes compétences" />
            <Button asChild variant="outline">
              <Link href="/participant/partage">
                <Share2 aria-hidden />
                Partager mon passeport
              </Link>
            </Button>
            <Button asChild>
              <a href={`/api/exports/passeport/${passport.participant.id}`} download>
                <FileDown aria-hidden />
                Télécharger mon passeport (PDF)
              </a>
            </Button>
          </>
        }
      />
      <FinalReports reports={reports} title="Mes bilans HAPPI" />

      {latest?.content ? (
        <Card className="mb-6">
          <CardHeader
            title={`Mon bilan du ${formatDate(latest.finalizedAt)}`}
            description="Écoutez l’introduction et la synthèse de votre bilan. La lecture se fait par votre navigateur : rien n’est envoyé à un service extérieur."
            action={<ListenButton text={reportListenText(latest.content)} />}
            className={easyRead?.content ? undefined : 'pb-5'}
          />
          {easyRead?.content ? (
            <CardBody>
              <section aria-labelledby="facile-a-lire" className="rounded-md border border-line bg-paper/60 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="facile-a-lire" className="text-title">
                    Version facile à lire
                  </h2>
                  <ListenButton text={easyReadToText(easyRead.content)} />
                </div>
                <div className="mt-3 space-y-4 text-[1.0625rem] leading-relaxed">
                  {easyRead.content.sections.map((section, index) => (
                    <div key={index}>
                      <h3 className="font-semibold">{section.title}</h3>
                      <ul className="mt-1 space-y-1">
                        {section.sentences.map((sentence, position) => (
                          <li key={position}>{sentence}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <p className="mt-4 flex items-start gap-1.5 text-sm text-ink-muted">
                  {easyRead.contentSource === 'manual' ? null : <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
                  {easyReadWritingMention(easyRead.contentSource)}
                </p>
                <p className="mt-1 text-xs text-ink-subtle">{EASY_READ_MENTION}</p>
              </section>
            </CardBody>
          ) : null}
        </Card>
      ) : null}

      {cvOptions.length > 0 ? (
        <Card className="mb-6">
          <CardHeader
            title="Mon CV de compétences"
            description="Une page « Mes compétences observées » à joindre à une candidature : les compétences que vous choisissez, avec leur niveau validé. Jamais les commentaires des formateurs ni vos présences."
          />
          <CardBody>
            <SkillsCvForm participantId={passport.participant.id} options={cvOptions} />
          </CardBody>
        </Card>
      ) : null}

      <BilanView passport={passport} />
    </>
  );
}
