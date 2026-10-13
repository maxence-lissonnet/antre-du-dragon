# L'antre du dragon

Une salle de mini-jeux en 3D. Le dragon, couché sur sa montagne d'or, veille sur une rangée d'alcôves : une par jeu. Les pièces d'or sont imaginaires : aucun argent réel n'est en jeu.

| Jeu | Principe |
| --- | --- |
| Blackjack | Blackjack européen contre le dragon croupier (séparer, doubler, assurance). Seul, ou en ligne dans une salle publique de 6 joueurs au plus (sans bots) : chacun mise depuis son propre trésor. |
| Machine à sous | 3 rouleaux, 5 lignes, mise de 10 à 100, jackpot qui grossit ; on attrape le levier à la souris ou au doigt, on le tire et on le relâche. |
| Vol du trésor | Le dragon dort : chaque objet volé fait monter le butin et le risque de réveil. On s'enfuit quand on veut. |
| Memory des écailles | Duel contre le dragon, qui joue avec sa propre mémoire (meilleure en difficile). Chaque paire ratée coûte une vie ; plus de paires que lui double la mise. À plusieurs (2 à 4, bots et/ou amis en ligne) : sans mise ni vies, le plus de paires gagne. |
| Supaplex | Une seule porte : on choisit en entrant la version originale ou la version dragon. 8 niveaux d'initiation (une mécanique chacun) puis 6 grands circuits de 40 × 20 cases dans le style d'origine, tous créés pour l'antre. Chaque niveau réussi la première fois rapporte de l'or. |
| Mille Bornes | Règles françaises (106 cartes, attaques, parades, bottes et coups-fourrés), une manche à 1 000 bornes pour 2 à 4 joueurs, bots et/ou amis en ligne, sans mise. Une route fait le tour de la table avec une voiture par joueur ; chaque étiquette montre son feu, sa limitation, l'attaque subie et ses bottes. |

## Jouer

Ouvre `index.html` dans un navigateur récent (Chrome, Edge, Firefox ou Safari). Il n'y a rien à installer et pas de serveur à lancer.

- Survole une porte : elle s'illumine et le dragon la regarde. L'encadré du bas présente le jeu choisi ; ses flèches (ou celles du clavier) passent au jeu suivant. Clique sur la porte ou sur « Entrer ».
- Depuis un jeu, la flèche en haut à droite ramène à la salle.
- Le trésor et le dragon choisi (dans les paramètres du blackjack) sont communs à tous les jeux et gardés dans le navigateur.
- Une connexion internet sert à charger les polices, et au jeu en ligne.

### Jouer en ligne avec des amis

**Blackjack** : « Jouer en ligne » demande ton nom puis te place directement dans une salle publique (salle 1, salle 2…), sans code. Une salle accueille 6 joueurs ; quand elle est pleine, le suivant ouvre la salle d'après. Si tu arrives pendant une donne, tu joues à la suivante. Le premier arrivé fait tourner la salle ; s'il part, le plus ancien joueur restant prend le relais (la donne en cours est annulée et les mises sont rendues).

**Mille Bornes et memory** (« Jouer à plusieurs ») ont un salon :

- **Contre des bots** : 1 à 3 adversaires sur ton appareil, sans internet.
- **Créer une partie en ligne** : le jeu affiche un code de 6 caractères à donner à tes amis ; tu peux compléter avec des bots, puis lancer.
- **Rejoindre avec un code** : tape le code reçu.

Les appareils se parlent directement (WebRTC, via la bibliothèque PeerJS). La mise en relation passe par le serveur public gratuit de PeerJS (0.peerjs.com) ; quand deux réseaux ne peuvent pas se joindre directement, les messages de la partie transitent par un relais de PeerJS. Aucun compte n'est nécessaire. Celui qui crée la partie (l'hôte) la fait tourner : s'il ferme sa page, la partie s'arrête ; si un invité part, un bot prend sa place. Pour jouer à distance, le site doit être en ligne (par exemple sur GitHub Pages) ; sur un même ordinateur, deux onglets suffisent pour essayer.

