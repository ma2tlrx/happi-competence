import type { ReactNode } from 'react';

export function AuthHeading({ title, intro, children }: { title: string; intro?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-8">
      {children}
      <h1 className="text-display-md">{title}</h1>
      {intro ? <p className="mt-2 text-ink-muted">{intro}</p> : null}
    </div>
  );
}
