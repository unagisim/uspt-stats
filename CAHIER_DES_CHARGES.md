# Cahier des charges : application de suivi de match de tennis

Version 0.1 du 23/11/2026, brouillon à valider.

## 1. Vision

Une PWA (application web installable) pour smartphone et tablette. Elle permet à **une seule personne** (coach, parent ou proche) de saisir en direct le score et les données d'un match de tennis, puis d'en tirer des statistiques détaillées, consultables pendant et après le match, et exportables.

- **Cible V1 :** outil interne d'un club, en français, Android en priorité (iOS compatible via la PWA).
- **Différence avec TennisTracker :** toutes les statistiques sont disponibles gratuitement, avec trois niveaux de saisie et un fonctionnement 100 % hors ligne.

## 2. Périmètre par version

| Fonction | V1 | V2 | Plus tard |
|---|:-:|:-:|:-:|
| Match de simple, saisie en direct | ✅ | | |
| Formats FFT 1 à 3 | ✅ | | |
| Option let au service (ITF) | ✅ | | |
| 3 modes de saisie (rapide, standard, expert) | ✅ | | |
| Annuler le dernier point | ✅ | | |
| Événements (avertissement, pénalité, temps mort médical, interruption, abandon, forfait) | ✅ | | |
| Notes libres sur un point, dictée vocale | ✅ | | |
| Rappel des changements de côté | ✅ | | |
| Stats en direct et en fin de match, avec graphiques | ✅ | | |
| Historique des matchs (recherche, filtres) | ✅ | | |
| Export PDF et CSV, partage | ✅ | | |
| Stats dans le temps (saison, adversaire, surface) | ✅ | | |
| Synchronisation cloud et comptes | | ✅ | |
| Suivi du score en direct par d'autres personnes (lien) | | ✅ | |
| Double | | | ✅ |
| Deux matchs simultanés (mode rapide) | | | ✅ |
| Anglais | | | ✅ |

## 3. Formats de match (FFT)

> ⚠️ Correspondance des formats à confirmer (voir §10).

| Format | Sets | Jeu décisif | Point décisif | 3e set |
|---|---|---|---|---|
| Format 1 | 3 sets à 6 jeux | à 6/6, 7 points | non | set classique avec jeu décisif |
| Format 2 | 2 sets à 6 jeux | à 6/6, 7 points | non | super jeu décisif en 10 points |
| Format 3 | 2 sets à 6 jeux | à 6/6, 7 points | oui (à 40/40) | super jeu décisif en 10 points |

Pour toutes les règles de score :
- les jeux décisifs se gagnent avec 2 points d'écart ;
- le service alterne dans le jeu décisif (1 point, puis 2, puis 2…) ;
- les côtés changent après les jeux impairs et tous les 6 points dans un jeu décisif.

Option **let** : quand elle est activée, un bouton « Let » est proposé au service. Il ne change pas le score mais il est compté dans les stats.

## 4. Modes de saisie

Principes communs :
- l'interface repose uniquement sur des boutons, assez grands pour le pouce, et fonctionne à une main en portrait comme en paysage ;
- le score est toujours visible ;
- la personne au service est indiquée automatiquement ;
- le bouton **Annuler** est toujours accessible ;
- le mode se choisit au début du match et **peut changer en cours de match** : les stats s'adaptent aux données disponibles.

### 4.1 Mode rapide (1 tap)
`[Point Joueur A]` `[Point Joueur B]`, avec en plus `Ace` et `Double faute` en raccourci (facultatif).

### 4.2 Mode standard (2 à 3 taps)
1. **Service :** `1re faute` (on passe à la 2e balle), `Ace`, `Double faute`, `Balle en jeu`.
2. **Gagnant du point :** A ou B.
3. **Fin du point :** `Coup gagnant`, `Faute directe` ou `Faute provoquée`, puis le coup : `Coup droit`, `Revers`, `Volée`, `Smash`, `Service`, `Retour`.

### 4.3 Mode expert (4 à 7 taps, les étapes facultatives peuvent être sautées)
En plus du mode standard :
- **Zone du service :** `Large`, `Corps`, `Axe`.
- **Type de coup :** `Lift`, `Slice`, `À plat`, `Amortie`, `Lob`, `Passing`.
- **Position du joueur qui termine le point :** `Fond de court`, `Milieu`, `Filet` (on enregistre aussi si le joueur est monté au filet).
- **Zone de fin du point :** une grille de boutons en 3 × 2 (gauche, centre, droite × court, long), plus `Filet`, `Out long` et `Out large`.
- **Longueur de l'échange (estimation) :** `1–4`, `5–8`, `9+`.

### 4.4 Autres saisies
- **Événements :** avertissement, pénalité (point, jeu), temps mort médical, interruption et reprise, abandon, forfait.
- **Note libre sur le point :** texte, ou dictée vocale avec la reconnaissance vocale du navigateur.
- **Correction :** annulation du dernier point, sur autant de niveaux que nécessaire.

## 5. Statistiques

