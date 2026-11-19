'use client';

import { Scale } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { startSecondRating } from '@/lib/reliability/actions';

/** Ouvre la seconde cotation d'une séance (participants dont l'évaluation officielle est vide). */
export function StartSecondRatingButton({ sessionId, label = 'Coter en second' }: { sessionId: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await startSecondRating(sessionId);
          if (!result.ok) {
            toast.error(result.message);
            return;
          }
          if (result.message) toast.success(result.message);
          router.push(`/formateur/seconde-cotation/${sessionId}`);
        })
      }
    >
      {pending ? null : <Scale aria-hidden />}
      {label}
    </Button>
  );
}
