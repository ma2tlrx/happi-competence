import { ArrowRight, BookOpen, MonitorSmartphone } from 'lucide-react';
import Link from 'next/link';

import { PROGRAM_KIND_LABELS, PROGRAM_KINDS, programSlug, type ProgramKind } from '@/lib/programmes/kind';

const ICONS: Record<ProgramKind, typeof BookOpen> = { happi_competence: BookOpen, passeport_numerique: MonitorSmartphone };

/**
 * Première étape de l'inscription d'un participant : pour quel programme crée-t-il son compte ?
 * Le choix détermine le questionnaire qui suivra (celui de HAPPI Compétence, ou celui du Passeport Numérique).
 */
export function ProgramChoice() {
  return (
    <ul className="grid gap-3">
      {PROGRAM_KINDS.map((kind) => {
        const Icon = ICONS[kind];
        return (
          <li key={kind}>
            <Link
              href={`/inscription?espace=participant&programme=${programSlug(kind)}`}
              className="group flex items-start gap-4 rounded-xl border-2 border-line bg-white p-4 transition-colors hover:border-orange-400 hover:bg-orange-50 focus-visible:border-orange-400 sm:p-5"
            >
              <span aria-hidden className="pixel-corners flex size-12 shrink-0 items-center justify-center bg-petrol-100 text-petrol-700 transition-colors group-hover:bg-orange-500 group-hover:text-petrol-950">
                <Icon className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-semibold text-ink">{PROGRAM_KIND_LABELS[kind].name}</span>
                <span className="mt-0.5 block text-[0.9375rem] text-ink-muted">{PROGRAM_KIND_LABELS[kind].summary}</span>
              </span>
              <ArrowRight className="mt-1 size-5 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
