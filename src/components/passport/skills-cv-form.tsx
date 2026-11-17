'use client';

import { FileDown } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/form';
import { CV_MAX_SKILLS } from '@/lib/skills-cv';

type Option = { code: string; name: string; framework: string; levelLabel: string };

/**
 * Choix des compétences du CV « Mes compétences observées ». Formulaire GET natif :
 * le PDF se télécharge même sans JavaScript (toutes les compétences cochées par défaut).
 */
export function SkillsCvForm({ participantId, options }: { participantId: string; options: Option[] }) {
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(options.slice(0, CV_MAX_SKILLS).map((option) => option.code)));
  const frameworks = [...new Set(options.map((option) => option.framework))];
  const full = chosen.size >= CV_MAX_SKILLS;
  return (
    <form method="get" action={`/api/exports/cv/${participantId}`} className="space-y-4">
      <input type="hidden" name="choix" value="1" />
      {frameworks.map((framework) => (
        <fieldset key={framework}>
          <legend className="mb-2 text-sm font-semibold">{framework}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {options
              .filter((option) => option.framework === framework)
              .map((option) => (
                <Checkbox
                  key={option.code}
                  name="c"
                  value={option.code}
                  checked={chosen.has(option.code)}
                  disabled={!chosen.has(option.code) && full}
                  onChange={(event) =>
                    setChosen((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(option.code);
                      else next.delete(option.code);
                      return next;
                    })
                  }
                  label={option.name}
                  description={option.levelLabel}
                />
              ))}
          </div>
        </fieldset>
      ))}
      <p className="text-sm text-ink-subtle" aria-live="polite">
        {chosen.size} compétence{chosen.size > 1 ? 's' : ''} sélectionnée{chosen.size > 1 ? 's' : ''} sur {CV_MAX_SKILLS} possibles (le document tient sur une page).
      </p>
      <Button type="submit" disabled={chosen.size === 0}>
        <FileDown aria-hidden />
        Télécharger mon CV de compétences (PDF)
      </Button>
    </form>
  );
}
