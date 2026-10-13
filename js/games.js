/*
 * Catalogue des mini-jeux de l'antre. Pour ajouter un jeu : ajouter { id, name, tagline, href, available: true }
 * et prévoir le petit décor de son alcôve dans alcoves.js (DECORS, même `id`).
 */
(function (root) {
  'use strict';

  root.DragonJack = root.DragonJack || {};
  root.DragonJack.GAMES = [
    {
      id: 'blackjack',
      name: 'Blackjack',
      tagline: 'Approche-toi de 21 face au dragon croupier.',
      href: 'jeux/blackjack/index.html',
      available: true,
    },
    {
      id: 'machine-a-sous',
      name: 'Machine à sous',
      tagline: 'Aligne trois symboles, et trois dragons pour le jackpot.',
      href: 'jeux/machine-a-sous/index.html',
      available: true,
    },
    {
      id: 'vol-du-tresor',
      name: 'Vol du trésor',
      tagline: 'Dérobe ses trésors pendant qu’il dort, sans le réveiller.',
      href: 'jeux/vol-du-tresor/index.html',
      available: true,
    },
    {
      id: 'memory-des-ecailles',
      name: 'Memory des écailles',
      tagline: 'Affronte le dragon : trouve plus de paires que lui.',
      href: 'jeux/memory-des-ecailles/index.html',
      available: true,
    },
    {
      id: 'supaplex',
      name: 'Supaplex',
      tagline: 'Infotrons, zonks et ciseaux, en version originale ou version dragon.',
      href: 'jeux/supaplex/index.html',
      available: true,
    },
    {
      id: 'mille-bornes',
      name: 'Mille Bornes',
      tagline: 'Règle française, contre des bots ou entre amis en ligne.',
      href: 'jeux/mille-bornes/index.html',
      available: true,
    },
  ];
})(window);
