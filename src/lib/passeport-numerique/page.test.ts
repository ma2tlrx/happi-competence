import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PASSEPORT_WORLD_COUNT } from './meta';
import { preparePasseportNumerique, type PasseportContext } from './page';

const source = readFileSync(join(process.cwd(), 'private/passeport-numerique/index.html'), 'utf8');
const participant: PasseportContext = { role: 'participant', uid: 'a1b2c3d4e5f60718', firstName: 'Camille', lastName: 'Essai' };
const staff: PasseportContext = { role: 'staff', uid: '0123456789abcdef', firstName: 'Léa', lastName: 'Formatrice' };

describe('Passeport Numérique : page préparée pour la personne connectée', () => {
  it('s’applique au fichier d’origine, pour un participant comme pour un formateur', () => {
    expect(() => preparePasseportNumerique(source, participant)).not.toThrow();
    expect(() => preparePasseportNumerique(source, staff)).not.toThrow();
  });

  it('refuse une page d’origine modifiée plutôt que de livrer une version non adaptée', () => {
    expect(() => preparePasseportNumerique(source.replace("const KEY='passeport-numerique-v1';", ''), participant)).toThrow(/clé de stockage/);
  });

  it('ne contient plus aucun code animateur, ni appel à un service tiers de polices ou de bibliothèques', () => {
    for (const context of [participant, staff]) {
      const html = preparePasseportNumerique(source, context);
      expect(html).not.toContain("'1111'");
      expect(html).not.toContain("'000'");
      expect(html).not.toContain('fonts.googleapis.com');
      expect(html).not.toContain('fonts.gstatic.com');
      expect(html).not.toContain('cdnjs.cloudflare.com');
      expect(html).not.toMatch(/<button[^>]*data-a="chCode"/);
      expect(html).toContain('/passeport-numerique/vendor/pdf-lib.min.js');
      expect(html).toContain('/passeport-numerique/fonts.css');
    }
  });

  it('passe le rôle et l’identité depuis le serveur, sans pouvoir fermer la balise du script', () => {
    const html = preparePasseportNumerique(source, { ...participant, firstName: '</script><img src=x onerror=alert(1)>', lastName: 'O’Neil & fils' });
    const injected = html.slice(html.indexOf('window.__PN='), html.indexOf('</script>', html.indexOf('window.__PN=')));
    expect(injected).toContain('"role":"participant"');
    expect(injected).not.toContain('<');
    expect(injected).toContain('\\u003c/script\\u003e');
    expect(html.split('window.__PN=').length - 1).toBe(1);
  });

  it('range les données du navigateur sous une clé propre au compte', () => {
    const html = preparePasseportNumerique(source, participant);
    expect(html).toContain("const KEY='passeport-numerique-v1:'+__PN.uid;");
    expect(html).toContain("const SBK='passeport-numerique-sync:'+__PN.uid;");
  });

  it('seul un formateur ouvre l’espace animateur ; un participant n’a plus ni écran de connexion ni déconnexion propres', () => {
    for (const context of [participant, staff]) {
      const html = preparePasseportNumerique(source, context);
      // Le rôle n'est jamais choisi dans la page : il est lu dans la valeur posée par le serveur.
      expect(html).toContain("const ok=__PN.role==='staff';");
      expect(html).toContain("if(__PN.role==='staff'){ANIM=true;V={s:'anim',back:V};break}");
      expect(html).toContain("pnExit('/participant/dashboard')");
    }
    expect(preparePasseportNumerique(source, participant)).toContain('"role":"participant"');
    expect(preparePasseportNumerique(source, staff)).toContain('"role":"staff"');
  });

  it('le script principal reste du JavaScript valide après adaptation', () => {
    for (const context of [participant, staff]) {
      const html = preparePasseportNumerique(source, context);
      const scripts = [...html.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]!);
      expect(scripts.length).toBeGreaterThanOrEqual(2);
      for (const code of scripts) expect(() => new Function(code)).not.toThrow();
    }
  });

  it('charte HAPPI des PDF : le gabarit commun remplace les polices Helvetica, la palette d’origine et l’ancien sceau', () => {
    for (const context of [participant, staff]) {
      const html = preparePasseportNumerique(source, context);
      // Gabarit et sceau chargés depuis la plateforme (aucun CDN), avant le script principal.
      expect(html).toContain('/passeport-numerique/happi-pdf-assets.js');
      expect(html).toContain('/passeport-numerique/happi-pdf.js');
      expect(html.indexOf('/passeport-numerique/happi-pdf.js')).toBeLessThan(html.indexOf("const KEY='passeport-numerique-v1:"));
      // Tous les PDF passent par le même gabarit.
      expect(html).toContain('async function makePdf(opts){return HappiPdf.create(');
      expect(html).toContain('HappiPdf.cartes(');
      expect(html).toContain('HappiPdf.memos(');
      expect(html).toContain('HappiPdf.certificate(');
      expect(html).not.toContain('StandardFonts');
      expect(html).not.toContain('const PC={ink:[16,44,50],teal:[22,118,106]');
      expect(html).toContain('const PC=HappiPdf.PC;');
      // Sceau : nouveau dessin, rasterisé avec sa police pour les PDF et l’image du certificat.
      expect(html).toContain('HappiPdf.sealSvg(');
      expect(html).toContain('happiStamp(300,true)');
      expect(html).toContain('happiStamp(340,true)');
      expect(html).not.toContain('#d86f00');
      // Image PNG du certificat (envoi par mail) : papier HAPPI, DM Sans, prénom en orange foncé.
      expect(html).toContain("x.fillStyle='#f5f5f2'");
      expect(html).not.toContain("x.fillStyle='#fffaf2'");
      expect(html).toContain("x.fillStyle='#b8431a';x.font='700 110px");
    }
  });

  it('garde les textes d’origine des cartes, mémos et certificat (seule la mise en page change)', () => {
    const html = preparePasseportNumerique(source, staff);
    for (const text of ['Ce que je sais faire', 'Les astuces', 'Mes notes', 'décerné à', 'Signature de l’animateur', 'Certificat de réussite']) expect(html).toContain(text);
    // Les fichiers de gabarit existent et portent la mention de pied de page demandée.
    const gabarit = readFileSync(join(process.cwd(), 'public/passeport-numerique/happi-pdf.js'), 'utf8');
    expect(gabarit).toContain('HAPPI Compétence · Passeport Numérique');
    for (const file of ['vendor/fontkit.umd.min.js', 'vendor/fontkit.LICENSE.md', 'happi-pdf-assets.js']) expect(() => readFileSync(join(process.cwd(), 'public/passeport-numerique', file))).not.toThrow();
  });

  it('le nombre de mondes annoncé par la plateforme est celui de l’application', () => {
    const worlds = source.match(/\n\{id:'w\d+',n:'/g) ?? [];
    expect(worlds.length).toBe(PASSEPORT_WORLD_COUNT);
  });

  describe('évolutions demandées par le client (comportement de l’application)', () => {
    it('défis chrono : une fois le code saisi, on revient à la grille de tous les défis, pas au seul premier', () => {
      const line = source.split('\n').find((l) => l.includes("case 'lobbyGo':")) ?? '';
      expect(line).toContain('S.lobbyDay=dayKey();save();closeOv();');
      expect(line).not.toContain("V={s:'defi',d:val}");
    });

    it('les mondes et les exercices se débloquent un par un, après la fin du précédent', () => {
      expect(source).toContain('wDone(W[i-1])');
      expect(source).not.toContain('wDone(W[0])&&wDone(W[1])');
      expect(source).toContain('const exUnlocked=');
      expect(source).toContain('aria-disabled="true"');
    });

    it('défis chrono : le message de pénalité est une région annoncée, hors de la mise en page', () => {
      expect(source).toContain('<div class="fb dfb" id="fb" role="status" aria-live="polite" aria-atomic="true"></div>');
      const rule = source.split('\n').find((l) => l.startsWith('.defibox #fb{')) ?? '';
      expect(rule).toContain('position:fixed');
      expect(rule).not.toContain('display:none');
    });
  });
});
