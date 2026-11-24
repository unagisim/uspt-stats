# USPT Stats

Application web installable (PWA) pour saisir en direct un match de tennis et en tirer des statistiques. Elle fonctionne hors ligne ; les matchs sont enregistrés sur l'appareil.

Le cahier des charges est dans [CAHIER_DES_CHARGES.md](CAHIER_DES_CHARGES.md).

## Développement

Prérequis : Node.js 22 ou plus récent.

```sh
npm install
npm run dev      # serveur de développement
npm test         # tests du moteur de score, des stats et des exports
npm run check    # vérification des types
npm run build    # version de production dans dist/
```

Les icônes de `public/` sont générées par `node scripts/make-icons.mjs`.

## Publication

Chaque envoi sur la branche `main` lance le workflow `.github/workflows/deploy.yml`, qui teste, construit et publie l'application sur GitHub Pages.
