/**
 * Adaptation à la plateforme de l'application « Le Passeport Numérique » (fichier statique d'origine,
 * private/passeport-numerique/index.html, livré tel quel). La page est préparée à chaque requête,
 * côté serveur, pour la personne connectée : rien de ce qui décide du rôle n'est laissé au navigateur.
 *
 * Ce que change cette adaptation :
 * - polices et bibliothèque PDF servies par la plateforme (aucun appel à Google Fonts ni à un CDN) ;
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

export type PasseportContext = {
  /** `staff` : formateur ou administrateur (espace animateur ouvert). `participant` : parcours de la personne. */
  role: 'staff' | 'participant';
  /** Identifiant opaque du compte, pour ranger les données du navigateur (jamais l'adresse e-mail). */
  uid: string;
  firstName: string;
  lastName: string;
};

export const PASSEPORT_BASE = '/passeport-numerique';

function replaceOnce(html: string, search: string | RegExp, replacement: string, label: string): string {
  const matches = typeof search === 'string' ? html.split(search).length - 1 : (html.match(new RegExp(search.source, search.flags.includes('g') ? search.flags : `${search.flags}g`)) ?? []).length;
  if (matches !== 1) throw new Error(`Passeport Numérique : « ${label} » trouvé ${matches} fois (1 attendue). Le fichier d'origine a changé : mettez à jour src/lib/passeport-numerique/page.ts.`);
  return typeof search === 'string' ? html.replace(search, () => replacement) : html.replace(search, () => replacement);
}

function replaceAllExactly(html: string, search: string, replacement: string, expected: number, label: string): string {
  const found = html.split(search).length - 1;
  if (found !== expected) throw new Error(`Passeport Numérique : « ${label} » trouvé ${found} fois (${expected} attendues). Le fichier d'origine a changé : mettez à jour src/lib/passeport-numerique/page.ts.`);
  return html.split(search).join(replacement);
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
  return `<script>window.__PN=Object.freeze(${json});</script>`;
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

  // 2. Contexte de la personne, avant le premier script.
  html = replaceOnce(html, '<script>\n{', `${contextScript(context)}\n<script>\n{`, 'début du script principal');

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

  // « Fermer » dans l'espace animateur ramène le formateur à la page « Programmes » de la plateforme.
  html = replaceOnce(
    html,
    "case 'aClose':V=",
    "case 'aClose':if(__PN.role==='staff'){try{window.top.location.assign('/formateur/programmes?programme=passeport-numerique')}catch(e){}return}V=",
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
    `case 'logout':if(__PN.role==='participant'){try{window.top.location.assign('/participant/dashboard')}catch(e){}return}{stopSpeak();`,
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

  return html;
}
