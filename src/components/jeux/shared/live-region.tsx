/**
 * Annonce vocale des changements d'état de la partie (lecteurs d'écran), sans rien afficher.
 * À rendre en permanence : la zone doit exister avant que son texte change.
 */
export function LiveRegion({ message, assertive = false }: { message: string; assertive?: boolean }) {
  return (
    <p className="sr-only" role={assertive ? 'alert' : 'status'} aria-live={assertive ? 'assertive' : 'polite'} aria-atomic="true">
      {message}
    </p>
  );
}
