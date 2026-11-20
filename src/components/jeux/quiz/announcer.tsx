/** Annonce vocale (lecteurs d'écran) à chaque changement d'état de la partie. */
export function Announcer({ message }: { message: string }) {
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
