import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { applyEvolutions, CLIENT_SCRIPT, VIDEO_SCENES, VOX_CORE } from './evolutions';
import { preparePasseportNumerique, type PasseportContext } from './page';
import { replaceOnce } from './replace';

const source = readFileSync(join(process.cwd(), 'private/passeport-numerique/index.html'), 'utf8');
const css = readFileSync(join(process.cwd(), 'public/passeport-numerique/theme.css'), 'utf8');
const participant: PasseportContext = { role: 'participant', uid: 'a1b2c3d4e5f60718', firstName: 'Camille', lastName: 'Essai' };
const staff: PasseportContext = { role: 'staff', uid: '0123456789abcdef', firstName: 'Léa', lastName: 'Formatrice' };
const prepared = preparePasseportNumerique(source, participant);

type VoxState = { vox?: boolean; mute?: boolean };

/** Fait tourner le cœur de l'assistant vocal tel qu'il est livré dans la page, avec un navigateur simulé. */
function voxHarness(state: VoxState, speech = true) {
  const speak = vi.fn(() => Promise.resolve());
  const stopSpeak = vi.fn();
  const save = vi.fn();
  const toast = vi.fn();
  const voxUI = vi.fn();
  const build = new Function('S', 'save', 'stopSpeak', 'speak', 'TTSN', 'voxUI', 'toast', 'window', `${VOX_CORE};return {voxAuto,voxHas,aspeak,voxSet}`);
  const api = build(state, save, stopSpeak, speak, null, voxUI, toast, speech ? { speechSynthesis: {} } : {}) as {
    voxAuto: () => boolean;
    voxHas: () => boolean;
    aspeak: (t: string, s?: string) => Promise<void>;
    voxSet: (o: VoxState) => void;
  };
  return { api, speak, stopSpeak, save, toast, voxUI, state };
}

describe('Assistant vocal : réglage de session', () => {
  it('est activé à la première visite, puis le choix de la personne fait foi', () => {
    const h = voxHarness({});
    expect(h.api.voxAuto()).toBe(true);
    void h.api.aspeak('Bravo !');
    expect(h.speak).toHaveBeenCalledTimes(1);
  });

  it('désactivé : plus aucune lecture automatique, et la lecture en cours s’arrête', () => {
    const h = voxHarness({});
    h.api.voxSet({ vox: false });
    expect(h.state.vox).toBe(false);
    expect(h.save).toHaveBeenCalled();
    expect(h.stopSpeak).toHaveBeenCalled();
    void h.api.aspeak('Bravo !');
    expect(h.speak).not.toHaveBeenCalled();
  });

  it('muet : plus aucune lecture automatique non plus, indépendamment du réglage de l’assistant', () => {
    const h = voxHarness({ vox: true });
    h.api.voxSet({ mute: true });
    expect(h.api.voxAuto()).toBe(false);
    void h.api.aspeak('Bravo !');
    expect(h.speak).not.toHaveBeenCalled();
    h.api.voxSet({ mute: false });
    expect(h.api.voxAuto()).toBe(true);
  });

  it('le choix passe d’un exercice à l’autre : un réglage coupé le reste, quel que soit le nombre de lectures demandées', () => {
    const h = voxHarness({ vox: false });
    for (let i = 0; i < 5; i += 1) void h.api.aspeak(`Exercice ${i}`);
    expect(h.speak).not.toHaveBeenCalled();
  });

  it('sans synthèse vocale dans le navigateur : rien ne se lit et aucun message d’erreur ne surgit tout seul', () => {
    const h = voxHarness({}, false);
    expect(h.api.voxHas()).toBe(false);
    void h.api.aspeak('Bravo !');
    expect(h.speak).not.toHaveBeenCalled();
    expect(h.toast).not.toHaveBeenCalled();
  });
});

