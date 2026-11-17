/* global gsap, SplitText, DrawSVGPlugin, MorphSVGPlugin, CustomEase, MotionPathPlugin */
// Moteur : une timeline GSAP en pause, positionnée image par image (window.__video.seek).
// Aucune animation ne dépend du temps réel : le rendu est déterministe.
gsap.registerPlugin(SplitText, DrawSVGPlugin, MorphSVGPlugin, CustomEase, MotionPathPlugin);
gsap.ticker.lagSmoothing(0);

export const W = 1920;
export const H = 1080;
export const CX = 960;
export const CY = 540;
export const SVGNS = 'http://www.w3.org/2000/svg';

export const $ = (s, r = document) => r.querySelector(s);
export const camera = $('#camera');
export const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
export const renderers = [];

/** Caméra virtuelle : translation, zoom, rotation, tremblement. */
export const cam = { x: 0, y: 0, zoom: 1, rot: 0, shake: 0, pz: 1 };
/** Particules : attraction vers un point, souffle, opacité, dérive. */
export const P = { attract: 0, ax: CX, ay: CY, burst: 0, bx: CX, by: CY, opacity: 0.8, drift: 1 };

CustomEase.create('ramp', 'M0,0 C0.7,0 0.84,0.06 0.9,0.3 0.96,0.6 0.98,1 1,1');
CustomEase.create('whip', 'M0,0 C0.5,0 0.1,1 1,1');
CustomEase.create('land', 'M0,0 C0.12,0.62 0.2,1.08 0.42,1.04 0.62,1 0.8,1 1,1');

export function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rand = mulberry32(20261117);
export const R = (a, b) => a + (b - a) * rand();
export const lerp = (a, b, k) => a + (b - a) * k;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export function el(tag, { cls, text, html, style, attrs } = {}, parent = camera) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  if (html != null) node.innerHTML = html;
  if (style) Object.assign(node.style, style);
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent.appendChild(node);
  return node;
}