Elles sont calculées **pour les deux joueurs**, sur le match, par set, et dans le temps. Chaque stat n'apparaît que si le mode de saisie a fourni les données nécessaires (R = rapide, S = standard, E = expert).

| Catégorie | Statistiques | Mode minimal |
|---|---|:-:|
| Général | points gagnés (total et %), jeux, plus longue série de points, courbe de momentum | R |
| Service | aces, doubles fautes | R (raccourci) |
| Service | % de 1res balles, % de points gagnés sur 1re et sur 2e balle, jeux de service gagnés | S |
| Retour | % de points gagnés en retour (sur 1re et sur 2e balle), jeux de retour gagnés | S |
| Points importants | balles de break obtenues, converties et sauvées ; balles de set et de match ; points à 30/30 et 40/40 ; points décisifs | R |
| Fin de point | coups gagnants et fautes directes par coup, fautes provoquées, ratio gagnants / fautes | S |
| Tactique | zones de service et % de réussite, heatmap des zones de fin de point, points au filet (joués et gagnés), longueur des échanges et % de gain, efficacité par type de coup | E |
| Discipline | lets, avertissements, pénalités | R |
| Historique | évolution sur la saison, bilan contre un adversaire, stats par surface | selon les données |

**Graphiques :** courbe de momentum, barres comparatives A/B, camemberts sur la fin des points, heatmap sur un schéma du court, évolution dans le temps.

## 6. Données de match
- **Joueurs :** nom et prénom uniquement. Une liste réutilisable est nécessaire pour l'historique (voir §10).
- **Contexte (facultatif) :** tournoi, tour, date, lieu, surface, intérieur ou extérieur, météo.
- **Règles :** format FFT, option let, joueur au service en premier.

## 7. Exports
- **PDF :** feuille de match (score par set) et tableau de stats, avec graphiques.
- **CSV :** un fichier avec une ligne par point (données brutes) et un fichier de synthèse des stats.
- **Partage :** feuille de partage native d'Android (e-mail, WhatsApp, etc.).
- **Sauvegarde et restauration :** export et import de toute la base en JSON, pour couvrir la V1 sans cloud.

## 8. Architecture technique

| Élément | Choix proposé |
|---|---|
| Type d'application | PWA installable, hors ligne (service worker) |
| Langage | TypeScript |
| Framework | Svelte (léger et rapide sur mobile d'entrée de gamme ; React reste possible) |
| Build | Vite avec vite-plugin-pwa |
| Stockage local | IndexedDB, via Dexie |
| Graphiques | Chart.js |
| PDF | jsPDF |
| Tests | Vitest, en priorité sur le moteur de score |
| Hébergement | site statique (GitHub Pages, Netlify ou serveur du club), à choisir |

**Principe clé : stocker les événements plutôt que le score.**
- Un match est enregistré comme une **liste ordonnée d'événements** (points et incidents).
- Le score, le joueur au service, les changements de côté et les stats sont **recalculés** en rejouant ces événements avec un moteur de règles pur et testé.
- Conséquences : annuler revient à supprimer le dernier événement, aucune incohérence de score n'est possible, et le format est prêt pour la synchronisation cloud et le suivi en direct de la V2.

```
Match { id, date, format, letActif, joueurA, joueurB, premierServeur, contexte?, modeSaisie, evenements[] }
Joueur { id, nom, prenom }
// chaque événement porte un horodatage automatique : ts
Point { seq, ts, gagnant, serveur, service?: 1re|2e|ace|df, lets?, fin?: gagnant|faute_directe|faute_provoquee,
        coup?, effet?, zoneService?, zoneFin?, position?, monteeFilet?, longueurEchange?, note? }
Incident { seq, ts, type: avertissement|penalite|medical|interruption|reprise|abandon|forfait, joueur?, note? }
```

## 9. Interface (écrans V1)
1. **Accueil :** nouveau match, match en cours, historique.
2. **Création d'un match :** joueurs, format, options, mode de saisie, contexte facultatif.
3. **Saisie en direct :** bandeau de score, boutons, Annuler, accès rapide aux stats.
4. **Stats en direct ou de fin de match :** onglets Résumé, Service, Retour, Points, Tactique, Graphiques.
5. **Historique :** liste filtrable (joueur, date, surface).
6. **Stats d'un joueur dans le temps.**

Thèmes clair et sombre, avec un mode « plein soleil » à fort contraste.

## 10. Décisions validées (23/11/2026)

| Sujet | Décision |
|---|---|
| Formats FFT | La correspondance du §3 est validée. |
| Joueurs | Liste minimale (nom et prénom), réutilisable d'un match à l'autre ; nécessaire pour l'historique. |
| Horodatage | Automatique et invisible sur chaque événement, sans aucune saisie. Il donne la durée du match, des sets et des jeux. |
| Stats | Calculées pour les deux joueurs. |
| Suivi du score en direct par d'autres personnes | Reporté en V2, avec le cloud. |
| Dictée vocale | Peut nécessiter du réseau ; sans réseau, seule la note écrite est disponible. |
| Hébergement | À décider plus tard. |
| Framework | Svelte. |
