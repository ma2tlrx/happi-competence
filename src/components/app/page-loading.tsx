/**
 * Squelette affiché pendant le chargement d'une page (fichiers loading.tsx) : la coque (menu, en-tête)
 * reste en place et la personne voit tout de suite que son clic a été pris en compte.
 */
export function PageLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6" aria-busy="true">
      <span className="sr-only">Chargement de la page…</span>
      <div className="skeleton h-9 w-2/3 max-w-md" />
      <div className="skeleton h-4 w-full max-w-xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="skeleton h-28" />
        <div className="skeleton h-28" />
        <div className="skeleton h-28" />
      </div>
      <div className="skeleton h-48" />
    </div>
  );
}
