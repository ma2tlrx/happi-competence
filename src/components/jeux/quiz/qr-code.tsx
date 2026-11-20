'use client';

import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';

/** QR code d'invitation à une partie (encre HAPPI sur fond blanc, pour un bon contraste au projecteur). */
export function QrCodeDisplay({ url, size = 220, label }: { url: string; size?: number; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !url) return;
    QRCode.toCanvas(canvasRef.current, url, { width: size, margin: 2, color: { dark: '#102C32', light: '#FFFFFF' } }).catch(() =>
      setFailed(true),
    );
  }, [url, size]);

  if (failed) return <p className="text-sm text-white/80">Le QR code n’a pas pu être généré. Utilisez le code de la partie.</p>;
  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label ?? `QR code pour rejoindre la partie : ${url}`}
      style={{ width: size, height: size, maxWidth: '100%' }}
      className="rounded-lg bg-white"
    />
  );
}
