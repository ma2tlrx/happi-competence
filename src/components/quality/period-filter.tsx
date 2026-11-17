import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';

/** Filtre de période (?du=…&au=…), en GET : l'adresse reste partageable. */
export function PeriodFilter({ from, to, today }: { from: string; to: string; today: string }) {
  return (
    <form method="get" className="mb-6 grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="block text-sm font-semibold">
        Du
        <Input type="date" name="du" defaultValue={from} max={today} className="mt-1" />
      </label>
      <label className="block text-sm font-semibold">
        Au
        <Input type="date" name="au" defaultValue={to} max={today} className="mt-1" />
      </label>
      <Button type="submit" variant="secondary">
        Appliquer
      </Button>
    </form>
  );
}
