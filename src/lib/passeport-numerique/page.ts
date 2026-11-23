/**
 * Adaptation à la plateforme de l'application « Le Passeport Numérique » (fichier statique d'origine,
 * private/passeport-numerique/index.html, livré tel quel). La page est préparée à chaque requête,
 * côté serveur, pour la personne connectée : rien de ce qui décide du rôle n'est laissé au navigateur.
 *
 * Ce que change cette adaptation :
 * - polices et bibliothèque PDF servies par la plateforme (aucun appel à Google Fonts ni à un CDN) ;
 * - **tous les PDF et le certificat aux couleurs de HAPPI** : un seul gabarit (public/passeport-numerique/happi-pdf.js)
 *   remplace la mise en page d'origine (polices, bandeau, logo, mascotte, pied de page) ; les contenus ne changent pas.
 *   Le sceau « Passeport Numérique · Validé » est redessiné dans la charte avec la mascotte ;
 * - **aucun code animateur dans la page** : l'espace animateur s'ouvre directement pour un formateur ou un
 *   administrateur, et reste fermé pour un participant (le code « 1111 » de l'original est retiré) ;
 * - pour un participant, la création de compte de l'application (prénom, nom, code à quatre chiffres) est
 *   remplacée par son compte HAPPI : il arrive directement sur le consentement, puis sur le questionnaire
 *   de départ de l'application, puis sur ses exercices ;
 * - les données de l'application (progression, réglages) restent dans le navigateur, mais sont rangées
 *   sous une clé propre à chaque compte : deux personnes qui se servent du même appareil ne voient pas
 *   les données l'une de l'autre.
 *
 * Module pur (aucune dépendance serveur), testé sur le vrai fichier. Si une phrase recherchée disparaît
 * du fichier d'origine (mise à jour de l'application), `preparePasseportNumerique` lève une erreur :
 * on le voit aux tests, pas chez les utilisateurs.
 */

import { applyEvolutions } from './evolutions';
import { replaceAllExactly, replaceOnce } from './replace';

export type PasseportContext = {
  /** `staff` : formateur ou administrateur (espace animateur ouvert). `participant` : parcours de la personne. */
  role: 'staff' | 'participant';
  /** Identifiant opaque du compte, pour ranger les données du navigateur (jamais l'adresse e-mail). */
  uid: string;
  firstName: string;
  lastName: string;
};

export const PASSEPORT_BASE = '/passeport-numerique';

/** Remplace tout ce qui sépare deux repères (chacun présent une seule fois) : le repère de fin est conservé. */
function replaceBetween(html: string, from: string, to: string, replacement: string, label: string): string {
  const count = (needle: string) => html.split(needle).length - 1;
  if (count(from) !== 1 || count(to) !== 1) throw new Error(`Passeport Numérique : « ${label} » : repères trouvés ${count(from)} et ${count(to)} fois (1 attendue chacun). Le fichier d'origine a changé : mettez à jour src/lib/passeport-numerique/page.ts.`);
  const start = html.indexOf(from);
  const end = html.indexOf(to);
  if (end < start) throw new Error(`Passeport Numérique : « ${label} » : repères dans le désordre. Le fichier d'origine a changé : mettez à jour src/lib/passeport-numerique/page.ts.`);
  return html.slice(0, start) + replacement + html.slice(end);
}

/** Applique une transformation à toute la page sauf au dictionnaire de traductions (texte seulement, aucune couleur). */
function outsideTranslations(html: string, transform: (part: string) => string): string {
  const start = html.indexOf('<script type="application/json" id="i18n">');
  const end = html.indexOf('</script>', start) + '</script>'.length;
  return transform(html.slice(0, start)) + html.slice(start, end) + transform(html.slice(end));
}

/**
 * Charte graphique HAPPI : couleurs de l'application d'origine ramenées à la palette HAPPI (pétrole, orange),
 * polices Poppins (titres) et DM Sans (texte). Les écrans simulés des exercices gardent leurs propres couleurs.
 */
const RECOLOR: [string, string][] = [
  ['#16766a', '#21505a'],
  ['#47c3b1', '#76a3ac'],
  ['#f7941d', '#ea632e'],
  ['#e07b00', '#d2541f'],
  ['#b88400', '#b8431a'],
  ['#fff1e0', '#fef3ee'],
  ['#1f1300', '#0a1e22'],
  ['#8aa3a4', '#76a3ac'],
  ['#1d4a52', '#21505a'],
  ['#cfe3e0', '#cadce0'],
  ['#eaf4f2', '#f5f5f2'],
];

