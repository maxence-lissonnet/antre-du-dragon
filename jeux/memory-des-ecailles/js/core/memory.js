/*
 * Règles du memory des écailles en duel contre le dragon : fonctions pures, sans affichage.
 * Chacun son tour retourne deux écailles ; une paire trouvée rapporte un point et fait rejouer.
 * Chaque paire ratée coûte une vie au joueur. Avec plus de paires que le dragon (et au moins une vie),
 * le joueur double sa mise ; à égalité, elle lui est rendue.
 */
(function (root) {
  'use strict';

  const BETS = [10, 25, 50, 100];
  // `dragonMemory` : chance que le dragon retienne une écaille qu'il a vue retournée.
  const LEVELS = {
    easy: { label: 'Facile', columns: 4, rows: 4, lives: 3, dragonMemory: 0.35 },
    medium: { label: 'Moyen', columns: 6, rows: 4, lives: 4, dragonMemory: 0.6 },
    hard: { label: 'Difficile', columns: 6, rows: 6, lives: 5, dragonMemory: 0.9 },
  };
  const WIN_MULTIPLIER = 2;

  function randomFraction() {
    const cryptoApi = root.crypto || (typeof globalThis !== 'undefined' ? globalThis.crypto : null);
    if (cryptoApi && cryptoApi.getRandomValues) {
      const buffer = new Uint32Array(1);
      cryptoApi.getRandomValues(buffer);
      return buffer[0] / 2 ** 32;
    }
    return Math.random();
  }

  const randomIndex = (max, random = randomFraction) => Math.floor(random() * max);

  function pairCount(levelKey) {
    const { columns, rows } = LEVELS[levelKey];
    return (columns * rows) / 2;
  }

  /* Plateau mélangé : chaque motif (numéroté de 0 à paires - 1) apparaît deux fois. */
  function createBoard(levelKey, random = randomFraction) {
    const board = [];
    for (let symbol = 0; symbol < pairCount(levelKey); symbol += 1) board.push(symbol, symbol);
    for (let i = board.length - 1; i > 0; i -= 1) {
      const j = randomIndex(i + 1, random);
      [board[i], board[j]] = [board[j], board[i]];
    }
    return board;
  }

  /* Résultat de la partie : 'lose' sans vie restante, sinon selon le nombre de paires. */
  function outcome(playerPairs, dragonPairs, livesLeft) {
    if (livesLeft <= 0 || playerPairs < dragonPairs) return 'lose';
    return playerPairs > dragonPairs ? 'win' : 'draw';
  }

  /* Somme rendue au joueur, mise comprise. */
  function payout(bet, result) {
    if (result === 'win') return bet * WIN_MULTIPLIER;
    return result === 'draw' ? bet : 0;
  }

  /*
   * Mémoire du dragon : une Map « position → motif ». Il ne retient une écaille vue
   * qu'avec la probabilité `strength` ; il oublie les écailles déjà appariées.
   */
  function observe(memory, index, symbol, strength, random = randomFraction) {
    if (random() < strength) memory.set(index, symbol);
  }

  function forget(memory, indices) {
    indices.forEach((index) => memory.delete(index));
  }

  function pick(candidates, random) {
    return candidates[randomIndex(candidates.length, random)];
  }

  /* Première écaille du dragon : une paire qu'il connaît, sinon une écaille qu'il n'a jamais vue. */
  function chooseFirst(memory, available, random = randomFraction) {
    const bySymbol = new Map();
    for (const [index, symbol] of memory) {
      if (!available.includes(index)) continue;
      if (bySymbol.has(symbol)) return bySymbol.get(symbol);
      bySymbol.set(symbol, index);
    }
    const unknown = available.filter((index) => !memory.has(index));
    return pick(unknown.length > 0 ? unknown : available, random);
  }

  /* Seconde écaille : celle qu'il se rappelle avoir le même motif, sinon une inconnue. */
  function chooseSecond(memory, available, first, firstSymbol, random = randomFraction) {
    const others = available.filter((index) => index !== first);
    const remembered = others.find((index) => memory.get(index) === firstSymbol);
    if (remembered !== undefined) return remembered;
    const unknown = others.filter((index) => !memory.has(index));
    return pick(unknown.length > 0 ? unknown : others, random);
  }

  const api = { BETS, LEVELS, WIN_MULTIPLIER, pairCount, createBoard, outcome, payout, observe, forget, chooseFirst, chooseSecond };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.DragonJack = root.DragonJack || {};
    root.DragonJack.memory = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
