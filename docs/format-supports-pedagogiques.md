# Format des supports pédagogiques (Markdown)

Chaque session du programme dispose d’un support Markdown, importé depuis
**Administration → Supports pédagogiques**. Le lecteur pédagogique des formateurs
découpe automatiquement ce fichier en séquences. Chaque import crée une nouvelle
version ; les versions précédentes restent consultables et peuvent être republiées.

L’analyse est tolérante : un fichier qui ne suit pas exactement la convention reste
lisible (chaque titre `##` devient une séquence, tout le contenu est conservé).

## Structure reconnue

```markdown
# Session 1 — La communication

Paragraphe d’introduction facultatif (avertissements, contexte).

- **Durée** : 3 h 00
- **Participants** : 8

## Objectifs

- Objectif pédagogique 1
- Objectif pédagogique 2

## Compétences observées

- **Compétences transversales** : Relationnel, Esprit d’équipe
- **Habiletés socio-cognitives** : Coopération, Planification

## Accueil et cadrage

- **Durée** : 10 min
- **Type** : Introduction
- **Objectif** : Installer un climat de confiance
- **Compétences mobilisées** : Relationnel, Coopération

### À dire

Texte que le formateur présente ou lit au groupe.

### Consigne pour les participants

Ce que les participants doivent faire.

### À observer

- Comportement observable 1
- Comportement observable 2

### À retenir

Rappel ou conseil destiné au formateur.

### Questions à poser

1. Première question de réflexion
2. Deuxième question

## Pause

- **Durée** : 10 min
- **Type** : Pause
```

## Règles

| Élément | Rôle dans le lecteur |
| --- | --- |
| `# Titre` | Titre de la session |
| Texte et fiche avant le premier `##` | Écran « Avant de commencer » |
| `## Objectifs`, `## Compétences…`, `## Matériel`, `## Préparation` (sans durée) | Informations de préparation |
| `## Titre` | Une séquence du déroulé |
| `- **Durée** : 10 min` | Durée de la séquence (minuteur). Accepte `10 min`, `1 h 30`, `1h30`, `90 minutes`. La durée peut aussi figurer dans le titre : `## Débat (20 min)` |
| `- **Type** : …` | Introduction, Apport théorique, Activité, Débat, Pause, Transition, Débriefing, Quiz |
| `- **Objectif** : …` | Objectif affiché sous le titre de la séquence |
| `- **Compétences mobilisées** : A, B` | Compétences rappelées pendant la séquence |
| `### …` | Bloc de contenu, mis en forme selon son registre |

### Registres des blocs `###`

| Titre du bloc (exemples) | Registre | Mise en forme |
| --- | --- | --- |
| À dire, Texte à lire, Notions clés à transmettre | Ce que le formateur dit | Bandeau pétrole, texte agrandi |
| Consigne…, Ce que font les participants, Déroulé du jeu | Ce que font les participants | Bandeau orange |
| À observer, Points d’observation, Indicateurs | Ce que le formateur observe | Bandeau bleu-vert |
| À retenir, Conseil…, Rappel, Vigilance | Ce que le formateur retient | Bandeau ambre |
| Questions… | Questions à poser au groupe | Liste numérotée encadrée |
| Débriefing, Transition, Objectifs, Matériel | Rubriques dédiées | Encadré |
| Tout autre titre | Contenu | Bloc neutre |

Les tableaux, listes, mises en gras/italique, citations et liens Markdown (syntaxe GFM)
sont conservés. Le HTML brut éventuellement présent dans le fichier n’est pas
interprété, par sécurité.

## Supports actuels

Les fichiers `content/supports/session-1.md` à `session-6.md` sont les supports
**provisoires** installés à la mise en service :

- sessions 1 à 5 : séquences reprises de l’outil précédent, converties en Markdown ;
- session 6 : gabarit de démonstration qui illustre tous les types de blocs.

Remplacez-les en important les supports officiels.
