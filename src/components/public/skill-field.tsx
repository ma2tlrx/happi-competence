"use client";

import { useEffect, useRef, useState } from "react";

export type FieldSkill = { name: string; kind: "ct" | "hbs" };

type Node = {
  x: number;
  y: number;
  name: string;
  kind: FieldSkill["kind"];
  found: boolean;
  flash: number;
  labelled: boolean;
};

const CELL = 20;
const RADIUS = 210;
const PETROL = [165, 195, 201] as const; // petrol-300
const ORANGE = [234, 99, 46] as const; // orange-500

/** Générateur pseudo-aléatoire déterministe : la carte est la même à chaque visite. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mix = (from: readonly number[], to: readonly number[], t: number) =>
  `${Math.round(from[0]! + (to[0]! - from[0]!) * t)}, ${Math.round(from[1]! + (to[1]! - from[1]!) * t)}, ${Math.round(from[2]! + (to[2]! - from[2]!) * t)}`;

/**
 * Carte « brouillard de guerre » du hero : les compétences du référentiel sont
 * cachées dans une grille de pixels ; le pointeur (ou une sonde autonome sur
 * écran tactile / au repos) les révèle. Purement décoratif : la liste des
 * compétences est présentée en texte ailleurs sur la page.
 */
export function SkillField({ skills }: { skills: FieldSkill[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [found, setFound] = useState(0);
  const [reduced, setReduced] = useState(false);
  const total = skills.length;

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !host || !ctx || total === 0) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    setReduced(reduce);
    const fontFamily = getComputedStyle(document.body).fontFamily;

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let memory = new Float32Array(0);
    let nodes: Node[] = [];
    const foundNames = new Set<string>();

    const light = { x: 0, y: 0, tx: 0, ty: 0 };
    let lastPointer = -Infinity;
    let visible = true;
    let frame = 0;
    let start = performance.now();

    /** Zone où sont cachées les compétences : à droite sur grand écran, en bas sur mobile. */
    const region = () =>
      width >= 1024
        ? {
            x0: width * 0.5,
            x1: width * 0.97,
            y0: height * 0.2,
            y1: height * 0.9,
          }
        : { x0: 24, x1: width - 24, y0: height - 250, y1: height - 70 };

    const layout = () => {
      const rect = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / CELL);
      rows = Math.ceil(height / CELL);
      memory = new Float32Array(cols * rows);

      const random = seeded(34);
      const area = region();
      ctx.font = `500 13px ${fontFamily}`;
      // Chaque compétence occupe une boîte (repère + étiquette) qui ne doit pas en chevaucher une autre.
      const boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
      // La mascotte occupe le coin inférieur droit sur grand écran.
      if (width >= 1024)
        boxes.push({
          x0: width * 0.96 - Math.min(256, width * 0.17) - 30,
          y0: height - 470,
          x1: width,
          y1: height,
        });
      const free = (box: { x0: number; y0: number; x1: number; y1: number }) =>
        !boxes.some(
          (b) =>
            box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0,
        );
      const placed: Node[] = [];
      for (const skill of skills) {
        const labelWidth = ctx.measureText(skill.name).width;
        let best: { x: number; y: number; labelled: boolean } | null = null;
        // D'abord une place avec étiquette permanente, sinon un simple repère (étiquette visible sous la lumière).
        for (const withLabel of [true, false]) {
          for (let attempt = 0; attempt < 500 && !best; attempt += 1) {
            const x =
              Math.floor(
                (area.x0 +
                  random() *
                    Math.max(
                      1,
                      area.x1 - area.x0 - (withLabel ? labelWidth + 14 : 0),
                    )) /
                  CELL,
              ) *
                CELL +
              CELL / 2;
            const y =
              Math.floor((area.y0 + random() * (area.y1 - area.y0)) / CELL) *
                CELL +
              CELL / 2;
            const box = withLabel
              ? { x0: x - 14, y0: y - 13, x1: x + 26 + labelWidth, y1: y + 13 }
              : { x0: x - 12, y0: y - 12, x1: x + 12, y1: y + 12 };
            if (free(box)) {
              boxes.push(box);
              best = { x, y, labelled: withLabel };
            }
          }
          if (best) break;
        }
        const spot = best ?? { x: area.x0, y: area.y0, labelled: false };
        placed.push({
          ...spot,
          name: skill.name,
          kind: skill.kind,
          found: foundNames.has(skill.name),
          flash: 0,
        });
      }
      nodes = placed;
      if (!light.x) {
        light.x = light.tx = (area.x0 + area.x1) / 2;
        light.y = light.ty = (area.y0 + area.y1) / 2;
      }
    };

    const draw = (now: number, staticFrame = false) => {
      ctx.clearRect(0, 0, width, height);
      const t = (now - start) / 1000;

      // Sonde autonome quand personne ne guide la lumière.
      if (!staticFrame && now - lastPointer > 2500) {
        const area = region();
        const cx = (area.x0 + area.x1) / 2;
        const cy = (area.y0 + area.y1) / 2;
        light.tx = cx + Math.sin(t * 0.37) * (area.x1 - area.x0) * 0.46;
        light.ty = cy + Math.sin(t * 0.53 + 1.2) * (area.y1 - area.y0) * 0.46;
      }
      light.x += (light.tx - light.x) * 0.09;
      light.y += (light.ty - light.y) * 0.09;

      // Halo de la lumière.
      const halo = ctx.createRadialGradient(
        light.x,
        light.y,
        0,
        light.x,
        light.y,
        RADIUS * 1.15,
      );
      halo.addColorStop(0, "rgba(234, 99, 46, 0.13)");
      halo.addColorStop(0.45, "rgba(71, 130, 141, 0.07)");
      halo.addColorStop(1, "rgba(16, 44, 50, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);

      // Grille de pixels : éclairée près de la lumière, avec une mémoire qui s'estompe.
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const i = row * cols + col;
          const cx = col * CELL + CELL / 2;
          const cy = row * CELL + CELL / 2;
          const d = Math.hypot(cx - light.x, cy - light.y);
          const lit = d < RADIUS ? (1 - d / RADIUS) ** 2 : 0;
          memory[i] = Math.max(
            memory[i]! * (staticFrame ? 1 : 0.985),
            lit * 0.5,
          );
          const energy = Math.min(1, lit + memory[i]! * 0.6);
          const alpha = 0.07 + energy * 0.75;
          const size = 1.5 + energy * 3.5;
          ctx.fillStyle = `rgba(${mix(PETROL, ORANGE, Math.max(0, lit - 0.35) / 0.65)}, ${alpha})`;
          ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
        }
      }

      // Compétences cachées.
      ctx.font = `500 13px ${fontFamily}`;
      ctx.textBaseline = "middle";
      let newlyFound = 0;
      for (const node of nodes) {
        const d = Math.hypot(node.x - light.x, node.y - light.y);
        if (!node.found && d < RADIUS * 0.42) {
          node.found = true;
          node.flash = 1;
          foundNames.add(node.name);
          newlyFound += 1;
        }
        const proximity = Math.max(0, 1 - d / (RADIUS * 0.8));
        if (node.found) {
          if (node.flash > 0) {
            // Onde de découverte.
            const ring = (1 - node.flash) * 34;
            ctx.strokeStyle = `rgba(234, 99, 46, ${node.flash * 0.9})`;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(
              node.x - ring / 2 - 4,
              node.y - ring / 2 - 4,
              ring + 8,
              ring + 8,
            );
            node.flash = Math.max(0, node.flash - 0.025);
          }
          const pulse = staticFrame ? 0 : Math.sin(t * 2 + node.x) * 0.5 + 0.5;
          ctx.fillStyle =
            node.kind === "ct" ? "rgb(234, 99, 46)" : "rgb(244, 161, 126)";
          ctx.fillRect(node.x - 4, node.y - 4, 8, 8);
          ctx.fillStyle = `rgba(234, 99, 46, ${0.15 + pulse * 0.1})`;
          ctx.fillRect(node.x - 8, node.y - 8, 16, 16);
          const labelAlpha = node.labelled
            ? 0.55 + proximity * 0.45
            : Math.max(0, proximity * 1.6 - 0.6);
          if (labelAlpha > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${labelAlpha})`;
            ctx.fillText(node.name, node.x + 14, node.y + 0.5);
          }
        } else if (proximity > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${proximity * 0.8})`;
          ctx.fillRect(node.x - 3, node.y - 3, 6, 6);
        }
      }
      if (newlyFound) setFound(foundNames.size);
    };

    const loop = (now: number) => {
      frame = 0;
      if (!visible || document.hidden) return;
      draw(now);
      frame = requestAnimationFrame(loop);
    };
    const play = () => {
      if (!frame && !reduce) frame = requestAnimationFrame(loop);
    };

    layout();
    if (reduce) {
      // Image fixe : toutes les compétences visibles, sans animation.
      for (const node of nodes) node.found = true;
      skills.forEach((skill) => foundNames.add(skill.name));
      setFound(foundNames.size);
      draw(performance.now(), true);
    } else {
      start = performance.now();
      play();
    }

    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      light.tx = event.clientX - rect.left;
      light.ty = event.clientY - rect.top;
      lastPointer = performance.now();
    };
    const resize = new ResizeObserver(() => {
      layout();
      if (reduce) {
        for (const node of nodes) node.found = true;
        draw(performance.now(), true);
      }
    });
    const seen = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible) play();
    });
    const onVisibility = () => {
      if (!document.hidden) play();
    };

    resize.observe(host);
    seen.observe(host);
    if (!reduce) {
      host.addEventListener("pointermove", onPointer);
      host.addEventListener("pointerdown", onPointer);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      seen.disconnect();
      host.removeEventListener("pointermove", onPointer);
      host.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [skills, total]);

  if (total === 0) return null;
  const complete = found === total;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-5 bottom-5 z-10 w-56 rounded-lg border border-white/10 bg-petrol-950/70 p-3.5 backdrop-blur-sm sm:right-8 lg:top-8 lg:bottom-auto"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-white/70">
            {complete ? "Toutes révélées" : "Compétences révélées"}
          </span>
          <span className="font-display text-lg font-semibold text-white tabular-nums">
            {found}
            <span className="text-white/45">/{total}</span>
          </span>
        </div>
        <div className="mt-2.5 flex gap-[3px]">
          {Array.from({ length: 12 }, (_, index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-[1px] transition-colors duration-500 ${index < Math.round((found / total) * 12) ? "bg-orange-500" : "bg-white/12"}`}
            />
          ))}
        </div>
        {!reduced && found === 0 ? (
          <p className="mt-2 text-xs text-white/55">
            Survolez ou touchez la carte pour explorer
          </p>
        ) : null}
      </div>
    </>
  );
}
