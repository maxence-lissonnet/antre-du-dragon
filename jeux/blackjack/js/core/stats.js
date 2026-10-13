/*
 * Statistiques du joueur : calculs purs (testés) et sauvegarde dans le navigateur.
 */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'blackjack-dragon.stats';
  const WINNING_OUTCOMES = ['win', 'dealerBust', 'blackjack'];
  // Une animation spéciale salue chaque dizaine de donnes gagnées ou perdues d'affilée.
  const STREAK_MILESTONE = 10;

  function createStats() {
    return {
      handsPlayed: 0,
      handsWon: 0,
      handsLost: 0,
      handsPushed: 0,
      blackjacks: 0,
      biggestWin: 0,
      currentStreak: 0,
      bestStreak: 0,
      currentLossStreak: 0,
      highestBalance: 0,
    };
  }

  /*
   * Ajoute une donne terminée. `outcomes` contient le résultat de chaque main
   * (plusieurs après une séparation), `net` le gain ou la perte de la donne.
   * Une égalité ne casse pas une série de victoires.
   */
  function recordRound(stats, { outcomes, net, balance }) {
    const next = { ...stats };
    outcomes.forEach((outcome) => {
      next.handsPlayed += 1;
      if (WINNING_OUTCOMES.includes(outcome)) next.handsWon += 1;
      else if (outcome === 'push') next.handsPushed += 1;
      else next.handsLost += 1;
      if (outcome === 'blackjack') next.blackjacks += 1;
    });
    next.biggestWin = Math.max(stats.biggestWin, net);
    if (net > 0) {
      next.currentStreak = stats.currentStreak + 1;
      next.currentLossStreak = 0;
    } else if (net < 0) {
      next.currentStreak = 0;
      next.currentLossStreak = stats.currentLossStreak + 1;
    }
    next.bestStreak = Math.max(stats.bestStreak, next.currentStreak);
    next.highestBalance = Math.max(stats.highestBalance, balance);
    return next;
  }

  /*
   * Palier de série franchi par la dernière donne : { kind: 'win' | 'loss', count } ou null.
   * Une égalité ne fait pas avancer la série, donc ne déclenche rien.
   */
  function streakMilestone(previous, next) {
    if (next.currentStreak > previous.currentStreak && next.currentStreak % STREAK_MILESTONE === 0) {
      return { kind: 'win', count: next.currentStreak };
    }
    if (next.currentLossStreak > previous.currentLossStreak && next.currentLossStreak % STREAK_MILESTONE === 0) {
      return { kind: 'loss', count: next.currentLossStreak };
    }
    return null;
  }

  /* Pourcentage de mains gagnées, ou null avant la première main. */
  function winRate(stats) {
    return stats.handsPlayed === 0 ? null : Math.round((stats.handsWon / stats.handsPlayed) * 100);
  }

  function load() {
    try {
      const saved = JSON.parse(root.localStorage.getItem(STORAGE_KEY));
      return saved ? { ...createStats(), ...saved } : createStats();
    } catch (error) {
      return createStats();
    }
  }

  function save(stats) {
    try {
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (error) {
      // Navigation privée : les statistiques ne seront pas retenues.
    }
  }

  const api = { createStats, recordRound, streakMilestone, winRate, load, save };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.DragonJack.stats = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
