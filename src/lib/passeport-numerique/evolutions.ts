/**
 * Évolutions fonctionnelles demandées par le client, appliquées à l'application d'origine par la couche de
 * transformation (le fichier d'origine reste livré tel quel, voir page.ts). Quatre sujets :
 *
 * 1. Assistant vocal : un réglage « Assistant vocal activé / désactivé » et un bouton « Son / Muet », visibles
 *    sur chaque écran, valables pour toute la session (mémorisés dans le stockage de l'application, rangé par compte).
 *    Désactivé ou muet : rien ne se lit tout seul ; un clic sur « Écouter » lit toujours la consigne.
 * 2. Champ de saisie présélectionné : une seule solution générale (script observant la page), voir CLIENT_SCRIPT.
 * 3. Diaporama : « Passer cette diapositive » (et retour) en plus de « Passer la vidéo ».
 * 4. Retour direct à « Mon passeport » depuis chaque écran de fin (exercices, mémo, mini-jeux, diaporama, certificat).
 *
 * Même règle que page.ts : si une phrase cherchée disparaît du fichier d'origine, `replaceOnce` lève une erreur.
 */
import { replaceOnce } from './replace';

/** Écrit le code de l'application tel quel : `@{` vaut `${` et `¤` vaut une apostrophe inversée. */
function js(parts: TemplateStringsArray): string {
  return parts.raw.join('').split('@{').join('${').split('¤').join('`');
}

/**
 * Repères des diapositives de la vidéo de présentation (video.mp4, 54 s), relevés image par image :
 * accroche, titre, « mails, arnaques », « nos ateliers », « on s'entraîne », « 2e heure », certificat, « rejoignez-nous ».
 */
export const VIDEO_SCENES = [0, 3, 6, 14, 20, 32, 40, 46];

/**
 * Cœur de l'assistant vocal (testé tel quel). Par défaut : activé à la première visite (`S.vox` absent), puis le
 * choix de la personne fait foi. `aspeak` = lecture AUTOMATIQUE (soumise au réglage) ; `speak` = lecture demandée
 * par un clic (toujours effectuée).
 */
export const VOX_CORE = js`
const voxAuto=()=>S.vox!==false&&!S.mute;
const voxHas=()=>!!(window.speechSynthesis||TTSN);
function aspeak(t,s){return voxAuto()&&voxHas()?speak(t,s):Promise.resolve()}
function voxSet(o){
 if('vox' in o&&!voxHas()){toast('La lecture à voix haute n’est pas disponible sur cet appareil.');voxUI();return}
 if('vox' in o)S.vox=o.vox;if('mute' in o)S.mute=o.mute;save();
 if(!voxAuto())stopSpeak();
 const m='vox' in o?(o.vox?'Assistant vocal activé : les consignes se lisent toutes seules.':'Assistant vocal désactivé. Le bouton « Écouter » lit toujours la consigne.'):(o.mute?'Son coupé : rien ne se lit tout seul.':'Son rétabli.');
 voxUI(m);toast(m)}
`;

/** Les deux commandes, présentes sur tous les écrans (créées une fois, mises à jour sur place pour garder le focus clavier). */
const VOX_UI = js`
function voxUI(msg){
 let d=document.getElementById('vox');
 if(__PN.role==='staff'||ANIM){if(d)d.remove();return}
 if(!d){d=document.createElement('div');d.id='vox';d.className='vox';d.setAttribute('role','group');d.setAttribute('aria-label','Assistant vocal');
  d.innerHTML='<button type="button" class="vox-sw" role="switch" data-a="voxToggle"><span class="vox-ic" aria-hidden="true"></span><span class="vox-t"><span class="vox-l">Assistant vocal</span><b class="vox-s"></b></span></button><button type="button" class="vox-mu" data-a="voxMute"><span class="vox-ic" aria-hidden="true"></span><span class="vox-mt"></span></button><span class="vox-live" role="status" aria-live="polite"></span>';
  document.body.appendChild(d)}
 const has=voxHas(),on=S.vox!==false&&has,mu=!!S.mute;
 const sw=d.querySelector('.vox-sw'),mb=d.querySelector('.vox-mu'),ic2=d.querySelectorAll('.vox-ic');
 sw.setAttribute('aria-checked',String(on));sw.setAttribute('aria-disabled',String(!has));sw.classList.toggle('on',on);
 d.querySelector('.vox-s').textContent=has?(on?'Activé':'Désactivé'):'Indisponible';
 mb.setAttribute('aria-pressed',String(mu));mb.classList.toggle('on',mu);
 mb.setAttribute('aria-label',mu?'Son coupé. Remettre le son':'Son activé. Couper le son');
 d.querySelector('.vox-mt').textContent=mu?'Muet':'Son';
 const i1=ic(on?'speak':'mute'),i2=ic(mu?'mute':'speak');
 if(ic2[0].dataset.k!==i1){ic2[0].innerHTML=i1;ic2[0].dataset.k=i1}
 if(ic2[1].dataset.k!==i2){ic2[1].innerHTML=i2;ic2[1].dataset.k=i2}
 if(msg){const l=d.querySelector('.vox-live');l.textContent='';setTimeout(()=>{l.textContent=msg},50)}}
`;

