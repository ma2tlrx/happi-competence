/* global gsap */
// Vidéo « Passeport Numérique » (30 s) : six séquences, toutes positionnées image par image.
// Rythme de lecture : chaque texte reste à l'écran au moins 0,45 s par mot + 0,8 s (voir docs dans video/README.md).
import { $, CX, CY, P, clamp, cam, el, fadeUp, flash, glows, leave, punch, renderers, rise, scene, shake, show, slam, split, svg, text, tl } from './engine.js';

export const DURATION = 52;
const BRAND = '../public/brand';
const ORANGE = '#EA632E';
const ORANGE_INK = '#C94D1A';
const PETROLE = '#102C32';

gsap.set(['#wipeA', '#wipeB'], { xPercent: -140, skewX: -12 });

/** Balayage de transition : orange puis blanc cassé, centré sur l'instant `b` (le changement de scène a lieu sous le balayage). */
function wipe(b) {
  tl.fromTo('#wipeA', { xPercent: -140 }, { xPercent: 0, duration: 0.36, ease: 'power3.in', immediateRender: false }, b - 0.36);
  tl.fromTo('#wipeA', { xPercent: 0 }, { xPercent: 140, duration: 0.42, ease: 'power3.out', immediateRender: false }, b);
  tl.fromTo('#wipeB', { xPercent: -140 }, { xPercent: 0, duration: 0.36, ease: 'power3.in', immediateRender: false }, b - 0.26);
  tl.fromTo('#wipeB', { xPercent: 0 }, { xPercent: 140, duration: 0.42, ease: 'power3.out', immediateRender: false }, b + 0.12);
}

function glow(i, t, props, dur = 1.6) {
  tl.to(glows[i], { ...props, duration: dur, ease: 'sine.inOut' }, t);
}

