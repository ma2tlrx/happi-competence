/* global gsap */
// Vidéo « Passeport Numérique » (30 s) : six séquences, toutes positionnées image par image.
// Rythme de lecture : chaque texte reste à l'écran au moins 0,45 s par mot + 0,8 s (voir docs dans video/README.md).
import { $, CX, CY, P, clamp, cam, el, fadeUp, flash, glows, leave, punch, renderers, rise, scene, shake, show, slam, split, svg, text, tl } from './engine.js';

export const DURATION = 30;
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
    ['1', 'Les premiers gestes'],
    ['2', 'Reconnaître les arnaques'],
    ['3', 'Les mails'],
    ['4', 'Démarches et rendez-vous'],
  ];
  const times = [10.4, 10.8, 11.2, 11.6];
  items.forEach(([n, label], i) => {
    const chip = el('div', { cls: 'chip', html: `<div class="n">${n}</div><div class="t">${label}</div>`, style: { left: '1010px', top: `${150 + i * 148}px` } }, s);
    tl.fromTo(chip, { x: 180, opacity: 0, scale: 0.94 }, { x: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out' }, times[i]);
    tl.fromTo(chip, { y: 0 }, { y: -8, duration: 1.3, ease: 'sine.inOut', yoyo: true, repeat: 1, immediateRender: false }, times[i] + 0.7);
  });
  const more = el('div', { cls: 'chip more', html: '<div class="n">+</div><div class="t">15 autres mondes</div>', style: { left: '1010px', top: `${150 + 4 * 148}px` } }, s);
  tl.fromTo(more, { x: 180, opacity: 0, scale: 0.94 }, { x: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out' }, 12.2);
  shake(9.4, 0.5, 0.4);
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 4. S'ENTRAÎNER SANS RISQUE, AVEC UN GUIDE (14 – 21 s)
// ═════════════════════════════════════════════════════════════════════════════════════
function demo() {
  const s = scene('s4');
  show(s, 14, 21);
  el('div', { cls: 'paper-bg' }, s);
  tl.set('#vignette', { opacity: 0.25 }, 14);
  tl.set('#vignette', { opacity: 1 }, 21);

  const disc = el('div', { cls: 'disc', style: { left: '1190px', top: '170px', width: '740px', height: '740px', background: `radial-gradient(circle at 36% 30%, #ff9a70, ${ORANGE} 60%, #d9561f)` } }, s);
  tl.fromTo(disc, { scale: 0 }, { scale: 1, duration: 0.9, ease: 'back.out(1.4)' }, 14.15);

  // Texte A : s'entraîner
  const a1 = text(s, 'On s’entraîne', 'h w800 ink', { left: '126px', top: '262px', fontSize: '100px' });
  const a2 = text(s, 'sans risque', 'h w800', { left: '126px', top: '388px', fontSize: '100px' }, { color: ORANGE_INK });
  const sa1 = split(a1, 'words', 'words');
  const sa2 = split(a2, 'words', 'words');
  rise(sa1.words, 14.4, { stagger: 0.1, dur: 0.7 });
  rise(sa2.words, 14.6, { stagger: 0.1, dur: 0.7 });
  const as = text(s, 'Rien ne se perd.', 'body ink', { left: '130px', top: '556px', fontSize: '64px' });
  fadeUp(as, 15.2, { dur: 0.6 });
  leave([a1, a2, as], 17.35, { y: -90, blur: 14, dur: 0.32, stagger: 0.05 });

  // Texte B : le guide
  const b1 = text(s, 'Un guide', 'h w800 ink', { left: '126px', top: '262px', fontSize: '100px' });
  const b2 = text(s, 'vous accompagne', 'h w800', { left: '126px', top: '388px', fontSize: '100px' }, { color: ORANGE_INK });
  const sb1 = split(b1, 'words', 'words');
  const sb2 = split(b2, 'words', 'words');
  rise(sb1.words, 17.7, { stagger: 0.1, dur: 0.7 });
  rise(sb2.words, 17.9, { stagger: 0.1, dur: 0.7 });
  const bs = text(s, 'Lu à voix haute, en 6 langues.', 'body ink', { left: '130px', top: '556px', fontSize: '58px' });
  fadeUp(bs, 18.4, { dur: 0.6 });

  // Téléphone
  const phone = el('div', { cls: 'pn-phone', style: { left: '1300px', top: '100px' } }, s);
  const scr = el('div', { cls: 'pn-screen' }, phone);
  const bar = el('div', { cls: 'pn-bar' }, scr);
  const barA = el('span', { text: 'Toucher les ronds', style: { position: 'absolute', left: '0', right: '0', top: '24px' } }, bar);
  const barB = el('span', { text: 'Votre guide', style: { position: 'absolute', left: '0', right: '0', top: '24px', opacity: '0' } }, bar);
  tl.fromTo(phone, { y: 1000, rotation: 9 }, { y: 0, rotation: 0, duration: 0.95, ease: 'expo.out' }, 14.25);
  tl.fromTo(phone, { y: 0 }, { y: -12, duration: 1.6, ease: 'sine.inOut', yoyo: true, repeat: 3, immediateRender: false }, 15.3);

  const game = el('div', { style: { position: 'absolute', inset: '0' } }, scr);
  const spots = [[50, 190], [240, 340], [110, 500]];
  const dots = spots.map(([x, y], i) => {
    const d = el('div', { cls: 'tapdot', style: { left: `${x}px`, top: `${y}px` }, html: '<svg viewBox="0 0 112 112" width="112" height="112" style="position:absolute;inset:0;opacity:0"><path d="M30 58 L48 76 L82 38" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>' }, game);
    tl.fromTo(d, { scale: 0 }, { scale: 1, duration: 0.5, ease: 'back.out(2)' }, 14.7 + i * 0.1);
    return d;
  });
  const finger = el('div', { cls: 'finger', style: { left: '0', top: '0' } }, game);
  const spot = (i) => ({ x: spots[i][0] + 56 - 38, y: spots[i][1] + 56 - 38 });
  tl.fromTo(finger, { x: 320, y: 820, opacity: 0 }, { x: spot(0).x, y: spot(0).y, opacity: 1, duration: 0.4, ease: 'power3.out' }, 14.8);
  [1, 2].forEach((i) => {
    tl.fromTo(finger, { x: spot(i - 1).x, y: spot(i - 1).y }, { x: spot(i).x, y: spot(i).y, duration: 0.3, ease: 'power3.inOut', immediateRender: false }, 15.35 + (i - 1) * 0.5);
  });
  tl.fromTo(finger, { opacity: 1 }, { opacity: 0, duration: 0.25, immediateRender: false }, 16.4);
  [15.2, 15.7, 16.2].forEach((t, i) => {
    tl.fromTo(finger, { scale: 1 }, { scale: 0.7, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, t - 0.05);
    tl.fromTo(dots[i], { scale: 1 }, { scale: 1.25, duration: 0.14, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, t);
    tl.fromTo(dots[i], { backgroundColor: ORANGE }, { backgroundColor: PETROLE, duration: 0.12, immediateRender: false }, t);
    tl.fromTo(dots[i].firstChild, { opacity: 0 }, { opacity: 1, duration: 0.15, immediateRender: false }, t);
  });
  const bravo = el('div', { cls: 'bravo', text: 'Bravo !' }, game);
  tl.fromTo(bravo, { scale: 0.4, opacity: 0, y: 40 }, { scale: 1, opacity: 1, y: 0, duration: 0.55, ease: 'back.out(2.2)' }, 16.5);
  flash(16.5, 0.12, 0.35);
  tl.fromTo(game, { opacity: 1 }, { opacity: 0, duration: 0.3, ease: 'power2.in', immediateRender: false }, 17.35);
  tl.fromTo(barA, { opacity: 1 }, { opacity: 0, duration: 0.2, immediateRender: false }, 17.35);
  tl.fromTo(barB, { opacity: 0 }, { opacity: 1, duration: 0.3, immediateRender: false }, 17.6);

  // Le guide parle
  const guide = el('div', { style: { position: 'absolute', inset: '0', opacity: '0' } }, scr);
  const avatar = el('div', { cls: 'disc', style: { left: '117px', top: '170px', width: '170px', height: '170px', background: '#F5F5F2', overflow: 'hidden', boxShadow: `0 0 0 8px ${ORANGE}` } }, guide);
  el('img', { attrs: { src: `${BRAND}/happi-mascotte.png` }, style: { position: 'absolute', left: '0', top: '6px', width: '170px', height: '170px' } }, avatar);
  const bubble = el('div', { cls: 'bubble', text: 'Touchez le rond orange.' }, guide);
  const waves = el('div', { style: { position: 'absolute', left: '82px', width: '240px', top: '600px', height: '110px' } }, guide);
  const bars = Array.from({ length: 9 }, (_, i) => el('div', { cls: 'wavebar', style: { left: `${i * 27}px`, height: '14px' } }, waves));
  tl.fromTo(guide, { opacity: 0 }, { opacity: 1, duration: 0.3, immediateRender: false }, 17.6);
  tl.fromTo(avatar, { scale: 0 }, { scale: 1, duration: 0.6, ease: 'back.out(2)' }, 17.75);
  tl.fromTo(bubble, { scale: 0.6, opacity: 0, y: 30 }, { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: 'back.out(2)' }, 18.15);
  renderers.push((t) => {
    const on = clamp((t - 18.4) / 0.2) * (1 - clamp((t - 20.8) / 0.3));
    bars.forEach((b, i) => {
      const h = 14 + on * (14 + 76 * Math.abs(Math.sin(t * 8.5 + i * 0.85) * Math.cos(t * 3.1 + i)));
      b.style.height = `${h.toFixed(1)}px`;
    });
  });
  punch(17.6, 0.02, 0.4);
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 5. DES TRACES (21 – 26 s) : défis chrono, mémos, certificat
// ═════════════════════════════════════════════════════════════════════════════════════
function traces() {
  const s = scene('s5');
  show(s, 21, 26);
  el('div', { cls: 'orange-bg' }, s);
  tl.set('#vignette', { opacity: 0.3 }, 21);
  tl.set('#vignette', { opacity: 1 }, 26);

  const h = text(s, 'Pour garder des traces', 'h w700', { left: '0', right: '0', top: '96px', textAlign: 'center', fontSize: '100px' });
  const sh = split(h, 'words', 'words');
  rise(sh.words, 21.3, { stagger: 0.1, dur: 0.75 });

  const lefts = [80, 690, 1300];
  const top = 270;
  const defs = [
    { ttl: 'Défis chrono', sub: 'pour s’amuser', rot: -5 },
    { ttl: 'Notes mémo', sub: 'à imprimer', rot: 0 },
    { ttl: 'Certificat', sub: 'de réussite', rot: 5 },
  ];
  const cards = defs.map((d, i) => {
    const c = el('div', { cls: 'card', html: `<div class="ttl">${d.ttl}</div><div class="sub">${d.sub}</div>`, style: { left: `${lefts[i]}px`, top: `${top}px` } }, s);
    tl.fromTo(c, { y: 260, opacity: 0, rotation: d.rot }, { y: 0, opacity: 1, rotation: 0, duration: 0.85, ease: 'back.out(1.4)' }, 21.9 + i * 0.6);
    return c;
  });

  // Chronomètre
  const sw = svg('svg', { class: 'ico', viewBox: '0 0 260 260' }, cards[0]);
  svg('rect', { x: 108, y: 14, width: 44, height: 28, rx: 8, fill: PETROLE }, sw);
  svg('rect', { x: 196, y: 52, width: 24, height: 20, rx: 6, fill: PETROLE, transform: 'rotate(40 208 62)' }, sw);
  svg('circle', { cx: 130, cy: 150, r: 92, fill: '#FFF', stroke: PETROLE, 'stroke-width': 14 }, sw);
  const arc = svg('circle', { cx: 130, cy: 150, r: 70, fill: 'none', stroke: ORANGE, 'stroke-width': 14, 'stroke-linecap': 'round', 'stroke-dasharray': '440', 'stroke-dashoffset': '440', transform: 'rotate(-90 130 150)' }, sw);
  const hand = svg('line', { x1: 130, y1: 150, x2: 130, y2: 98, stroke: PETROLE, 'stroke-width': 12, 'stroke-linecap': 'round' }, sw);
  svg('circle', { cx: 130, cy: 150, r: 12, fill: PETROLE }, sw);
  tl.fromTo(arc, { attr: { 'stroke-dashoffset': 440 } }, { attr: { 'stroke-dashoffset': 70 }, duration: 1.8, ease: 'power2.inOut', immediateRender: false }, 22.5);
  tl.fromTo(hand, { rotation: 0, svgOrigin: '130 150' }, { rotation: 320, duration: 1.8, ease: 'power2.inOut', immediateRender: false }, 22.5);

  // Mémo
  const doc = svg('svg', { class: 'ico', viewBox: '0 0 260 260' }, cards[1]);
  svg('rect', { x: 52, y: 20, width: 156, height: 210, rx: 18, fill: '#FFF', stroke: PETROLE, 'stroke-width': 14 }, doc);
  const lines = [88, 128, 168].map((y, i) => svg('rect', { x: 84, y, width: i === 2 ? 70 : 92, height: 14, rx: 7, fill: ORANGE }, doc));
  tl.fromTo(lines, { scaleX: 0, svgOrigin: '84 0' }, { scaleX: 1, duration: 0.5, ease: 'power3.out', stagger: 0.18 }, 23.1);
  svg('rect', { x: 84, y: 52, width: 50, height: 14, rx: 7, fill: PETROLE }, doc);

  // Sceau du certificat (étoile dentelée) + mascotte
  const seal = svg('svg', { class: 'ico', viewBox: '0 0 260 260' }, cards[2]);
  const pts = Array.from({ length: 48 }, (_, k) => {
    const r = k % 2 ? 112 : 126;
    const ang = (k / 48) * Math.PI * 2;
    return `${(130 + r * Math.cos(ang)).toFixed(1)},${(130 + r * Math.sin(ang)).toFixed(1)}`;
  }).join(' ');
  const star = svg('g', {}, seal);
  svg('polygon', { points: pts, fill: ORANGE }, star);
  svg('circle', { cx: 130, cy: 130, r: 96, fill: 'none', stroke: '#fff', 'stroke-width': 4, 'stroke-dasharray': '3 9' }, seal);
  const medal = el('div', { cls: 'disc', style: { left: '170px', top: '100px', width: '200px', height: '200px', background: '#F5F5F2', overflow: 'hidden', boxShadow: '0 0 0 6px #fff' } }, cards[2]);
  el('img', { attrs: { src: `${BRAND}/happi-mascotte.png` }, style: { position: 'absolute', left: '0', top: '8px', width: '200px', height: '200px' } }, medal);
  tl.fromTo(star, { rotation: -40, scale: 0.4, svgOrigin: '130 130' }, { rotation: 0, scale: 1, svgOrigin: '130 130', duration: 0.9, ease: 'back.out(1.6)' }, 23.15);
  tl.fromTo(medal, { scale: 0.4, rotation: -40 }, { scale: 1, rotation: 0, duration: 0.9, ease: 'back.out(1.6)' }, 23.15);
  tl.fromTo(star, { rotation: 0, svgOrigin: '130 130' }, { rotation: 360, svgOrigin: '130 130', duration: 6, ease: 'none', immediateRender: false }, 24.05);

  // Éclats autour du certificat
  const cx = lefts[2] + 270;
  const cy = top + 220;
  const sparks = Array.from({ length: 12 }, (_, i) => {
    const sp = el('div', { cls: 'disc', style: { left: `${cx - 9}px`, top: `${cy - 9}px`, width: '18px', height: '18px', background: '#fff', opacity: '0' } }, s);
    const ang = (i / 12) * Math.PI * 2;
    tl.fromTo(sp, { x: 0, y: 0, scale: 0.4, opacity: 1 }, { x: Math.cos(ang) * 330, y: Math.sin(ang) * 300, scale: 1.2, opacity: 0, duration: 0.9, ease: 'power2.out', immediateRender: false }, 24.2);
    return sp;
  });
  void sparks;
  tl.fromTo(cards[2], { scale: 1 }, { scale: 1.06, duration: 0.3, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, 24.15);
  flash(24.2, 0.18, 0.4);
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 6. INVITATION (26 – 30 s)
// ═════════════════════════════════════════════════════════════════════════════════════
function final() {
  const s = scene('s6');
  show(s, 26, 30);
  tl.set(P, { opacity: 0.8 }, 26);
  glow(0, 26, { opacity: 0.35, x: 1000, y: 200 }, 2);
  glow(1, 26, { opacity: 0.2, x: 100, y: 500 }, 2);
  tl.fromTo(cam, { zoom: 1.0 }, { zoom: 1.04, duration: 4, ease: 'sine.inOut' }, 26);

  const halo = el('div', { cls: 'disc', style: { left: '1250px', top: '230px', width: '640px', height: '640px', background: `radial-gradient(circle at 36% 30%, #ff9a70, ${ORANGE} 60%, #d9561f)` } }, s);
  tl.fromTo(halo, { scale: 0 }, { scale: 1, duration: 0.9, ease: 'back.out(1.5)' }, 26.2);
  const masc = el('img', { cls: 'abs', attrs: { src: `${BRAND}/happi-mascotte-3d.webp` }, style: { left: '1330px', top: '170px', height: '800px', filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.45))' } }, s);
  tl.fromTo(masc, { y: 500, opacity: 0, rotation: -8 }, { y: 0, opacity: 1, rotation: 0, duration: 0.9, ease: 'back.out(1.4)' }, 26.45);
  tl.fromTo(masc, { y: 0 }, { y: -14, duration: 1.3, ease: 'sine.inOut', yoyo: true, repeat: 1, immediateRender: false }, 27.4);

  const l1 = text(s, 'Prêt à', 'h w800', { left: '124px', top: '240px', fontSize: '150px' });
  const l2 = text(s, 'commencer ?', 'h w800', { left: '124px', top: '382px', fontSize: '150px' }, { color: ORANGE });
  const sp = [l1, l2].map((n) => split(n, 'words', 'words'));
  rise(sp[0].words, 26.4, { dur: 0.75 });
  rise(sp[1].words, 26.55, { dur: 0.75 });
  const sub = text(s, 'Inscrivez-vous sur HAPPI Compétence', 'body', { left: '130px', top: '600px', fontSize: '56px' }, { color: 'rgba(255,255,255,0.88)' });
  fadeUp(sub, 27.3, { dur: 0.6 });
  const logo = el('img', { cls: 'abs', attrs: { src: `${BRAND}/happi-logotype-blanc.png` }, style: { left: '130px', top: '770px', height: '84px' } }, s);
  fadeUp(logo, 27.75, { dur: 0.6 });
  tl.fromTo('#fade', { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.in', immediateRender: false }, 29.4);
  punch(26.45, 0.03, 0.5);
}

export function buildAll() {
  titre();
  question();
  mondes();
  demo();
  traces();
  final();
  for (const b of [3.5, 9, 14, 21, 26]) wipe(b);
  return tl;
}

export { $ };
