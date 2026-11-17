/* global gsap */
import {
  $, CX, CY, H, P, R, W, cam, camera, clamp, depth, el, fadeUp, flash, glows, leave, lerp, punch, renderers, rise, scene, shake, show,
  slam, split, svg, text, tl,
} from './engine.js';

const ORANGE = '#EA632E';
const TEAL = '#3FB3C8';
const BRAND = '../public/brand';

// ── Éléments persistants : le point orange (fil conducteur) et ses ondes ─────────────
const dot = el('div', { attrs: { id: 'dot' } });
const dotWhite = el('div', { style: { position: 'absolute', inset: '0', borderRadius: '50%', background: '#fff', opacity: '0' } }, dot);
const rings = Array.from({ length: 8 }, (_, i) => el('div', { cls: `ring${i % 2 ? ' white' : ''}`, style: { zIndex: '29' } }));
gsap.set(dot, { x: CX, y: CY, scale: 0 });
gsap.set(rings, { x: CX, y: CY, opacity: 0 });

function ring(i, t, x, y, to = 1.8, dur = 1.1) {
  tl.fromTo(rings[i], { x, y, scale: 0.12, opacity: 0.95 }, { scale: to, opacity: 0, duration: dur, ease: 'power2.out', immediateRender: false }, t);
}

/** Décalage de la ligne de base pour une police donnée (mesuré, pas estimé). */
function baseline(cls, size) {
  const m = el('div', { cls, style: { position: 'absolute', left: '-9999px', top: '0', fontSize: `${size}px` }, html: 'X<span style="display:inline-block;width:0;height:0"></span>' }, document.body);
  const off = m.lastChild.getBoundingClientRect().top - m.getBoundingClientRect().top;
  m.remove();
  return off;
}

