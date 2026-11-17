# Vidéo de présentation HAPPI (motion design, 58 s)

Publicité en motion design 2D/2.5D, 1920×1080, 30 images/s, musique originale synchronisée.
Tout est généré par le code de ce dossier : on peut modifier un texte, un timing ou une couleur, puis relancer le rendu.

## Contenu

| Temps | Séquence | Techniques |
| --- | --- | --- |
| 0–8 s | « Des compétences essentielles, souvent INVISIBLES. Le jeu les révèle. » | Point orange fil conducteur, typographie cinétique, onde, remplissage par balayage lumineux, plongée de caméra dans le point |
| 8–18 s | COMMUNICATION · LEADERSHIP · COOPÉRATION → réseau 3D de compétences → 18 / 16 | Masque iris, mots en impact, réseau en perspective qui tourne, impulsions lumineuses, compteurs, implosion |
| 18–28 s | Le jeu vidéo comme terrain d'observation → 6 sessions · 18 heures → interface du formateur | Morphing point → manette, tracé SVG, tuiles en 3D, frise, écran réel en perspective, cartes en couches, curseur |
| 28–34 s | Radar séance 1 → séance 6, puis courbe de progression | Tracé progressif, morphing du polygone, données → histogramme |
| 34–38 s | « Du déclaré à l'observé. » (respiration) | Parallaxe, profondeur de champ, ralenti, transition par bandes |
| 38–50 s | Passeport, bilan (IA + validation), partage vérifiable, publics | Écrans réels en 3D, masque diagonal, pages du bilan en éventail, tampon, QR, mascotte |
| 50–58 s | Logo construit lettre à lettre, « L'avenir se joue ici. » | Onde de choc, point qui devient le point du « i », signature |

Les textes reprennent le site (slogan, 18 h, 6 sessions, groupes de 4 à 8, 18 compétences transversales, 16 habiletés socio-cognitives).
Les données du radar et de l'histogramme sont **illustratives** (mention « Illustration » à l'écran). Les écrans proviennent des
**données de démonstration** de l'application.

## Fichiers

- `cues.json` : grille rythmique partagée (120 BPM, une mesure = 2 s) ; les impacts, whooshes et clics de la musique sont placés aux mêmes instants que les animations.
- `music/compose.py` : musique originale par synthèse (aucun échantillon externe, aucun droit tiers) → `out/music.wav`.
- `index.html`, `src/` : scènes HTML/SVG animées par une timeline GSAP déterministe (`src/scenes.js`).
- `capture.mjs` : captures de l'application (comptes de démonstration, pile locale).
- `render.mjs` : rendu image par image (Chromium), flou de mouvement par sur-échantillonnage, encodage H.264 + AAC.

## Refaire la vidéo

```bash
cd video && npm install
python3 -I music/compose.py
node capture.mjs                      # nécessite la pile locale + npm run demo:seed + next dev
node render.mjs --sheet 1             # planche de contrôle (une image par seconde)
node render.mjs --workers 3           # vidéo finale → out/happi-competence.mp4
```

Pour remplacer la musique par un morceau sous licence : un titre à 120 BPM calé sur la première mesure reste synchronisé
(impacts à 4, 8, 20, 38, 50 et 54 s).
