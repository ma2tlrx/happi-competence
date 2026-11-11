'use client';

import { useEffect } from 'react';

const SKIPPED = new Set(['password', 'hidden', 'file', 'submit', 'button', 'reset', 'image']);

/**
 * Conserve la saisie quand un formulaire revient en erreur.
 *
 * React réinitialise un formulaire après l'exécution de son action serveur, y compris
 * quand le serveur a refusé la saisie : l'utilisateur perdait tout ce qu'il avait tapé.
 * On mémorise les valeurs à l'envoi ; si, après la réinitialisation, le formulaire
 * affiche une erreur (champ invalide ou message d'alerte), on les restaure. Les mots de
 * passe ne sont jamais restaurés.
 */
export function FormValuesKeeper() {
  useEffect(() => {
    const snapshots = new WeakMap<HTMLFormElement, [string, string][]>();
    const onSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const entries: [string, string][] = [];
      for (const [name, value] of new FormData(form).entries()) if (typeof value === 'string') entries.push([name, value]);
      snapshots.set(form, entries);
    };
    const restore = (form: HTMLFormElement, entries: [string, string][]) => {
      for (const element of Array.from(form.elements)) {
        if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) continue;
        if (!element.name || (element instanceof HTMLInputElement && SKIPPED.has(element.type))) continue;
        const values = entries.filter(([name]) => name === element.name).map(([, value]) => value);
        if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
          // Seulement si la case est encore dans son état initial : on n'écrase jamais une nouvelle saisie.
          if (element.checked === element.defaultChecked) element.checked = values.includes(element.value);
        } else if (values.length) {
          const pristine = element instanceof HTMLSelectElement ? true : element.value === element.defaultValue;
          if (pristine) element.value = values[0]!;
        }
      }
    };
    const onReset = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const entries = snapshots.get(form);
      if (!entries) return;
      // L'erreur est rendue dans la même mise à jour que la réinitialisation : on vérifie dès
      // qu'elle est terminée (microtâche), puis une dernière fois au rendu suivant.
      let done = false;
      const attempt = () => {
        if (done || !form.isConnected) return;
        if (form.querySelector('[aria-invalid="true"], [role="alert"]')) {
          done = true;
          restore(form, entries);
          snapshots.delete(form);
        }
      };
      queueMicrotask(attempt);
      window.requestAnimationFrame(() => {
        attempt();
        snapshots.delete(form);
      });
    };
    document.addEventListener('submit', onSubmit, true);
    document.addEventListener('reset', onReset, true);
    return () => {
      document.removeEventListener('submit', onSubmit, true);
      document.removeEventListener('reset', onReset, true);
    };
  }, []);
  return null;
}
