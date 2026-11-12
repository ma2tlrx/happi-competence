'use client';

import { Ban, Copy, FileDown, ImageDown, Link2, QrCode } from 'lucide-react';
import { useActionState, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox, Field, FormMessage, Input, Select, SubmitButton } from '@/components/ui/form';
import { Dialog, DialogContent } from '@/components/ui/overlays';
import { toast } from '@/components/ui/toast';
import { SHARE_DURATIONS, SHARE_LABEL_MAX } from '@/lib/passport-share/rules';

import { createShare, revealShare, revokeShare, type RevealedShare } from './actions';

/** Lien, QR code et téléchargements d'un lien actif. Le jeton reste en mémoire, jamais dans le stockage du navigateur. */
function SharePanel({ share, participantId }: { share: RevealedShare; participantId?: string }) {
  const copy = () =>
    navigator.clipboard.writeText(share.url).then(
      () => toast.success('Lien copié.'),
      () => toast.error('Copie impossible : sélectionnez le lien et copiez-le.'),
    );
  const qr = `/api/exports/partage/${share.shareId}/qr`;
  return (
    <div className="grid gap-5 sm:grid-cols-[11rem_1fr] sm:items-start">
      {/* eslint-disable-next-line @next/next/no-img-element -- image produite par le serveur, en mémoire */}
      <img
        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(share.svg)}`}
        alt="QR code du lien de vérification"
        className="mx-auto size-44 rounded-md border border-line bg-white p-1 sm:mx-0"
      />
      <div className="min-w-0 space-y-3">
        <div>
          <p className="text-sm font-semibold text-ink">Lien de vérification</p>
          <p className="mt-1 rounded-md bg-paper px-3 py-2 font-mono text-sm break-all text-ink select-all">{share.url}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={copy}>
            <Copy aria-hidden />
            Copier le lien
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={`${qr}?format=png`} download>
              <ImageDown aria-hidden />
              QR code (PNG)
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={`${qr}?format=svg`} download>
              <ImageDown aria-hidden />
              QR code (SVG)
            </a>
          </Button>
          {participantId ? (
            <Button asChild size="sm" variant="outline">
              <a href={`/api/exports/passeport/${participantId}?partage=${share.shareId}`} download>
                <FileDown aria-hidden />
                Passeport PDF avec ce QR code
              </a>
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-ink-subtle">Transmettez ce lien uniquement à la personne concernée : quiconque le possède peut consulter la page tant qu’il est actif.</p>
      </div>
    </div>
  );
}

export function ShareForm({
  hasFinalReport,
  hasSociocognitive,
  limitReached,
  participantId,
}: {
  hasFinalReport: boolean;
  hasSociocognitive: boolean;
  limitReached: boolean;
  participantId: string;
}) {
  const [state, action] = useActionState(createShare, null);
  const errors = state?.fieldErrors ?? {};
  const created = state?.ok ? state.data : null;
  return (
    <div className="space-y-5">
      {created ? (
        <div className="rounded-lg border border-success/30 bg-success-soft/60 p-4" role="status">
          <p className="mb-4 flex items-center gap-2 font-semibold text-success">
            <Link2 className="size-5" aria-hidden />
            {state?.message}
          </p>
          <SharePanel share={created} participantId={participantId} />
        </div>
      ) : null}
      {limitReached ? (
        <p className="text-sm text-ink-muted">Vous avez atteint 10 liens actifs. Révoquez un lien pour en créer un nouveau.</p>
      ) : (
        <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Pour qui ?" required error={errors.label} hint="Un repère pour vous, non affiché sur la page partagée.">
            {({ id, describedBy, invalid }) => (
              <Input id={id} name="label" maxLength={SHARE_LABEL_MAX} aria-describedby={describedBy} aria-invalid={invalid || undefined} placeholder="Ex. Entreprise Dupont, entretien du 12 décembre" required />
            )}
          </Field>
          <Field label="Durée de validité" error={errors.duration}>
            {({ id, describedBy }) => (
              <Select id={id} name="duration" defaultValue="30" aria-describedby={describedBy}>
                {SHARE_DURATIONS.map((days) => (
                  <option key={days} value={days}>
                    {days} jours
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <fieldset className="space-y-3 sm:col-span-2">
            <legend className="mb-2 text-sm font-semibold text-ink">Contenu partagé</legend>
            <Checkbox checked disabled readOnly label="Compétences transversales observées" description="Toujours incluses : niveau validé et descripteur de chaque compétence observée." />
            {hasSociocognitive ? <Checkbox name="includeSociocognitive" label="Habiletés socio-cognitives observées" /> : null}
            <Checkbox
              name="includeReport"
              disabled={!hasFinalReport}
              label="Mon bilan validé le plus récent"
              description={hasFinalReport ? 'Synthèse, lecture par référentiel, conclusion et limites. Les recommandations et retours par session ne sont pas partagés.' : 'Disponible quand votre formateur aura validé un bilan.'}
            />
          </fieldset>
          <div className="sm:col-span-2">
            {!state?.ok ? <FormMessage state={state} /> : null}
            <SubmitButton>
              <QrCode aria-hidden />
              Créer le lien
            </SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}

export function ShowShareButton({ shareId, label, participantId }: { shareId: string; label: string; participantId: string }) {
  const [open, setOpen] = useState(false);
  const [share, setShare] = useState<RevealedShare | null>(null);
  const [pending, start] = useTransition();
  const show = () =>
    start(async () => {
      const result = await revealShare(shareId);
      if (result?.ok && result.data) {
        setShare(result.data);
        setOpen(true);
      } else toast.error(result?.message ?? 'Lien indisponible.');
    });
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setShare(null);
      }}
    >
      <Button type="button" size="sm" variant="outline" loading={pending} onClick={show} aria-label={`Afficher le lien et le QR code « ${label} »`}>
        <QrCode aria-hidden />
        Afficher
      </Button>
      {share ? (
        <DialogContent title={`Lien « ${label} »`} size="lg">
          <SharePanel share={share} participantId={participantId} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export function RevokeShareButton({ shareId, label }: { shareId: string; label: string }) {
  const [pending, start] = useTransition();
  const revoke = () =>
    start(async () => {
      if (!window.confirm(`Révoquer le lien « ${label} » ? La page ne sera plus consultable, même par les personnes qui l’ont déjà reçue.`)) return;
      const result = await revokeShare(shareId);
      if (result.ok) toast.success('Lien révoqué.');
      else toast.error(result.message ?? 'Révocation impossible.');
    });
  return (
    <Button type="button" size="sm" variant="ghost" loading={pending} onClick={revoke} aria-label={`Révoquer le lien « ${label} »`}>
      <Ban aria-hidden />
      Révoquer
    </Button>
  );
}
