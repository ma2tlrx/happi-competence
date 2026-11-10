import Image from 'next/image';

import { cn } from '@/lib/utils';

type LogoProps = {
  /** « petrol » sur fond clair, « white » sur fond pétrole. */
  tone?: 'petrol' | 'white';
  /** Affiche la mascotte à gauche du logotype. */
  withMascot?: boolean;
  className?: string;
  priority?: boolean;
};

/** Logotype « happi » accompagné de la mascotte. */
export function Logo({ tone = 'petrol', withMascot = true, className, priority }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {withMascot ? (
        <Image src="/brand/happi-mascotte.png" alt="" width={36} height={36} className="size-9 shrink-0" priority={priority} />
      ) : null}
      <Image
        src={tone === 'white' ? '/brand/happi-logotype-blanc.png' : '/brand/happi-logotype-petrole.png'}
        alt="HAPPI"
        width={800}
        height={305}
        className="h-[1.375rem] w-auto"
        priority={priority}
      />
    </span>
  );
}
