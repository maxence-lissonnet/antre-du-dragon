/*
 * Règles du blackjack européen : fonctions pures, sans aucun affichage.
 * Le croupier ne reçoit qu'une carte visible au départ et tire la seconde après le joueur.
 * Utilisable dans le navigateur (DragonJack.rules) et dans Node (tests).
 */
(function (root) {
  'use strict';

  const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  const DECK_COUNT = 8;
  // La carte de coupe est glissée entre 70 % et 80 % du sabot : il reste alors 20 à 30 % des cartes.
  const CUT_CARD_MIN_REMAINING = 0.2;
  const CUT_CARD_SPREAD = 0.1;
  const BURN_COUNT = 5;
  const BLACKJACK = 21;
  const DEALER_STANDS_ON = 17;
  const BLACKJACK_PAYOUT = 1.5;
  const INSURANCE_PAYOUT = 2;

  function randomIndex(max) {
    const cryptoApi = root.crypto || (typeof globalThis !== 'undefined' ? globalThis.crypto : null);
    if (cryptoApi && cryptoApi.getRandomValues) {
      const buffer = new Uint32Array(1);
      cryptoApi.getRandomValues(buffer);
      return buffer[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function shuffle(cards, pickIndex = randomIndex) {
    const result = cards.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = pickIndex(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function createShoe(deckCount = DECK_COUNT, pickIndex = randomIndex) {
    const cards = [];
    for (let deck = 0; deck < deckCount; deck += 1) {
      SUITS.forEach((suit) => {
        RANKS.forEach((rank) => cards.push({ rank, suit }));
      });
    }
    return shuffle(cards, pickIndex);
  }

  /* Nombre de cartes restant dans le sabot au moment où la carte de coupe sort. */
  function cutCardRemaining(shoeSize, pickIndex = randomIndex) {
    const spread = pickIndex(1000) / 1000;
    return Math.round(shoeSize * (CUT_CARD_MIN_REMAINING + spread * CUT_CARD_SPREAD));
  }

  function cardPoints(card) {
    if (card.rank === 'A') return 1;
    if (['J', 'Q', 'K'].includes(card.rank)) return 10;
    return Number(card.rank);
  }

  /* Un as vaut 11 tant que la main ne dépasse pas 21 : la main est alors « souple ». */
  function handValue(cards) {
    let total = 0;
    let hasAce = false;
    cards.forEach((card) => {
      total += cardPoints(card);
      if (card.rank === 'A') hasAce = true;
    });
    const soft = hasAce && total + 10 <= BLACKJACK;
    return { total: soft ? total + 10 : total, soft };
  }

  function isBlackjack(cards) {
    return cards.length === 2 && handValue(cards).total === BLACKJACK;
  }

  function isBust(cards) {
    return handValue(cards).total > BLACKJACK;
  }

  // Le croupier tire jusqu'à 17 et reste sur tous les 17, même souples.
  function dealerShouldHit(cards) {
    return handValue(cards).total < DEALER_STANDS_ON;
  }

  function canDouble(playerCards, balance, bet) {
    return playerCards.length === 2 && balance >= bet;
  }

  // Deux cartes de même valeur (un roi et une dame se séparent aussi), sans limite de mains.
  function canSplit(playerCards, balance, bet) {
    return playerCards.length === 2 && cardPoints(playerCards[0]) === cardPoints(playerCards[1]) && balance >= bet;
  }

  function insuranceCost(bet) {
    return Math.floor(bet / 2);
  }

  /* Somme rendue par l'assurance : la mise d'assurance plus un gain de 2 pour 1 si le dragon a un blackjack. */
  function settleInsurance(cost, dealerCards) {
    return isBlackjack(dealerCards) ? cost * (1 + INSURANCE_PAYOUT) : 0;
  }

  /*
   * Renvoie le résultat de la main et la somme rendue au joueur
   * (mise comprise). `bet` est la mise totale, déjà doublée si besoin.
   * Après une séparation, un 21 en deux cartes n'est pas un blackjack.
   * Règle européenne : un blackjack du croupier rafle toute la mise, suppléments compris.
   */
  function settle(playerCards, dealerCards, bet, { fromSplit = false } = {}) {
    const player = handValue(playerCards).total;
    const dealer = handValue(dealerCards).total;
    const playerBlackjack = !fromSplit && isBlackjack(playerCards);
    const dealerBlackjack = isBlackjack(dealerCards);

    if (player > BLACKJACK) return { outcome: 'bust', returned: 0 };
    if (playerBlackjack && dealerBlackjack) return { outcome: 'push', returned: bet };
    if (playerBlackjack) return { outcome: 'blackjack', returned: bet + Math.floor(bet * BLACKJACK_PAYOUT) };
    if (dealerBlackjack) return { outcome: 'lose', returned: 0 };
    if (dealer > BLACKJACK) return { outcome: 'dealerBust', returned: bet * 2 };
    if (player > dealer) return { outcome: 'win', returned: bet * 2 };
    if (player === dealer) return { outcome: 'push', returned: bet };
    return { outcome: 'lose', returned: 0 };
  }

  const api = {
    SUITS,
    RANKS,
    DECK_COUNT,
    BURN_COUNT,
    createShoe,
    shuffle,
    cutCardRemaining,
    handValue,
    isBlackjack,
    isBust,
    dealerShouldHit,
    canDouble,
    canSplit,
    insuranceCost,
    settleInsurance,
    settle,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.DragonJack = root.DragonJack || {};
    root.DragonJack.rules = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
