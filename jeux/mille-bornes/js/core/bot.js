/*
 * Stratégie des bots du Mille Bornes (fonctions pures). Dans l'ordre de préférence :
 * finir pile à 1000, réparer, repartir, lever la limitation, attaquer le joueur le plus avancé,
 * avancer le plus loin possible, poser une botte, sinon défausser la carte la moins utile.
 * Un bot répond toujours par un coup-fourré quand il le peut.
 */
(function (root) {
  'use strict';

  const rules = typeof module !== 'undefined' && module.exports ? require('./rules.js') : root.DragonJack.milleBornes;

  function cardOf(player, cardId) {
    return player.hand.find((card) => card.id === cardId);
  }

  /* Intérêt de garder une carte : plus il est bas, plus on la défausse volontiers. */
  function keepValue(player, card) {
    if (card.kind === 'safety') return 1000;
    if (card.kind === 'distance') {
      if (player.km + card.value > rules.GOAL) return 0;
      if (card.type === 'km200' && player.distance.filter((c) => c.type === 'km200').length >= 2) return 0;
      return card.value / 4;
    }
    if (card.kind === 'remedy') {
      const coveredBy = Object.entries(rules.REMEDY_FOR).find(([, remedy]) => remedy === card.type);
      const hazard = coveredBy && coveredBy[0];
      if (hazard && player.safeties.some((entry) => entry.card.type === rules.SAFETY_FOR[hazard])) return 1;
      return card.type === 'greenLight' ? 45 : 35;
    }
    return 25;
  }

  function chooseMove(state, playerIndex = state.turn) {
    const player = state.players[playerIndex];
    const moves = rules.legalMoves(state, playerIndex);
    const plays = moves.filter((move) => move.action === 'play');
    const card = (move) => cardOf(player, move.cardId);
    const of = (predicate) => plays.filter((move) => predicate(card(move), move));

    const finish = of((c) => c.kind === 'distance' && player.km + c.value === rules.GOAL);
    if (finish.length) return finish[0];

    const repairs = of((c) => c.kind === 'remedy' && c.type !== 'greenLight' && c.type !== 'endOfLimit');
    if (repairs.length) return repairs[0];

    const green = of((c) => c.type === 'greenLight');
    if (green.length) return green[0];

    const hasFastCards = player.hand.some((c) => c.kind === 'distance' && c.value > 50);
    const endLimit = of((c) => c.type === 'endOfLimit');
    if (endLimit.length && hasFastCards) return endLimit[0];

    const attacks = of((c) => c.kind === 'hazard');
    if (attacks.length) {
      // On vise le joueur le plus avancé.
      attacks.sort((a, b) => state.players[b.target].km - state.players[a.target].km);
      return attacks[0];
    }

    const drives = of((c) => c.kind === 'distance');
    if (drives.length) {
      drives.sort((a, b) => card(b).value - card(a).value);
      return drives[0];
    }

    const safeties = of((c) => c.kind === 'safety');
    // On garde volontiers une botte pour un coup-fourré, sauf si la main est pleine de cartes inutiles.
    const usefulCards = player.hand.filter((c) => keepValue(player, c) > 20).length;
    if (safeties.length && usefulCards >= player.hand.length - 1) return safeties[0];

    const discards = moves.filter((move) => move.action === 'discard' && card(move).kind !== 'safety');
    if (discards.length) {
      discards.sort((a, b) => keepValue(player, card(a)) - keepValue(player, card(b)));
      return discards[0];
    }
    return safeties[0] || moves[0];
  }

  const api = { chooseMove, wantsCoupFourre: () => true };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.DragonJack.milleBornesBot = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