/** Pastille de tableau de bord : un élément + une apparition. */
function pop(node, t, o = {}) {
  tl.fromTo(node, { scale: o.from ?? 0, opacity: 0 }, { scale: 1, opacity: 1, duration: o.dur ?? 0.7, ease: o.ease ?? 'back.out(1.8)', immediateRender: false }, t);
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 1. TITRE (0 – 3,5 s)
// ═════════════════════════════════════════════════════════════════════════════════════
function titre() {
  const s = scene('s1');
  show(s, 0, 3.5);
  tl.fromTo('#fade', { opacity: 1 }, { opacity: 0, duration: 0.45, ease: 'power1.out' }, 0);
  tl.set(P, { opacity: 0 }, 0);
  tl.to(P, { opacity: 0.8, duration: 1.4, ease: 'sine.inOut' }, 0.2);
  glow(0, 0, { opacity: 0.32, x: 900, y: 80 }, 2.5);
  glow(1, 0, { opacity: 0.18, x: -200, y: 300 }, 2.5);
  tl.fromTo(cam, { zoom: 1 }, { zoom: 1.05, duration: 3.6, ease: 'sine.inOut' }, 0);

  const logo = el('img', { cls: 'abs', attrs: { src: `${BRAND}/happi-logotype-blanc.png` }, style: { left: '130px', top: '82px', height: '58px' } }, s);
  fadeUp(logo, 0.25, { dur: 0.6 });

  // Disque de la mascotte, entouré d'orbites
  const cx = 1470;
  const cy = 540;
  const orbit = svg('svg', { width: 900, height: 900, style: `position:absolute;left:${cx - 450}px;top:${cy - 450}px;overflow:visible` }, s);
  const o1 = svg('circle', { cx: 450, cy: 450, r: 380, fill: 'none', stroke: 'rgba(255,255,255,0.35)', 'stroke-width': 2, 'stroke-dasharray': '4 14' }, orbit);
  const o2 = svg('circle', { cx: 450, cy: 450, r: 420, fill: 'none', stroke: 'rgba(234,99,46,0.7)', 'stroke-width': 3, 'stroke-dasharray': '90 1100' }, orbit);
  tl.fromTo(orbit, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.9, ease: 'expo.out' }, 0.35);
  tl.fromTo([o1, o2], { rotation: 0, svgOrigin: '450 450' }, { rotation: (i) => (i ? -200 : 120), duration: 3.4, ease: 'none' }, 0.3);

  const disc = el('div', { cls: 'disc', style: { left: `${cx - 290}px`, top: `${cy - 290}px`, width: '580px', height: '580px', background: '#F5F5F2', overflow: 'hidden', boxShadow: `0 0 0 14px ${ORANGE}, 0 40px 120px rgba(0,0,0,0.5)` } }, s);
  const masc = el('img', { attrs: { src: `${BRAND}/happi-mascotte.png` }, style: { position: 'absolute', left: '0', top: '12px', width: '580px', height: '580px' } }, disc);
  tl.fromTo(disc, { scale: 0 }, { scale: 1, duration: 0.85, ease: 'back.out(1.6)' }, 0.35);
  tl.fromTo(masc, { y: 60 }, { y: 0, duration: 0.9, ease: 'expo.out' }, 0.6);
  tl.fromTo(masc, { rotation: -2.5 }, { rotation: 2.5, duration: 1.5, ease: 'sine.inOut', yoyo: true, repeat: 1, immediateRender: false }, 1.4);

  // Titre
  const a = text(s, 'Le', 'h w600', { left: '134px', top: '250px', fontSize: '84px' }, { color: 'rgba(255,255,255,0.8)' });
  const b = text(s, 'Passeport', 'h w800', { left: '126px', top: '326px', fontSize: '164px' });
  const c = text(s, 'Numérique', 'h w800', { left: '126px', top: '496px', fontSize: '164px' }, { color: ORANGE });
  const sa = split(a, 'chars', 'chars');
  const sb = split(b, 'chars', 'chars');
  const sc = split(c, 'chars', 'chars');
  rise(sa.chars, 0.5, { stagger: 0.04 });
  rise(sb.chars, 0.62, { stagger: 0.03 });
  rise(sc.chars, 0.92, { stagger: 0.03 });
  punch(0.62, 0.03, 0.5);
  flash(0.62, 0.22, 0.4);

  const tag = text(s, 'Avec HAPPI Compétence', 'mono', { left: '134px', top: '742px', fontSize: '30px' }, { color: '#FF8A57' });
  fadeUp(tag, 1.7, { dur: 0.6 });
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 2. LA QUESTION (3,5 – 9 s) : « Le numérique vous semble compliqué ? » → « Pas de panique. »
// ═════════════════════════════════════════════════════════════════════════════════════
function question() {
  const s = scene('s2');
  show(s, 3.5, 9);
  el('div', { cls: 'paper-bg' }, s);
  tl.set('#vignette', { opacity: 0.25 }, 3.5);
  tl.set('#vignette', { opacity: 1 }, 9);

  // Grand disque orange à droite : porte le « ? », puis la mascotte
  const disc = el('div', { cls: 'disc', style: { left: '1170px', top: '210px', width: '640px', height: '640px', background: `radial-gradient(circle at 36% 30%, #ff9a70, ${ORANGE} 60%, #d9561f)` } }, s);
  tl.fromTo(disc, { scale: 0 }, { scale: 1, duration: 0.9, ease: 'back.out(1.5)' }, 3.7);
  const q = el('div', { cls: 'abs h w800', text: '?', style: { left: '1170px', width: '640px', top: '270px', textAlign: 'center', fontSize: '520px', lineHeight: '1', color: '#fff' } }, s);
  tl.fromTo(q, { scale: 0.2, rotation: -25, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.7, ease: 'back.out(2)' }, 4.1);
  tl.fromTo(q, { rotation: -6 }, { rotation: 6, duration: 0.55, ease: 'sine.inOut', yoyo: true, repeat: 3, immediateRender: false }, 4.8);
  tl.fromTo(q, { scale: 1, opacity: 1 }, { scale: 0.1, opacity: 0, duration: 0.3, ease: 'power3.in', immediateRender: false }, 6.1);

  const l1 = text(s, 'Le numérique', 'h w700 ink', { left: '130px', top: '262px', fontSize: '124px' });
  const l2 = text(s, 'vous semble', 'h w700 ink', { left: '130px', top: '392px', fontSize: '124px' });
  const l3 = text(s, 'compliqué ?', 'h w700', { left: '130px', top: '522px', fontSize: '124px' }, { color: ORANGE_INK });
  const sp = [l1, l2, l3].map((n) => split(n, 'words', 'words'));
  rise(sp[0].words, 3.85, { stagger: 0.1, dur: 0.7 });
  rise(sp[1].words, 4.05, { stagger: 0.1, dur: 0.7 });
  rise(sp[2].words, 4.3, { stagger: 0.1, dur: 0.7 });
  leave([l1, l2, l3], 6.05, { y: -100, blur: 14, dur: 0.32, stagger: 0.04 });

  // Réponse
  const r1 = text(s, 'Pas de', 'h w800 ink', { left: '124px', top: '290px', fontSize: '178px' });
  const r2 = text(s, 'panique.', 'h w800', { left: '124px', top: '462px', fontSize: '178px' }, { color: ORANGE_INK });
  const s1 = split(r1, 'words', 'words');
  const s2 = split(r2, 'words', 'words');
  rise(s1.words, 6.3, { dur: 0.75 });
  rise(s2.words, 6.45, { dur: 0.75 });
  const bar = el('div', { cls: 'abs', style: { left: '134px', top: '672px', width: '600px', height: '14px', borderRadius: '8px', background: ORANGE, transformOrigin: 'left center' } }, s);
  tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'expo.out' }, 6.9);
  const sub = text(s, 'À votre rythme, sans jugement.', 'body ink', { left: '134px', top: '722px', fontSize: '62px' });
  fadeUp(sub, 6.85, { dur: 0.6 });

  const masc = el('img', { cls: 'abs', attrs: { src: `${BRAND}/happi-mascotte-3d.webp` }, style: { left: '1300px', top: '170px', height: '800px', filter: 'drop-shadow(0 30px 40px rgba(16,44,50,0.35))' } }, s);
  tl.fromTo(masc, { y: 500, opacity: 0, rotation: 8 }, { y: 0, opacity: 1, rotation: 0, duration: 0.9, ease: 'back.out(1.4)' }, 6.3);
  tl.fromTo(masc, { y: 0 }, { y: -14, duration: 1.2, ease: 'sine.inOut', yoyo: true, repeat: 1, immediateRender: false }, 7.3);
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 3. 19 MONDES (9 – 14 s)
// ═════════════════════════════════════════════════════════════════════════════════════
function mondes() {
  const s = scene('s3');
  show(s, 9, 14);
  tl.set(P, { opacity: 0.8 }, 9);
  glow(0, 9, { opacity: 0.3, x: 200, y: 200 }, 2);
  glow(1, 9, { opacity: 0.2, x: 1100, y: 500 }, 2);
  tl.fromTo(cam, { zoom: 1.0 }, { zoom: 1.035, duration: 5, ease: 'sine.inOut' }, 9);

  const num = text(s, '0', 'h w800', { left: '120px', top: '150px', fontSize: '480px', lineHeight: '1' }, { color: ORANGE });
  const mask = (t) => clamp((t - 9.4) / 0.95);
  renderers.push((t) => {
    const k = mask(t);
    num.textContent = String(Math.round(19 * (1 - (1 - k) ** 3)));
  });
  tl.fromTo(num, { opacity: 0, scale: 0.7, transformOrigin: '0% 60%' }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, 9.35);
  tl.fromTo(num, { scale: 1.08 }, { scale: 1, duration: 0.5, ease: 'power3.out', immediateRender: false }, 10.3);
  const l1 = text(s, 'mondes', 'h w700', { left: '134px', top: '628px', fontSize: '104px' });
  const l2 = text(s, 'd’exercices', 'h w700', { left: '134px', top: '736px', fontSize: '104px' });
  const sl = [l1, l2].map((n) => split(n, 'words', 'words'));
  rise(sl[0].words, 9.85, { dur: 0.7 });
  rise(sl[1].words, 10.0, { dur: 0.7 });

  const items = [
    ['1', 'Acheter sur Amazon', '#FF9900'],
    ['2', 'Publier sur Facebook', '#5AA2FF'],
    ['3', 'Trouver son chemin (GPS)', '#3DDC97'],
  ];
  const times = [10.4, 10.9, 11.4];
  items.forEach(([n, label, color], i) => {
    const chip = el('div', { cls: 'chip', html: `<div class="n" style="background:${color};color:#102C32">${n}</div><div class="t">${label}</div>`, style: { left: '1010px', top: `${190 + i * 150}px` } }, s);
    tl.fromTo(chip, { x: 180, opacity: 0, scale: 0.94 }, { x: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out' }, times[i]);
    tl.fromTo(chip, { y: 0 }, { y: -8, duration: 1.3, ease: 'sine.inOut', yoyo: true, repeat: 1, immediateRender: false }, times[i] + 0.7);
  });
  const more = el('div', { cls: 'chip more', html: '<div class="n">+</div><div class="t">Et bien d’autres exercices</div>', style: { left: '1010px', top: `${190 + 3 * 150}px` } }, s);
  tl.fromTo(more, { x: 180, opacity: 0, scale: 0.94 }, { x: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out' }, 12.1);
  shake(9.4, 0.5, 0.4);
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 4–6. LES TROIS MODULES : Amazon, Facebook, GPS — les vrais écrans de l'application, touchés pas à pas
// ═════════════════════════════════════════════════════════════════════════════════════
const PH = { left: 1262, top: 70, sw: 470, sh: 903 }; // écran du téléphone (la coque ajoute 18 px de chaque côté)

function moduleScene(m, manifests) {
  const s = scene(`m-${m.id}`);
  show(s, m.start, m.end);
  tl.set(P, { opacity: 0.7 }, m.start);
  const acc = m.accent;
  const meta = (f) => manifests[f.dir ?? m.dir].frames.find((x) => x.file === f.file);
  const frameAt = (t) => [...m.frames].reverse().find((f) => f.t <= t) ?? m.frames[0];

  // Lueur de la couleur du module
  const aura = el('div', { cls: 'disc', style: { left: '640px', top: '60px', width: '1100px', height: '1100px', background: `radial-gradient(circle, ${acc}40, ${acc}00 62%)`, filter: 'blur(24px)' } }, s);
  tl.fromTo(aura, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 1.2, ease: 'power2.out' }, m.start + 0.1);
  tl.fromTo(cam, { zoom: 1 }, { zoom: 1.03, duration: m.end - m.start, ease: 'sine.inOut' }, m.start);

  // Texte : surtitre, titre, note
  const kick = text(s, m.kicker, 'mono', { left: '130px', top: '104px', fontSize: '27px' }, { color: acc });
  fadeUp(kick, m.start + 0.35, { dur: 0.55 });
  const colored = (html) => html.replace('<em>', `<span style="color:${acc}">`).replace('</em>', '</span>');
  const t1 = text(s, m.title[0], 'h w800', { left: '126px', top: '170px', fontSize: '104px' });
  const t2 = text(s, colored(m.title[1]), 'h w800', { left: '126px', top: '282px', fontSize: '104px' });
  const st = [t1, t2].map((n) => split(n, 'words', 'words'));
  rise(st[0].words, m.start + 0.5, { dur: 0.7 });
  rise(st[1].words, m.start + 0.65, { dur: 0.7 });
  const note = text(s, m.note, 'body', { left: '130px', top: '426px', fontSize: '36px' }, { color: 'rgba(255,255,255,0.68)' });
  fadeUp(note, m.start + 1.0, { dur: 0.6 });

  // Étapes : la liste est visible d'emblée, l'étape en cours s'allume
  m.steps.forEach((step, i) => {
    const row = el('div', { cls: 'abs', style: { left: '130px', top: `${520 + i * 92}px`, display: 'flex', alignItems: 'center', gap: '22px', height: '72px', opacity: '0' } }, s);
    const dot = el('div', { text: String(i + 1), style: { width: '58px', height: '58px', borderRadius: '50%', border: `3px solid ${acc}`, color: acc, font: '700 30px/52px Poppins, sans-serif', textAlign: 'center', flex: 'none' } }, row);
    el('div', { text: step.label, style: { font: '600 44px/1 Poppins, sans-serif', letterSpacing: '-0.02em', whiteSpace: 'nowrap' } }, row);
    const next = m.steps[i + 1]?.t;
    tl.fromTo(row, { opacity: 0, x: -40 }, { opacity: 0.32, x: 0, duration: 0.5, ease: 'power3.out' }, m.start + 0.7 + i * 0.1);
    tl.fromTo(row, { opacity: 0.32 }, { opacity: 1, duration: 0.3, immediateRender: false }, step.t);
    tl.fromTo(row, { scale: 1 }, { scale: 1.05, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out', transformOrigin: '0% 50%', immediateRender: false }, step.t);
    tl.fromTo(dot, { backgroundColor: 'rgba(0,0,0,0)', color: acc }, { backgroundColor: acc, color: '#102C32', duration: 0.3, immediateRender: false }, step.t);
    if (next) tl.fromTo(row, { opacity: 1 }, { opacity: 0.62, duration: 0.4, immediateRender: false }, next);
  });

  // Téléphone et vrais écrans
  const phone = el('div', { cls: 'pn-phone', style: { left: `${PH.left}px`, top: `${PH.top}px`, width: `${PH.sw + 36}px`, height: `${PH.sh + 36}px` } }, s);
  const scr = el('div', { cls: 'pn-screen' }, phone);
  tl.fromTo(phone, { x: 900, rotation: 8, opacity: 0 }, { x: 0, rotation: 0, opacity: 1, duration: 0.95, ease: 'expo.out' }, m.start + 0.15);
  tl.fromTo(phone, { y: 0 }, { y: -10, duration: 1.8, ease: 'sine.inOut', yoyo: true, repeat: Math.max(1, Math.round((m.end - m.start) / 1.8) - 1), immediateRender: false }, m.start + 1.2);
  const imgs = m.frames.map((f) =>
    el('img', { attrs: { src: `./out/captures-pn/${f.dir ?? m.dir}/${f.file}` }, style: { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', opacity: '0' } }, scr),
  );
  renderers.push((t) => {
    if (t < m.start - 0.01 || t > m.end + 0.01) return;
    const k = m.frames.findLastIndex((f) => f.t <= t);
    imgs.forEach((im, i) => { im.style.opacity = i === Math.max(0, k) ? '1' : '0'; });
  });

  // Touchers : un doigt arrive, appuie, une onde part de l'élément touché
  const finger = el('div', { cls: 'finger', style: { left: '0', top: '0', opacity: '0' } }, scr);
  const taps = [];
  m.frames.forEach((f, i) => {
    const mt = meta(f);
    const t = f.tapAt ?? m.frames[i + 1]?.t;
    if (mt?.tap && !f.noTap && t != null) taps.push({ t, box: mt.tap });
  });
  taps.forEach((tp, k) => {
    const cx = (tp.box.x + tp.box.w / 2) * PH.sw;
    const cy = (tp.box.y + tp.box.h / 2) * PH.sh;
    const tx = cx - 38;
    const ty = cy - 38;
    tl.fromTo(finger, { x: Math.min(tx + 90, PH.sw - 76), y: Math.min(ty + 170, PH.sh - 76), opacity: 0, scale: 1 }, { x: tx, y: ty, opacity: 1, duration: 0.42, ease: 'power3.out', immediateRender: k === 0 }, tp.t - 0.52);
    tl.fromTo(finger, { scale: 1 }, { scale: 0.72, duration: 0.1, ease: 'power2.in', immediateRender: false }, tp.t - 0.1);
    tl.fromTo(finger, { scale: 0.72 }, { scale: 1, duration: 0.18, ease: 'back.out(3)', immediateRender: false }, tp.t);
    tl.fromTo(finger, { opacity: 1 }, { opacity: 0, duration: 0.25, ease: 'power1.in', immediateRender: false }, tp.t + 0.2);
    const ripple = el('div', { style: { position: 'absolute', left: `${cx - 60}px`, top: `${cy - 60}px`, width: '120px', height: '120px', borderRadius: '50%', border: `5px solid ${ORANGE}`, opacity: '0', pointerEvents: 'none' } }, scr);
    tl.fromTo(ripple, { scale: 0.3, opacity: 0.9 }, { scale: 1.5, opacity: 0, duration: 0.55, ease: 'power2.out', immediateRender: false }, tp.t);
  });

  // Mises en évidence : ce qu'il faut regarder
  for (const c of m.callouts) {
    const f = frameAt(c.t0);
    const mt = meta(f);
    const b = c.box ? { x: c.box[0], y: c.box[1], w: c.box[2], h: c.box[3] } : c.mark ? mt.marks[c.mark] : mt.tap;
    if (!b) throw new Error(`mise en évidence introuvable : ${m.id} ${c.label}`);
    const L = b.x * PH.sw - 8;
    const T = b.y * PH.sh - 6;
    const Wd = b.w * PH.sw + 16;
    const Ht = b.h * PH.sh + 12;
    const rect = el('div', { style: { position: 'absolute', left: `${L}px`, top: `${T}px`, width: `${Wd}px`, height: `${Ht}px`, borderRadius: '14px', border: `5px solid ${acc}`, boxShadow: `0 0 0 3px rgba(16,44,50,0.35), 0 0 34px ${acc}`, opacity: '0', pointerEvents: 'none' } }, scr);
    const pill = el('div', { text: c.label, style: { position: 'absolute', left: '0', top: '0', padding: '10px 20px', borderRadius: '999px', background: acc, color: '#102C32', font: '700 30px/1 Poppins, sans-serif', whiteSpace: 'nowrap', opacity: '0' } }, scr);
    const pw = pill.offsetWidth;
    pill.style.left = `${Math.min(Math.max(8, L), PH.sw - pw - 8)}px`;
    pill.style.top = `${c.below || T <= 80 ? T + Ht + 12 : T - 58}px`;
    tl.fromTo(rect, { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }, c.t0);
    tl.fromTo(pill, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }, c.t0 + 0.06);
    tl.fromTo([rect, pill], { opacity: 1 }, { opacity: 0, duration: 0.2, immediateRender: false }, c.t1 - 0.2);
  }

  // Confirmations
  for (const ts of m.toasts) {
    const toast = el('div', { style: { position: 'absolute', left: '26px', right: '26px', bottom: '44px', height: '104px', borderRadius: '30px', background: '#102C32', color: '#fff', display: 'flex', alignItems: 'center', gap: '18px', padding: '0 26px', font: '700 36px/1.1 Poppins, sans-serif', boxShadow: '0 20px 40px rgba(0,0,0,0.35)', opacity: '0' } }, scr);
    el('div', { html: '<svg viewBox="0 0 56 56" width="56" height="56"><circle cx="28" cy="28" r="28" fill="#3DDC97"/><path d="M15 29 L25 39 L42 18" fill="none" stroke="#102C32" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>', style: { flex: 'none' } }, toast);
    el('div', { text: ts.text }, toast);
    tl.fromTo(toast, { y: 100, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, ts.t0);
    tl.fromTo(toast, { opacity: 1 }, { opacity: 0, duration: 0.25, immediateRender: false }, ts.t1 - 0.25);
    flash(ts.t0, 0.1, 0.4);
  }
  return { taps: taps.map((x) => x.t), toasts: m.toasts.map((x) => x.t0) };
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 7. ET EN PLUS (43 – 48 s) : guide vocal, défis chrono, mémos, certificat
// ═════════════════════════════════════════════════════════════════════════════════════
function traces() {
  const T0 = 43;
  const s = scene('s5');
  show(s, T0, 48);
  el('div', { cls: 'orange-bg' }, s);
  tl.set('#vignette', { opacity: 0.3 }, T0);
  tl.set('#vignette', { opacity: 1 }, 48);

  const h = text(s, 'Pour aller plus loin', 'h w700', { left: '0', right: '0', top: '96px', textAlign: 'center', fontSize: '100px' });
  const sh = split(h, 'words', 'words');
  rise(sh.words, T0 + 0.3, { stagger: 0.1, dur: 0.75 });

  const lefts = [90, 540, 990, 1440];
  const top = 270;
  const defs = [
    { ttl: 'Guide vocal', sub: 'en 6 langues', rot: -5 },
    { ttl: 'Défis chrono', sub: 'pour s’amuser', rot: -2 },
    { ttl: 'Notes mémo', sub: 'à imprimer', rot: 2 },
    { ttl: 'Certificat', sub: 'de réussite', rot: 5 },
  ];
  const cards = defs.map((d, i) => {
    const c = el('div', { cls: 'card s', html: `<div class="ttl">${d.ttl}</div><div class="sub">${d.sub}</div>`, style: { left: `${lefts[i]}px`, top: `${top}px` } }, s);
    tl.fromTo(c, { y: 260, opacity: 0, rotation: d.rot }, { y: 0, opacity: 1, rotation: 0, duration: 0.8, ease: 'back.out(1.4)' }, T0 + 0.5 + i * 0.5);
    return c;
  });

  // Haut-parleur
  const sp = svg('svg', { class: 'ico', viewBox: '0 0 260 260' }, cards[0]);
  svg('path', { d: 'M40 105 H78 L130 62 V198 L78 155 H40 Z', fill: PETROLE }, sp);
  const waves = [0, 1, 2].map((k) => svg('path', { d: `M${158 + k * 26} ${130 - 30 - k * 14} Q${186 + k * 26} 130 ${158 + k * 26} ${130 + 30 + k * 14}`, fill: 'none', stroke: ORANGE, 'stroke-width': 14, 'stroke-linecap': 'round' }, sp));
  tl.fromTo(waves, { opacity: 0.15 }, { opacity: 1, duration: 0.35, stagger: 0.2, yoyo: true, repeat: 3, ease: 'power1.inOut', immediateRender: true }, T0 + 1.0);

  // Chronomètre
  const sw = svg('svg', { class: 'ico', viewBox: '0 0 260 260' }, cards[1]);
  svg('rect', { x: 108, y: 14, width: 44, height: 28, rx: 8, fill: PETROLE }, sw);
  svg('rect', { x: 196, y: 52, width: 24, height: 20, rx: 6, fill: PETROLE, transform: 'rotate(40 208 62)' }, sw);
  svg('circle', { cx: 130, cy: 150, r: 92, fill: '#FFF', stroke: PETROLE, 'stroke-width': 14 }, sw);
  const arc = svg('circle', { cx: 130, cy: 150, r: 70, fill: 'none', stroke: ORANGE, 'stroke-width': 14, 'stroke-linecap': 'round', 'stroke-dasharray': '440', 'stroke-dashoffset': '440', transform: 'rotate(-90 130 150)' }, sw);
  const hand = svg('line', { x1: 130, y1: 150, x2: 130, y2: 98, stroke: PETROLE, 'stroke-width': 12, 'stroke-linecap': 'round' }, sw);
  svg('circle', { cx: 130, cy: 150, r: 12, fill: PETROLE }, sw);
  tl.fromTo(arc, { attr: { 'stroke-dashoffset': 440 } }, { attr: { 'stroke-dashoffset': 70 }, duration: 1.8, ease: 'power2.inOut', immediateRender: false }, T0 + 1.5);
  tl.fromTo(hand, { rotation: 0, svgOrigin: '130 150' }, { rotation: 320, duration: 1.8, ease: 'power2.inOut', immediateRender: false }, T0 + 1.5);

  // Mémo
  const doc = svg('svg', { class: 'ico', viewBox: '0 0 260 260' }, cards[2]);
  svg('rect', { x: 52, y: 20, width: 156, height: 210, rx: 18, fill: '#FFF', stroke: PETROLE, 'stroke-width': 14 }, doc);
  const lines = [88, 128, 168].map((y, i) => svg('rect', { x: 84, y, width: i === 2 ? 70 : 92, height: 14, rx: 7, fill: ORANGE }, doc));
  tl.fromTo(lines, { scaleX: 0, svgOrigin: '84 0' }, { scaleX: 1, duration: 0.5, ease: 'power3.out', stagger: 0.18 }, T0 + 2.1);
  svg('rect', { x: 84, y: 52, width: 50, height: 14, rx: 7, fill: PETROLE }, doc);

  // Sceau du certificat
  const seal = svg('svg', { class: 'ico', viewBox: '0 0 260 260' }, cards[3]);
  const pts = Array.from({ length: 48 }, (_, k) => {
    const r = k % 2 ? 112 : 126;
    const ang = (k / 48) * Math.PI * 2;
    return `${(130 + r * Math.cos(ang)).toFixed(1)},${(130 + r * Math.sin(ang)).toFixed(1)}`;
  }).join(' ');
  const star = svg('g', {}, seal);
  svg('polygon', { points: pts, fill: ORANGE }, star);
  svg('circle', { cx: 130, cy: 130, r: 96, fill: 'none', stroke: '#fff', 'stroke-width': 4, 'stroke-dasharray': '3 9' }, seal);
  const medal = el('div', { cls: 'disc', style: { left: '100px', top: '80px', width: '200px', height: '200px', background: '#F5F5F2', overflow: 'hidden', boxShadow: '0 0 0 6px #fff' } }, cards[3]);
  el('img', { attrs: { src: `${BRAND}/happi-mascotte.png` }, style: { position: 'absolute', left: '0', top: '8px', width: '200px', height: '200px' } }, medal);
  tl.fromTo(star, { rotation: -40, scale: 0.4, svgOrigin: '130 130' }, { rotation: 0, scale: 1, svgOrigin: '130 130', duration: 0.9, ease: 'back.out(1.6)' }, T0 + 2.0);
  tl.fromTo(medal, { scale: 0.4, rotation: -40 }, { scale: 1, rotation: 0, duration: 0.9, ease: 'back.out(1.6)' }, T0 + 2.0);
  tl.fromTo(star, { rotation: 0, svgOrigin: '130 130' }, { rotation: 360, svgOrigin: '130 130', duration: 6, ease: 'none', immediateRender: false }, T0 + 2.95);

  const cx = lefts[3] + 200;
  const cy = top + 240;
  for (let i = 0; i < 12; i += 1) {
    const spark = el('div', { cls: 'disc', style: { left: `${cx - 9}px`, top: `${cy - 9}px`, width: '18px', height: '18px', background: '#fff', opacity: '0' } }, s);
    const ang = (i / 12) * Math.PI * 2;
    tl.fromTo(spark, { x: 0, y: 0, scale: 0.4, opacity: 1 }, { x: Math.cos(ang) * 300, y: Math.sin(ang) * 280, scale: 1.2, opacity: 0, duration: 0.9, ease: 'power2.out', immediateRender: false }, T0 + 3.0);
  }
  tl.fromTo(cards[3], { scale: 1 }, { scale: 1.06, duration: 0.3, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, T0 + 2.95);
  flash(T0 + 3.0, 0.18, 0.4);
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 8. INVITATION (48 – 52 s)
// ═════════════════════════════════════════════════════════════════════════════════════
function final() {
  const T0 = 48;
  const s = scene('s6');
  show(s, T0, 52);
  tl.set(P, { opacity: 0.8 }, T0);
  glow(0, T0, { opacity: 0.35, x: 1000, y: 200 }, 2);
  glow(1, T0, { opacity: 0.2, x: 100, y: 500 }, 2);
  tl.fromTo(cam, { zoom: 1.0 }, { zoom: 1.04, duration: 4, ease: 'sine.inOut' }, T0);

  const halo = el('div', { cls: 'disc', style: { left: '1250px', top: '230px', width: '640px', height: '640px', background: `radial-gradient(circle at 36% 30%, #ff9a70, ${ORANGE} 60%, #d9561f)` } }, s);
  tl.fromTo(halo, { scale: 0 }, { scale: 1, duration: 0.9, ease: 'back.out(1.5)' }, T0 + 0.2);
  const masc = el('img', { cls: 'abs', attrs: { src: `${BRAND}/happi-mascotte-3d.webp` }, style: { left: '1330px', top: '170px', height: '800px', filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.45))' } }, s);
  tl.fromTo(masc, { y: 500, opacity: 0, rotation: -8 }, { y: 0, opacity: 1, rotation: 0, duration: 0.9, ease: 'back.out(1.4)' }, T0 + 0.45);
  tl.fromTo(masc, { y: 0 }, { y: -14, duration: 1.3, ease: 'sine.inOut', yoyo: true, repeat: 1, immediateRender: false }, T0 + 1.4);

  const l1 = text(s, 'Prêt à', 'h w800', { left: '124px', top: '240px', fontSize: '150px' });
  const l2 = text(s, 'commencer ?', 'h w800', { left: '124px', top: '382px', fontSize: '150px' }, { color: ORANGE });
  const sp = [l1, l2].map((n) => split(n, 'words', 'words'));
  rise(sp[0].words, T0 + 0.4, { dur: 0.75 });
  rise(sp[1].words, T0 + 0.55, { dur: 0.75 });
  const sub = text(s, 'Inscrivez-vous sur HAPPI Compétence', 'body', { left: '130px', top: '600px', fontSize: '56px' }, { color: 'rgba(255,255,255,0.88)' });
  fadeUp(sub, T0 + 1.3, { dur: 0.6 });
  const logo = el('img', { cls: 'abs', attrs: { src: `${BRAND}/happi-logotype-blanc.png` }, style: { left: '130px', top: '770px', height: '84px' } }, s);
  fadeUp(logo, T0 + 1.75, { dur: 0.6 });
  tl.fromTo('#fade', { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.in', immediateRender: false }, 51.4);
  punch(T0 + 0.45, 0.03, 0.5);
}

export function buildAll(data) {
  titre();
  question();
  mondes();
  const { modules, manifests } = data;
  for (const m of modules) moduleScene(m, manifests);
  traces();
  final();
  for (const b of [3.5, 9, 14, 24, 33.5, 43, 48]) wipe(b);
  return tl;
}

export { $ };