const PASSB = js`const PASSB=()=>¤<button class="btn big sun pn-retour" data-a="pass">@{ic('home')} <span>@{B('Retour à mon passeport')}</span></button>¤;
`;

/**
 * Script général injecté en fin de page (n'appartient pas à l'application) :
 * - champ de saisie présélectionné : après chaque changement de la page, le premier champ texte VIDE et VISIBLE
 *   reçoit le focus (sans faire défiler la page). Jamais pendant que la personne tape ou choisit dans un autre
 *   champ, jamais deux fois le même champ, jamais un champ de recherche ou facultatif, un champ de l'espace
 *   animateur, un champ déjà rempli. Quand une fenêtre est ouverte, seuls ses champs comptent. Sur écran tactile,
 *   seul un champ dans la partie haute de l'écran est visé, pour ne pas faire remonter le clavier sans raison ;
 * - vidéo de présentation : boutons « diapositive précédente », « Passer cette diapositive » et « Passer la vidéo ».
 */
export const CLIENT_SCRIPT = `(function(){
'use strict';
var SCENES=${JSON.stringify(VIDEO_SCENES)};
var DENY='#pinq,#cp,#certAddr,.sm,[data-no-autofocus],[type=search]';
var OPT=/facultatif|optionnel/i;
var TXT=/^(text|email|tel|url|number|password|)$/i;
var done=typeof WeakSet==='function'?new WeakSet():null;
var timer=0;
function typing(a){return !!a&&a!==document.body&&(a.tagName==='TEXTAREA'||a.isContentEditable||a.tagName==='SELECT'||(a.tagName==='INPUT'&&TXT.test(a.getAttribute('type')||'')))}
function visible(el){
 var r=el.getBoundingClientRect();if(!r.width||!r.height)return false;
 var cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.display==='none')return false;
 if(el.closest('[aria-hidden="true"],[inert],[hidden]'))return false;
 var coarse=window.matchMedia&&window.matchMedia('(pointer:coarse)').matches;
 return r.bottom>0&&r.right>0&&r.left<window.innerWidth&&r.top<(coarse?window.innerHeight*0.7:window.innerHeight)}
function candidate(el){
 if(done&&done.has(el))return false;
 if(el.disabled||el.readOnly||el.value!=='')return false;
 if(el.tagName==='INPUT'&&!TXT.test(el.getAttribute('type')||''))return false;
 if(el.matches(DENY))return false;
 if(OPT.test((el.placeholder||'')+' '+(el.getAttribute('aria-label')||'')))return false;
 return visible(el)}
function focusFirst(){
 timer=0;
 if(typing(document.activeElement))return;
 if(document.getElementById('rcp'))return;
 var root=document.getElementById('ov')||document;
 var list=root.querySelectorAll('input,textarea');
 for(var i=0;i<list.length;i++){if(candidate(list[i])){if(done)done.add(list[i]);try{list[i].focus({preventScroll:true})}catch(e){list[i].focus()}return}}}
var posterHTML=null;
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-a="vidPlay"]');var box=document.getElementById('vidbox');if(b&&box)posterHTML=box.innerHTML},true);
function sceneAt(t){var k=0;for(var i=0;i<SCENES.length;i++){if(t>=SCENES[i]-0.05)k=i}return k}
function attach(v){
 if(v.getAttribute('data-pn-ctl'))return;v.setAttribute('data-pn-ctl','1');
 var box=v.parentNode;var bar=document.createElement('div');bar.className='pn-vidctl';bar.setAttribute('role','group');bar.setAttribute('aria-label','Avancer dans la vidéo');
 bar.innerHTML='<button type="button" class="btn alt" data-pn="prev"><span aria-hidden="true">‹</span> Diapositive précédente</button><span class="pn-vidpos"></span><button type="button" class="btn sun" data-pn="next">Passer cette diapositive <span aria-hidden="true">›</span></button><button type="button" class="btn alt" data-pn="close">Passer la vidéo</button>';
 box.appendChild(bar);
 var pos=bar.querySelector('.pn-vidpos');
 function upd(){pos.textContent='Diapositive '+(sceneAt(v.currentTime||0)+1)+' sur '+SCENES.length}
 v.addEventListener('timeupdate',upd);v.addEventListener('loadedmetadata',upd);upd();
 bar.addEventListener('click',function(e){
  var b=e.target.closest('button');if(!b)return;var k=b.getAttribute('data-pn');var t=v.currentTime||0,i=sceneAt(t);
  if(k==='next'){if(i+1<SCENES.length){v.currentTime=SCENES[i+1]}else{v.currentTime=isFinite(v.duration)?v.duration:t;v.pause()}}
  else if(k==='prev'){v.currentTime=(t-SCENES[i]>1.5||i===0)?SCENES[i]:SCENES[i-1]}
  else if(k==='close'){v.pause();if(posterHTML!==null)box.innerHTML=posterHTML}
  upd()})}
function scan(){
 var vs=document.querySelectorAll('#vidbox video');for(var i=0;i<vs.length;i++)attach(vs[i]);
 if(timer)clearTimeout(timer);timer=setTimeout(focusFirst,120)}
function later(){if(timer)clearTimeout(timer);timer=setTimeout(focusFirst,250)}
function start(){if(!(window.matchMedia&&window.matchMedia('(pointer:coarse)').matches))window.addEventListener('scroll',later,true);new MutationObserver(scan).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class','hidden']});scan()}
if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
})();`;

