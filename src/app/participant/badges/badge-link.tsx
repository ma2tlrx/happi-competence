'use client';

import { Copy, Link2 } from 'lucide-react';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

import { revealBadgeLink } from './actions';

/** Affiche et copie le lien public de vérification d'un badge (gardé en mémoire uniquement). */
export function BadgeLink({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const copy = (value: string) =>
    navigator.clipboard.writeText(value).then(
      () => toast.success('Lien copié.'),
      () => toast.error('Copie impossible : sélectionnez le lien et copiez-le.'),
    );
  if (url) {
    return (
      <div className="mt-3 space-y-2">
        <p className="rounded-md bg-paper px-3 py-2 font-mono text-sm break-all text-ink select-all">{url}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => copy(url)}>
            <Copy aria-hidden />
            Copier le lien
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={url} target="_blank" rel="noreferrer noopener">
              Ouvrir la page de vérification
            </a>
          </Button>
        </div>
      </div>
    );
  }
  return (
    <Button
      size="sm"
      variant="outline"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await revealBadgeLink(id);
          if (result.ok && result.url) setUrl(result.url);
          else toast.error(result.message ?? 'Lien indisponible.');
        })
      }
    >
      <Link2 aria-hidden />
      Lien de vérification
    </Button>
  );
}
