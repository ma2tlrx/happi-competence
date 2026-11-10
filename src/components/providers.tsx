'use client';

import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

import { TooltipProvider } from '@/components/ui/overlays';

/** Fournisseurs globaux : mouvement (respect de prefers-reduced-motion) et infobulles. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
      <TooltipProvider>{children}</TooltipProvider>
    </MotionConfig>
  );
}