export function applyEvolutions(input: string): string {
  let html = input;

  // 1. Assistant vocal : cœur et commandes, définis avant « toast » (utilisé par les lectures).
  html = replaceOnce(html, 'function toast(m){document.querySelectorAll(\'.toast\')', `${VOX_CORE}${VOX_UI}function toast(m){document.querySelectorAll('.toast')`, 'fonction toast (assistant vocal)');
  // Les commandes sont mises à jour à chaque écran.
  html = replaceOnce(html, "closeOv();applyZoom();document.body.classList.toggle('lost'", "voxUI();closeOv();applyZoom();document.body.classList.toggle('lost'", 'début du rendu (assistant vocal)');
  html = replaceOnce(html, " case 'voice':{const o=['auto','device','claude'];", " case 'voxToggle':voxSet({vox:S.vox===false});return;\n case 'voxMute':voxSet({mute:!S.mute});return;\n case 'voice':{const o=['auto','device','claude'];", 'action « voice »');
  // Lectures automatiques : désormais soumises au réglage (le bouton « Écouter » appelle toujours speak).
  html = replaceOnce(html, "speak('Félicitations ! Vous avez réussi tout le Passeport Num", "aspeak('Félicitations ! Vous avez réussi tout le Passeport Num", 'lecture du bilan final');
  html = replaceOnce(html, ' speak(`Bravo ${p.name} ! ${tx(msg)}', ' aspeak(`Bravo ${p.name} ! ${tx(msg)}', 'lecture de fin d’exercice');
  html = replaceOnce(html, "speak('Pas d’inquiétude ! Levez la main", "aspeak('Pas d’inquiétude ! Levez la main", 'lecture de l’aide');
  html = replaceOnce(html, 'Promise.race([speak(s.fr,s.sub)', 'Promise.race([aspeak(s.fr,s.sub)', 'lecture du diaporama');
  // Diaporama : le son suit le réglage global à chaque lancement (et non « toujours activé »), et le bouton Son/Muet le modifie.
  html = replaceOnce(html, 'Object.assign(RCP,{el,i:0,pause:false,cb,w,r,sc,wi})', 'Object.assign(RCP,{el,i:0,pause:false,cb,w,r,sc,wi,sound:voxAuto()})', 'lancement du diaporama');
  html = replaceOnce(html, "case 'rcpSound':RCP.sound=!RCP.sound;if(!RCP.sound){stopSpeak()}", "case 'rcpSound':RCP.sound=!RCP.sound;if(!RCP.sound){stopSpeak()}voxSet({mute:!RCP.sound});", 'bouton son du diaporama');
  html = replaceOnce(html, '<button data-a="rcpSound">', '<button data-a="rcpSound" aria-pressed="${!RCP.sound}" aria-label="${RCP.sound?\'Couper le son\':\'Remettre le son\'}">', 'bouton son du diaporama (nom accessible)');

  // 3. Diaporama : diapositive suivante / précédente en plus de « passer la vidéo ».
  html = replaceOnce(
    html,
    '<button data-a="rcpSkip">${ic(\'arrow\')}<span>${B(\'Passer\')}</span></button>',
    '<button data-a="rcpNext" class="rc-next" aria-label="Passer cette diapositive">${ic(\'arrow\')}<span>${B(\'Passer cette diapositive\')}</span></button><button data-a="rcpSkip" aria-label="Passer la vidéo">${ic(\'arrow\')}<span>${B(\'Passer la vidéo\')}</span></button>',
    'commandes du diaporama',
  );
  html = replaceOnce(html, 'data-a="rcpPrev" aria-label="Précédent"', 'data-a="rcpPrev" aria-label="Diapositive précédente"', 'bouton précédent du diaporama');
  html = replaceOnce(html, " case 'rcpPrev':", " case 'rcpNext':RCP.tok=(RCP.tok||0)+1;RCP.i=Math.min(RCP.sc.length,RCP.i+1);recapShow();return;\n case 'rcpPrev':", 'action « rcpPrev »');

  // 4. Retour direct au passeport depuis chaque écran de fin.
  html = replaceOnce(html, 'function stamp(w,state,size=150){', `${PASSB}function stamp(w,state,size=150){`, 'fonction stamp (bouton de retour)');
  // Fin d'exercice (les dix types d'exercices et de simulations passent par le même écran).
  html = replaceOnce(
    html,
    '<button class="btn ${next?\'alt\':\'big\'}" data-a="${nowW||!next?\'pass\':\'world\'}" data-v="${V.w}"><span>${B(nowW||!next?\'Voir mon passeport\':\'Retour à la liste\')}</span></button>',
    '${PASSB()}${!nowW&&next?`<button class="btn alt" data-a="world" data-v="${V.w}"><span>${B(\'Retour à la liste\')}</span></button>`:\'\'}',
    'écran de fin d’exercice',
  );
  // Bilan final (tous les mondes réussis).
  html = replaceOnce(html, '<button class="btn big sun" data-a="cert">${ic(\'star\')} <span>${B(\'Voir mon certificat\')}</span></button></div>', '<button class="btn big sun" data-a="cert">${ic(\'star\')} <span>${B(\'Voir mon certificat\')}</span></button>${PASSB()}</div>', 'bilan final');
  // Mémo à télécharger.
  html = replaceOnce(
    html,
    '<button class="btn alt" data-a="close">${B(\'Fermer\')}</button></div><p class="note">${B(\'Vous pouvez aussi demander à l’animateur de l’imprimer pour vous.\')}</p>',
    '<button class="btn alt" data-a="close">${B(\'Fermer\')}</button>${PASSB()}</div><p class="note">${B(\'Vous pouvez aussi demander à l’animateur de l’imprimer pour vous.\')}</p>',
    'mémo à télécharger',
  );
  // Bilan d'un mini-jeu (défi chrono).
  html = replaceOnce(
    html,
    '<button class="btn alt" data-a="pass">${ic(\'back\')} <span>${B(\'Mon passeport\')}</span></button></div>`)}\nconst DPHR',
    '${PASSB()}</div>`)}\nconst DPHR',
    'bilan de mini-jeu',
  );
  // Certificat.
  html = replaceOnce(
    html,
    '<button class="btn alt" data-a="pass">${ic(\'back\')} <span>${B(\'Mon passeport\')}</span></button></div></div></div>`}',
    '${PASSB()}</div></div></div>`}',
    'écran du certificat',
  );
  // Fin du diaporama récapitulatif.
  html = replaceOnce(
    html,
    '<button class="btn alt" data-a="rcpAgain">${ic(\'replay\')} <span>${B(\'Revoir la vidéo\')}</span></button></div>',
    '<button class="btn alt" data-a="rcpAgain">${ic(\'replay\')} <span>${B(\'Revoir la vidéo\')}</span></button><button class="btn alt" data-a="rcpPass">${ic(\'home\')} <span>${B(\'Retour à mon passeport\')}</span></button></div>',
    'fin du diaporama',
  );
  html = replaceOnce(html, " case 'rcpClose':", " case 'rcpPass':RCP.cb=null;recapStop(true);V={s:'pass'};break;\n case 'rcpClose':", 'action « rcpClose »');

  // 2 et 3. Script général : champ présélectionné et commandes de la vidéo de présentation.
  const end = html.lastIndexOf('</body>');
  if (end < 0) throw new Error('Passeport Numérique : fin de page introuvable. Le fichier d’origine a changé : mettez à jour src/lib/passeport-numerique/evolutions.ts.');
  return `${html.slice(0, end)}<script id="pn-evolutions">${CLIENT_SCRIPT}</script>\n${html.slice(end)}`;
}
