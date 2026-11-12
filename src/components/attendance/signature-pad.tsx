'use client';

import { Eraser } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { SIGNATURE_HEIGHT, SIGNATURE_WIDTH, strokesToPath, type Point } from '@/lib/attendance/signature';
import { cn } from '@/lib/utils';

/**
 * Zone de signature au doigt, au stylet ou à la souris (événements pointeur sur un canvas).
 * Les points sont exprimés dans le cadre 600 × 200 quelle que soit la taille affichée, puis
 * convertis en tracé vectoriel borné (`onChange` reçoit '' quand la zone est vide).
 * Le tracé ne se fait pas au clavier : l'écran d'émargement propose l'alternative
 * « signature impossible », saisie par le formateur.
 * Pour un nouveau signataire, changer la `key` du composant : la zone repart vierge.
 */
export function SignaturePad({
  label,
  onChange,
  disabled = false,
  className,
}: {
  label: string;
  onChange: (path: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const drawing = useRef<number | null>(null);
  const [empty, setEmpty] = useState(true);
  const hintId = useId();

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const scale = canvas.width / SIGNATURE_WIDTH;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.lineWidth = 3.5;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#102c32';
    for (const stroke of strokes.current) {
      if (stroke.length === 0) continue;
      context.beginPath();
      context.moveTo(stroke[0]!.x, stroke[0]!.y);
      if (stroke.length === 1) context.lineTo(stroke[0]!.x + 0.5, stroke[0]!.y);
      for (const point of stroke.slice(1)) context.lineTo(point.x, point.y);
      context.stroke();
    }
  }, []);

  // Résolution du canvas adaptée à sa taille affichée et à la densité de l'écran.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      redraw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  const clear = useCallback(() => {
    strokes.current = [];
    drawing.current = null;
    setEmpty(true);
    redraw();
    onChange('');
  }, [onChange, redraw]);

  const toBox = (event: { clientX: number; clientY: number }): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * SIGNATURE_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * SIGNATURE_HEIGHT,
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || drawing.current !== null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = event.pointerId;
    strokes.current.push([toBox(event)]);
    setEmpty(false);
    redraw();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawing.current !== event.pointerId) return;
    const stroke = strokes.current.at(-1);
    if (!stroke) return;
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    for (const item of events.length ? events : [event.nativeEvent]) stroke.push(toBox(item));
    redraw();
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawing.current !== event.pointerId) return;
    drawing.current = null;
    onChange(strokesToPath(strokes.current));
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-line-strong bg-white focus-within:border-petrol-500">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label}
          aria-describedby={hintId}
          className={cn('block aspect-[3/1] w-full touch-none select-none', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-crosshair')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onLostPointerCapture={onPointerEnd}
        />
        <span aria-hidden className="pointer-events-none absolute right-6 bottom-[22%] left-6 border-b border-line-strong" />
        {empty ? (
          <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg text-ink-subtle">
            Signez ici
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={hintId} className="text-sm text-ink-subtle">
          Signez au doigt, au stylet ou à la souris dans le cadre.
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={disabled || empty}>
          <Eraser aria-hidden />
          Effacer
        </Button>
      </div>
    </div>
  );
}

/** Affichage d'une signature enregistrée (tracé vectoriel). */
export function SignaturePreview({ path, label, className }: { path: string; label: string; className?: string }) {
  return (
    <svg viewBox={`0 0 ${SIGNATURE_WIDTH} ${SIGNATURE_HEIGHT}`} role="img" aria-label={label} className={cn('h-10 w-auto text-ink', className)}>
      <path d={path} fill="none" stroke="currentColor" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
