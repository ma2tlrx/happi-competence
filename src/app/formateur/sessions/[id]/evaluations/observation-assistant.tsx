'use client';

import { Mic, MicOff, NotebookPen, Sparkles, Wand2 } from 'lucide-react';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox, Field, Textarea } from '@/components/ui/form';
import { Badge, Notice } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';
import { AI_FACT_PREFIX, NOTES_MAX_LENGTH, type ValidFact } from '@/lib/observation/structure';
import { useDictation } from '@/lib/speech/use-dictation';

import { saveNotesToTrainerNotes, structureSessionNotes } from './assistant-actions';

type Proposal = { facts: ValidFact[]; unattached: string[]; discarded: number };

/**
 * Notes de séance d'un participant : saisie au clavier ou dictée, puis proposition de
 * faits observables par l'IA. Rien n'est enregistré automatiquement : les faits cochés
 * sont ajoutés aux commentaires du brouillon d'évaluation, que le formateur relit.
 * Les notes brutes restent dans la page (jamais en base), sauf enregistrement explicite
 * dans les notes privées de séance.
 */
export function ObservationAssistant({
  sessionId,
  participant,
  aiReady,
  locked,
  knownSkillIds,
  onInsert,
}: {
  sessionId: string;
  participant: { id: string; firstName: string };
  aiReady: boolean;
  locked: boolean;
  knownSkillIds: Set<string>;
  onInsert: (selection: { facts: ValidFact[]; unattached: string[] }) => void;
}) {
  const [notes, setNotes] = useState('');
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [chosenFacts, setChosenFacts] = useState<Set<number>>(new Set());
  const [chosenUnattached, setChosenUnattached] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [structuring, startStructuring] = useTransition();
  const [saving, startSaving] = useTransition();
  const dictation = useDictation((text) => setNotes((current) => (current.trim() ? `${current.trimEnd()} ${text}` : text).slice(0, NOTES_MAX_LENGTH)));

  const structure = () =>
    startStructuring(async () => {
      if (dictation.listening) dictation.stop();
      setError(null);
      const result = await structureSessionNotes({ sessionId, participantId: participant.id, notes });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const facts = result.facts.filter((fact) => knownSkillIds.has(fact.skillId));
      setProposal({ facts, unattached: result.unattached, discarded: result.discarded + (result.facts.length - facts.length) });
      setChosenFacts(new Set());
      setChosenUnattached(new Set());
    });

  const insert = () => {
    if (!proposal) return;
    onInsert({ facts: proposal.facts.filter((_, index) => chosenFacts.has(index)), unattached: proposal.unattached.filter((_, index) => chosenUnattached.has(index)) });
    toast.success('Ajouté aux commentaires du brouillon. Relisez-les avant de valider l’évaluation.');
    // Les notes brutes ne sont pas conservées après reprise.
    setProposal(null);
    setNotes('');
  };

  const saveNotes = () =>
    startSaving(async () => {
      const result = await saveNotesToTrainerNotes({ sessionId, participantId: participant.id, notes });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });

  const toggle = (set: Set<number>, index: number) => {
    const next = new Set(set);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    return next;
  };
  const chosenCount = chosenFacts.size + chosenUnattached.size;

  return (
    <details className="rounded-lg border border-line bg-white">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-5 py-3 font-semibold">
        <NotebookPen className="size-5 text-petrol-500" aria-hidden />
        Notes de séance
        <span className="text-sm font-normal text-ink-subtle">· tapez ou dictez, puis structurez</span>
      </summary>
      <div className="space-y-4 border-t border-line p-5">
        <Field
          label={`Notes brutes sur ${participant.firstName}`}
          hint="Ces notes ne sont pas enregistrées : elles disparaissent quand vous changez de participant ou quittez la page, sauf si vous les ajoutez à vos notes privées. Ne saisissez aucune donnée de santé ni information sensible."
        >
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={5}
              maxLength={NOTES_MAX_LENGTH}
              disabled={locked}
              placeholder="Ex. a proposé de répartir les rôles avant la partie, a relu la consigne à voix haute pour le groupe…"
            />
          )}
        </Field>
        {dictation.interim ? (
          <p className="text-sm text-ink-subtle italic" aria-live="polite">
            {dictation.interim}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {dictation.supported ? (
            <Button type="button" variant={dictation.listening ? 'secondary' : 'outline'} onClick={dictation.listening ? dictation.stop : dictation.start} disabled={locked} aria-pressed={dictation.listening}>
              {dictation.listening ? <MicOff aria-hidden /> : <Mic aria-hidden />}
              {dictation.listening ? 'Arrêter la dictée' : 'Dicter'}
            </Button>
          ) : null}
          <Button type="button" onClick={structure} loading={structuring} disabled={locked || !aiReady || !notes.trim()}>
            <Wand2 aria-hidden />
            Structurer
          </Button>
          <Button type="button" variant="ghost" onClick={saveNotes} loading={saving} disabled={locked || !notes.trim()}>
            Ajouter à mes notes privées
          </Button>
        </div>
        <p className="text-xs text-ink-subtle">
          {dictation.supported
            ? 'Dictée du navigateur (français) : selon votre navigateur, le son peut être transcrit par le service de reconnaissance vocale de son éditeur. Le clavier reste toujours possible.'
            : 'La dictée n’est pas proposée par ce navigateur : saisissez vos notes au clavier (ou utilisez la dictée de votre clavier).'}
        </p>
        {dictation.error ? <Notice variant="warning">{dictation.error}</Notice> : null}
        {!aiReady ? (
          <Notice title="Aide à la structuration indisponible">
            Aucune clé de service d’IA n’est configurée sur ce serveur. La saisie et la dictée fonctionnent : reprenez vos notes à la main dans les commentaires.
          </Notice>
        ) : (
          <p className="text-xs text-ink-subtle">
            « Structurer » envoie vos notes, sans nom ni coordonnées, à un service d’intelligence artificielle. Il propose des faits rattachés aux
            compétences de la séance, jamais de niveau ni de note. Vous choisissez ce que vous reprenez.
          </p>
        )}
        {error ? <Notice variant="danger">{error}</Notice> : null}

        {proposal ? (
          <section aria-labelledby="proposition-titre" className="space-y-3 rounded-md border border-petrol-200 bg-petrol-50/50 p-4">
            <h4 id="proposition-titre" className="flex flex-wrap items-center gap-2 font-semibold">
              Proposition à relire
              <Badge variant="orange" icon={Sparkles}>
                Proposé par l’IA
              </Badge>
            </h4>
            {proposal.facts.length === 0 && proposal.unattached.length === 0 ? (
              <p className="text-sm text-ink-muted">Aucun fait observable n’a été repéré dans ces notes.</p>
            ) : null}
            {proposal.facts.length ? (
              <ul className="space-y-3">
                {proposal.facts.map((fact, index) => (
                  <li key={index} className="rounded-md border border-line bg-white p-3">
                    <Checkbox
                      checked={chosenFacts.has(index)}
                      onChange={() => setChosenFacts((set) => toggle(set, index))}
                      label={
                        <>
                          <span className="font-semibold">{fact.skillName}</span>
                          {fact.criterionLabel ? <span className="text-ink-muted"> · {fact.criterionLabel}</span> : null}
                          <span className="mt-0.5 block">{fact.fact}</span>
                        </>
                      }
                      description={<>D’après vos notes : « {fact.excerpt} »</>}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
            {proposal.unattached.length ? (
              <div>
                <p className="text-sm font-semibold">Passages non rattachés à une compétence de la séance</p>
                <ul className="mt-2 space-y-2">
                  {proposal.unattached.map((excerpt, index) => (
                    <li key={index} className="rounded-md border border-line bg-white p-3">
                      <Checkbox
                        checked={chosenUnattached.has(index)}
                        onChange={() => setChosenUnattached((set) => toggle(set, index))}
                        label={<>« {excerpt} »</>}
                        description="À reprendre, si vous le souhaitez, dans l’observation générale."
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {proposal.discarded ? (
              <p className="text-xs text-ink-subtle">
                {proposal.discarded} proposition{proposal.discarded > 1 ? 's' : ''} écartée{proposal.discarded > 1 ? 's' : ''} automatiquement (extrait introuvable dans vos
                notes, compétence hors séance, ou mention d’un niveau ou d’un diagnostic).
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={insert} disabled={locked || chosenCount === 0}>
                Ajouter la sélection aux commentaires
              </Button>
              <Button type="button" variant="ghost" onClick={() => setProposal(null)}>
                Ignorer
              </Button>
            </div>
            <p className="text-xs text-ink-subtle">
              Les textes ajoutés commencent par « {AI_FACT_PREFIX.trim()} » et restent en brouillon : aucun niveau n’est saisi pour vous, rien n’est validé
              automatiquement.
            </p>
          </section>
        ) : null}
      </div>
    </details>
  );
}