export function svg(tag, attrs = {}, parent) {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

export function scene(id, { persp = false, bg = false } = {}) {
  const s = el('section', { cls: `scene${persp ? ' persp' : ''}` });
  s.id = id;
  if (bg) el('div', { style: { position: 'absolute', inset: '0', background: 'radial-gradient(120% 90% at 50% 38%, #163a41 0%, #0f2a30 38%, #0b1d21 68%, #06121a 100%)' } }, s);
  return s;
}

export function show(node, t0, t1) {
  tl.set(node, { visibility: 'visible' }, t0);
  if (t1 != null) tl.set(node, { visibility: 'hidden' }, t1);
}

export function split(node, type = 'chars,words', mask) {
  return SplitText.create(node, { type, mask, charsClass: 'char', wordsClass: 'word', aria: 'none' });
}

/** Texte absolu : `pos` = left/top/right/width… ; renvoie le nœud. */
export function text(parent, content, cls, pos = {}, extra = {}) {
  return el('div', { cls: `abs ${cls}`, html: content, style: { ...pos, ...extra } }, parent);
}

// ── Préréglages de typographie cinétique ─────────────────────────────────────────────
export function rise(targets, t, o = {}) {
  tl.fromTo(
    targets,
    { yPercent: o.from ?? 115, opacity: o.fade ? 0 : 1, rotate: o.rot ?? 0 },
    { yPercent: 0, opacity: 1, rotate: 0, duration: o.dur ?? 0.75, ease: o.ease ?? 'expo.out', stagger: o.stagger ?? 0.022 },
    t,
  );
}
export function slam(targets, t, o = {}) {
  tl.fromTo(
    targets,
    { scale: o.scale ?? 2.4, opacity: 0, filter: `blur(${o.blur ?? 16}px)` },
    { scale: 1, opacity: 1, filter: 'blur(0px)', duration: o.dur ?? 0.55, ease: o.ease ?? 'expo.out', stagger: o.stagger ?? { each: 0.016, from: 'center' } },
    t,
  );
}
export function fadeUp(targets, t, o = {}) {
  tl.fromTo(
    targets,
    { y: o.y ?? 34, opacity: 0, filter: `blur(${o.blur ?? 8}px)` },
    { y: 0, opacity: 1, filter: 'blur(0px)', duration: o.dur ?? 0.65, ease: o.ease ?? 'power3.out', stagger: o.stagger ?? 0.06 },
    t,
  );
}
export function leave(targets, t, o = {}) {
  tl.to(
    targets,
    { y: o.y ?? -70, x: o.x ?? 0, opacity: 0, filter: `blur(${o.blur ?? 12}px)`, duration: o.dur ?? 0.38, ease: o.ease ?? 'power2.in', stagger: o.stagger ?? 0 },
    t,
  );
}
/** Petit « punch » de caméra. */
export function punch(t, amount = 0.035, dur = 0.45) {
  tl.fromTo(cam, { pz: 1 + amount }, { pz: 1, duration: dur, ease: 'power3.out', immediateRender: false }, t);
}
export function shake(t, amount = 1, dur = 0.45) {
  tl.fromTo(cam, { shake: amount }, { shake: 0, duration: dur, ease: 'power2.out', immediateRender: false }, t);
}
export function flash(t, amount = 0.6, dur = 0.5) {
  tl.fromTo('#flash', { opacity: amount }, { opacity: 0, duration: dur, ease: 'power2.out', immediateRender: false }, t);
}

// ── Caméra et parallaxe ──────────────────────────────────────────────────────────────
const depthNodes = [];
/** Calque de profondeur : d > 1 au premier plan, d < 1 à l'arrière-plan. */
export function depth(parent, d) {
  const node = el('div', { cls: 'depth' }, parent);
  node._d = d;
  depthNodes.push(node);
  return node;
}
renderers.push((t) => {
  const sx = cam.shake * (Math.sin(t * 91.7) * 0.6 + Math.sin(t * 57.3 + 1.3) * 0.4) * 16;
  const sy = cam.shake * (Math.sin(t * 77.1 + 2.1) * 0.6 + Math.sin(t * 43.9) * 0.4) * 11;
  const sr = cam.shake * Math.sin(t * 63.3 + 0.7) * 0.35;
  camera.style.transform = `translate3d(${(cam.x + sx).toFixed(2)}px, ${(cam.y + sy).toFixed(2)}px, 0) scale(${(cam.zoom * cam.pz).toFixed(5)}) rotate(${(cam.rot + sr).toFixed(3)}deg)`;
  for (const n of depthNodes) {
    const k = n._d - 1;
    n.style.transform = `translate3d(${(cam.x * k * 0.55).toFixed(2)}px, ${(cam.y * k * 0.55).toFixed(2)}px, 0) scale(${(1 + (cam.zoom - 1) * k * 0.4).toFixed(5)})`;
  }
});

// ── Lueurs d'ambiance ────────────────────────────────────────────────────────────────
export const glows = ['orange', 'teal', 'white', 'orange'].map((kind) => el('div', { cls: `glow ${kind}` }, $('#glows')));
glows.forEach((g, i) => gsap.set(g, { x: [700, 200, 1300, 1500][i], y: [300, 100, 700, 100][i], opacity: 0 }));

// ── Particules (sprites lumineux, mouvement fonction du temps) ───────────────────────
const pctx = $('#particles').getContext('2d');
function sprite(rgb) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.18, `rgba(${rgb},0.85)`);
  grad.addColorStop(0.45, `rgba(${rgb},0.22)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}
const sprites = { o: sprite('255,140,90'), w: sprite('255,255,255'), t: sprite('110,210,225') };
const prand = mulberry32(7);
const parts = Array.from({ length: 180 }, () => {
  const r = prand();
  return {
    x: prand() * (W + 200) - 100,
    y: prand() * (H + 200) - 100,
    z: 0.35 + prand() * 1.3,
    r: 2 + prand() * 5,
    vx: -8 + prand() * 16,
    vy: -18 + prand() * 12,
    ph: prand() * 6.28,
    tw: 0.5 + prand() * 2,
    c: r < 0.55 ? 'o' : r < 0.85 ? 'w' : 't',
  };
});
renderers.push((t) => {
  pctx.clearRect(0, 0, W, H);
  if (P.opacity <= 0.001) return;
  pctx.globalCompositeOperation = 'lighter';
  const wrapW = W + 200;
  const wrapH = H + 200;
  for (const p of parts) {
    let x = p.x + p.vx * t * p.z * P.drift + Math.sin(t * 0.45 + p.ph) * 22 * p.z;
    let y = p.y + p.vy * t * p.z * P.drift + Math.cos(t * 0.37 + p.ph) * 14 * p.z;
    x = (((x + 100) % wrapW) + wrapW) % wrapW - 100;
    y = (((y + 100) % wrapH) + wrapH) % wrapH - 100;
    x += cam.x * (p.z - 1) * 0.7;
    y += cam.y * (p.z - 1) * 0.7;
    if (P.burst > 0) {
      const dx = x - P.bx;
      const dy = y - P.by;
      const d = Math.hypot(dx, dy) + 1;
      x += (dx / d) * P.burst * 520 * p.z;
      y += (dy / d) * P.burst * 520 * p.z;
    }
    let fade = 1;
    if (P.attract > 0) {
      const k = clamp(P.attract * (0.75 + 0.25 * p.z));
      x = lerp(x, P.ax, k);
      y = lerp(y, P.ay, k);
      fade = 1 - k * k * k;
    }
    const a = P.opacity * fade * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * p.tw + p.ph))) * Math.min(1, p.z * 0.9);
    const size = p.r * p.z * 4;
    pctx.globalAlpha = clamp(a);
    pctx.drawImage(sprites[p.c], x - size / 2, y - size / 2, size, size);
  }
  pctx.globalAlpha = 1;
  pctx.globalCompositeOperation = 'source-over';
});

// ── Grain (identique pour toutes les sous-images d'une même image) ───────────────────
const gctx = $('#grain').getContext('2d');
const grains = [0, 1, 2].map((i) => {
  const c = document.createElement('canvas');
  c.width = 960;
  c.height = 540;
  const g = c.getContext('2d');
  const img = g.createImageData(960, 540);
  const nr = mulberry32(100 + i);
  for (let k = 0; k < img.data.length; k += 4) {
    const v = 128 + (nr() - 0.5) * 255;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
    img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
});
renderers.push((t) => {
  const f = Math.floor(t * 30 + 1e-6);
  gctx.drawImage(grains[f % 3], 0, 0, W, H);
});

export async function fontsReady() {
  const faces = ['500 100px Poppins', '600 100px Poppins', '700 100px Poppins', '800 100px Poppins', '400 40px "DM Sans"', '500 40px "DM Sans"', '700 40px "DM Sans"', '500 30px "DM Mono"'];
  await Promise.all(faces.map((f) => document.fonts.load(f, 'Aéêàçîôù’ABCabc0123')));
  await document.fonts.ready;
}
export function imagesReady() {
  return Promise.all(
    [...document.images].map((img) => (img.complete && img.naturalWidth ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; }))),
  );
}