describe('Assistant vocal : intégration dans la page', () => {
  it('mémorise le choix dans le stockage de l’application (rangé par compte) et le restaure au chargement', () => {
    expect(VOX_CORE).toContain('save()');
    expect(prepared).toContain("const KEY='passeport-numerique-v1:'+__PN.uid;");
    expect(prepared).toContain('S.vox!==false');
  });

  it('les lectures automatiques passent par le réglage ; les boutons « Écouter » lisent toujours', () => {
    expect(prepared).toContain("aspeak('Félicitations ! Vous avez réussi tout le Passeport Num");
    expect(prepared).toContain('aspeak(`Bravo ${p.name} !');
    expect(prepared).toContain("aspeak('Pas d’inquiétude ! Levez la main");
    expect(prepared).toContain('Promise.race([aspeak(s.fr,s.sub)');
    expect(prepared).toContain("case 'speak':speak(curSay,curSubT);return;");
    expect(prepared).toContain("case 'speakHelp':speak(val,HELPSUB);return;");
  });

  it('le son du diaporama récapitulatif suit le réglage global, à chaque lancement', () => {
    expect(prepared).toContain('Object.assign(RCP,{el,i:0,pause:false,cb,w,r,sc,wi,sound:voxAuto()})');
    expect(prepared).toContain("case 'rcpSound':");
    expect(prepared).toContain("voxSet({mute:!RCP.sound})");
  });

  it('affiche en permanence le réglage et le bouton muet (accessibles : interrupteur, état annoncé)', () => {
    expect(prepared).toContain('voxUI();closeOv();applyZoom();');
    expect(prepared).toContain("case 'voxToggle':");
    expect(prepared).toContain("case 'voxMute':");
    expect(prepared).toContain('role="switch"');
    expect(prepared).toContain('aria-pressed');
    expect(css).toMatch(/\.vox\s*\{/);
  });

  it('n’affiche pas le réglage dans l’espace animateur', () => {
    expect(prepared).toContain("if(__PN.role==='staff'||ANIM)");
  });
});

describe('Diaporama : avancer diapositive par diapositive', () => {
  it('ajoute « Passer cette diapositive » et un retour, en plus de « Passer la vidéo »', () => {
    expect(prepared).toContain('data-a="rcpNext"');
    expect(prepared).toContain('Passer cette diapositive');
    expect(prepared).toContain('Passer la vidéo');
    expect(prepared).toContain("case 'rcpNext':RCP.tok=(RCP.tok||0)+1;RCP.i=Math.min(RCP.sc.length,RCP.i+1);recapShow();return;");
    expect(prepared).toContain('data-a="rcpPrev"');
  });

  it('la vidéo de présentation a des repères de diapositives croissants, du début à la fin', () => {
    expect(VIDEO_SCENES[0]).toBe(0);
    expect([...VIDEO_SCENES].sort((a, b) => a - b)).toEqual([...VIDEO_SCENES]);
    expect(new Set(VIDEO_SCENES).size).toBe(VIDEO_SCENES.length);
    expect(Math.max(...VIDEO_SCENES)).toBeLessThan(54);
    expect(CLIENT_SCRIPT).toContain(JSON.stringify(VIDEO_SCENES));
    expect(CLIENT_SCRIPT).toContain('Passer cette diapositive');
  });
});

describe('Retour au passeport', () => {
  it('propose « Retour à mon passeport » sur chaque écran de fin', () => {
    // Fin d'exercice (tous les types d'exercices passent par le même écran) : toujours le bouton, avec ou sans exercice suivant.
    expect(prepared).toContain("${PASSB()}${!nowW&&next?`<button class=\"btn alt\" data-a=\"world\"");
    expect(prepared).not.toContain("B(nowW||!next?'Voir mon passeport'");
    // Tout le Passeport réussi, mémo à télécharger, bilan de mini-jeu, certificat, fin du diaporama.
    expect(prepared).toContain("<span>${B('Voir mon certificat')}</span></button>${PASSB()}</div>");
    expect(prepared).toContain("${B('Fermer')}</button>${PASSB()}</div><p class=\"note\">${B('Vous pouvez aussi demander");
    expect(prepared).toContain("${PASSB()}</div>`)}\nconst DPHR");
    expect(prepared).toContain('${PASSB()}</div></div></div>`}');
    expect(prepared).toContain('data-a="rcpPass"');
    expect(prepared).toContain("case 'rcpPass':");
  });

  it('le bouton fait revenir directement à l’accueil des mondes', () => {
    expect(prepared).toContain('const PASSB=()=>`<button class="btn big sun pn-retour" data-a="pass">');
    expect(prepared).toContain("case 'pass':V={s:'pass'};break;");
  });
});

describe('Champs de saisie présélectionnés', () => {
  it('injecte un seul script général, avant la fin de la page, qui reste du JavaScript valide', () => {
    expect(prepared.split('id="pn-evolutions"').length - 1).toBe(1);
    expect(prepared.indexOf('id="pn-evolutions"')).toBeGreaterThan(prepared.indexOf('window.__PN='));
    expect(() => new Function(CLIENT_SCRIPT)).not.toThrow();
  });

  it('ne vole pas le focus pendant la saisie et ne cible pas les champs facultatifs ni la recherche de l’espace animateur', () => {
    expect(CLIENT_SCRIPT).toContain('document.activeElement');
    expect(CLIENT_SCRIPT).toContain('#pinq');
    expect(CLIENT_SCRIPT).toContain('facultatif');
    expect(CLIENT_SCRIPT).toContain('preventScroll');
  });

  it('concerne aussi le formateur sans déranger l’espace animateur (champs préremplis)', () => {
    expect(preparePasseportNumerique(source, staff)).toContain('id="pn-evolutions"');
  });
});

describe('Robustesse face à une mise à jour de l’application', () => {
  it('signale précisément la phrase qui ne se retrouve plus', () => {
    expect(() => applyEvolutions('<html><body></body></html>')).toThrow(/Passeport Numérique/);
    expect(() => replaceOnce('abc', 'z', 'y', 'lettre z')).toThrow(/lettre z/);
  });
});
