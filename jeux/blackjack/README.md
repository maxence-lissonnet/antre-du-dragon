# Blackjack du Dragon

Un blackjack européen en 3D dans l'antre d'un dragon. Le dragon tient la table : il distribue, suit les cartes du regard, crache du feu sur ta mise quand tu perds et boude quand tu gagnes. Les pièces d'or sont imaginaires : aucun argent réel n'est en jeu.

## Jouer

Ce jeu fait partie de « L'antre du dragon » : ouvre `index.html` à la racine du projet, puis entre dans l'alcôve du blackjack. On peut aussi ouvrir directement `jeux/blackjack/index.html`.

- Une connexion internet sert seulement à charger les polices (Grenze Gotisch, Alegreya Sans). Sans connexion, le jeu marche avec des polices de secours.
- Le trésor et le dragon choisi sont communs à tous les jeux de l'antre ; les statistiques et le réglage du son sont propres au blackjack. Tout est gardé dans le navigateur (`localStorage`).
- Cinq dragons au choix dans les paramètres (Émeraude, Rouge de feu, Ombre, Glace, Spectral) : seule l'apparence change.
- Un blackjack déclenche une pluie d'or et le dragon s'incline devant toi.
- Toutes les 10 donnes gagnées d'affilée (10, 20, 30…) : sacre du joueur, avec couronne d'or et feux d'artifice. Toutes les 10 donnes perdues d'affilée : le dragon s'empare du trésor (mise en scène seulement, le solde ne change pas). Une égalité ne casse pas la série et ne la fait pas avancer.

### Commandes

| Action | Souris / doigt | Clavier |
| --- | --- | --- |
| Miser | jetons 10, 25, 100, 500 | — |
| Distribuer | « Distribuer » | Entrée |
| Tirer une carte | « Tirer » | T |
| Rester | « Rester » | R |
| Doubler | « Doubler » | D |
| Séparer une paire | « Séparer » | S |
| Prendre / refuser l'assurance | « M'assurer » / « Non merci » | A / N |

### Règles

Blackjack européen : le dragon ne reçoit qu'une carte visible au départ et tire la seconde après le tour du joueur.

- Sabot de 8 jeux. Une carte de coupe est glissée entre 70 et 80 % du sabot : quand elle sort, la donne se termine puis le dragon remélange (animation), et brûle les 5 premières cartes. Mise de 10 à 2 000 pièces.
- Le dragon tire jusqu'à 16 et reste sur tous les 17.
- Blackjack payé 3 pour 2 (arrondi à la pièce inférieure), victoire 1 pour 1, égalité remboursée.
- Doubler : sur toute main de deux cartes, y compris après une séparation.
- Séparer : deux cartes de même valeur, sans limite de mains. Deux as séparés reçoivent une seule carte chacun. Un 21 après séparation n'est pas un blackjack.
- Assurance : proposée quand le dragon montre un as, elle coûte la moitié de la mise et paie 2 pour 1.
- Si le dragon fait blackjack, il rafle toutes les mises, y compris doublées ou séparées. Seul un blackjack du joueur fait égalité.

## Organisation du code

Le HTML, le CSS et le JS sont séparés. Les scripts sont « classiques » (pas de modules ES) pour que le jeu s'ouvre d'un double-clic, sans serveur. Ils partagent un seul espace de noms global, `window.DragonJack`.

Three.js, la feuille de style de base, le dragon, les particules, le moteur d'animation, la grotte et le profil (trésor commun) sont dans `../../shared/` : voir le README du projet.

```
index.html              structure de la page et ordre de chargement des scripts
css/
  hud.css               interface de jeu : trésor, mise, actions, résultat
  overlays.css          écran d'accueil, règles, statistiques, paramètres
js/
  core/rules.js         règles pures du blackjack européen (testées)
  core/stats.js         statistiques du joueur (testées)
  core/game.js          déroulement d'une donne (mise → donne → assurance → mains du joueur → dragon → paiement)
  scene/textures.js     cartes, jetons et tapis dessinés dans des <canvas>
  scene/gold-rain.js    pluie d'or du blackjack
  scene/streak-effects.js sacre du joueur et vol du trésor (séries de 10)
  scene/environment.js  table en pierre et tapis, disposition du jeu
  scene/table-pieces.js cartes, jetons, sabot, défausse, mélange
  scene/stage.js        moteur de rendu, caméra adaptée à l'écran, boucle d'animation
  ui/audio.js           sons synthétisés (Web Audio), aucun fichier audio
  ui/hud.js             interface HTML par-dessus la scène
  main.js               assemble le tout et branche les commandes
tests/                  tests des règles et des statistiques
```

`game.js` ne dessine rien : il appelle une « vue » (définie dans `main.js`) dont chaque méthode renvoie une promesse. Chaque animation se termine donc avant l'étape suivante, et les règles restent testables sans navigateur.

## Tests

Avec Node.js 18 ou plus récent, depuis la racine du projet (`antre-du-dragon/`) :

```
npm test
```

## Accessibilité

- Toutes les actions sont des boutons, utilisables au clavier, avec un focus visible.
- Les cibles tactiles font au moins 44 px.
- Les résultats et les totaux sont du texte HTML annoncé aux lecteurs d'écran.
- Avec le réglage système « réduire les animations », les animations sont raccourcies, la caméra ne bouge plus et le souffle du dragon est plus discret.
