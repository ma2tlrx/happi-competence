'use client';

import { Play, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input } from '@/components/ui/form';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/overlays';
import { Card, CardBody, CardHeader, EmptyState, Notice } from '@/components/ui/primitives';
import { buttonClasses } from '@/components/ui/button';
import { undercoverApi, type UndercoverConfig } from '@/lib/jeux/client-undercover';

type LaunchInput = { civilWord: string; undercoverWord: string; includeMisterWhite: boolean };

/** Création d'une partie « Fourmi Caché » (Undercover) et gestion des configurations enregistrées. Réservé à l'animateur. */
export function UndercoverCreate({ defaultNickname }: { defaultNickname: string }) {
  const router = useRouter();
  const [civilWord, setCivilWord] = useState('');
  const [undercoverWord, setUndercoverWord] = useState('');
  const [includeMisterWhite, setIncludeMisterWhite] = useState(true);
  const [saveAs, setSaveAs] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [configs, setConfigs] = useState<UndercoverConfig[] | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<UndercoverConfig | null>(null);

  useEffect(() => {
    let off = false;
    undercoverApi.listConfigs().then((result) => {
      if (off) return;
      if (result.ok) setConfigs(result.data.configs);
      else {
        setConfigs([]);
        setConfigError(result.error);
      }
    });
    return () => {
      off = true;
    };
  }, []);

  async function launch(input: LaunchInput, source: string) {
    setBusy(source);
    setMessage(null);
    const result = await undercoverApi.create({ nickname: defaultNickname.trim().length >= 2 ? defaultNickname.trim() : undefined, ...input });
    if (!result.ok) {
      setBusy(null);
      setMessage({ ok: false, text: result.error });
      return;
    }
    router.push(`/jeux/undercover/partie/${result.data.gameId}`);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!civilWord.trim()) next.civilWord = 'Indiquez le mot des Civils.';
    if (!undercoverWord.trim()) next.undercoverWord = 'Indiquez le mot de la Fourmi.';
    if (civilWord.trim() && civilWord.trim().toLowerCase() === undercoverWord.trim().toLowerCase()) next.undercoverWord = 'Les deux mots doivent être différents.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    if (saveAs.trim()) {
      const saved = await undercoverApi.saveConfig({
        name: saveAs.trim(),
        civilWord: civilWord.trim(),
        undercoverWord: undercoverWord.trim(),
        includeMisterWhite,
      });
      if (!saved.ok) {
        setMessage({ ok: false, text: `La configuration n’a pas pu être enregistrée : ${saved.error}` });
        return;
      }
    }
    await launch({ civilWord: civilWord.trim(), undercoverWord: undercoverWord.trim(), includeMisterWhite }, 'new');
  }

  async function saveOnly() {
    if (!saveAs.trim() || !civilWord.trim() || !undercoverWord.trim()) {
      setMessage({ ok: false, text: 'Pour enregistrer, donnez un nom à la configuration et indiquez les deux mots.' });
      return;
    }
    setBusy('save');
    const saved = await undercoverApi.saveConfig({ name: saveAs.trim(), civilWord: civilWord.trim(), undercoverWord: undercoverWord.trim(), includeMisterWhite });
    setBusy(null);
    if (saved.ok) {
      setConfigs((current) => [saved.data.config, ...(current ?? [])]);
      setSaveAs('');
      setMessage({ ok: true, text: 'Configuration enregistrée.' });
    } else setMessage({ ok: false, text: saved.error });
  }

  async function remove(config: UndercoverConfig) {
    setBusy(`delete-${config.id}`);
    const result = await undercoverApi.deleteConfig(config.id);
    setBusy(null);
    setToDelete(null);
    if (result.ok) {
      setConfigs((current) => (current ?? []).filter((item) => item.id !== config.id));
      setMessage({ ok: true, text: `Configuration « ${config.name} » supprimée.` });
    } else setMessage({ ok: false, text: result.error });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Nouvelle partie" description="Choisissez deux mots proches : l’un pour les Civils, l’autre pour la Fourmi." />
        <CardBody>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <Field label="Mot des Civils" required error={errors.civilWord}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} value={civilWord} onChange={(e) => setCivilWord(e.target.value)} maxLength={40} placeholder="Chat" />
              )}
            </Field>
            <Field label="Mot de la Fourmi" required error={errors.undercoverWord}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} value={undercoverWord} onChange={(e) => setUndercoverWord(e.target.value)} maxLength={40} placeholder="Chien" />
              )}
            </Field>
            <Checkbox
              label="Inclure l’Espion (Mister White)"
              description="Un joueur sans mot, qui doit deviner celui des Civils. Actif seulement à partir de 4 joueurs."
              checked={includeMisterWhite}
              onChange={(e) => setIncludeMisterWhite(e.target.checked)}
            />
            <Field label="Enregistrer comme configuration" optional hint="Donnez un nom pour la retrouver dans « Mes configurations ».">
              {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={saveAs} onChange={(e) => setSaveAs(e.target.value)} maxLength={60} placeholder="Animaux domestiques" />}
            </Field>
            {message ? <Notice variant={message.ok ? 'success' : 'danger'}>{message.text}</Notice> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="lg" loading={busy === 'new'}>
                <Play aria-hidden />
                Créer la partie
              </Button>
              <Button type="button" variant="outline" size="lg" loading={busy === 'save'} onClick={saveOnly}>
                <Save aria-hidden />
                Enregistrer sans lancer
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Mes configurations" description="Vos paires de mots enregistrées, à relancer en un clic." />
        <CardBody>
          {configs === null ? <p className="text-sm text-ink-muted">Chargement…</p> : null}
          {configError ? <Notice variant="warning">{configError}</Notice> : null}
          {configs && configs.length === 0 && !configError ? (
            <EmptyState title="Aucune configuration enregistrée" description="Enregistrez une paire de mots depuis le formulaire pour la retrouver ici." className="py-8" />
          ) : null}
          {configs && configs.length > 0 ? (
            <ul className="divide-y divide-line">
              {configs.map((config) => (
                <li key={config.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{config.name}</p>
                    <p className="text-sm text-ink-muted">
                      {config.civilWord} / {config.undercoverWord}
                      {config.includeMisterWhite ? ' · avec Espion' : ' · sans Espion'}
                    </p>
                  </div>
                  <Button
                    size="md"
                    loading={busy === config.id}
                    onClick={() => launch({ civilWord: config.civilWord, undercoverWord: config.undercoverWord, includeMisterWhite: config.includeMisterWhite }, config.id)}
                  >
                    <Play aria-hidden />
                    Lancer
                  </Button>
                  <Button variant="danger-outline" size="md" aria-label={`Supprimer la configuration ${config.name}`} onClick={() => setToDelete(config)}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </CardBody>
      </Card>

      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent title="Supprimer cette configuration ?" description={toDelete ? `« ${toDelete.name} » (${toDelete.civilWord} / ${toDelete.undercoverWord}) sera supprimée définitivement.` : undefined} size="sm">
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose className={buttonClasses({ variant: 'outline' })}>Conserver</DialogClose>
            <Button variant="danger" loading={toDelete !== null && busy === `delete-${toDelete.id}`} onClick={() => toDelete && remove(toDelete)}>
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