## Organisation

```
index.html            la salle des jeux
css/salle.css         interface de la salle
js/
  games.js            catalogue des jeux (ajouter un jeu ici)
  alcoves.js          arches 3D et petit décor de chaque jeu (herse et cadenas pour un jeu à venir)
  hall.js             scène 3D de la salle : caméra, dragon, survol et entrée dans une alcôve
  main.js             plaques de jeux, trésor, liaison avec la scène
shared/               commun à la salle et à tous les jeux
  vendor/three.min.js Three.js r149 (bibliothèque 3D, licence MIT)
  vendor/peerjs.min.js PeerJS 1.5.4 (connexions entre navigateurs pour le jeu en ligne, licence MIT)
  css/base.css        couleurs, polices, espacements, boutons
  css/game-hud.css    interface commune des jeux : trésor, barre du bas, résultat, mises
  css/game-overlays.css fenêtres communes : règles, statistiques, paramètres, erreur
  css/lobby.css       salon des parties à plusieurs
  js/profile.js       trésor commun et dragon choisi
  js/boot.js          démarrage : vérification de la 3D, polices, message d'erreur
  js/hud-kit.js       briques d'interface : porte-monnaie, choix de mise, messages, raccourcis
  js/audio.js         sons synthétisés (Web Audio)
  js/tween.js         mini moteur d'animation
  js/stage.js         rendu 3D et caméra réglable
  js/particles.js     feu, fumée, braises, étincelles
  js/lair.js          grotte, collines d'or, braseros
  js/lair-scene.js    scène de jeu toute prête : grotte, lumières, dragon
  js/dragon.js        le dragon, ses 5 apparences et ses animations (dont dormir et se réveiller)
  js/gold-rain.js     pluie d'or des grands gains
  js/net.js           jeu en ligne : partie privée avec un code, ou salle publique numérotée ; échange des messages
  js/lobby.js         salon commun : bots, création et arrivée des joueurs, lancement de la partie
jeux/
  blackjack/          blackjack européen (voir son README) ; à plusieurs : core/table.js (règles multi-places),
                      scene/party-pieces.js (cartes de chaque place), party.js (salles publiques en ligne)
  machine-a-sous/     core/slots.js (règles), scene/machine.js et symbols.js (machine 3D)
  vol-du-tresor/      core/heist.js (règles), scene/loot.js (trésors 3D)
  memory-des-ecailles/ core/memory.js (règles et mémoire du dragon), scene/tiles.js (dalle et écailles 3D),
                      party.js (partie à plusieurs)
  supaplex/           core/engine.js (moteur tic par tic), core/levels.js (8 niveaux d'initiation + 6 grands circuits),
                      scene/board.js (plateau 3D), themes/classic.js et themes/dragon.js (les deux apparences)
  mille-bornes/       core/rules.js (règles françaises), core/bot.js (bots), scene/cards.js (dessin des cartes),
                      scene/table.js (table 3D), main.js (salon, tours, en ligne)
```

Les scripts sont « classiques » (pas de modules ES) pour que tout s'ouvre d'un double-clic, sans serveur. Ils partagent un espace de noms global, `window.DragonJack`.

### Ajouter un jeu

1. Créer son dossier dans `jeux/` en s'inspirant d'un jeu existant : `DragonJack.createLairScene` installe la grotte et le dragon, `DragonJack.hudKit.createWallet` gère le trésor commun.
2. Mettre ses règles dans un fichier pur (`js/core/…`) et ses tests dans `tests/`, puis les ajouter au script `test` de `package.json`.
3. Dans `js/games.js`, ajouter le jeu ; dans `js/alcoves.js`, ajouter son décor dans `DECORS`. La salle crée l'alcôve automatiquement.

## Tests

Avec Node.js 18 ou plus récent, depuis ce dossier :

```
npm test
```
