/*
 * Règles du vol du trésor : fonctions pures, sans affichage.
 * Chaque objet volé fait grimper le multiplicateur de la mise, mais le dragon peut se réveiller.
 * Les multiplicateurs sont calculés pour que le jeu rende en moyenne 96 % des mises, quelle que soit
 * la stratégie : plus on va loin, plus le gain est gros, mais aussi plus le risque cumulé est fort.
 */
(function (root) {
  'use strict';

  const BETS = [10, 25, 50, 100];
  // Chance que le dragon continue de dormir à chaque nouveau vol (le 1er, le 2e…).
  const SURVIVAL = [0.85, 0.85, 0.83, 0.8, 0.78, 0.75, 0.72, 0.7, 0.65, 0.6];
  const MAX_STEALS = SURVIVAL.length;
  const RETURN_RATE = 0.96;

  /* Multiplicateur de la mise après `stolen` vols réussis (×1 avant le premier vol). */
  function multiplier(stolen) {
    if (stolen === 0) return 1;
    const survived = SURVIVAL.slice(0, stolen).reduce((product, chance) => product * chance, 1);
    return Math.round((RETURN_RATE / survived) * 100) / 100;
  }

  /* Risque de réveil au prochain vol, en pourcentage arrondi (pour la jauge de sommeil). */
  function wakeRisk(stolen) {
    if (stolen >= MAX_STEALS) return 100;
    return Math.round((1 - SURVIVAL[stolen]) * 100);
  }

  /* `roll` est un nombre au hasard entre 0 et 1 : le vol réussit s'il tombe sous la chance de sommeil. */
  function attemptSteal(stolen, roll) {
    return stolen < MAX_STEALS && roll < SURVIVAL[stolen];
  }

  function payout(bet, stolen) {
    return Math.floor(bet * multiplier(stolen));
  }

  const api = { BETS, MAX_STEALS, multiplier, wakeRisk, attemptSteal, payout };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.DragonJack = root.DragonJack || {};
    root.DragonJack.heist = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
