/*
 * Table de blackjack européen à plusieurs places (2 à 4) face au dragon croupier : fonctions pures.
 * Chaque place mise, reçoit deux cartes, le dragon une seule ; puis chaque place joue à son tour
 * (tirer, rester, doubler, séparer), le dragon tire ensuite sa seconde carte et jusqu'à 17.
 * Les règles de calcul (valeur des mains, paiements) viennent de rules.js.
 * Utilisable dans le navigateur (DragonJack.table) et dans Node (tests).
 */
(function (root) {
  'use strict';

  const rules = typeof module !== 'undefined' && module.exports ? require('./rules.js') : root.DragonJack.rules;

  const MIN_BET = 10;
  const MAX_BET = 2000;
  const BETS = [10, 25, 50, 100, 250, 500];
  // Sous ce nombre de cartes, le dragon reprend un sabot neuf avant la donne.
  const RESHUFFLE_BELOW = 104;

  const sum = (values) => values.reduce((total, value) => total + value, 0);
  const totalOf = (hand) => rules.handValue(hand.cards).total;
  const isNatural = (hand) => !hand.fromSplit && rules.isBlackjack(hand.cards);

  function draw(state) {
    if (state.shoe.length === 0) state.shoe = rules.createShoe();
    return state.shoe.pop();
  }

  /*
   * Ouvre une donne. `players` : [{ bet, bankroll }] où `bankroll` est ce qu'il reste au joueur
   * une fois sa mise posée (pour savoir s'il peut encore doubler, séparer ou s'assurer).
   */
  function startRound(players, shoe) {
    const state = {
      shoe: shoe && shoe.length >= RESHUFFLE_BELOW ? shoe : rules.createShoe(),
      phase: 'deal',
      dealer: [],
      turn: -1,
      seats: players.map(({ bet, bankroll }) => ({
        bankroll,
        insurance: 0,
        insuranceAnswered: false,
        hands: [{ cards: [], bet, fromSplit: false, splitAces: false }],
        active: 0,
        done: false,
        result: null,
      })),
    };
    state.seats.forEach((seat) => seat.hands[0].cards.push(draw(state)));
    state.dealer.push(draw(state));
    state.seats.forEach((seat) => seat.hands[0].cards.push(draw(state)));

    if (state.dealer[0].rank === 'A') {
      state.seats.forEach((seat) => {
        const cost = rules.insuranceCost(seat.hands[0].bet);
        seat.insuranceAnswered = isNatural(seat.hands[0]) || cost === 0 || seat.bankroll < cost;
      });
      if (state.seats.some((seat) => !seat.insuranceAnswered)) {
        state.phase = 'insurance';
        return state;
      }
    }
    beginPlay(state);
    return state;
  }

  function beginPlay(state) {
    state.phase = 'play';
    state.turn = -1;
    nextSeat(state);
  }

  /* Passe à la place suivante qui a quelque chose à décider (un blackjack ou un 21 n'a rien à jouer). */
  function nextSeat(state) {
    for (let index = state.turn + 1; index < state.seats.length; index += 1) {
      const seat = state.seats[index];
      seat.active = 0;
      if (totalOf(seat.hands[0]) < 21) {
        state.turn = index;
        return;
      }
      seat.done = true;
    }
    state.turn = -1;
    state.phase = 'dealer';
  }

  /*
   * Main suivante de la place en cours. Une main issue d'une séparation reçoit d'abord sa seconde carte ;
   * les as séparés et les mains à 21 sont terminés d'office.
   */
  function advanceHand(state) {
    const seat = state.seats[state.turn];
    seat.active += 1;
    while (seat.active < seat.hands.length) {
      const hand = seat.hands[seat.active];
      if (hand.cards.length === 1) hand.cards.push(draw(state));
      if (!hand.splitAces && totalOf(hand) < 21) return;
      seat.active += 1;
    }
    seat.done = true;
    nextSeat(state);
  }

  function insuranceCostFor(state, seatIndex) {
    return rules.insuranceCost(state.seats[seatIndex].hands[0].bet);
  }

  /* Ce que la place peut faire maintenant. */
  function legalActions(state, seatIndex) {
    const seat = state.seats[seatIndex];
    if (!seat) return [];
    if (state.phase === 'insurance') return seat.insuranceAnswered ? [] : ['insurance', 'noInsurance'];
    if (state.phase !== 'play' || state.turn !== seatIndex) return [];
    const hand = seat.hands[seat.active];
    const actions = ['hit', 'stand'];
    if (rules.canDouble(hand.cards, seat.bankroll, hand.bet)) actions.push('double');
    if (rules.canSplit(hand.cards, seat.bankroll, hand.bet)) actions.push('split');
    return actions;
  }

  function act(state, seatIndex, action) {
    if (!legalActions(state, seatIndex).includes(action)) throw new Error('Action interdite');
    const seat = state.seats[seatIndex];
    if (action === 'insurance' || action === 'noInsurance') {
      if (action === 'insurance') {
        seat.insurance = insuranceCostFor(state, seatIndex);
        seat.bankroll -= seat.insurance;
      }
      seat.insuranceAnswered = true;
      if (state.seats.every((other) => other.insuranceAnswered)) beginPlay(state);
      return state;
    }
    const hand = seat.hands[seat.active];
    if (action === 'hit') {
      hand.cards.push(draw(state));
      if (totalOf(hand) >= 21) advanceHand(state);
    } else if (action === 'stand') {
      advanceHand(state);
    } else if (action === 'double') {
      seat.bankroll -= hand.bet;
      hand.bet *= 2;
      hand.doubled = true;
      hand.cards.push(draw(state));
      advanceHand(state);
    } else if (action === 'split') {
      seat.bankroll -= hand.bet;
      const splitAces = hand.cards[0].rank === 'A';
      const newHand = { cards: [hand.cards.pop()], bet: hand.bet, fromSplit: true, splitAces };
      hand.fromSplit = true;
      hand.splitAces = splitAces;
      seat.hands.splice(seat.active + 1, 0, newHand);
      hand.cards.push(draw(state));
      if (splitAces || totalOf(hand) >= 21) advanceHand(state);
    }
    return state;
  }

  /*
   * Une étape du dragon : sa seconde carte, puis une carte tant qu'il est sous 17
   * (seulement si une main peut encore gagner contre lui). Renvoie false quand il a fini.
   */
  function dealerStep(state) {
    if (state.phase !== 'dealer') return false;
    if (state.dealer.length < 2) {
      state.dealer.push(draw(state));
      return true;
    }
    const live = state.seats.some((seat) => seat.hands.some((hand) => !rules.isBust(hand.cards) && !isNatural(hand)));
    if (live && !rules.isBlackjack(state.dealer) && rules.dealerShouldHit(state.dealer)) {
      state.dealer.push(draw(state));
      return true;
    }
    settleRound(state);
    return false;
  }

  /* Paiement de chaque place : `net` est le gain (ou la perte) de la donne, toutes mises comprises. */
  function settleRound(state) {
    state.seats.forEach((seat) => {
      const hands = seat.hands.map((hand) => rules.settle(hand.cards, state.dealer, hand.bet, { fromSplit: hand.fromSplit }));
      const insuranceReturned = rules.settleInsurance(seat.insurance, state.dealer);
      const staked = sum(seat.hands.map((hand) => hand.bet)) + seat.insurance;
      const returned = sum(hands.map((hand) => hand.returned)) + insuranceReturned;
      seat.result = { outcomes: hands.map((hand) => hand.outcome), net: returned - staked, insuranceWon: insuranceReturned > 0 };
    });
    state.phase = 'done';
  }

  /* Total misé en ce moment par une place (mises, doubles, séparations et assurance). */
  function staked(seat) {
    return sum(seat.hands.map((hand) => hand.bet)) + seat.insurance;
  }

  /* Bot : stratégie de base simplifiée, sans assurance. */
  function botAction(state, seatIndex) {
    const legal = legalActions(state, seatIndex);
    if (legal.includes('noInsurance')) return 'noInsurance';
    const seat = state.seats[seatIndex];
    const hand = seat.hands[seat.active];
    const { total, soft } = rules.handValue(hand.cards);
    const up = rules.handValue([state.dealer[0]]).total;
    if (legal.includes('split')) {
      const rank = rules.handValue([hand.cards[0]]).total;
      if (rank === 11 || rank === 8 || ([2, 3, 6, 7, 9].includes(rank) && up >= 2 && up <= 7)) return 'split';
    }
    if (legal.includes('double') && !soft && (total === 11 || (total === 10 && up < 10) || (total === 9 && up >= 3 && up <= 6))) return 'double';
    if (soft) return total <= 17 || (total === 18 && up >= 9) ? 'hit' : 'stand';
    if (total <= 11) return 'hit';
    if (total === 12) return up >= 4 && up <= 6 ? 'stand' : 'hit';
    if (total <= 16) return up >= 7 ? 'hit' : 'stand';
    return 'stand';
  }

  const api = { MIN_BET, MAX_BET, BETS, startRound, legalActions, act, dealerStep, staked, botAction, insuranceCostFor };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.DragonJack.table = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