function applyBrand(part: string): string {
  let out = part;
  for (const [from, to] of RECOLOR) out = out.split(from).join(to).split(from.toUpperCase()).join(to);
  // L'orange sert aux fonds (boutons) : en texte sur fond clair, il est trop pâle. Les textes passent par --link.
  out = out.split('color:var(--pri)').join('color:var(--link)');
  return out.split('"Atkinson Hyperlegible"').join('"DM Sans"').split('Lexend').join('Poppins');
}

/** Valeurs passées à la page : encodées pour un script en ligne (aucune fermeture de balise possible). */
function contextScript(context: PasseportContext) {
  const json = JSON.stringify({ role: context.role, uid: context.uid, first: context.firstName, last: context.lastName })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .split(String.fromCharCode(0x2028))
    .join('\\u2028')
    .split(String.fromCharCode(0x2029))
    .join('\\u2029');
  // pnExit : demande au cadre de la plateforme de quitter l'application (et le plein écran) vers une page autorisée.
  const exit = "window.pnExit=function(to){try{if(window.parent&&window.parent!==window){window.parent.postMessage({type:'pn:exit',to:to},window.location.origin)}else{window.location.assign(to)}}catch(e){window.location.assign(to)}};";
  return `<script>window.__PN=Object.freeze(${json});${exit}</script>`;
}

