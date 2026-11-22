import { cn } from '@/lib/utils';

/**
 * L'application du Passeport Numérique dans la page de la plateforme : un cadre de même origine.
 * Le contenu (et le rôle de la personne) est préparé par la route /passeport-numerique/app ;
 * ce cadre n'ajoute aucune autorisation.
 * - `flush` : pleine largeur et pleine hauteur, sous la barre du haut (parcours du participant) ;
 * - sinon : encadré dans la page (espace animateur, avec son lien de retour).
 */
export function PasseportNumeriqueFrame({ flush = false, title = 'Le Passeport Numérique' }: { flush?: boolean; title?: string }) {
  return (
    <div className={cn('overflow-hidden', flush ? '-mx-4 -mt-6 sm:-mx-6 sm:-mt-8 lg:-mx-8' : 'rounded-xl border border-line')}>
      <iframe
        title={title}
        src="/passeport-numerique/app"
        allow="clipboard-write; fullscreen"
        className={cn('block w-full border-0 bg-paper', flush ? 'h-[calc(100dvh-8.5rem)] sm:h-[calc(100dvh-4rem)]' : 'h-[calc(100dvh-11rem)] min-h-[32rem]')}
      />
    </div>
  );
}
