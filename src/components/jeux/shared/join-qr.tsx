'use client';

import { useEffect, useRef } from 'react';

/** QR code d'accès à une partie : motif pétrole sur fond blanc (contraste maximal pour les téléphones). */
export function JoinQr({ url, size = 220, label = 'QR code pour rejoindre la partie' }: { url: string; size?: number; label?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    import('qrcode')
      .then((module) => {
        if (cancelled || !canvas.current) return;
        return module.default.toCanvas(canvas.current, url, { width: size, margin: 2, color: { dark: '#102C32', light: '#FFFFFF' } });
      })
      .catch(() => {
        // Sans QR code, le code de la partie affiché à côté reste utilisable.
      });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  return (
    <span className="inline-block rounded-xl bg-white p-2">
      <canvas ref={canvas} width={size} height={size} role="img" aria-label={`${label} : ${url}`} className="block rounded-md" style={{ width: size, height: size, maxWidth: '100%' }} />
    </span>
  );
}
