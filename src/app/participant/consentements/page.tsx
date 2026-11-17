import { FileSignature } from 'lucide-react';
import type { Metadata } from 'next';

import { ConsentForm } from '@/components/referrals/consent-form';
import { Card, CardBody, CardHeader, EmptyState, Notice, PageHeader } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { formatParisDateTime } from '@/lib/referrals/dates';
import { INFORMATION_POINTS } from '@/lib/referrals/fields';
import { createClient } from '@/lib/supabase/server';

import { confirmConsents } from './actions';

export const metadata: Metadata = { title: 'Mes consentements' };

export default async function ConsentsPage() {
  await requireRole('participant');
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_referral_consents');
  const referrals = data ?? [];
  return (
    <>
      <PageHeader title="Mes consentements" description="Vos choix concernant votre image et le partage de vos résultats avec la structure qui vous a orienté(e). Modifiables à tout moment." />
      {referrals.length === 0 ? (
        <Card>
          <EmptyState icon={FileSignature} title="Aucun consentement à gérer" description="Vous n’avez pas été orienté(e) vers HAPPI par une structure partenaire." />
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Comment vos données sont utilisées" />
            <CardBody>
              <ul className="list-disc space-y-1.5 pl-5 text-[0.9375rem] text-ink-muted">
                {INFORMATION_POINTS.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </CardBody>
          </Card>
          {referrals.map((referral) => (
            <Card key={referral.referral_id}>
              <CardHeader
                title={`Orientation par ${referral.organization_name}`}
                description={[referral.program_name, `Information reçue le ${formatParisDateTime(referral.information_acknowledged_at)}`].filter(Boolean).join(' · ')}
              />
              <CardBody className="space-y-4">
                {referral.participant_confirmed_at ? (
                  <p className="text-sm text-ink-subtle">Dernière confirmation : {formatParisDateTime(referral.participant_confirmed_at)}.</p>
                ) : (
                  <Notice variant="warning" title="À confirmer">
                    Votre conseiller a indiqué vos choix lors de l’orientation. Vérifiez-les et confirmez-les vous-même.
                  </Notice>
                )}
                <ConsentForm
                  action={confirmConsents.bind(null, referral.referral_id)}
                  image={referral.consent_image}
                  share={referral.consent_share_results}
                  confirmed={Boolean(referral.participant_confirmed_at)}
                />
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
