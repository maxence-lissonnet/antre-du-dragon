/*
 * Règles de la machine à sous du trésor : fonctions pures, sans affichage.
 * 3 rouleaux, 3 rangées visibles, 5 lignes gagnantes. Trois symboles identiques sur une ligne gagnent.
 */
(function (root) {
  'use strict';

  const SYMBOLS = ['coin', 'egg', 'sword', 'chalice', 'crown', 'dragon'];
  // Nombre d'exemplaires de chaque symbole sur un rouleau de 20 cases : plus il est rare, plus il paie.
  const REEL_COUNTS = { coin: 6, egg: 5, sword: 4, chalice: 2, crown: 2, dragon: 1 };
  // Gain pour trois symboles alignés, en multiple de la mise par ligne.
  const PAYOUTS = { coin: 10, egg: 15, sword: 25, chalice: 60, crown: 80, dragon: 200 };
  const REEL_COUNT = 3;
  const ROW_COUNT = 3;
  // Chaque ligne donne la rangée regardée sur chacun des 3 rouleaux (0 = haut, 2 = bas).
  const LINES = [
    [1, 1, 1],
    [0, 0, 0],
    [2, 2, 2],
    [0, 1, 2],
    [2, 1, 0],
  ];
  const BETS = [10, 25, 50, 100];
  const MAX_BET = BETS[BETS.length - 1];
  const JACKPOT_SEED = 2000;
  // Part de chaque mise versée au jackpot.
  const JACKPOT_SHARE = 0.02;

  function randomIndex(max) {
    const cryptoApi = root.crypto || (typeof globalThis !== 'undefined' ? globalThis.crypto : null);
    if (cryptoApi && cryptoApi.getRandomValues) {
      const buffer = new Uint32Array(1);
      cryptoApi.getRandomValues(buffer);
      return buffer[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function shuffle(items, pickIndex) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = pickIndex(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function createStrips(pickIndex = randomIndex) {
    const strip = SYMBOLS.flatMap((symbol) => Array(REEL_COUNTS[symbol]).fill(symbol));
    return Array.from({ length: REEL_COUNT }, () => shuffle(strip, pickIndex));
  }

  /* Position d'arrêt de chaque rouleau : la case affichée sur la rangée du milieu. */
  function spin(strips, pickIndex = randomIndex) {
    return strips.map((strip) => pickIndex(strip.length));
  }

  /* Grille visible : grid[rangée][rouleau]. */
  function visibleGrid(strips, stops) {
    return Array.from({ length: ROW_COUNT }, (_, row) =>
      strips.map((strip, reel) => strip[(stops[reel] + row - 1 + strip.length) % strip.length]),
    );
  }

  function lineBet(bet) {
    return bet / LINES.length;
  }

  /*
   * Gains d'un tour. Trois dragons à la mise maximale remportent le jackpot (une seule fois par tour) ;
   * à une mise plus faible, ils paient comme un symbole normal.
   */
  function evaluate(grid, bet, jackpot) {
    const wins = [];
    let jackpotWon = false;
    LINES.forEach((line, lineIndex) => {
      const symbols = line.map((row, reel) => grid[row][reel]);
      if (!symbols.every((symbol) => symbol === symbols[0])) return;
      const symbol = symbols[0];
      if (symbol === 'dragon' && bet === MAX_BET && !jackpotWon) {
        jackpotWon = true;
        wins.push({ lineIndex, symbol, amount: Math.floor(jackpot), jackpot: true });
        return;
      }
      wins.push({ lineIndex, symbol, amount: PAYOUTS[symbol] * lineBet(bet), jackpot: false });
    });
    return { wins, total: wins.reduce((sum, win) => sum + win.amount, 0), jackpotWon };
  }

  function jackpotAfterBet(jackpot, bet) {
    return jackpot + bet * JACKPOT_SHARE;
  }

  /* Part de la mise rendue en moyenne, hors jackpot (calcul exact à partir des rouleaux). */
  function expectedReturn() {
    const stripLength = SYMBOLS.reduce((sum, symbol) => sum + REEL_COUNTS[symbol], 0);
    return SYMBOLS.reduce((sum, symbol) => sum + Math.pow(REEL_COUNTS[symbol] / stripLength, REEL_COUNT) * PAYOUTS[symbol], 0);
  }

  const api = {
    SYMBOLS,
    PAYOUTS,
    LINES,
    BETS,
    MAX_BET,
    JACKPOT_SEED,
    createStrips,
    spin,
    visibleGrid,
    lineBet,
    evaluate,
    jackpotAfterBet,
    expectedReturn,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.DragonJack = root.DragonJack || {};
    root.DragonJack.slots = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
