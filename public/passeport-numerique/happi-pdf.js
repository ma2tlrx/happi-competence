/**
 * Gabarit PDF HAPPI du Passeport Numérique : UN seul module pour tous les PDF de l'application
 * (rapport d'activité, émargement, attestation, cartes de code, mémos, défis chrono, certificat) et pour le
 * sceau « Passeport Numérique · Validé » (SVG, affiché à l'écran et rasterisé pour les PDF et l'image du certificat).
 *
 * Charte : encre pétrole #102C32, orange #EA632E (texte lisible : #B8431A sur fond clair), blanc, papier #F5F5F2,
 * trait #E5E5E0 ; titres Poppins, texte DM Sans (polices .woff de /fonts/report/, lues par @pdf-lib/fontkit),
 * logo HAPPI officiel et mascotte officielle (/brand/). Même esprit éditorial que le bilan (src/lib/pdf/report/).
 *
 * Les contenus (textes pédagogiques, chiffres) restent ceux de l'application : ce module ne fait que la mise en page.
 * Utilisable dans le navigateur (window.HappiPdf) et dans Node (tests) : `create(PDFLib, opts, env, { fontkit, fetchBytes })`.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HappiPdf = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const COL = {
    petrol: '#102C32', petrol800: '#173A41', petrol600: '#2F6873', petrol400: '#76A3AC', petrol200: '#CADCE0', petrol100: '#E3EDEF',
    orange: '#EA632E', orange700: '#B8431A', orange100: '#FCE5DA', muted: '#4B6166', subtle: '#5C7277', line: '#E5E5E0', paper: '#F5F5F2', white: '#FFFFFF',
  };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  /** Palette lue par le code d'origine de l'application (couleurs sous forme [r, v, b]). */
  const PC = { ink: hex(COL.petrol), teal: hex(COL.petrol600), or: hex(COL.orange700), soft: hex(COL.paper), line: hex(COL.line), mute: hex(COL.muted), cream: hex(COL.orange100), white: [255, 255, 255] };

  const BASE = '/passeport-numerique';
  const URLS = {
    dm400: '/fonts/report/dm-sans-latin-400-normal.woff',
    dm700: '/fonts/report/dm-sans-latin-700-normal.woff',
    poppins500: '/fonts/report/poppins-latin-500-normal.woff',
    poppins600: '/fonts/report/poppins-latin-600-normal.woff',
    logoWhite: '/brand/happi-logotype-blanc.png',
    logoPetrol: '/brand/happi-logotype-petrole.png',
    mascot: '/brand/happi-mascotte.png',
  };
  const LOGO_RATIO = 305 / 800;
  const MENTION = 'HAPPI Compétence · Passeport Numérique';

  const defaultFetch = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error('Ressource introuvable : ' + url); return r.arrayBuffer(); }).then((b) => new Uint8Array(b));
  const cache = new Map();
  const load = (fetchBytes, url) => {
    const key = url;
    if (!cache.has(key) || fetchBytes !== defaultFetch) {
      const p = fetchBytes(url).catch((e) => { cache.delete(key); throw e; });
      if (fetchBytes === defaultFetch) cache.set(key, p);
      return p;
    }
    return cache.get(key);
  };
  let fontkitPromise = null;
  function loadFontkit() {
    if (root.fontkit) return Promise.resolve(root.fontkit);
    if (fontkitPromise) return fontkitPromise;
    fontkitPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = BASE + '/vendor/fontkit.umd.min.js';
      s.onload = () => (root.fontkit ? resolve(root.fontkit) : (fontkitPromise = null, reject(new Error('fontkit'))));
      s.onerror = () => { fontkitPromise = null; s.remove(); reject(new Error('fontkit')); };
      document.head.appendChild(s);
    });
    return fontkitPromise;
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ── Sceau « Passeport Numérique · Validé » ─────────────────────────────────────────────────────────────
  let sealCount = 0;
  /**
   * Sceau vectoriel : disque pétrole, anneau orange, la petite fourmi au centre, « PASSEPORT NUMÉRIQUE » en arc,
   * l'association (comme avant : « ASSOCIATION <nom> ») sous le disque, bandeau orange « VALIDÉ <année> ».
   * `raster` : intègre la police dans le SVG (une image SVG ne charge aucune police extérieure) pour le dessiner
   * sur un canevas ou l'insérer dans un PDF.
   */
  function sealSvg(size, o) {
    o = o || {};
    const assets = root.HappiPdfAssets || {};
    const id = 'hs' + ++sealCount;
    let name = String(o.asso || 'Happi').trim().toUpperCase().slice(0, 22) || 'HAPPI';
    if (!/^ASSOCIATION\b/.test(name)) name = 'ASSOCIATION ' + name;
    const year = o.year || new Date().getFullYear();
    const fs = name.length <= 18 ? 10 : name.length <= 24 ? 8.6 : 7.6;
    const family = o.raster ? "'HappiSeal', Poppins, Arial, sans-serif" : "Poppins, 'DM Sans', Arial, sans-serif";
    const font = o.raster && assets.poppins600Woff ? `<style>@font-face{font-family:'HappiSeal';font-weight:600;src:url(${assets.poppins600Woff}) format('woff')}</style>` : '';
    const label = `Sceau : Passeport Numérique, validé ${year}, ${name.toLowerCase()}`;
    const mascot = assets.mascotPng ? `<image href="${assets.mascotPng}" x="50" y="46" width="100" height="100" clip-path="url(#${id}c)" preserveAspectRatio="xMidYMid slice"/>` : '';
    return `<svg class="hstamp" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 200 200" role="img" aria-label="${esc(label)}">${font}`
      + `<defs><path id="${id}t" d="M 27,100 a 73,73 0 1,1 146,0"/><path id="${id}b" d="M 17,100 a 83,83 0 0,0 166,0"/><clipPath id="${id}c"><circle cx="100" cy="100" r="56"/></clipPath></defs>`
      + `<circle cx="100" cy="100" r="98" fill="${COL.petrol}"/><circle cx="100" cy="100" r="93" fill="none" stroke="${COL.orange}" stroke-width="1.6"/><circle cx="100" cy="100" r="64" fill="none" stroke="${COL.petrol400}" stroke-width=".8"/>`
      + `<circle cx="21" cy="100" r="2.6" fill="${COL.orange}"/><circle cx="179" cy="100" r="2.6" fill="${COL.orange}"/>`
      + `<text font-family="${family}" font-weight="600" font-size="12.5" letter-spacing="2.2" fill="${COL.white}" text-anchor="middle"><textPath href="#${id}t" startOffset="50%">PASSEPORT NUMÉRIQUE</textPath></text>`
      + `<text font-family="${family}" font-weight="600" font-size="${fs}" letter-spacing="1.8" fill="${COL.petrol200}" text-anchor="middle"><textPath href="#${id}b" startOffset="50%">${esc(name)}</textPath></text>`
      + `<circle cx="100" cy="100" r="57" fill="${COL.paper}" stroke="${COL.orange}" stroke-width="2"/>${mascot}`
      + `<rect x="50" y="139" width="100" height="23" rx="11.5" fill="${COL.orange}" stroke="${COL.petrol}" stroke-width="2.5"/>`
      + `<text x="100" y="154.6" text-anchor="middle" font-family="${family}" font-weight="600" font-size="12" letter-spacing="1.4" fill="${COL.petrol}">VALIDÉ ${esc(year)}</text></svg>`;
  }

  // ── Document ───────────────────────────────────────────────────────────────────────────────────────────
  /**
   * Prépare un document A4 aux couleurs HAPPI.
   * opts : { title, sub, landscape, bare (pas d'en-tête automatique), noFirst (pas de première page), noFooter }
   * env  : { asso, fmtD(ms) }
   */
  async function create(PDFLib, opts, env, deps) {
    opts = opts || {}; env = env || {}; deps = deps || {};
    const { PDFDocument, rgb } = PDFLib;
    const fetchBytes = deps.fetchBytes || defaultFetch;
    const fontkit = deps.fontkit || (await loadFontkit());
    const bytes = await Promise.all(['dm400', 'dm700', 'poppins500', 'poppins600', 'logoWhite', 'logoPetrol', 'mascot'].map((k) => load(fetchBytes, URLS[k])));
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const asso = (env.asso || 'Happi');
    doc.setTitle(opts.title || 'Document');
    doc.setAuthor(asso + ' · Passeport Numérique');
    doc.setCreator('HAPPI Compétence · Passeport Numérique');
    const [F, FB, HM, H] = await Promise.all([bytes[0], bytes[1], bytes[2], bytes[3]].map((b) => doc.embedFont(b, { subset: true })));
    const [logoWhite, logoPetrol, mascot] = await Promise.all([doc.embedPng(bytes[4]), doc.embedPng(bytes[5]), doc.embedPng(bytes[6])]);
    const C = (a) => rgb(a[0] / 255, a[1] / 255, a[2] / 255);
    const K = {}; Object.keys(COL).forEach((k) => { K[k] = C(hex(COL[k])); });

    const land = !!opts.landscape;
    const PW = land ? 841.89 : 595.28, PH = land ? 595.28 : 841.89, M = land ? 56 : 54, BOTTOM = 66;
    let pg = null, y = 0, group = 0;
    const pages = [];

    // Les caractères absents des polices sont retirés plutôt que remplacés par un carré.
    const okCache = new Map();
    const hasGlyph = (font, cp) => { try { const f = font.embedder && font.embedder.font; return f && f.hasGlyphForCodePoint ? !!f.hasGlyphForCodePoint(cp) : true; } catch (e) { return true; } };
    const safe = (s) => {
      s = String(s == null ? '' : s).replace(/[    ]/g, ' ').replace(/[✓✔]/g, '').replace(/★/g, '*').replace(/→/g, '->');
      let out = '';
      for (const ch of s) {
        if (ch === '\n') { out += ch; continue; }
        let v = okCache.get(ch);
        if (v === undefined) { v = hasGlyph(F, ch.codePointAt(0)) && hasGlyph(FB, ch.codePointAt(0)) && hasGlyph(H, ch.codePointAt(0)); okCache.set(ch, v); }
        if (v) out += ch;
      }
      return out;
    };
    const wrap = (t, f, sz, w) => {
      const out = [];
      String(safe(t)).split('\n').forEach((par) => {
        let line = '';
        par.split(' ').forEach((wd) => {
          while (f.widthOfTextAtSize(wd, sz) > w && wd.length > 1) { // mot plus large que la ligne : coupé
            let k = wd.length - 1; while (k > 1 && f.widthOfTextAtSize(wd.slice(0, k), sz) > w) k--;
            if (line) { out.push(line); line = ''; }
            out.push(wd.slice(0, k)); wd = wd.slice(k);
          }
          const tr = line ? line + ' ' + wd : wd;
          if (f.widthOfTextAtSize(tr, sz) <= w || !line) line = tr; else { out.push(line); line = wd; }
        });
        out.push(line);
      });
      return out;
    };
    const fit = (t, f, sz, w) => { let s = sz; while (s > 6 && f.widthOfTextAtSize(t, s) > w) s -= 0.5; return s; };

    // Formes : rectangle à coins arrondis (tracé SVG, origine en haut à gauche), points discrets du bandeau.
    const rr = (p, x, top, w, h, r, st) => {
      r = Math.max(0, Math.min(r, w / 2, h / 2));
      const d = `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
      p.drawSvgPath(d, Object.assign({ x, y: top }, st));
    };
    const dots = (p, x, bottom, w, h) => { for (let gx = x + 9; gx < x + w; gx += 12) for (let gy = bottom + 9; gy < bottom + h; gy += 12) p.drawCircle({ x: gx, y: gy, size: 0.7, color: K.white, opacity: 0.1 }); };
    const centered = (p, t, cx, yy, o) => p.drawText(t, Object.assign({ x: cx - o.font.widthOfTextAtSize(t, o.size) / 2, y: yy }, o));

    const api = { doc, F, FB, H, HM, C, K, rgb, PW, PH, M, safe, wrap, fit, rr, dots, centered, COL, PC, mascot, logoWhite, logoPetrol, LOGO_RATIO,
      get page() { return pg; }, get y() { return y; }, set y(v) { y = v; } };

    /** Bandeau pétrole de tête : logo officiel, titre en Poppins, mascotte (ou pastille) à droite. */
    api.banner = (o) => {
      const p = pg;
      const badge = o.badge ? wrap(o.badge, H, 9, 62).slice(0, 3) : null;
      const maxW = PW - 2 * M - (badge ? 112 : 100);
      const tl = wrap(o.title || '', H, 22, maxW).slice(0, 2);
      const sub = o.sub ? wrap(o.sub, F, 10.5, maxW)[0] : null;
      const bh = Math.max(badge ? 118 : 108, 90 + (tl.length - 1) * 27 + (sub ? 22 : 0) + 22);
      p.drawRectangle({ x: 0, y: PH - bh, width: PW, height: bh, color: K.petrol });
      dots(p, 0, PH - bh, PW, bh);
      p.drawRectangle({ x: 0, y: PH - bh - 3, width: PW, height: 3, color: K.orange });
      const lh = 22, lw = lh / LOGO_RATIO;
      p.drawImage(logoWhite, { x: M, y: PH - 30 - lh, width: lw, height: lh });
      const kx = M + lw + 12;
      p.drawRectangle({ x: kx, y: PH - 30 - lh + 3, width: 0.75, height: lh - 6, color: K.petrol400 });
      p.drawText(safe('Passeport Numérique' + (o.kicker ? ' · ' + o.kicker : '')), { x: kx + 12, y: PH - 30 - lh + 7, size: 10, font: HM, color: K.orange });
      tl.forEach((l, i) => p.drawText(l, { x: M, y: PH - 30 - lh - 24 - i * 27, size: 22, font: H, color: K.white }));
      if (sub) p.drawText(sub, { x: M, y: PH - 30 - lh - 24 - (tl.length - 1) * 27 - 22, size: 10.5, font: F, color: K.petrol200 });
      if (badge) {
        const cx = PW - M - 40, cy = PH - bh / 2;
        p.drawCircle({ x: cx, y: cy, size: 41, color: K.petrol800, borderColor: K.orange, borderWidth: 2.5 });
        badge.forEach((l, i) => centered(p, l, cx, cy - 3 + ((badge.length - 1) / 2 - i) * 11, { size: 9, font: H, color: K.white }));
        y = PH - bh - 36;
      } else if (o.mascot !== false) {
        p.drawImage(mascot, { x: PW - M - 70, y: PH - bh - 24, width: 80, height: 80 });
        y = PH - bh - 44;
      } else y = PH - bh - 36;
      return p;
    };
    /** Page courante : en-tête fin (logo pétrole, titre du document). */
    api.runningHead = () => {
      const lh = 14;
      pg.drawImage(logoPetrol, { x: M, y: PH - 40, width: lh / LOGO_RATIO, height: lh });
      const t = safe(opts.title || '');
      pg.drawText(t, { x: PW - M - F.widthOfTextAtSize(t, 8.5), y: PH - 36, size: 8.5, font: F, color: K.subtle });
      pg.drawLine({ start: { x: M, y: PH - 50 }, end: { x: PW - M, y: PH - 50 }, thickness: 0.6, color: K.line });
      y = PH - 78;
    };
    api.newPage = (first) => {
      pg = doc.addPage([PW, PH]); pg.__group = group; pages.push(pg);
      if (opts.bare) { y = PH - M; return pg; }
      if (first) api.banner({ title: opts.title, sub: opts.sub }); else api.runningHead();
      return pg;
    };
    /** Nouvelle série de pages dont la numérotation repart de 1 (un mémo = une série). */
    api.section = () => { group++; };
    api.ensure = (h) => { if (y - h < BOTTOM) api.newPage(false); };
    api.text = (t, o) => {
      o = o || {};
      const f = o.bold ? FB : (o.font || F), sz = o.size || 10.5, lh = o.lh || sz * 1.5, w = o.w || (PW - 2 * M - (o.indent || 0));
      wrap(t, f, sz, w).forEach((l) => { api.ensure(lh); pg.drawText(l, { x: M + (o.indent || 0), y: y - sz, size: sz, font: f, color: C(o.color || PC.ink) }); y -= lh; });
      y -= (o.after == null ? 4 : o.after);
    };
    /** Titre de section : Poppins, petit point orange (le point du « i » du logo), filet fin. */
    api.h2 = (t) => {
      api.ensure(86); y -= 12;
      pg.drawCircle({ x: M + 3, y: y - 8, size: 3, color: K.orange });
      pg.drawText(safe(t), { x: M + 14, y: y - 13, size: 13.5, font: H, color: K.petrol });
      pg.drawLine({ start: { x: M, y: y - 22 }, end: { x: PW - M, y: y - 22 }, thickness: 0.6, color: K.line });
      y -= 38;
    };
    api.kpis = (items, cols) => {
      cols = cols || 3;
      const gap = 10, bw = (PW - 2 * M - gap * (cols - 1)) / cols, bh = 66;
      for (let i = 0; i < items.length; i += cols) {
        api.ensure(bh + gap);
        items.slice(i, i + cols).forEach((k, j) => {
          const x = M + j * (bw + gap);
          rr(pg, x, y, bw, bh, 8, { color: K.paper, borderColor: K.line, borderWidth: 0.75 });
          const v = safe(String(k[0]));
          pg.drawText(v, { x: x + 14, y: y - 30, size: fit(v, H, 20, bw - 28), font: H, color: K.petrol });
          wrap(k[1], F, 8.5, bw - 28).slice(0, 2).forEach((l, n) => pg.drawText(l, { x: x + 14, y: y - 45 - n * 11, size: 8.5, font: F, color: K.muted }));
        });
        y -= bh + gap;
      }
      y -= 2;
    };
    api.bars = (obj, o) => {
      o = o || {};
      const e = Object.entries(obj).sort((a, b) => b[1] - a[1]);
      if (!e.length) { api.text('Pas encore de données.', { color: PC.mute, size: 10 }); return; }
      const m = Math.max.apply(null, e.map((x) => x[1]).concat(1)), lw = o.lw || 170, bw = PW - 2 * M - lw - 40;
      e.forEach(([k, v]) => {
        api.ensure(22);
        pg.drawText(wrap(k, F, 9.5, lw - 8)[0], { x: M, y: y - 11, size: 9.5, font: F, color: K.petrol });
        rr(pg, M + lw, y - 3, bw, 8, 4, { color: K.petrol100 });
        rr(pg, M + lw, y - 3, Math.max(8, bw * v / m), 8, 4, { color: K.petrol600 });
        pg.drawText(String(v), { x: M + lw + bw + 8, y: y - 11, size: 9.5, font: FB, color: K.petrol });
        y -= 20;
      });
      y -= 6;
    };
    api.table = (heads, rows, ws, o) => {
      o = o || {};
      const tw = PW - 2 * M, W2 = ws.map((w) => w * tw), pad = 7, sz = o.size || 10, minH = o.rowH || 24;
      const bold = (i) => o.bold && o.bold.includes(i);
      const head = () => {
        api.ensure(26 + minH);
        rr(pg, M, y, tw, 24, 6, { color: K.petrol });
        let x = M; heads.forEach((hh, i) => { pg.drawText(wrap(hh, HM, 9, W2[i] - 2 * pad)[0], { x: x + pad, y: y - 15.5, size: 9, font: HM, color: K.white }); x += W2[i]; });
        y -= 24;
      };
      head();
      rows.forEach((r, ri) => {
        const cells = r.map((c, i) => wrap(c == null ? '' : String(c), bold(i) ? FB : F, sz, W2[i] - 2 * pad));
        const h = Math.max(minH, ...cells.map((c) => c.length * sz * 1.35 + 12));
        if (y - h < BOTTOM) { api.newPage(false); head(); }
        if (ri % 2) pg.drawRectangle({ x: M, y: y - h, width: tw, height: h, color: K.paper });
        pg.drawLine({ start: { x: M, y: y - h }, end: { x: M + tw, y: y - h }, thickness: 0.6, color: K.line });
        let x = M;
        cells.forEach((c, i) => {
          c.forEach((l, n) => pg.drawText(l, { x: x + pad, y: y - 7 - sz - n * sz * 1.35, size: sz, font: bold(i) ? FB : F, color: K.petrol }));
          if (i) pg.drawLine({ start: { x, y }, end: { x, y: y - h }, thickness: 0.4, color: K.line });
          x += W2[i];
        });
        y -= h;
      });
      y -= 14;
    };
    /** Encadré : fond papier, filet orange à gauche, titre Poppins orange foncé ; la mascotte peut dépasser du haut. */
    api.callout = (title, blocks, o) => {
      o = o || {};
      const pad = 16, iw = PW - 2 * M - 2 * pad - 6, lh = 15.5;
      const lay = [];
      blocks.forEach((b, bi) => wrap((b.bullet ? '•  ' : '') + b.t, b.bold ? FB : F, b.size || 10.5, iw).forEach((l, i) => lay.push({ l, b, gap: i === 0 && bi > 0 ? 5 : 0 })));
      const h = pad + 22 + lay.reduce((s, x) => s + lh + x.gap, 0) + pad - 2;
      api.ensure(h + 40);
      y -= o.mascot ? 40 : 4;
      if (o.mascot) pg.drawImage(mascot, { x: PW - M - pad - 56, y: y - 14, width: 60, height: 60 });
      rr(pg, M, y, PW - 2 * M, h, 10, { color: K.paper, borderColor: K.line, borderWidth: 0.75 });
      rr(pg, M, y, 5, h, 2.5, { color: K.orange });
      pg.drawText(safe(title), { x: M + pad + 6, y: y - pad - 9, size: 12.5, font: H, color: K.orange700 });
      let yy = y - pad - 22;
      lay.forEach((x) => { yy -= x.gap; pg.drawText(x.l, { x: M + pad + 6, y: yy - 10, size: x.b.size || 10.5, font: x.b.bold ? FB : F, color: K.petrol }); yy -= lh; });
      y -= h + 14;
    };
    api.finish = async () => {
      if (!opts.noFooter) {
        const date = env.fmtD ? env.fmtD(Date.now()) : '';
        const left = safe(MENTION + (asso && asso !== 'Happi' ? ' · ' + asso : ''));
        const right = safe(date ? ' · document généré le ' + date : '');
        const counts = {}; pages.forEach((p) => { counts[p.__group] = (counts[p.__group] || 0) + 1; });
        const seen = {};
        pages.forEach((p) => {
          if (p.__noFooter) return;
          const n = (seen[p.__group] = (seen[p.__group] || 0) + 1);
          p.drawLine({ start: { x: M, y: 46 }, end: { x: PW - M, y: 46 }, thickness: 0.6, color: K.line });
          p.drawText(left, { x: M, y: 31, size: 8, font: FB, color: K.petrol });
          p.drawText(right, { x: M + FB.widthOfTextAtSize(left, 8), y: 31, size: 8, font: F, color: K.subtle });
          const pn = 'Page ' + n + ' / ' + counts[p.__group];
          p.drawText(pn, { x: PW - M - F.widthOfTextAtSize(pn, 8), y: 31, size: 8, font: F, color: K.subtle });
        });
      }
      return doc.save();
    };
    if (!opts.noFirst) api.newPage(true);
    return api;
  }

  // ── Cartes de code ────────────────────────────────────────────────────────────────────────────────────
  /** profs : profils { name, last, pin }. Dix cartes par page (2 × 5), à découper. */
  function cartes(P, profs) {
    const { K, rr, dots, C, PC: pc } = P;
    const cw = 244, ch = 134, gx = (P.PW - 2 * cw) / 3, gy = 10, top = P.PH - 62;
    profs.forEach((p, i) => {
      if (i % 10 === 0) {
        P.newPage();
        P.page.drawText(P.safe('Cartes de code — à découper et à donner à chaque participant'), { x: P.M, y: P.PH - 34, size: 9, font: P.F, color: K.muted });
      }
      const k = i % 10, col = k % 2, row = Math.floor(k / 2), x = gx + col * (cw + gx), yTop = top - row * (ch + gy), pg = P.page;
      rr(pg, x - 4, yTop + 4, cw + 8, ch + 8, 12, { borderColor: K.petrol200, borderWidth: 0.8, borderDashArray: [4, 3] });
      rr(pg, x, yTop, cw, ch, 9, { color: K.white, borderColor: K.line, borderWidth: 1 });
      pg.drawSvgPath(`M 0 9 A 9 9 0 0 1 9 0 H ${cw - 9} A 9 9 0 0 1 ${cw} 9 V 32 H 0 Z`, { x, y: yTop, color: K.petrol });
      dots(pg, x, yTop - 32, cw, 32);
      pg.drawRectangle({ x, y: yTop - 34, width: cw, height: 2, color: K.orange });
      const lh = 15;
      pg.drawImage(P.logoWhite, { x: x + 12, y: yTop - 24, width: lh / P.LOGO_RATIO, height: lh });
      pg.drawText(P.safe('Passeport Numérique'), { x: x + 12 + lh / P.LOGO_RATIO + 8, y: yTop - 22, size: 9, font: P.HM, color: K.white });
      const nm = P.wrap((p.name || '') + ' ' + (p.last || ''), P.H, 13.5, cw - 24)[0];
      pg.drawText(nm, { x: x + 12, y: yTop - 55, size: 13.5, font: P.H, color: K.petrol });
      pg.drawText(P.safe('Mon code secret :'), { x: x + 12, y: yTop - 71, size: 8.5, font: P.F, color: K.muted });
      pg.drawText((p.pin || '____').split('').join(' '), { x: x + 12, y: yTop - 100, size: 28, font: P.H, color: K.orange700 });
      P.wrap('Je le garde pour moi. Code oublié ? L’animateur peut me le redonner.', P.F, 7.5, cw - 24).forEach((l, n) => pg.drawText(l, { x: x + 12, y: yTop - 116 - n * 9, size: 7.5, font: P.F, color: K.muted }));
    });
    return P.finish();
  }

  // ── Mémos ─────────────────────────────────────────────────────────────────────────────────────────────
  /** env : { RECAP, exs(w), T1(texte) }. Un mémo par monde : bandeau avec le tampon, savoir-faire, astuces, notes. */
  async function memos(P, env, ws, all) {
    const { K, M, PW, C } = P;
    const T1 = env.T1;
    for (const w of ws) {
      const r = Object.assign({ tips: [], key: w.badge }, (env.RECAP && env.RECAP[w.id]) || {});
      P.section(); P.newPage();
      P.banner({ title: T1(w.n), kicker: T1('Mémo'), badge: T1(w.badge), mascot: false });
      P.h2(T1('Ce que je sais faire'));
      (all ? w.ex : env.exs(w)).forEach((e, i) => {
        P.ensure(44);
        P.page.drawCircle({ x: M + 9, y: P.y - 9, size: 9.5, color: K.petrol600 });
        const n = String(i + 1);
        P.page.drawText(n, { x: M + 9 - P.H.widthOfTextAtSize(n, 9.5) / 2, y: P.y - 12.5, size: 9.5, font: P.H, color: K.white });
        const help = T1(e.help);
        P.text(T1(e.t) + (all && e.only ? (e.only === 'pc' ? ' (ordinateur)' : ' (téléphone)') : ''), { bold: true, size: 12, indent: 28, after: help ? 1 : 8 });
        if (help) P.text(help, { size: 10.5, indent: 28, color: P.PC.mute, after: 8 });
      });
      const blocks = r.tips.map((t) => ({ t: T1(t), bullet: true })).concat([{ t: T1(r.key), bold: true, size: 12 }]);
      P.callout(T1('Les astuces'), blocks, { mascot: true });
      P.ensure(168);
      P.h2(T1('Mes notes'));
      for (let n = 0; n < 4; n++) { P.page.drawLine({ start: { x: M, y: P.y - 18 }, end: { x: PW - M, y: P.y - 18 }, thickness: 0.7, color: K.line }); P.y -= 25; }
      P.y -= 2;
      P.text(T1('Ne notez jamais un mot de passe ou un code secret sur ce mémo.'), { size: 9.5, color: P.PC.or });
    }
    return P.finish();
  }

  // ── Certificat de réussite (A4 paysage) ────────────────────────────────────────────────────────────────
  /**
   * d : { name, worlds: [noms], count, date, lieu, asso, seal (octets PNG du sceau, ou null) }
   * Mêmes textes que le certificat d'origine ; seule la mise en page change.
   */
  async function certificate(P, d) {
    const { K, PW, PH, M, rr, dots, centered } = P;
    const pg = P.newPage(); pg.__noFooter = true;
    pg.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: K.paper });
    const bh = 82;
    pg.drawRectangle({ x: 0, y: PH - bh, width: PW, height: bh, color: K.petrol });
    dots(pg, 0, PH - bh, PW, bh);
    pg.drawRectangle({ x: 0, y: PH - bh - 3, width: PW, height: 3, color: K.orange });
    const lh = 28;
    pg.drawImage(P.logoWhite, { x: M, y: PH - bh / 2 - lh / 2, width: lh / P.LOGO_RATIO, height: lh });
    const who = P.safe((d.asso || 'Happi') + ' · Le Passeport Numérique');
    pg.drawText(who, { x: PW - M - P.HM.widthOfTextAtSize(who, 12), y: PH - bh / 2 - 4, size: 12, font: P.HM, color: K.petrol200 });
    pg.drawRectangle({ x: 0, y: 0, width: PW, height: 10, color: K.petrol });
    const cx = PW / 2;
    centered(pg, 'Certificat de réussite', cx, PH - 160, { size: 38, font: P.H, color: K.petrol });
    centered(pg, 'décerné à', cx, PH - 190, { size: 13, font: P.F, color: K.muted });
    const nm = P.safe(d.name || '');
    centered(pg, nm, cx, PH - 236, { size: P.fit(nm, P.H, 44, PW - 2 * M - 40), font: P.H, color: K.orange700 });
    const intro = P.wrap('pour avoir réussi les ' + d.count + ' mondes du parcours de découverte du numérique :', P.F, 13.5, PW - 2 * M - 80);
    intro.forEach((l, i) => centered(pg, l, cx, PH - 266 - i * 18, { size: 13.5, font: P.F, color: K.petrol }));
    const nc = d.worlds.length > 14 ? 3 : 2, per = Math.ceil(d.worlds.length / nc), cwid = (PW - 2 * M - 40) / nc, rh = nc === 3 ? 17 : 21;
    const y0 = PH - 306 - (intro.length - 1) * 18;
    d.worlds.forEach((w, i) => {
      const col = Math.floor(i / per), row = i % per, x = M + 20 + col * cwid, yy = y0 - row * rh;
      pg.drawCircle({ x: x + 5.5, y: yy + 3.5, size: 6, color: K.orange });
      pg.drawLine({ start: { x: x + 2.6, y: yy + 3.6 }, end: { x: x + 4.9, y: yy + 1.3 }, thickness: 1.3, color: K.white });
      pg.drawLine({ start: { x: x + 4.9, y: yy + 1.3 }, end: { x: x + 8.6, y: yy + 6 }, thickness: 1.3, color: K.white });
      const t = P.safe(w);
      pg.drawText(t, { x: x + 17, y: yy, size: P.fit(t, P.FB, 10.5, cwid - 30), font: P.FB, color: K.petrol });
    });
    const base = 108;
    pg.drawText(P.safe('Le ' + d.date + (d.lieu ? ' · ' + d.lieu : '')), { x: M, y: base, size: 11, font: P.F, color: K.muted });
    pg.drawLine({ start: { x: PW - M - 200, y: base + 12 }, end: { x: PW - M, y: base + 12 }, thickness: 0.8, color: K.petrol400 });
    const sg = 'Signature de l’animateur';
    pg.drawText(P.safe(sg), { x: PW - M - P.F.widthOfTextAtSize(sg, 10), y: base - 6, size: 10, font: P.F, color: K.muted });
    const sz = 122, sx = cx - sz / 2, sy = 30;
    if (d.seal) pg.drawImage(await P.doc.embedPng(d.seal), { x: sx, y: sy, width: sz, height: sz });
    else {
      pg.drawCircle({ x: cx, y: sy + sz / 2, size: sz / 2, color: K.petrol, borderColor: K.orange, borderWidth: 2 });
      pg.drawImage(P.mascot, { x: cx - 40, y: sy + sz / 2 - 40, width: 80, height: 80 });
    }
    return P.finish();
  }

  return { create, cartes, memos, certificate, sealSvg, PC, COL, MENTION };
});