function glow(i, t, props, dur = 1.6) {
  tl.to(glows[i], { ...props, duration: dur, ease: 'sine.inOut' }, t);
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 1. ACCROCHE (0 – 8 s) : « Des compétences essentielles, souvent INVISIBLES. Le jeu les révèle. »
// ═════════════════════════════════════════════════════════════════════════════════════
function accroche() {
  const s = scene('s1');
  show(s, 0, 8.0);
  tl.set(P, { opacity: 0 }, 0);
  tl.to(P, { opacity: 0.75, duration: 2.5, ease: 'sine.inOut' }, 0.3);
  glow(0, 0.2, { opacity: 0.3, x: 520, y: 80 }, 3);
  glow(1, 0.2, { opacity: 0.16, x: -260, y: -200 }, 3);
  tl.fromTo(cam, { zoom: 1 }, { zoom: 1.06, duration: 7.3, ease: 'sine.inOut' }, 0);

  // Le point apparaît et bat au rythme
  tl.fromTo(dot, { x: CX, y: CY, scale: 0 }, { scale: 1, duration: 0.45, ease: 'back.out(3)' }, 0.5);
  for (const t of [1.0, 1.5]) tl.fromTo(dot, { scale: 1.35 }, { scale: 1, duration: 0.32, ease: 'power2.out', immediateRender: false }, t);
  const hair = el('div', { cls: 'abs', style: { left: `${CX - 760}px`, top: `${CY - 1}px`, width: '1520px', height: '2px', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.45) 35%, rgba(234,99,46,0.9) 50%, rgba(255,255,255,0.45) 65%, rgba(255,255,255,0))', transformOrigin: '50% 50%' } }, s);
  const ticks = el('div', { cls: 'abs', style: { left: `${CX - 600}px`, top: `${CY - 7}px`, width: '1200px', height: '14px', backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.35) 0 2px, transparent 2px 100px)', opacity: '0' } }, s);
  const orbit = svg('svg', { width: 220, height: 220, style: `position:absolute;left:${CX - 110}px;top:${CY - 110}px;overflow:visible` }, s);
  const oc = svg('circle', { cx: 110, cy: 110, r: 78, fill: 'none', stroke: 'rgba(255,255,255,0.35)', 'stroke-width': 1.5, 'stroke-dasharray': '3 9' }, orbit);
  const oc2 = svg('circle', { cx: 110, cy: 110, r: 100, fill: 'none', stroke: 'rgba(234,99,46,0.55)', 'stroke-width': 2, 'stroke-dasharray': '60 568' }, orbit);
  gsap.set(hair, { scaleX: 0 });
  tl.fromTo(hair, { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: 'expo.out' }, 0.62);
  tl.fromTo(ticks, { opacity: 0, scaleX: 0.6 }, { opacity: 1, scaleX: 1, duration: 0.9, ease: 'power2.out' }, 0.9);
  tl.fromTo(orbit, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.7, ease: 'expo.out' }, 0.55);
  tl.fromTo([oc, oc2], { rotation: 0, svgOrigin: '110 110' }, { rotation: (i) => (i ? -220 : 160), duration: 1.6, ease: 'none' }, 0.5);
  tl.to([hair, ticks, orbit], { scaleX: 0, opacity: 0, duration: 0.24, ease: 'power3.in' }, 1.8);
  ring(0, 0.5, CX, CY, 1.4);
  ring(1, 1.0, CX, CY, 1.7);
  ring(2, 1.5, CX, CY, 2.0);

  const l1 = text(s, 'Des compétences', 'h w600', { left: '600px', top: '318px', fontSize: '104px' });
  const l2 = text(s, 'essentielles,', 'h w600', { left: '600px', top: '428px', fontSize: '104px' });
  const l3 = text(s, 'souvent', 'body muted', { left: '606px', top: '552px', fontSize: '62px' });
  const s1 = split(l1, 'chars', 'chars');
  const s2 = split(l2, 'chars', 'chars');
  const s3 = split(l3, 'words', 'words');

  // Le point guide la lecture, ligne après ligne
  tl.to(dot, { x: 552, y: 372, scale: 0.8, duration: 0.32, ease: 'power3.inOut' }, 1.82);
  rise(s1.chars, 2.0, { stagger: 0.02 });
  tl.to(dot, { y: 482, duration: 0.24, ease: 'power3.inOut' }, 2.55);
  rise(s2.chars, 2.75, { stagger: 0.02 });
  tl.to(dot, { y: 590, x: 558, duration: 0.22, ease: 'power3.inOut' }, 3.08);
  rise(s3.words, 3.25, { dur: 0.6 });
  for (const t of [2.5, 3.0, 3.5]) tl.fromTo(dot, { scale: 1.1 }, { scale: 0.8, duration: 0.25, ease: 'power2.out', immediateRender: false }, t);

  // IMPACT : INVISIBLES
  const bigSize = 250;
  const big = el('div', { cls: 'abs', style: { left: '0', right: '0', top: '402px', textAlign: 'center' } }, s);
  const wrap = el('div', { style: { display: 'inline-block', position: 'relative' } }, big);
  const outline = el('div', { cls: 'h w800 outline', text: 'INVISIBLES', style: { fontSize: `${bigSize}px`, letterSpacing: '-0.02em' } }, wrap);
  const fill = el('div', { cls: 'h w800 orange', text: 'INVISIBLES', style: { position: 'absolute', left: '0', top: '0', fontSize: `${bigSize}px`, letterSpacing: '-0.02em', clipPath: 'inset(0% 100% 0% 0%)' } }, wrap);
  const sweep = el('div', { style: { position: 'absolute', top: '-6%', height: '112%', width: '120px', left: '0', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,236,224,0.95), rgba(255,255,255,0))', mixBlendMode: 'screen', opacity: '0', filter: 'blur(8px)' } }, wrap);
  const so = split(outline, 'chars');
  split(fill, 'chars');
  const rect = wrap.getBoundingClientRect();
  const base = baseline('h w800', bigSize);
  const dotScale = 1.55;
  const px = rect.right + 30;
  const py = rect.top + base - 17 * dotScale;

  leave([l1, l2, l3], 3.98, { y: -110, blur: 16, dur: 0.32, stagger: 0.03 });
  tl.fromTo(wrap, { scale: 1.28 }, { scale: 1, duration: 0.8, ease: 'expo.out' }, 4.0);
  slam(so.chars, 4.0, { scale: 1.9, blur: 14, dur: 0.6, stagger: { each: 0.02, from: 'center' } });
  tl.to(dot, { motionPath: { path: [{ x: 558, y: 590 }, { x: (558 + px) / 2, y: 250 }, { x: px, y: py }], curviness: 1.3 }, duration: 0.24, ease: 'power2.in' }, 3.8);
  tl.fromTo(dot, { scaleX: dotScale * 1.55, scaleY: dotScale * 0.62 }, { scaleX: dotScale, scaleY: dotScale, duration: 0.42, ease: 'land', immediateRender: false }, 4.04);
  shake(4.0, 1.1, 0.55);
  flash(4.0, 0.35, 0.45);
  punch(4.0, 0.05, 0.5);
  tl.fromTo(P, { burst: 0 }, { burst: 0.28, duration: 0.5, ease: 'power3.out', immediateRender: false }, 4.0);
  tl.to(P, { burst: 0, duration: 2.2, ease: 'sine.inOut' }, 4.5);
  ring(3, 4.04, px, py, 2.2, 0.9);
  so.chars.forEach((c, i) => tl.to(c, { y: (i % 2 ? 1 : -1) * (6 + (i % 3) * 3), duration: 1.4, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 4.6 + i * 0.04));
  tl.to(wrap, { scale: 1.045, duration: 3.2, ease: 'sine.inOut' }, 4.8);

  // « Le jeu les révèle. » + remplissage orange
  const rev = text(s, '<span class="orange">Le jeu</span> les révèle.', 'h w700', { left: '0', right: '0', top: '232px', fontSize: '92px', textAlign: 'center' });
  const sr = split(rev, 'words', 'words');
  rise(sr.words.slice(0, 2), 6.0, { stagger: 0.07 });
  rise(sr.words.slice(2), 6.5, { stagger: 0.07 });
  tl.to(fill, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.0, ease: 'power2.inOut' }, 6.25);
  tl.fromTo(sweep, { x: -80, opacity: 1 }, { x: rect.width - 40, duration: 1.0, ease: 'power2.inOut', immediateRender: false }, 6.25);
  tl.to(sweep, { opacity: 0, duration: 0.2 }, 7.2);
  tl.to(dot, { scale: dotScale * 1.2, duration: 0.3, ease: 'power2.out' }, 7.1);

  // Plongée dans le point → l'écran devient orange
  const zEnd = 70;
  tl.to(cam, { zoom: zEnd, x: (px - CX) * (1 - zEnd), y: (py - CY) * (1 - zEnd), duration: 0.6, ease: 'expo.in' }, 7.38);
  tl.to(P, { opacity: 0, duration: 0.25, ease: 'power2.in' }, 7.7);
  const wipe = el('div', { attrs: { id: 'wipe' } });
  tl.fromTo(wipe, { opacity: 0 }, { opacity: 1, duration: 0.1, ease: 'none' }, 7.88);
  tl.set(cam, { zoom: 1, x: 0, y: 0 }, 8.0);
  tl.set(dot, { opacity: 0 }, 8.0);
  tl.set(wipe, { opacity: 0 }, 8.6);
  return { px, py };
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 2. RÉSEAU (8 – 18 s) : COMMUNICATION, LEADERSHIP, COOPÉRATION → réseau 3D → 18 / 16
// ═════════════════════════════════════════════════════════════════════════════════════
function reseau() {
  const s = scene('s2', { bg: true });
  show(s, 8.0, 18.05);
  tl.fromTo(s, { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(80% at 50% 50%)', duration: 0.6, ease: 'expo.out' }, 8.0);
  tl.to(s.firstChild, { opacity: 0, duration: 0.05 }, 8.6);
  tl.set(P, { opacity: 0.7 }, 8.6);
  tl.to('#grid', { opacity: 0.22, duration: 1.2 }, 8.5);
  glow(0, 8.4, { opacity: 0.26, x: 140, y: -60 }, 2.5);
  glow(1, 8.4, { opacity: 0.22, x: 1100, y: 400 }, 2.5);

  const mk = (txt, cls, size = 150) => {
    const wrap = el('div', { cls: 'abs', style: { left: '0', right: '0', top: '465px', textAlign: 'center' } }, s);
    const inner = el('div', { cls: `h w800 ${cls}`, text: txt, style: { display: 'inline-block', fontSize: `${size}px`, letterSpacing: '-0.02em' } }, wrap);
    return { wrap, inner, sp: split(inner, 'chars') };
  };
  const w1 = mk('COMMUNICATION', '');
  const w2 = mk('LEADERSHIP', 'orange');
  const w3 = mk('COOPÉRATION', '');
  gsap.set([w2.wrap, w3.wrap], { opacity: 0 });

  slam(w1.sp.chars, 8.0, { scale: 2.5, blur: 18, dur: 0.6 });
  punch(8.0, 0.05, 0.5);
  tl.to(w1.wrap, { y: -175, scale: 0.5, opacity: 0.55, duration: 0.36, ease: 'power3.inOut' }, 8.78);
  tl.fromTo(w2.wrap, { x: 1700, skewX: -24, opacity: 1 }, { x: 0, skewX: 0, duration: 0.42, ease: 'expo.out' }, 8.78);
  punch(9.0, 0.025, 0.35);
  tl.to(w2.wrap, { y: -30, scale: 0.62, duration: 0.3, ease: 'power3.inOut' }, 9.78);
  tl.to(w1.wrap, { opacity: 0.8, duration: 0.3 }, 9.78);
  tl.set(w3.wrap, { y: 120, scale: 0.62, opacity: 1 }, 9.9);
  tl.fromTo(w3.sp.chars, { y: -320, rotate: (i) => (i % 2 ? 22 : -18) + i * 2, opacity: 0 }, { y: 0, rotate: 0, opacity: 1, stagger: 0.028, duration: 0.6, ease: 'back.out(1.7)' }, 9.98);
  punch(10.0, 0.025, 0.35);
  const ul = el('div', { style: { position: 'absolute', left: '0', right: '0', bottom: '-6px', height: '12px', borderRadius: '6px', background: ORANGE, transformOrigin: '0% 50%' } }, w2.inner);
  w2.inner.style.position = 'relative';
  tl.fromTo(ul, { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: 'expo.out' }, 9.02);
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => el('div', { cls: 'abs', style: { left: `${CX - 30}px`, top: `${CY - 30}px`, width: '60px', height: '60px', borderColor: 'rgba(255,255,255,0.8)', borderStyle: 'solid', borderWidth: `${sy < 0 ? 3 : 0}px ${sx > 0 ? 3 : 0}px ${sy > 0 ? 3 : 0}px ${sx < 0 ? 3 : 0}px` } }, s));
  tl.fromTo(corners, { x: 0, y: 0, opacity: 0, scale: 0.4 }, { x: (i) => [-430, 430, -430, 430][i], y: (i) => [-230, -230, 230, 230][i], opacity: 1, scale: 1, duration: 0.55, ease: 'expo.out' }, 10.0);
  tl.to(corners, { x: (i) => [-560, 560, -560, 560][i], y: (i) => [-300, -300, 300, 300][i], opacity: 0, duration: 0.4, ease: 'power2.in' }, 10.85);

  // ── Réseau 3D (projection perspective, rotation lente) ──
  const net = { ry: -0.42, rx: 0.16, scale: 1, dim: 1, collapse: 0, py: 0 };
  const root = svg('svg', { width: W, height: H, style: 'position:absolute;inset:0;overflow:visible' }, s);
  const gE = svg('g', {}, root);
  const gP = svg('g', {}, root);
  const gN = svg('g', {}, root);
  const labels = el('div', { cls: 'abs', style: { inset: '0' } }, s);
  const pops = [11.25, 11.5, 11.75, 12.0, 12.25, 12.5, 12.75, 13.25, 13.5, 13.75];
  const N = [
    { l: 'Communication', k: 'ct', p: [-470, -190, 140], t: 11.38, big: true },
    { l: 'Leadership', k: 'ct', p: [430, -95, 210], t: 11.38, big: true },
    { l: 'Coopération', k: 'hbs', p: [-40, 225, 160], t: 11.38, big: true },
    { l: 'Relationnel', k: 'ct', p: [-760, 60, -60] },
    { l: 'Sensibilité sociale', k: 'hbs', p: [180, -300, -40] },
    { l: 'Adaptabilité', k: 'ct', p: [760, 150, -80] },
    { l: 'Esprit d’équipe', k: 'ct', p: [-300, 40, 380] },
    { l: 'Flexibilité mentale', k: 'hbs', p: [520, 300, 120] },
    { l: 'Organisation', k: 'ct', p: [120, 30, -300] },
    { l: 'Planification', k: 'hbs', p: [-560, 320, -150] },
    { l: 'Gestion du stress', k: 'ct', p: [700, -280, 40] },
    { l: 'Synthèse', k: 'hbs', p: [-120, -330, 260] },
    { l: 'Curiosité', k: 'ct', p: [330, 120, 420] },
  ];
  N.slice(3).forEach((n, i) => { n.t = pops[i]; });
  const far = ['Autonomie', 'Arbitrage', 'Rigueur', 'Projection', 'Implication', 'Auto-régulation', 'Polyvalence', 'Raisonnement logique', 'Compréhension', 'Auto-mobilisation'];
  far.forEach((l, i) => {
    const a = (i / far.length) * Math.PI * 2 + 0.4;
    N.push({ l, k: i % 2 ? 'hbs' : 'ct', p: [Math.cos(a) * 640, Math.sin(a) * 330, -420 - (i % 3) * 120], t: 11.6 + i * 0.22, far: true });
  });
  for (let i = 0; i < 12; i++) {
    const a = R(0, Math.PI * 2);
    N.push({ l: null, k: i % 3 ? 'ct' : 'hbs', p: [Math.cos(a) * R(300, 900), Math.sin(a) * R(150, 420), R(-500, 400)], t: R(11.2, 13.9), micro: true });
  }
  N.forEach((n) => {
    n.st = { a: 0 };
    tl.to(n.st, { a: 1, duration: n.big ? 0.4 : 0.45, ease: 'back.out(2)' }, n.t);
    n.h = svg('circle', { r: 0, fill: n.k === 'ct' ? ORANGE : TEAL, opacity: 0 }, gN);
    n.c = svg('circle', { r: 0, fill: n.k === 'ct' ? ORANGE : TEAL }, gN);
    if (n.l) {
      n.lab = el('div', { cls: n.big ? 'h w700' : 'h w600', text: n.l, style: { position: 'absolute', left: '0', top: '0', fontSize: n.big ? '40px' : '29px', color: n.big ? '#fff' : 'rgba(255,255,255,0.92)', transformOrigin: '0 50%', whiteSpace: 'nowrap', opacity: '0' } }, labels);
    }
  });
  const d3 = (a, b) => Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
  const E = [];
  const seen = new Set();
  N.forEach((n, i) => {
    N.map((m, j) => [j, d3(n, m)]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, n.micro ? 1 : 2).forEach(([j]) => {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) { seen.add(key); E.push({ i, j }); }
    });
  });
  [[0, 1], [1, 2], [0, 2], [0, 6], [1, 10], [2, 9], [4, 11], [5, 7]].forEach(([i, j]) => {
    const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
    if (!seen.has(key)) { seen.add(key); E.push({ i, j }); }
  });
  E.forEach((e, k) => {
    e.st = { p: 0 };
    e.ph = (k * 0.137) % 1;
    tl.to(e.st, { p: 1, duration: 0.55, ease: 'power2.out' }, Math.max(N[e.i].t, N[e.j].t) + 0.08);
    const ka = N[e.i].k;
    const kb = N[e.j].k;
    e.line = svg('line', { stroke: ka === kb ? (ka === 'ct' ? 'rgba(234,99,46,0.55)' : 'rgba(63,179,200,0.55)') : 'rgba(255,255,255,0.3)', 'stroke-width': 1.6 }, gE);
    e.pulse = svg('circle', { r: 0, fill: '#ffd2bd' }, gP);
  });
  tl.to(net, { ry: 0.38, rx: -0.06, duration: 5.0, ease: 'sine.inOut' }, 11.0);

  const project = (p) => {
    const cy = Math.cos(net.ry);
    const sy = Math.sin(net.ry);
    const cx = Math.cos(net.rx);
    const sx = Math.sin(net.rx);
    const x = p[0] * cy + p[2] * sy;
    let z = -p[0] * sy + p[2] * cy;
    const y = p[1] * cx - z * sx;
    z = p[1] * sx + z * cx;
    const s = 1500 / (1500 + z);
    const k = net.collapse;
    return { X: lerp(CX + x * s * net.scale, CX, k), Y: lerp(CY + (y + net.py) * s * net.scale, CY, k), s };
  };
  renderers.push((t) => {
    if (t < 10.9 || t > 18.1) return;
    const pr = N.map((n) => project(n.p));
    N.forEach((n, i) => {
      const { X, Y, s } = pr[i];
      const a = n.st.a;
      const depthA = clamp((s - 0.62) / 0.5, 0.18, 1);
      const r = (n.big ? 11 : n.far ? 5 : n.micro ? 3.2 : 7.5) * s * a;
      n.c.setAttribute('cx', X.toFixed(2));
      n.c.setAttribute('cy', Y.toFixed(2));
      n.c.setAttribute('r', Math.max(0, r).toFixed(2));
      n.c.setAttribute('opacity', (clamp(a) * net.dim * depthA * (1 - net.collapse * 0.3)).toFixed(3));
      n.h.setAttribute('cx', X.toFixed(2));
      n.h.setAttribute('cy', Y.toFixed(2));
      n.h.setAttribute('r', Math.max(0, r * 3.2).toFixed(2));
      n.h.setAttribute('opacity', (clamp(a) * net.dim * depthA * 0.16).toFixed(3));
      if (n.lab) {
        const sc = s * (n.far ? 0.72 : 1) * (0.85 + 0.15 * a) * (1 - net.collapse * 0.7);
        n.lab.style.transform = `translate(${(X + 16 * s).toFixed(1)}px, ${(Y - 19 * s).toFixed(1)}px) scale(${sc.toFixed(4)})`;
        n.lab.style.opacity = (clamp(a) * net.dim * depthA * (n.far ? 0.55 : 1) * (1 - net.collapse)).toFixed(3);
      }
    });
    E.forEach((e) => {
      const A = pr[e.i];
      const B = pr[e.j];
      const p = e.st.p;
      const o = Math.min(N[e.i].st.a, N[e.j].st.a);
      e.line.setAttribute('x1', A.X.toFixed(2));
      e.line.setAttribute('y1', A.Y.toFixed(2));
      e.line.setAttribute('x2', lerp(A.X, B.X, p).toFixed(2));
      e.line.setAttribute('y2', lerp(A.Y, B.Y, p).toFixed(2));
      e.line.setAttribute('opacity', (clamp(o) * net.dim * clamp((Math.min(A.s, B.s) - 0.6) / 0.5, 0.25, 1)).toFixed(3));
      if (p >= 1) {
        const f = (t * 0.55 + e.ph) % 1;
        e.pulse.setAttribute('cx', lerp(A.X, B.X, f).toFixed(2));
        e.pulse.setAttribute('cy', lerp(A.Y, B.Y, f).toFixed(2));
        e.pulse.setAttribute('r', (3.2 * Math.min(A.s, B.s)).toFixed(2));
        e.pulse.setAttribute('opacity', (Math.sin(Math.PI * f) * 0.95 * net.dim * (1 - net.collapse)).toFixed(3));
      } else e.pulse.setAttribute('opacity', '0');
    });
  });

  // Les trois mots rejoignent leur nœud
  net.ry = -0.42;
  const target = (i) => { const saved = net.ry; net.ry = -0.42 + 0.06; const p = project(N[i].p); net.ry = saved; return p; };
  [w1, w2, w3].forEach((w, i) => {
    const p = target(i);
    const startY = [-175, -30, 120][i];
    tl.to(w.wrap, { x: p.X + 120 - CX, y: p.Y - 536 + 0, scale: 0.2, duration: 0.45, ease: 'power3.inOut' }, 10.98);
    tl.to(w.wrap, { opacity: 0, duration: 0.12, ease: 'none' }, 11.33);
    void startY;
  });

  // Compteurs 18 / 16
  tl.to(net, { dim: 0.22, scale: 0.8, duration: 0.6, ease: 'power2.inOut' }, 12.85);
  const counter = (side, n, label, t, color) => {
    const box = el('div', { cls: 'abs', style: { top: '330px', [side]: '230px', textAlign: side === 'left' ? 'left' : 'right' } }, s);
    const num = el('div', { cls: `h w800 ${color}`, text: '0', style: { fontSize: '230px', letterSpacing: '-0.05em' } }, box);
    const lab = el('div', { cls: 'body', html: label, style: { fontSize: '40px', lineHeight: '1.15', marginTop: '14px', color: 'rgba(255,255,255,0.86)', whiteSpace: 'normal' } }, box);
    const st = { v: 0 };
    tl.fromTo(num, { scale: 1.7, opacity: 0, filter: 'blur(14px)' }, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.5, ease: 'expo.out', transformOrigin: side === 'left' ? '0% 60%' : '100% 60%' }, t);
    tl.to(st, { v: n, duration: 0.75, ease: 'power2.out' }, t);
    fadeUp(lab, t + 0.15, { dur: 0.55 });
    renderers.push(() => { num.textContent = String(Math.round(st.v)); });
    return box;
  };
  const shade = el('div', { cls: 'abs', style: { inset: '0', opacity: '0', background: 'radial-gradient(38% 46% at 22% 47%, rgba(5,16,20,0.82), rgba(5,16,20,0) 100%), radial-gradient(38% 46% at 78% 47%, rgba(5,16,20,0.82), rgba(5,16,20,0) 100%), radial-gradient(60% 30% at 50% 82%, rgba(5,16,20,0.7), rgba(5,16,20,0) 100%)' } }, s);
  tl.to(shade, { opacity: 1, duration: 0.6 }, 12.85);
  tl.to(shade, { opacity: 0, duration: 0.5 }, 16.1);
  const c1 = counter('left', 18, 'compétences<br>transversales', 13.0, 'orange');
  const c2 = counter('right', 16, 'habiletés<br>socio-cognitives', 14.0, '');
  const cap = text(s, 'Deux référentiels pour nommer ce que l’on observe.', 'body', { left: '0', right: '0', top: '820px', fontSize: '46px', textAlign: 'center', color: 'rgba(255,255,255,0.88)' });
  fadeUp(split(cap, 'words').words, 15.0, { stagger: 0.05 });

  // Effondrement vers le point
  leave([c1, c2, cap], 16.0, { y: -80, blur: 16, dur: 0.4, stagger: 0.06 });
  tl.to(net, { dim: 1, scale: 1.04, duration: 0.45, ease: 'power2.out' }, 16.05);
  tl.to(net, { ry: '+=0.9', duration: 1.5, ease: 'power2.in' }, 16.1);
  tl.to(net, { collapse: 1, duration: 1.0, ease: 'power3.in' }, 16.55);
  tl.to(net, { dim: 0, duration: 0.3, ease: 'power2.in' }, 17.3);
  tl.to(P, { attract: 1, ax: CX, ay: CY, duration: 1.15, ease: 'power3.in' }, 16.4);
  ring(3, 17.55, CX, CY, 1.6, 0.6);
  tl.to('#grid', { opacity: 0, duration: 0.6 }, 16.6);
  tl.set(dot, { x: CX, y: CY, scale: 0, scaleX: 0, scaleY: 0, opacity: 1 }, 17.05);
  tl.to(dot, { scale: 1.9, scaleX: 1.9, scaleY: 1.9, duration: 0.42, ease: 'power2.out' }, 17.1);
  tl.to(dot, { scale: 2.5, scaleX: 2.5, scaleY: 2.5, duration: 0.2, ease: 'power2.out' }, 17.55);
  tl.to(dot, { scale: 1.9, scaleX: 1.9, scaleY: 1.9, duration: 0.25, ease: 'power2.in' }, 17.75);
  tl.to(P, { opacity: 0, duration: 0.3 }, 17.75);
  tl.set(P, { attract: 0 }, 18.4);
  tl.to(P, { opacity: 0.7, duration: 1.2 }, 18.45);
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 3. MÉTHODE (18 – 28 s) : manette → 6 sessions → interface du formateur
// ═════════════════════════════════════════════════════════════════════════════════════
const circleD = (cx, cy, r) => `M${cx - r},${cy} A${r},${r} 0 1,0 ${cx + r},${cy} A${r},${r} 0 1,0 ${cx - r},${cy} Z`;
const PAD = 'M 800 490 C 870 475 1050 475 1120 490 C 1195 505 1235 550 1255 640 C 1275 730 1270 800 1225 815 C 1180 830 1140 780 1100 730 C 1080 705 1060 695 1030 695 L 890 695 C 860 695 840 705 820 730 C 780 780 740 830 695 815 C 650 800 645 730 665 640 C 685 550 725 505 800 490 Z';

function methode() {
  const s = scene('s3');
  show(s, 17.98, 24.0);
  glow(0, 18.0, { opacity: 0.34, x: 520, y: 220 }, 1.5);
  glow(1, 18.0, { opacity: 0.18, x: 1250, y: -100 }, 1.5);

  const root = svg('svg', { width: W, height: H, style: 'position:absolute;inset:0;overflow:visible' }, s);
  const g = svg('g', {}, root);
  const body = svg('path', { d: circleD(CX, CY, 32), fill: '#EA632E', stroke: ORANGE, 'stroke-width': 7, 'stroke-linejoin': 'round' }, g);
  const det = [
    svg('path', { d: 'M 805 600 h 24 v -24 h 24 v 24 h 24 v 24 h -24 v 24 h -24 v -24 h -24 Z', fill: 'none', stroke: '#fff', 'stroke-width': 5, 'stroke-linejoin': 'round' }, g),
    ...[[1080, 585], [1115, 612], [1080, 639], [1045, 612]].map(([x, y]) => svg('circle', { cx: x, cy: y, r: 14, fill: 'rgba(234,99,46,0)', stroke: '#fff', 'stroke-width': 5 }, g)),
    svg('circle', { cx: 912, cy: 655, r: 24, fill: 'none', stroke: '#fff', 'stroke-width': 5 }, g),
    svg('circle', { cx: 1008, cy: 655, r: 24, fill: 'none', stroke: '#fff', 'stroke-width': 5 }, g),
    svg('line', { x1: 930, y1: 560, x2: 948, y2: 560, stroke: '#fff', 'stroke-width': 6, 'stroke-linecap': 'round' }, g),
    svg('line', { x1: 972, y1: 560, x2: 990, y2: 560, stroke: '#fff', 'stroke-width': 6, 'stroke-linecap': 'round' }, g),
  ];
  gsap.set(det, { drawSVG: '0%' });
  tl.set(dot, { opacity: 0 }, 18.0);
  gsap.set(body, { attr: { fill: '#EA632E' } });
  tl.to(body, { morphSVG: PAD, duration: 0.6, ease: 'expo.inOut' }, 18.0);
  tl.to(body, { attr: { fill: 'rgba(234,99,46,0.08)' }, duration: 0.45, ease: 'power2.inOut' }, 18.05);
  tl.to(det, { drawSVG: '100%', duration: 0.5, stagger: 0.05, ease: 'power2.out' }, 18.35);
  tl.fromTo(g, { scale: 1, rotation: 0, svgOrigin: '960 650' }, { scale: 1.1, rotation: 2.5, duration: 2.0, ease: 'sine.inOut' }, 18.4);
  // Les boutons s'allument sur la caisse claire
  det.slice(1, 5).forEach((b, i) => {
    for (const k of [0, 1]) tl.fromTo(b, { fill: 'rgba(234,99,46,0.95)' }, { fill: 'rgba(234,99,46,0)', duration: 0.24, ease: 'power2.out', immediateRender: false }, 19.0 + (k * 4 + i) * 0.125);
  });

  const t1 = text(s, 'Le jeu vidéo', 'h w700', { left: '0', right: '0', top: '150px', fontSize: '124px', textAlign: 'center' });
  const t2 = text(s, 'comme terrain d’observation.', 'body', { left: '0', right: '0', top: '300px', fontSize: '54px', textAlign: 'center', color: 'rgba(255,255,255,0.78)' });
  rise(split(t1, 'chars', 'chars').chars, 18.22, { stagger: 0.025 });
  fadeUp(split(t2, 'words').words, 19.0, { stagger: 0.07 });
  tl.to(cam, { zoom: 1.04, duration: 2, ease: 'sine.inOut' }, 18.0);

  // DROP : la manette éclate en 6 sessions
  leave([t1, t2], 19.98, { y: -120, blur: 16, dur: 0.3 });
  tl.to(g, { scale: 0.25, opacity: 0, duration: 0.24, ease: 'power3.in' }, 20.0);
  tl.set(cam, { zoom: 1 }, 20.0);
  flash(20.0, 0.45, 0.5);
  shake(20.0, 0.8, 0.45);
  const row = el('div', { cls: 'abs', style: { inset: '0', perspective: '1400px' } }, s);
  const tiles = [];
  for (let i = 0; i < 6; i++) {
    const left = 960 + (i - 2.5) * 250 - 107;
    const tile = el('div', { cls: 'tile', style: { left: `${left}px`, top: '420px' }, html: `<div class="lab">Session</div><div class="num">0${i + 1}</div><div class="bar"><i></i></div>` }, row);
    const t = 20.0 + i * 0.5;
    tl.fromTo(tile, { x: 960 - 107 - left, y: 70, scale: 0.2, opacity: 0, rotationY: 80 }, { x: 0, y: 0, scale: 1, opacity: 1, rotationY: 0, duration: 0.6, ease: 'back.out(1.25)' }, t);
    tl.fromTo(tile.querySelector('.bar i'), { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: 'power2.out' }, t + 0.18);
    tl.fromTo(tile, { borderColor: 'rgba(234,99,46,0.95)' }, { borderColor: 'rgba(255,255,255,0.18)', duration: 0.6, ease: 'power2.out', immediateRender: false }, t + 0.05);
    punch(t, 0.018, 0.3);
    tiles.push(tile);
  }
  const track = el('div', { cls: 'abs', style: { left: '228px', top: '735px', width: '1464px', height: '3px', background: 'rgba(255,255,255,0.16)', borderRadius: '3px', opacity: '0' } }, s);
  const trackFill = el('div', { style: { position: 'absolute', inset: '0', background: ORANGE, transformOrigin: '0% 50%', borderRadius: '3px' } }, track);
  const head = el('div', { style: { position: 'absolute', top: '-8px', left: '-9px', width: '18px', height: '18px', borderRadius: '50%', background: ORANGE, boxShadow: '0 0 18px rgba(234,99,46,0.9)' } }, track);
  gsap.set(trackFill, { scaleX: 0 });
  tl.to(track, { opacity: 1, duration: 0.3 }, 20.0);
  for (let i = 0; i < 6; i++) {
    const cxT = 107 + i * 250;
    el('div', { style: { position: 'absolute', top: '-5px', left: `${cxT - 1}px`, width: '2px', height: '13px', background: 'rgba(255,255,255,0.45)' } }, track);
    tl.to(trackFill, { scaleX: cxT / 1464, duration: 0.42, ease: 'expo.out' }, 20.0 + i * 0.5);
    tl.to(head, { x: cxT, duration: 0.42, ease: 'expo.out' }, 20.0 + i * 0.5);
  }
  tl.to(track, { opacity: 0, y: 40, duration: 0.35, ease: 'power2.in' }, 23.4);
  const hl = text(s, '<span class="a">6 sessions</span><span class="b orange">&nbsp;· 18 heures</span>', 'h w800', { left: '0', right: '0', top: '190px', fontSize: '118px', textAlign: 'center' });
  slam(split(hl.querySelector('.a'), 'chars').chars, 20.0, { scale: 2, stagger: { each: 0.02, from: 'start' } });
  slam(split(hl.querySelector('.b'), 'chars').chars, 21.5, { scale: 2, stagger: { each: 0.02, from: 'start' } });
  const sub = text(s, 'En groupe, de 4 à 8 participants.', 'body', { left: '0', right: '0', top: '800px', fontSize: '48px', textAlign: 'center', color: 'rgba(255,255,255,0.8)' });
  fadeUp(split(sub, 'words').words, 22.5, { stagger: 0.06 });
  tl.to(cam, { x: -24, y: -10, duration: 3.4, ease: 'sine.inOut' }, 20.0);

  // Bascule vers l'interface
  tl.to(row, { rotationX: 64, y: 260, opacity: 0, transformOrigin: '50% 100%', duration: 0.5, ease: 'power3.in' }, 23.45);
  leave([hl, sub], 23.4, { y: -100, blur: 14, dur: 0.35 });
  tl.to(cam, { x: 0, y: 0, duration: 0.5, ease: 'power2.inOut' }, 23.5);
}

function interfaceFormateur() {
  const s = scene('s3b', { persp: true });
  show(s, 23.85, 28.0);
  glow(0, 23.8, { opacity: 0.32, x: 1000, y: 260 }, 1.2);
  glow(1, 23.8, { opacity: 0.2, x: -200, y: 500 }, 1.2);

  const back = depth(s, 1);
  const front = depth(s, 1.55);
  const scr = el('div', { cls: 'screen', style: { left: '730px', top: '150px', width: '1180px' } }, back);
  el('img', { attrs: { src: 'out/captures/evaluations.png' } }, scr);
  tl.fromTo(scr, { z: -1700, rotationY: -52, rotationX: 16, y: 200, opacity: 0 }, { z: 0, rotationY: -17, rotationX: 6, y: 0, opacity: 1, duration: 1.0, ease: 'expo.out' }, 23.85);
  tl.to(scr, { rotationY: -11, x: -30, duration: 3.0, ease: 'sine.inOut' }, 24.85);

  const chip = el('div', { cls: 'pill dark abs', style: { left: '790px', top: '96px', fontSize: '24px' }, html: '<span style="width:12px;height:12px;border-radius:50%;background:#3FB3C8;display:inline-block"></span>Session 3 · Leadership — terminée' }, front);
  tl.fromTo(chip, { y: 40, opacity: 0, rotationX: 40 }, { y: 0, opacity: 1, rotationX: 0, duration: 0.6, ease: 'expo.out' }, 24.55);

  const card = el('div', { cls: 'paper-card abs', style: { left: '1000px', top: '560px', width: '700px', padding: '32px 36px 34px' } }, front);
  card.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px">
      <div><div class="h w600" style="font-size:44px;color:#102C32">Leadership</div>
      <div class="body" style="font-size:22px;color:#5b6b6e;margin-top:8px">Sarah D. · observée en séance</div></div>
      <div class="pill" style="background:#F5F5F2;color:#102C32;font-size:19px;padding:9px 16px">Compétence transversale</div>
    </div>
    <div class="lvls" style="display:flex;gap:12px;margin-top:26px"></div>
    <div class="body cm" style="font-size:24px;color:#102C32;margin-top:24px;min-height:32px">Fédère le groupe et l’oriente vers l’objectif.</div>`;
  const lv = card.querySelector('.lvls');
  const names = ['Non acquis', 'En difficulté', 'En cours', 'Acquis', 'Dépassé'];
  const on = names.map((n, i) => {
    const b = el('div', { cls: 'lvl', style: { position: 'relative', width: '118px' }, html: `<b>${i + 1}</b><span>${n}</span>` }, lv);
    return el('div', { cls: 'lvl on', style: { position: 'absolute', inset: '-2px', width: 'auto', height: 'auto', opacity: '0' }, html: `<b>${i + 1}</b><span>${n}</span>` }, b);
  });
  const cm = split(card.querySelector('.cm'), 'chars');
  gsap.set(cm.chars, { opacity: 0 });
  const badge = el('div', { cls: 'pill orange abs', style: { right: '-26px', top: '-30px', fontSize: '24px', fontWeight: '700', boxShadow: '0 16px 40px rgba(234,99,46,0.45)' }, html: '✓ Évaluation validée' }, card);
  const cursor = el('div', { cls: 'cursor', style: { left: '0', top: '0' }, html: '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M4 2 L4 20 L9 15.5 L12.4 22 L15.4 20.6 L12 14.2 L19 14.2 Z" fill="#fff" stroke="#102C32" stroke-width="1.6" stroke-linejoin="round"/></svg>' }, card);

  tl.fromTo(card, { y: 120, opacity: 0, rotationY: -24, z: -300 }, { y: 0, opacity: 1, rotationY: -8, z: 0, duration: 0.7, ease: 'expo.out' }, 24.6);
  tl.to(card, { rotationY: -4, duration: 2.6, ease: 'sine.inOut' }, 25.3);
  // Le curseur choisit le niveau 1 → 4 (clics sur la musique)
  const btnPos = (i) => ({ x: 36 + i * 130 + 70, y: 32 + 80 + 26 + 50 });
  tl.fromTo(cursor, { x: btnPos(0).x + 160, y: btnPos(0).y + 120, opacity: 0 }, { x: btnPos(0).x, y: btnPos(0).y, opacity: 1, duration: 0.3, ease: 'power3.out' }, 24.95);
  [25.25, 25.5, 25.75, 26.0].forEach((t, i) => {
    if (i > 0) tl.to(cursor, { x: btnPos(i).x, y: btnPos(i).y, duration: 0.2, ease: 'power3.inOut' }, t - 0.21);
    tl.fromTo(cursor, { scale: 0.78 }, { scale: 1, duration: 0.18, ease: 'power2.out', immediateRender: false }, t);
    tl.set(on[i], { opacity: 1 }, t);
    if (i > 0) tl.set(on[i - 1], { opacity: 0 }, t);
    tl.fromTo(on[i], { scale: 0.86 }, { scale: 1, duration: 0.3, ease: 'back.out(3)', immediateRender: false }, t);
  });
  tl.to(cursor, { x: btnPos(4).x + 200, y: btnPos(4).y + 160, opacity: 0, duration: 0.4, ease: 'power2.in' }, 26.15);
  tl.to(cm.chars, { opacity: 1, duration: 0.01, stagger: 0.011 }, 26.02);
  tl.fromTo(badge, { scale: 0, rotation: -12, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.45, ease: 'back.out(2.6)' }, 26.5);
  punch(26.5, 0.02, 0.35);

  const l1 = text(s, 'Le formateur', 'h w700', { left: '110px', top: '300px', fontSize: '96px' });
  const l2 = text(s, 'observe.', 'h w700 orange', { left: '110px', top: '405px', fontSize: '96px' });
  const l3 = text(s, 'Chaque compétence,<br>en situation réelle.', 'body', { left: '116px', top: '545px', fontSize: '42px', lineHeight: '1.2', color: 'rgba(255,255,255,0.82)', whiteSpace: 'normal' });
  rise(split(l1, 'chars', 'chars').chars, 24.35, { stagger: 0.022 });
  rise(split(l2, 'chars', 'chars').chars, 24.75, { stagger: 0.03 });
  fadeUp(split(l3, 'words').words, 25.5, { stagger: 0.06 });
  tl.to(cam, { x: -36, zoom: 1.045, duration: 3.4, ease: 'sine.inOut' }, 24.0);

  // Sortie en coup de fouet
  tl.to(s, { x: -2400, skewX: 10, duration: 0.45, ease: 'expo.in' }, 27.4);
  tl.to(cam, { x: 0, zoom: 1, duration: 0.5, ease: 'power2.inOut' }, 27.5);
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 4. MESURE (28 – 34 s) : radar séance 1 → séance 6, puis courbe de progression
// ═════════════════════════════════════════════════════════════════════════════════════
function mesure() {
  const s = scene('s4');
  show(s, 27.6, 34.05);
  tl.fromTo(s, { x: 2400, skewX: -10 }, { x: 0, skewX: 0, duration: 0.6, ease: 'expo.out' }, 27.62);
  tl.to('#grid', { opacity: 0.18, duration: 1 }, 28.0);
  glow(0, 28.0, { opacity: 0.3, x: 500, y: 250 }, 1.5);
  glow(1, 28.0, { opacity: 0.16, x: 1300, y: 500 }, 1.5);

  const root = svg('svg', { width: W, height: H, style: 'position:absolute;inset:0;overflow:visible' }, s);
  const G = svg('g', {}, root);
  const C = { x: 960, y: 610 };
  const RAD = 290;
  const axes = ['Relationnel', 'Esprit d’équipe', 'Adaptabilité', 'Gestion du stress', 'Leadership', 'Organisation', 'Curiosité', 'Autonomie'];
  const ang = (i) => -Math.PI / 2 + (i * Math.PI * 2) / axes.length;
  const pt = (i, v) => [C.x + Math.cos(ang(i)) * RAD * v, C.y + Math.sin(ang(i)) * RAD * v];
  const rings = [1, 2, 3, 4, 5].map((k) => svg('polygon', { points: axes.map((_, i) => pt(i, k / 5).join(',')).join(' '), fill: 'none', stroke: 'rgba(255,255,255,0.16)', 'stroke-width': 1.5 }, G));
  const spokes = axes.map((_, i) => svg('line', { x1: C.x, y1: C.y, x2: pt(i, 1)[0], y2: pt(i, 1)[1], stroke: 'rgba(255,255,255,0.18)', 'stroke-width': 1.5 }, G));
  const labs = axes.map((a, i) => {
    const [x, y] = pt(i, 1.17);
    const anchor = Math.abs(Math.cos(ang(i))) < 0.2 ? 'middle' : Math.cos(ang(i)) > 0 ? 'start' : 'end';
    const tnode = svg('text', { x, y: y + 9, 'text-anchor': anchor, fill: 'rgba(255,255,255,0.88)', 'font-family': 'Poppins', 'font-weight': 600, 'font-size': 26 }, G);
    tnode.textContent = a;
    return tnode;
  });
  const v1 = [2, 3, 2, 2, 2, 3, 2, 2].map((v) => v / 5);
  const v6 = [4, 4, 3, 4, 4, 4, 4, 3].map((v) => v / 5);
  const poly1 = svg('polygon', { fill: 'rgba(255,255,255,0.07)', stroke: 'rgba(255,255,255,0.75)', 'stroke-width': 3, 'stroke-linejoin': 'round' }, G);
  const poly6 = svg('polygon', { fill: 'rgba(234,99,46,0.24)', stroke: ORANGE, 'stroke-width': 5, 'stroke-linejoin': 'round', opacity: 0 }, G);
  const vdots = axes.map(() => svg('circle', { r: 0, fill: '#fff', stroke: ORANGE, 'stroke-width': 4 }, G));
  const st = { k1: 0, m: 0, dots: 0 };
  renderers.push((t) => {
    if (t < 27.7 || t > 34.1) return;
    poly1.setAttribute('points', v1.map((v, i) => pt(i, v * st.k1).join(',')).join(' '));
    const cur = v1.map((v, i) => lerp(v, v6[i], st.m));
    poly6.setAttribute('points', cur.map((v, i) => pt(i, v).join(',')).join(' '));
    vdots.forEach((d, i) => { const [x, y] = pt(i, cur[i]); d.setAttribute('cx', x); d.setAttribute('cy', y); d.setAttribute('r', 8 * st.dots); });
  });
  gsap.set([...rings, ...spokes], { drawSVG: '0%' });
  tl.to(rings, { drawSVG: '100%', duration: 0.6, stagger: 0.06, ease: 'power2.out' }, 27.62);
  tl.to(spokes, { drawSVG: '100%', duration: 0.5, stagger: 0.03, ease: 'power2.out' }, 27.7);
  tl.fromTo(labs, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.04 }, 27.9);
  tl.to(st, { k1: 1, duration: 0.7, ease: 'expo.out' }, 28.0);
  tl.set(poly6, { opacity: 1 }, 30.0);
  tl.to(st, { m: 1, duration: 0.65, ease: 'back.out(1.4)' }, 30.0);
  tl.to(st, { dots: 1, duration: 0.4, ease: 'back.out(3)' }, 30.25);
  tl.to(poly1, { attr: { 'stroke-dasharray': '8 8' }, opacity: 0.6, duration: 0.3 }, 30.0);
  punch(30.0, 0.03, 0.4);
  tl.fromTo(G, { rotation: -8, svgOrigin: `${C.x} ${C.y}` }, { rotation: 0, duration: 2.8, ease: 'sine.out' }, 27.7);

  const title = text(s, 'Chaque progrès devient visible.', 'h w700', { left: '0', right: '0', top: '96px', fontSize: '80px', textAlign: 'center' });
  const ts = split(title, 'chars', 'chars');
  rise(ts.chars, 27.95, { stagger: 0.016 });
  const legend = el('div', { cls: 'abs', style: { left: '0', right: '0', top: '985px', display: 'flex', justifyContent: 'center', gap: '22px' } }, s);
  const lg1 = el('div', { cls: 'pill dark', style: { fontSize: '24px' }, html: '<span style="width:14px;height:14px;border-radius:50%;border:3px solid #fff;display:inline-block"></span>Séance 1' }, legend);
  const lg2 = el('div', { cls: 'pill dark', style: { fontSize: '24px' }, html: `<span style="width:14px;height:14px;border-radius:50%;background:${ORANGE};display:inline-block"></span>Séance 6` }, legend);
  fadeUp(lg1, 29.0);
  fadeUp(lg2, 30.05);
  const tag = text(s, 'Illustration', 'mono', { right: '60px', top: '1010px', fontSize: '18px', color: 'rgba(255,255,255,0.45)' });
  fadeUp(tag, 28.6);

  // Les données deviennent une courbe de progression
  tl.to(G, { x: -440, y: 20, scale: 0.66, svgOrigin: `${C.x} ${C.y}`, duration: 0.55, ease: 'expo.inOut' }, 30.95);
  leave(ts.chars, 30.9, { y: -40, blur: 8, dur: 0.25, stagger: 0.004 });
  const t2 = text(s, 'Une progression mesurée, séance après séance.', 'h w700', { left: '0', right: '0', top: '108px', fontSize: '64px', textAlign: 'center' });
  rise(split(t2, 'chars', 'chars').chars, 31.15, { stagger: 0.012 });
  const B = svg('g', {}, root);
  const base = 830;
  const vals = [2.3, 2.7, 3.0, 3.4, 3.7, 4.0];
  const x0 = 1080;
  const bw = 78;
  const gap = 34;
  const baseLine = svg('line', { x1: x0 - 30, y1: base, x2: x0 + 6 * bw + 5 * gap + 30, y2: base, stroke: 'rgba(255,255,255,0.35)', 'stroke-width': 2 }, B);
  gsap.set(baseLine, { drawSVG: '0%' });
  tl.to(baseLine, { drawSVG: '100%', duration: 0.4, ease: 'power2.out' }, 31.2);
  const tops = [];
  vals.forEach((v, i) => {
    const h = (v / 5) * 430;
    const x = x0 + i * (bw + gap);
    const r = svg('rect', { x, y: base, width: bw, height: 0, rx: 10, fill: i === 5 ? ORANGE : 'rgba(255,255,255,0.16)', stroke: i === 5 ? 'none' : 'rgba(255,255,255,0.35)', 'stroke-width': 1.5 }, B);
    const t = 31.5 + i * 0.25;
    tl.to(r, { attr: { y: base - h, height: h }, duration: 0.45, ease: 'expo.out' }, t);
    const lab = svg('text', { x: x + bw / 2, y: base + 40, 'text-anchor': 'middle', fill: 'rgba(255,255,255,0.6)', 'font-family': 'DM Mono', 'font-size': 22 }, B);
    lab.textContent = `S${i + 1}`;
    const val = svg('text', { x: x + bw / 2, y: base - h - 18, 'text-anchor': 'middle', fill: i === 5 ? ORANGE : '#fff', 'font-family': 'Poppins', 'font-weight': 600, 'font-size': 26, opacity: 0 }, B);
    val.textContent = v.toFixed(1).replace('.', ',');
    tl.fromTo(val, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3 }, t + 0.18);
    tl.fromTo(lab, { opacity: 0 }, { opacity: 1, duration: 0.3 }, t);
    tops.push([x + bw / 2, base - h - 52]);
  });
  const trend = svg('polyline', { points: tops.map((p) => p.join(',')).join(' '), fill: 'none', stroke: ORANGE, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': '1 0' }, B);
  gsap.set(trend, { drawSVG: '0%' });
  tl.to(trend, { drawSVG: '100%', duration: 0.45, ease: 'power2.inOut' }, 32.95);
  const endDot = svg('circle', { cx: tops[5][0], cy: tops[5][1], r: 0, fill: ORANGE }, B);
  tl.to(endDot, { attr: { r: 10 }, duration: 0.35, ease: 'back.out(3)' }, 33.35);

  tl.to(s, { opacity: 0, scale: 0.94, filter: 'blur(10px)', duration: 0.5, ease: 'power2.in' }, 33.5);
  tl.to('#grid', { opacity: 0, duration: 0.5 }, 33.5);
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 5. RESPIRATION (34 – 38 s) : « Du déclaré à l'observé. »
// ═════════════════════════════════════════════════════════════════════════════════════
function respiration() {
  const s = scene('s5');
  show(s, 34.0, 37.85);
  glow(0, 33.8, { opacity: 0.26, x: 1250, y: 300 }, 2);
  glow(1, 33.8, { opacity: 0.2, x: -100, y: 450 }, 2);
  tl.to(P, { drift: 0.35, duration: 1.5 }, 34.0);
  tl.to(P, { drift: 1, duration: 1 }, 38.0);

  const farL = depth(s, 0.55);
  const cv = el('div', { cls: 'glass abs', style: { left: '150px', top: '230px', width: '470px', height: '600px', padding: '44px', filter: 'blur(5px)' } }, farL);
  cv.innerHTML = `<div class="h w600" style="font-size:42px">CV</div>${['Bon relationnel', 'Esprit d’équipe', 'Sens de l’organisation'].map((d) => `<div class="body" style="font-size:30px;margin-top:34px;color:rgba(255,255,255,0.75)">• ${d}</div>`).join('')}`;
  const pp = el('div', { cls: 'glass abs', style: { left: '1300px', top: '230px', width: '470px', height: '600px', padding: '44px', filter: 'blur(5px)' } }, farL);
  pp.innerHTML = `<div class="h w600" style="font-size:42px">Passeport</div>${[['Relationnel', 4], ['Esprit d’équipe', 3], ['Organisation', 4]].map(([n, v]) => `<div class="body" style="font-size:28px;margin-top:30px">${n}</div><div style="display:flex;gap:8px;margin-top:12px">${[1, 2, 3, 4, 5].map((k) => `<i style="display:block;width:62px;height:12px;border-radius:6px;background:${k <= v ? ORANGE : 'rgba(255,255,255,0.18)'}"></i>`).join('')}</div>`).join('')}`;
  tl.fromTo([cv, pp], { opacity: 0, y: 60 }, { opacity: 0.32, y: 0, duration: 1.4, ease: 'power2.out', stagger: 0.2 }, 34.0);
  tl.to(cv, { y: -30, x: -20, duration: 3.6, ease: 'sine.inOut' }, 34.2);
  tl.to(pp, { y: 30, x: 20, duration: 3.6, ease: 'sine.inOut' }, 34.2);

  const size = 150;
  const l1 = text(s, 'Du déclaré', 'h w800 outline', { left: '0', right: '0', top: '330px', fontSize: `${size}px`, textAlign: 'center' });
  const wrap = el('div', { cls: 'abs', style: { left: '0', right: '0', top: '505px', textAlign: 'center' } }, s);
  const l2 = el('div', { cls: 'h w800 orange', text: 'à l’observé', style: { display: 'inline-block', fontSize: `${size}px` } }, wrap);
  const c1 = split(l1, 'chars');
  const c2 = split(l2, 'chars', 'chars');
  tl.fromTo(c1.chars, { opacity: 0, y: 40, filter: 'blur(12px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, stagger: 0.045, ease: 'power3.out' }, 34.0);
  rise(c2.chars, 35.0, { stagger: 0.035, dur: 0.9 });
  const r = l2.getBoundingClientRect();
  const dScale = 0.95;
  const px = r.right + 22;
  const py = r.top + baseline('h w800', size) - 17 * dScale;
  tl.fromTo(dot, { x: 1560, y: -80, scale: dScale, scaleX: dScale, scaleY: dScale, opacity: 1 }, { x: px, y: py, duration: 0.3, ease: 'power2.in', immediateRender: false }, 34.75);
  tl.fromTo(dot, { scaleX: dScale * 1.6, scaleY: dScale * 0.6 }, { scaleX: dScale, scaleY: dScale, duration: 0.45, ease: 'land', immediateRender: false }, 35.05);
  ring(4, 35.05, px, py, 1.3, 0.9);
  tl.to([l1], { x: -46, scale: 1.035, duration: 2.6, ease: 'sine.inOut' }, 35.2);
  tl.to([wrap], { x: 46, scale: 1.035, duration: 2.6, ease: 'sine.inOut' }, 35.2);
  tl.to(dot, { x: px + 46 * 1.035 + (px - CX) * 0.035, duration: 2.6, ease: 'sine.inOut' }, 35.2);
  tl.fromTo(cam, { zoom: 1 }, { zoom: 1.05, duration: 3.6, ease: 'sine.inOut' }, 34.0);
  tl.set(cam, { zoom: 1 }, 37.85);
  tl.set(dot, { opacity: 0 }, 37.85);

  // Transition par bandes (masque)
  const bars = el('div', { cls: 'abs', style: { inset: '0', zIndex: '40', pointerEvents: 'none' } });
  const specs = [[60, '#ffffff', 0], [120, '#ff8a57', 0.03], [2700, ORANGE, 0.06], [90, '#0b1d21', 0.09]];
  let off = 0;
  specs.forEach(([w, c, d]) => {
    const b = el('div', { style: { position: 'absolute', top: '-200px', height: '1480px', width: `${w}px`, left: '0', background: c, transform: 'skewX(-14deg)' } }, bars);
    tl.fromTo(b, { x: 2400 + off }, { x: -3100 + off, duration: 0.74, ease: 'expo.inOut' }, 37.46 + d);
    off += w;
  });
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 6. PASSEPORT, BILAN, PARTAGE, PUBLICS (38 – 50 s)
// ═════════════════════════════════════════════════════════════════════════════════════
function passeport() {
  const s = scene('s6a', { persp: true });
  show(s, 37.83, 42.1);
  glow(0, 37.9, { opacity: 0.3, x: 200, y: 200 }, 1.2);
  glow(1, 37.9, { opacity: 0.22, x: 1200, y: 400 }, 1.2);
  const back = depth(s, 1);
  const front = depth(s, 1.6);
  const scr = el('div', { cls: 'screen', style: { left: '70px', top: '200px', width: '1000px' } }, back);
  el('img', { attrs: { src: 'out/captures/passeport-ct.png' } }, scr);
  tl.fromTo(scr, { z: -1500, rotationY: 46, rotationX: 10, x: -260, opacity: 0 }, { z: 0, rotationY: 17, rotationX: 5, x: 0, opacity: 1, duration: 0.9, ease: 'expo.out' }, 37.88);
  tl.to(scr, { rotationY: 10, x: 20, duration: 3.2, ease: 'sine.inOut' }, 38.8);
  flash(38.0, 0.3, 0.4);
  shake(38.0, 0.6, 0.4);

  const idc = el('div', { cls: 'glass abs', style: { left: '120px', top: '96px', padding: '18px 26px 18px 18px', display: 'flex', alignItems: 'center', gap: '18px', borderRadius: '20px' } }, front);
  idc.innerHTML = `<img src="${BRAND}/happi-mascotte.png" style="width:66px;height:66px;border-radius:50%;background:#F5F5F2"><div><div class="h w600" style="font-size:28px;letter-spacing:-0.02em">Passeport de compétences</div><div class="body" style="font-size:21px;color:rgba(255,255,255,0.72);margin-top:4px">Inès M. · session 4 sur 6</div></div>`;
  tl.fromTo(idc, { y: 50, opacity: 0, rotationX: 40 }, { y: 0, opacity: 1, rotationX: 0, duration: 0.6, ease: 'expo.out' }, 38.5);
  const pills = [['Relationnel', 'Acquis', ORANGE], ['Coopération', 'Maîtrise', TEAL], ['Organisation', 'Acquis', ORANGE], ['Synthèse', 'Excellence', TEAL]];
  pills.forEach(([n, lvl, c], i) => {
    const p = el('div', { cls: 'pill light abs', style: { left: `${720 + (i % 2) * 40}px`, top: `${640 + i * 78}px`, fontSize: '26px', boxShadow: '0 18px 40px rgba(0,0,0,0.35)' }, html: `<span style="width:14px;height:14px;border-radius:50%;background:${c};display:inline-block"></span><b style="font-weight:700">${n}</b><span style="color:#5b6b6e">· ${lvl}</span>` }, front);
    tl.fromTo(p, { x: -80, opacity: 0, scale: 0.8 }, { x: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }, 38.7 + i * 0.15);
  });

  const t1 = text(s, 'Un passeport', 'h w800', { left: '1130px', top: '380px', fontSize: '84px' });
  const t2 = text(s, 'de compétences', 'h w800 orange', { left: '1130px', top: '475px', fontSize: '84px' });
  const t3 = text(s, 'qui se remplit,<br>session après session.', 'body', { left: '1134px', top: '610px', fontSize: '42px', lineHeight: '1.22', whiteSpace: 'normal', color: 'rgba(255,255,255,0.84)' });
  rise(split(t1, 'chars', 'chars').chars, 38.35, { stagger: 0.022 });
  rise(split(t2, 'chars', 'chars').chars, 38.75, { stagger: 0.022 });
  fadeUp(split(t3, 'words').words, 39.5, { stagger: 0.06 });
  tl.to(cam, { x: -26, zoom: 1.04, duration: 3.6, ease: 'sine.inOut' }, 38.1);
  tl.set(cam, { x: 0, zoom: 1 }, 42.05);
}

function bilan() {
  const s = scene('s6b', { bg: true });
  show(s, 41.6, 45.05);
  tl.fromTo(s, { clipPath: 'polygon(120% 0%, 140% 0%, 140% 100%, 100% 100%)' }, { clipPath: 'polygon(-20% 0%, 140% 0%, 140% 100%, -40% 100%)', duration: 0.45, ease: 'expo.inOut' }, 41.62);
  const stripe = el('div', { cls: 'abs', style: { top: '-120px', height: '1320px', width: '34px', left: '0', background: ORANGE, transform: 'skewX(-19.6deg)', zIndex: '41', boxShadow: '0 0 40px rgba(234,99,46,0.8)' } });
  gsap.set(stripe, { x: 2600, opacity: 0 });
  tl.fromTo(stripe, { x: 2400, opacity: 1 }, { x: -620, duration: 0.47, ease: 'expo.inOut', immediateRender: false }, 41.6);
  tl.set(stripe, { opacity: 0 }, 42.1);
  tl.to(s.firstChild, { opacity: 0, duration: 0.3 }, 42.2);
  glow(0, 42.0, { opacity: 0.32, x: 900, y: 150 }, 1.2);
  glow(2, 42.0, { opacity: 0.12, x: 1100, y: 500 }, 1.2);

  const stack = el('div', { cls: 'abs', style: { inset: '0', perspective: '1600px' } }, s);
  const pages = [
    { src: 'out/pdf/bilan-07.png', x: -330, y: 40, r: -13 },
    { src: 'out/pdf/bilan-05.png', x: 330, y: 40, r: 13 },
    { src: 'out/pdf/bilan-03.png', x: -150, y: 0, r: -5 },
    { src: 'out/pdf/bilan-01.png', x: 70, y: -12, r: 3 },
  ];
  const cx0 = 1310;
  const cy0 = 560;
  const nodes = pages.map((p, i) => {
    const n = el('div', { cls: 'page', style: { left: `${cx0 - 190}px`, top: `${cy0 - 268}px` }, html: `<img src="${p.src}">` }, stack);
    tl.fromTo(n, { x: p.x * 0.3 + (i % 2 ? 260 : -260), y: 900, rotation: p.r + (i % 2 ? 30 : -30), rotationX: 40, opacity: 1 }, { x: p.x, y: p.y, rotation: p.r, rotationX: 0, duration: 0.8, ease: 'expo.out' }, 41.62 + i * 0.1);
    return n;
  });
  tl.to(nodes, { y: '-=14', duration: 2.0, ease: 'sine.inOut', stagger: 0.1 }, 42.8);

  // Étincelles (IA)
  const sparkRoot = svg('svg', { width: W, height: H, style: 'position:absolute;inset:0;overflow:visible;pointer-events:none' }, s);
  for (let i = 0; i < 18; i++) {
    const x = cx0 + R(-520, 520);
    const y = cy0 + R(-360, 360);
    const sz = R(10, 24);
    const star = svg('path', { d: `M${x},${y - sz} Q${x},${y} ${x + sz},${y} Q${x},${y} ${x},${y + sz} Q${x},${y} ${x - sz},${y} Q${x},${y} ${x},${y - sz} Z`, fill: i % 3 ? '#ffd2bd' : '#fff', opacity: 0 }, sparkRoot);
    const t = 42.4 + R(0, 1.5);
    tl.fromTo(star, { opacity: 0, scale: 0, rotation: 0, svgOrigin: `${x} ${y}` }, { opacity: 1, scale: 1, rotation: 45, duration: 0.25, ease: 'power2.out' }, t);
    tl.to(star, { opacity: 0, scale: 0.2, rotation: 90, svgOrigin: `${x} ${y}`, duration: 0.4, ease: 'power2.in' }, t + 0.3);
  }

  const l1 = text(s, 'Un bilan rédigé avec l’IA,', 'h w700', { left: '110px', top: '330px', fontSize: '60px' });
  const l2 = text(s, 'validé par le formateur.', 'h w700 orange', { left: '110px', top: '412px', fontSize: '60px' });
  const l3 = text(s, 'L’IA rédige à partir des observations,<br>sans jamais attribuer de niveau.', 'body', { left: '114px', top: '540px', fontSize: '34px', lineHeight: '1.3', whiteSpace: 'normal', color: 'rgba(255,255,255,0.78)' });
  rise(split(l1, 'words', 'words').words, 42.45, { stagger: 0.05 });
  rise(split(l2, 'words', 'words').words, 43.4, { stagger: 0.05 });
  fadeUp(split(l3, 'words').words, 44.0, { stagger: 0.03, dur: 0.45 });
  const stamp = el('div', { cls: 'stamp', style: { left: `${cx0 + 70 + 40}px`, top: `${cy0 - 268 - 10 + 70}px` }, html: 'Validé ✓' }, s);
  tl.fromTo(stamp, { scale: 2.6, rotation: -26, opacity: 0 }, { scale: 1, rotation: -9, opacity: 1, duration: 0.34, ease: 'back.out(2)' }, 43.75);
  shake(43.75, 0.45, 0.35);
  punch(43.75, 0.03, 0.35);

  tl.to([...nodes, stamp], { x: '-=1700', rotation: '-=18', duration: 0.38, ease: 'expo.in', stagger: 0.025 }, 44.6);
  leave([l1, l2, l3], 44.6, { y: 0, x: -400, blur: 12, dur: 0.32 });
}

function partage() {
  const s = scene('s6c', { persp: true });
  show(s, 44.85, 47.0);
  glow(0, 44.9, { opacity: 0.34, x: 820, y: 150 }, 1.0);
  glow(1, 44.9, { opacity: 0.2, x: -150, y: 450 }, 1.0);
  const t1 = text(s, 'Partageable.', 'h w800', { left: '110px', top: '220px', fontSize: '112px' });
  const t2 = text(s, 'Vérifiable.', 'h w800 orange', { left: '110px', top: '340px', fontSize: '112px' });
  const t3 = text(s, 'Un lien sécurisé, contrôlé par le participant.', 'body', { left: '116px', top: '492px', fontSize: '38px', color: 'rgba(255,255,255,0.8)' });
  slam(split(t1, 'chars').chars, 45.0, { scale: 2, stagger: { each: 0.018, from: 'start' } });
  slam(split(t2, 'chars').chars, 45.5, { scale: 2, stagger: { each: 0.018, from: 'start' } });
  fadeUp(split(t3, 'words').words, 46.0, { stagger: 0.04, dur: 0.45 });
  punch(45.0, 0.03, 0.35);
  punch(45.5, 0.03, 0.35);

  const qr = el('div', { cls: 'paper-card abs', style: { left: '120px', top: '600px', width: '300px', padding: '30px 30px 22px', textAlign: 'center' } }, s);
  qr.innerHTML = `<img src="out/qr.svg" style="width:240px;height:240px;display:block"><div class="body" style="font-size:20px;color:#5b6b6e;margin-top:14px">happicompetence.fr</div>`;
  const scan = el('div', { style: { position: 'absolute', left: '20px', right: '20px', height: '4px', top: '30px', background: ORANGE, boxShadow: '0 0 18px rgba(234,99,46,0.9)', borderRadius: '4px', opacity: '0' } }, qr);
  tl.fromTo(qr, { y: 80, opacity: 0, rotationX: 40 }, { y: 0, opacity: 1, rotationX: 0, duration: 0.6, ease: 'expo.out' }, 45.2);
  tl.fromTo(scan, { y: 0, opacity: 1 }, { y: 236, duration: 0.8, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 45.4);

  const phone = el('div', { cls: 'phone', style: { left: '1010px', top: '150px' } }, s);
  const rows = [['Relationnel', 4, 'Acquis'], ['Leadership', 3, 'En cours d’acquisition'], ['Coopération', 3, 'Maîtrise', 4], ['Organisation', 4, 'Acquis']];
  phone.innerHTML = `<div class="scr"><div style="padding:52px 26px 0">
    <div style="display:flex;align-items:center;gap:10px"><img src="${BRAND}/happi-mascotte.png" style="width:36px;height:36px"><img src="${BRAND}/happi-logotype-petrole.png" style="height:22px"></div>
    <div class="vbadge pill" style="margin-top:30px;background:rgba(234,99,46,0.12);color:${ORANGE};font-size:20px;font-weight:700;padding:9px 16px">✓ Passeport vérifié</div>
    <div class="h w600" style="font-size:32px;margin-top:20px;letter-spacing:-0.02em">Inès M.</div>
    <div class="body" style="font-size:18px;color:#5b6b6e;margin-top:4px">Programme HAPPI · niveaux validés</div>
    <div class="rows" style="margin-top:22px"></div>
    <div class="body" style="font-size:14.5px;line-height:1.35;color:#5b6b6e;margin-top:20px;white-space:normal">Niveaux observés en situation collective par un formateur HAPPI ; non une certification.</div>
  </div></div>`;
  const rowsEl = phone.querySelector('.rows');
  const rowNodes = rows.map(([n, v, l, max]) => el('div', { style: { padding: '13px 0', borderTop: '1px solid #e5e5e0' }, html: `<div style="display:flex;justify-content:space-between;font-size:19px"><b class="body" style="font-weight:700">${n}</b><span class="body" style="color:#5b6b6e;font-size:16px">${l}</span></div><div style="display:flex;gap:5px;margin-top:9px">${Array.from({ length: max ?? 5 }, (_, k) => `<i style="display:block;flex:1;height:8px;border-radius:4px;background:${k < v ? ((max ?? 5) === 4 ? TEAL : ORANGE) : '#e5e5e0'}"></i>`).join('')}</div>` }, rowsEl));
  tl.fromTo(phone, { y: 900, rotation: 10, scale: 0.92 }, { y: 0, rotation: -3, scale: 0.92, duration: 0.75, ease: 'expo.out' }, 44.92);
  tl.fromTo(phone.querySelector('.vbadge'), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(3)' }, 45.25);
  tl.fromTo(rowNodes, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.09 }, 45.4);
  const masc = el('img', { cls: 'abs', attrs: { src: `${BRAND}/happi-mascotte-3d.webp` }, style: { left: '1440px', top: '360px', height: '660px', filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.45))' } }, s);
  tl.fromTo(masc, { x: 700, rotation: 8 }, { x: 0, rotation: 0, duration: 0.75, ease: 'back.out(1.2)' }, 45.1);
  tl.to(masc, { y: -14, duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 45.85);

  leave([t1, t2, t3, qr], 46.65, { y: 120, blur: 14, dur: 0.32, stagger: 0.03 });
  tl.to([phone, masc], { y: '+=1000', duration: 0.4, ease: 'power3.in', stagger: 0.05 }, 46.6);
}

function publics() {
  const s = scene('s6d');
  show(s, 46.7, 50.05);
  const head = text(s, 'Pour qui ?', 'mono orange', { left: '0', right: '0', top: '300px', fontSize: '32px', textAlign: 'center', letterSpacing: '0.32em' });
  fadeUp(head, 46.85);
  const rowA = el('div', { cls: 'audience', style: { top: '400px' } }, s);
  const rowB = el('div', { cls: 'audience', style: { top: '545px' } }, s);
  const A = ['Missions Locales', 'France Travail', 'Entreprises'].map((n) => el('div', { cls: 'pill dark', text: n }, rowA));
  const B = ['Écoles et organismes de formation', 'Structures d’insertion'].map((n) => el('div', { cls: 'pill dark', text: n }, rowB));
  const center = (row) => { const w = row.getBoundingClientRect().width; row.style.left = `${(W - w) / 2}px`; };
  center(rowA);
  center(rowB);
  gsap.set([...A, ...B], { opacity: 0 });
  tl.fromTo(rowA, { x: -1500 }, { x: 0, duration: 0.55, ease: 'expo.out' }, 46.88);
  tl.to(rowA, { x: 110, duration: 1.2, ease: 'power1.in' }, 47.35);
  tl.fromTo(rowB, { x: 1500 }, { x: 0, duration: 0.55, ease: 'expo.out' }, 46.95);
  tl.to(rowB, { x: -110, duration: 1.05, ease: 'power1.in' }, 47.5);
  tl.fromTo(A, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, stagger: 0.06, duration: 0.4, ease: 'back.out(2)' }, 46.85);
  tl.fromTo(B, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, stagger: 0.06, duration: 0.4, ease: 'back.out(2)' }, 47.0);
  tl.fromTo(A.concat(B), { borderColor: 'rgba(234,99,46,1)' }, { borderColor: 'rgba(255,255,255,0.16)', duration: 0.5, stagger: 0.05, immediateRender: false }, 47.0);
  glow(0, 46.8, { opacity: 0.3, x: 500, y: 100 }, 1);

  // Implosion vers le point
  tl.to([rowA, rowB, head], { scale: 0.02, opacity: 0, x: (i) => [0, 0, 0][i], y: (i) => [80, -45, 210][i], transformOrigin: '50% 50%', duration: 1.2, ease: 'power3.in' }, 48.55);
  tl.to(P, { attract: 1, ax: CX, ay: CY, opacity: 1, duration: 1.3, ease: 'power3.in' }, 48.55);
  tl.set(dot, { x: CX, y: CY, scale: 0, scaleX: 0, scaleY: 0, opacity: 1 }, 49.1);
  tl.to(dot, { scale: 1.6, scaleX: 1.6, scaleY: 1.6, duration: 0.55, ease: 'power2.out' }, 49.15);
  tl.to(dot, { scale: 2.6, scaleX: 2.6, scaleY: 2.6, duration: 0.25, ease: 'power2.in' }, 49.72);
  tl.to(cam, { zoom: 1.08, duration: 1.3, ease: 'power2.in' }, 48.6);
  tl.set(cam, { zoom: 1 }, 50.0);
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 7. LOGO (50 – 58 s) : onde de choc, logotype lettre à lettre, signature
// ═════════════════════════════════════════════════════════════════════════════════════
function logo() {
  const s = scene('s7');
  show(s, 49.95, 58.1);
  flash(50.0, 0.95, 0.7);
  shake(50.0, 1.0, 0.55);
  punch(50.0, 0.07, 0.6);
  tl.set(P, { attract: 0, opacity: 0.9, bx: CX, by: CY }, 50.0);
  tl.fromTo(P, { burst: 0 }, { burst: 0.55, duration: 0.7, ease: 'expo.out', immediateRender: false }, 50.0);
  tl.to(P, { burst: 0.2, opacity: 0.55, duration: 3, ease: 'sine.inOut' }, 50.7);
  ring(5, 50.0, CX, CY, 9, 1.0);
  ring(6, 50.08, CX, CY, 7, 1.1);
  glow(0, 50.0, { opacity: 0.32, x: 520, y: 80 }, 1.5);
  glow(1, 50.0, { opacity: 0.16, x: 1100, y: 450 }, 1.5);
  glow(2, 50.0, { opacity: 0.0 }, 0.5);

  const scaleL = 0.75;
  const mascotSize = 330;
  const total = mascotSize + 24 + 800 * scaleL;
  const left = (W - total) / 2;
  const cy = 470;
  const logoLeft = left + mascotSize + 24;
  const logoTop = Math.round(cy - (305 * scaleL) / 2);
  const slices = [[0, 145], [172, 334], [375, 536], [567, 729], [756, 799]];
  const letters = slices.map(([a, b], i) => {
    const top = i === 4 ? 62 : 0;
    const box = el('div', { style: { position: 'absolute', overflow: 'hidden', left: `${logoLeft + a * scaleL - 2}px`, top: `${logoTop + top * scaleL}px`, width: `${(b - a + 4) * scaleL}px`, height: `${(305 - top) * scaleL + 4}px` } }, s);
    const inner = el('div', { style: { position: 'absolute', inset: '0', backgroundImage: `url(${BRAND}/happi-logotype-blanc.png)`, backgroundSize: `${800 * scaleL}px auto`, backgroundRepeat: 'no-repeat', backgroundPosition: `${-(a - 2) * scaleL}px ${-top * scaleL}px` } }, box);
    return inner;
  });
  tl.fromTo(letters, { yPercent: 112, rotation: 6 }, { yPercent: 0, rotation: 0, duration: 0.65, ease: 'expo.out', stagger: 0.15 }, 50.12);
  const ix = logoLeft + 777.5 * scaleL;
  const iy = logoTop + 28 * scaleL;
  const dS = (44 * scaleL) / 34;
  tl.to(dot, { scale: 1, scaleX: 1, scaleY: 1, duration: 0.2, ease: 'power2.out' }, 50.0);
  tl.to(dot, { motionPath: { path: [{ x: CX, y: CY }, { x: (CX + ix) / 2 + 60, y: 170 }, { x: ix, y: iy }], curviness: 1.2 }, duration: 0.32, ease: 'power2.inOut' }, 50.72);
  tl.to(dot, { scaleX: dS * 1.4, scaleY: dS * 0.7, duration: 0.04 }, 51.0);
  tl.to(dot, { scaleX: dS, scaleY: dS, duration: 0.4, ease: 'land' }, 51.04);
  tl.to(dotWhite, { opacity: 1, duration: 0.6, ease: 'power2.inOut' }, 51.4);
  tl.to(dot, { boxShadow: '0 0 0px rgba(234,99,46,0), 0 0 0px rgba(234,99,46,0)', duration: 0.6 }, 51.4);

  const masc = el('img', { cls: 'abs', attrs: { src: `${BRAND}/happi-mascotte.png` }, style: { left: `${left}px`, top: `${cy - mascotSize / 2}px`, width: `${mascotSize}px`, height: `${mascotSize}px` } }, s);
  tl.fromTo(masc, { scale: 0, rotation: -22, opacity: 1 }, { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(2.2)' }, 51.1);
  tl.to(masc, { y: -8, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: 3 }, 51.8);

  const meaning = text(s, 'Human Abilities &amp; Professional Progress Integration', 'mono', { left: '0', right: '0', top: '676px', fontSize: '22px', textAlign: 'center', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.62)' });
  tl.fromTo(meaning, { clipPath: 'inset(0% 50% 0% 50%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.out' }, 52.0);
  const slogan = text(s, 'L’avenir se joue <span class="orange">ici.</span>', 'h w700', { left: '0', right: '0', top: '752px', fontSize: '76px', textAlign: 'center' });
  const sw = split(slogan, 'words', 'words').words;
  rise(sw.slice(0, 1), 53.0, {});
  rise(sw.slice(1, 3), 53.5, { stagger: 0.06 });
  tl.fromTo(sw[3], { yPercent: 0, scale: 1.7, opacity: 0, filter: 'blur(10px)' }, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.5, ease: 'expo.out' }, 54.0);
  const icir = sw[3].getBoundingClientRect();
  ring(7, 54.0, icir.left + icir.width / 2, icir.top + icir.height / 2, 3.2, 1.0);
  flash(54.0, 0.28, 0.5);
  shake(54.0, 0.45, 0.4);
  const url = text(s, 'happicompetence.fr', 'body', { left: '0', right: '0', top: '872px', fontSize: '34px', textAlign: 'center', color: 'rgba(255,255,255,0.72)', letterSpacing: '0.02em' });
  fadeUp(url, 55.0, { dur: 0.8 });
  tl.fromTo(cam, { zoom: 1 }, { zoom: 1.035, duration: 5.4, ease: 'sine.inOut', immediateRender: false }, 52.0);
  tl.fromTo('#fade', { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power2.in' }, 57.2);
}

export function buildAll() {
  accroche();
  reseau();
  methode();
  interfaceFormateur();
  mesure();
  respiration();
  passeport();
  bilan();
  partage();
  publics();
  logo();
  return tl;
}

export { camera, $ };
