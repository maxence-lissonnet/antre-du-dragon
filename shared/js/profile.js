/*
 * Profil du joueur, commun à tous les jeux de l'antre : trésor (pièces d'or) et dragon choisi.
 * Tout est gardé dans le navigateur ; les anciennes sauvegardes du blackjack sont reprises.
 */
(function (root) {
  'use strict';

  const STARTING_TREASURE = 1000;
  const KEYS = { treasure: 'antre-du-dragon.tresor', dragon: 'antre-du-dragon.dragon' };
  // Clés utilisées avant la création de la salle des jeux, quand le blackjack était seul.
  const LEGACY_KEYS = { treasure: 'blackjack-dragon.balance', dragon: 'blackjack-dragon.dragon' };

  function read(name) {
    try {
      const value = root.localStorage.getItem(KEYS[name]);
      return value !== null ? value : root.localStorage.getItem(LEGACY_KEYS[name]);
    } catch (error) {
      return null;
    }
  }

  function write(name, value) {
    try {
      root.localStorage.setItem(KEYS[name], String(value));
    } catch (error) {
      // Navigation privée : la sauvegarde n'est simplement pas retenue.
    }
  }

  function loadTreasure() {
    const saved = Number(read('treasure'));
    return Number.isFinite(saved) && saved > 0 ? saved : STARTING_TREASURE;
  }

  root.DragonJack = root.DragonJack || {};
  root.DragonJack.profile = {
    STARTING_TREASURE,
    loadTreasure,
    saveTreasure: (amount) => write('treasure', amount),
    loadDragon: () => read('dragon'),
    saveDragon: (name) => write('dragon', name),
  };
})(window);