export function preparePasseportNumerique(source: string, context: PasseportContext): string {
  let html = source;

  // 1. Polices et bibliothèque PDF hébergées par la plateforme.
  html = replaceOnce(
    html,
    /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]*" rel="stylesheet">/,
    `<link rel="stylesheet" href="${PASSEPORT_BASE}/fonts.css">`,
    'polices Google',
  );
  html = replaceOnce(html, 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js', `${PASSEPORT_BASE}/vendor/pdf-lib.min.js`, 'bibliothèque PDF');

  // 1 bis. Charte graphique HAPPI : feuille de thème après la feuille d'origine, couleurs et polices ramenées à la marque.
  const styleEnd = html.indexOf('</style>');
  if (styleEnd < 0) throw new Error('Passeport Numérique : feuille de style d’origine introuvable.');
  html = `${html.slice(0, styleEnd + '</style>'.length)}\n<link rel="stylesheet" href="${PASSEPORT_BASE}/theme.css">${html.slice(styleEnd + '</style>'.length)}`;
  html = outsideTranslations(html, applyBrand);
  html = replaceOnce(html, "const LOGO='';", `const LOGO='${PASSEPORT_BASE.replace('/passeport-numerique', '')}/brand/happi-logotype-blanc.png';`, 'logo');
  // Mascotte officielle dans les écrans HTML. La fourmi dessinée reste utilisée là où un dessin vectoriel est
  // indispensable (tampons du passeport, fichiers PDF, attestation) : elle est déjà recolorée en orange HAPPI.
  html = replaceOnce(
    html,
    "function ant(s=80,mood='',k='#102C32'){const arm=",
    "function mascot(s=80){return `<img class=\"ant\" src=\"/brand/happi-mascotte.png\" alt=\"\" width=\"${s}\" height=\"${s}\">`}function ant(s=80,mood='',k='#102C32'){const arm=",
    'mascotte',
  );
  const keepSvg = "${ant(130,'cheer').replace(";
  if (html.split(keepSvg).length - 1 !== 1) throw new Error('Passeport Numérique : « passeport illustré » trouvé autrement qu’une fois. Le fichier d\'origine a changé : mettez à jour src/lib/passeport-numerique/page.ts.');
  html = html.split(keepSvg).join('\u0000KEEP').split('${ant(').join('${mascot(').split('\u0000KEEP').join(keepSvg);

  // 1 ter. Charte HAPPI des PDF et du certificat : le gabarit commun remplace la mise en page d'origine. Les fonctions
  // qui fabriquent le contenu (rapport, émargement, attestation, défis) restent celles de l'application : elles
  // écrivent dans le gabarit (`makePdf`) avec la même interface. Cartes, mémos, certificat et sceau, qui dessinaient
  // eux-mêmes, appellent directement le gabarit.
  html = replaceOnce(html, /const PC=\{[^\n]*\};/, 'const PC=HappiPdf.PC;', 'palette des PDF');
  html = replaceBetween(html, 'async function makePdf(opts){', 'async function pdfGive(', 'async function makePdf(opts){return HappiPdf.create(await loadPdfLib(),opts,{asso:S.cfg.asso,fmtD})}\n', 'gabarit des PDF');
  html = replaceBetween(
    html,
    'async function pdfCartes(ids){',
    'async function pdfDefis(){',
    [
      "async function pdfCartes(ids){const P=await makePdf({title:'Cartes de code',bare:true,noFirst:true});return HappiPdf.cartes(P,ids.map(id=>S.profiles[id]))}",
      "async function pdfMemos(ws,all){if(lang()==='ar')return null;const P=await makePdf({title:'Mémo',bare:true,noFirst:true});return HappiPdf.memos(P,{RECAP,exs,T1},ws,all)}",
      '',
    ].join('\n'),
    'cartes de code et mémos',
  );
  html = replaceBetween(
    html,
    'async function pdfCert(p){',
    '/* ================= MÉMOS À IMPRIMER ================= */',
    [
      "async function pdfCert(p){const seal=await svgPng(happiStamp(300,true),720,720);const P=await makePdf({title:'Certificat de réussite',landscape:true,bare:true,noFirst:true,noFooter:true});",
      ' return HappiPdf.certificate(P,{name:p.name,worlds:W.map(w=>w.n),count:W.length,date:certDate(p),lieu:S.cfg.lieu,asso:S.cfg.asso,seal})}',
      '',
      '',
    ].join('\n'),
    'certificat PDF',
  );
  // Sceau « Passeport Numérique · Validé » : nouveau dessin ; la version rasterisée (PDF, image du certificat) embarque sa police.
  html = replaceBetween(
    html,
    'function happiStamp(s=150){',
    'async function openMail(',
    'function happiStamp(s=150,raster=false){return HappiPdf.sealSvg(s,{asso:S.cfg&&S.cfg.asso,year:new Date().getFullYear(),raster})}\n\n',
    'sceau',
  );
  // Image PNG du certificat (envoi par mail, ou si le PDF n'a pas pu être créé) : papier HAPPI, texte DM Sans,
  // prénom en orange foncé lisible, sceau un peu plus petit pour rester dans le cadre.
  html = replaceOnce(html, "x.fillStyle='#fffaf2'", "x.fillStyle='#f5f5f2'", 'fond de l’image du certificat');
  html = replaceOnce(html, "x.fillStyle='#ea632e';x.font='700 110px", "x.fillStyle='#b8431a';x.font='700 110px", 'prénom de l’image du certificat');
  html = replaceAllExactly(html, 'px Arial, sans-serif', 'px DM Sans, Arial, sans-serif', 3, 'police du texte de l’image du certificat');
  html = replaceOnce(html, 'W2/2,600,1300,50', 'W2/2,600,1450,50', 'largeur de la phrase de l’image du certificat');
  html = replaceOnce(html, 'x.drawImage(img,W2/2-110,945,220,220)', 'x.drawImage(img,W2/2-105,930,210,210)', 'sceau de l’image du certificat (trois colonnes)');
  html = replaceOnce(html, 'svgPng(happiStamp(300),300,300)', 'svgPng(happiStamp(300,true),600,600)', 'sceau de l’attestation');
  html = replaceOnce(html, 'encodeURIComponent(happiStamp(340))', 'encodeURIComponent(happiStamp(340,true))', 'sceau de l’image du certificat');

  // 2. Contexte de la personne, avant le premier script (puis le gabarit PDF et son sceau, servis par la plateforme).
  const pdfScripts = `<script src="${PASSEPORT_BASE}/happi-pdf-assets.js"></script><script src="${PASSEPORT_BASE}/happi-pdf.js"></script>`;
  html = replaceOnce(html, '<script>\n{', `${contextScript(context)}\n${pdfScripts}\n<script>\n{`, 'début du script principal');

  // 3. Données rangées par compte (et non par navigateur).
  html = replaceOnce(html, "const KEY='passeport-numerique-v1';", "const KEY='passeport-numerique-v1:'+__PN.uid;", 'clé de stockage');
  html = replaceOnce(html, "const SBK='passeport-numerique-sync';", "const SBK='passeport-numerique-sync:'+__PN.uid;", 'clé de synchronisation');

  // 4. Espace animateur : plus aucun code dans la page, le rôle vient du serveur.
  html = replaceOnce(html, "const CODE_ANIMATEUR='000';", "const CODE_ANIMATEUR='';", 'code animateur par défaut');
  html = replaceOnce(html, "S.cfg.codeH=hcode('anim','1111');", '', 'code animateur initial');
  html = replaceOnce(html, "const ok=S.cfg.codeH?hcode('anim',v)===S.cfg.codeH:v==='1111';", "const ok=__PN.role==='staff';", 'contrôle du code animateur');
  // Le bouton « Espace animateur » ouvre l'espace sans saisie pour un formateur ; il reste sans effet pour un participant.
  html = replaceOnce(
    html,
    "case 'anim':overlay(`<h2>Espace animateur</h2><p>Entrez le code animateur.</p>",
    "case 'anim':if(__PN.role==='staff'){ANIM=true;V={s:'anim',back:V};break}overlay(`<h2>Espace animateur</h2><p>L’espace animateur est réservé aux formateurs de la plateforme.</p>",
    'ouverture de l’espace animateur',
  );
  html = replaceOnce(
    html,
    `<input class="inp" id="code" type="password" inputmode="numeric" autocomplete="off" aria-label="Code animateur" style="max-width:260px;text-align:center"><div class="fb bad" id="cfb"></div><div class="rowb"><button class="btn big" data-a="code">Entrer</button><button class="btn alt" data-a="close">Annuler</button></div>\`);document.getElementById('code').addEventListener('keydown',e=>{if(e.key==='Enter')act('code')});return;`,
    `<div class="rowb"><button class="btn alt" data-a="close">Fermer</button></div>\`);return;`,
    'fenêtre de saisie du code animateur',
  );

  // Plus de code à changer : l'accès à l'espace animateur dépend du rôle sur la plateforme.
  html = replaceOnce(
    html,
    `<div class="rowb" style="margin-bottom:12px"><button class="btn" data-a="chCode">\${ic('lock')} Changer le code animateur</button></div>`,
    '',
    'bouton « Changer le code animateur »',
  );

  // Pour un participant, « Me déconnecter » ramène à son espace HAPPI (la session reste celle de la plateforme).
  html = replaceAllExactly(
    html,
    "${B('Me déconnecter')}",
    "${__PN.role==='participant'?B('Retour à mon espace HAPPI'):B('Me déconnecter')}",
    2,
    'bouton « Me déconnecter »',
  );

  // « Fermer » dans l'espace animateur ramène le formateur à la page « Programmes » de la plateforme.
  html = replaceOnce(
    html,
    "case 'aClose':V=",
    "case 'aClose':if(__PN.role==='staff'){pnExit('/formateur/programmes?programme=passeport-numerique');return}V=",
    'fermeture de l’espace animateur',
  );

  // 5. Rôle de départ : un formateur arrive dans l'espace animateur ; un participant dans son parcours.
  const start = "let V={s:'welcome'};let KEEP=false;let curSay='';let ANIM=false;";
  const bootstrap = [
    start,
    "if(__PN.role==='staff'){ANIM=true;V={s:'anim',back:{s:'welcome'}}}",
    "else{let pid=Object.keys(S.profiles).find(k=>S.profiles[k].plat===__PN.uid);",
    "if(!pid){pid='p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);",
    "S.profiles[pid]={name:__PN.first,last:__PN.last,dev:'phone',done:{},help:[],lost:false,lang:S.lang||'fr',created:Date.now(),seen:Date.now(),plat:__PN.uid,pending:true}}",
    "S.cur=pid;V=S.profiles[pid].pending?{s:'consent'}:{s:'pass'}}",
  ].join('');
  html = replaceOnce(html, start, bootstrap, 'état de départ');

  // 6. Un participant n'a plus d'écran de création de compte, de connexion ni de déconnexion propres à l'application.
  html = replaceOnce(
    html,
    "const s=V.s;let h='';",
    "if(__PN.role==='participant'&&['welcome','who','login','new','forgot','accok'].includes(V.s))V=S.cur&&me()&&!me().pending?{s:'pass'}:{s:'consent'};const s=V.s;let h='';",
    'écrans d’accueil et de connexion',
  );
  html = replaceOnce(
    html,
    "case 'logout':{stopSpeak();",
    "case 'logout':if(__PN.role==='participant'){pnExit('/participant/dashboard');return}{stopSpeak();",
    'déconnexion',
  );

  // 7. Textes du consentement et de la notice : plus de code secret à quatre chiffres, le compte est celui de la
  // plateforme. (Ces phrases existent aussi comme clés des traductions : seul le script principal est modifié.)
  const scriptStart = html.indexOf('</script>', html.indexOf('id="i18n"')) + '</script>'.length;
  let tail = html.slice(scriptStart);
  tail = replaceAllExactly(
    tail,
    'Pour votre compte : votre nom et un code secret de 4 chiffres. L’animateur peut voir votre code pour vous le redonner si vous l’oubliez.',
    'Pour votre compte : votre prénom et votre nom, déjà enregistrés sur votre compte HAPPI. Il n’y a aucun code secret à retenir.',
    2,
    'texte du compte (consentement et notice)',
  );
  tail = replaceAllExactly(tail, 'Votre prénom et votre nom, votre code secret, vos exercices réussis', 'Votre prénom et votre nom, vos exercices réussis', 1, 'liste des informations conservées');
  html = html.slice(0, scriptStart) + tail;

  // 8. Évolutions demandées par le client (assistant vocal, diaporama, retour au passeport, champs présélectionnés).
  return applyEvolutions(html);
}
