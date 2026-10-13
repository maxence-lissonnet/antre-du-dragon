/*
 * Déroulement d'une donne de blackjack européen :
 * mise → deux cartes au joueur, une seule au dragon → assurance éventuelle → tour du joueur
 * (une ou plusieurs mains) → le dragon tire sa seconde carte puis jusqu'à 17 → paiement.
 * Le jeu ne dessine rien : il appelle une « vue » (scène 3D + interface) qui renvoie des promesses
 * pour que chaque animation se termine avant l'étape suivante.
 */
(function (root) {
  'use strict';

  const rules = root.DragonJack.rules;
  const statsApi = root.DragonJack.stats;

  const profile = root.DragonJack.profile;
  const MIN_BET = 10;
  const MAX_BET = 2000;

  const sum = (values) => values.reduce((total, value) => total + value, 0);

  function createHand(chips, fromSplit = false, splitAces = false) {
    return { cards: [], chips, fromSplit, splitAces };
  }

  function createGame(view) {
    const state = {
      phase: 'betting',
      balance: profile.loadTreasure(),
      betChips: [],
      lastBetChips: [],
      shoe: [],
      cutCardRemaining: 0,
      cutCardOut: false,
      hands: [],
      activeHand: 0,
      dealerCards: [],
      insurance: 0,
      busy: false,
      stats: statsApi.load(),
    };

    const handBet = (hand) => sum(hand.chips);
    const activeHand = () => (state.phase === 'player' ? state.hands[state.activeHand] : null);
    const totalOf = (hand) => rules.handValue(hand.cards).total;

    function stakedAmount() {
      if (state.phase === 'betting') return sum(state.betChips);
      return sum(state.hands.map(handBet)) + state.insurance;
    }

    function snapshot() {
      const hand = activeHand();
      const bet = stakedAmount();
      return {
        phase: state.phase,
        balance: state.balance,
        bet,
        busy: state.busy,
        canDeal: bet >= MIN_BET,
        canRebet: state.lastBetChips.length > 0,
        canDouble: Boolean(hand) && rules.canDouble(hand.cards, state.balance, handBet(hand)),
        canSplit: Boolean(hand) && rules.canSplit(hand.cards, state.balance, handBet(hand)),
        insuranceCost: state.phase === 'insurance' ? rules.insuranceCost(handBet(state.hands[0])) : 0,
        isBroke: state.phase === 'betting' && bet === 0 && state.balance < MIN_BET,
        minBet: MIN_BET,
        maxBet: MAX_BET,
      };
    }

    const refresh = () => view.render(snapshot());

    /* Empêche deux actions de se chevaucher pendant qu'une animation tourne. */
    async function exclusive(task) {
      if (state.busy) return;
      state.busy = true;
      refresh();
      try {
        await task();
      } finally {
        state.busy = false;
        refresh();
      }
    }

    /* Le sabot vide n'arrive jamais en pratique (la carte de coupe sort avant), mais on reste prudent. */
    function drawCard() {
      if (state.shoe.length === 0) state.shoe = rules.createShoe();
      const card = state.shoe.pop();
      view.shoeChanged(state.shoe.length);
      if (!state.cutCardOut && state.shoe.length <= state.cutCardRemaining) {
        state.cutCardOut = true;
        view.cutCardOut();
        view.notify('La carte de coupe est sortie : le dragon mélangera après cette donne.');
      }
      return card;
    }

    /* Nouveau sabot de 8 jeux : mélange, carte de coupe, puis 5 cartes brûlées. */
    async function shuffleShoe() {
      state.shoe = rules.createShoe();
      state.cutCardRemaining = rules.cutCardRemaining(state.shoe.length);
      state.cutCardOut = false;
      view.notify('Le dragon mélange les 8 jeux du sabot.');
      await view.shuffleShoe(state.shoe.length, state.cutCardRemaining);
      const burned = state.shoe.splice(-rules.BURN_COUNT);
      await view.burnCards(burned.length);
      view.shoeChanged(state.shoe.length);
    }

    function showTotals(outcomes = []) {
      const highlightActive = state.phase === 'player' && state.hands.length > 1;
      view.showTotals({
        hands: state.hands.map((hand, index) => ({
          value: hand.cards.length > 0 ? rules.handValue(hand.cards) : null,
          active: highlightActive && index === state.activeHand,
          outcome: outcomes[index] || null,
        })),
        dealer: state.dealerCards.length > 0 ? rules.handValue(state.dealerCards) : null,
      });
    }

    async function dealToPlayer(handIndex) {
      const card = drawCard();
      state.hands[handIndex].cards.push(card);
      await view.dealCard(card, 'player', handIndex);
      showTotals();
    }

    async function dealToDealer() {
      const card = drawCard();
      state.dealerCards.push(card);
      await view.dealCard(card, 'dealer', 0);
      showTotals();
    }

    function addChip(value) {
      if (state.phase !== 'betting' || state.busy) return;
      if (value > state.balance || stakedAmount() + value > MAX_BET) {
        view.notify(value > state.balance ? 'Ton trésor est trop maigre pour ce jeton.' : `La mise est limitée à ${MAX_BET} pièces.`);
        return;
      }
      state.balance -= value;
      state.betChips.push(value);
      view.placeChip(value, 0, state.betChips.length - 1);
      refresh();
    }

    function clearBet() {
      if (state.phase !== 'betting' || state.busy) return;
      state.balance += sum(state.betChips);
      state.betChips = [];
      view.clearChips();
      refresh();
    }

    function rebet() {
      if (state.phase !== 'betting' || state.busy) return;
      clearBet();
      state.lastBetChips.forEach(addChip);
    }

    function restoreTreasure() {
      if (!snapshot().isBroke) return;
      state.balance = profile.STARTING_TREASURE;
      profile.saveTreasure(state.balance);
      view.notify('Le dragon te prête un nouveau trésor de 1 000 pièces.');
      refresh();
    }

    function resetStats() {
      state.stats = statsApi.createStats();
      statsApi.save(state.stats);
      view.statsChanged(state.stats);
    }

    /* Choisit l'humeur du dragon d'après le bilan de la donne. Un blackjack du joueur l'emporte sur tout. */
    function pickReaction(results, net) {
      if (results.some((result) => result.outcome === 'blackjack')) return 'blackjack';
      if (net < 0) return 'fire';
      if (net > 0) return 'sulk';
      return 'huff';
    }

    async function finishRound() {
      state.phase = 'result';
      const results = state.hands.map((hand) => {
        const bet = handBet(hand);
        const { outcome, returned } = rules.settle(hand.cards, state.dealerCards, bet, { fromSplit: hand.fromSplit });
        return { outcome, returned, winnings: returned - bet };
      });
      const insuranceReturned = rules.settleInsurance(state.insurance, state.dealerCards);
      const insuranceWon = insuranceReturned > 0;
      state.balance += sum(results.map((result) => result.returned)) + insuranceReturned;
      profile.saveTreasure(state.balance);

      const net = sum(results.map((result) => result.winnings)) + insuranceReturned - state.insurance;
      const outcomes = results.map((result) => result.outcome);
      const previousStats = state.stats;
      state.stats = statsApi.recordRound(state.stats, { outcomes, net, balance: state.balance });
      const milestone = statsApi.streakMilestone(previousStats, state.stats);
      statsApi.save(state.stats);
      view.statsChanged(state.stats);
      showTotals(outcomes);
      refresh();

      let summary = outcomes[0];
      if (results.length > 1) summary = net > 0 ? 'roundWin' : net < 0 ? 'roundLose' : 'push';
      const firstLosingHand = Math.max(0, outcomes.findIndex((outcome) => outcome === 'lose' || outcome === 'bust'));

      await Promise.all([
        view.showResult(summary, net, { insuranceWon }),
        view.dragonReact(pickReaction(results, net), firstLosingHand),
      ]);
      if (milestone) await view.celebrateStreak(milestone);
      if (state.insurance > 0) await view.settleInsurance(insuranceWon);
      await view.settleHands(results.map(({ outcome, winnings }) => ({ outcome, winnings })));
      await view.collectCards();
      view.hideTotals();
      view.hideResult();

      if (state.cutCardOut) await shuffleShoe();
      state.hands = [];
      state.dealerCards = [];
      state.activeHand = 0;
      state.insurance = 0;
      state.phase = 'betting';
    }

    /* Le dragon tire sa seconde carte, puis continue jusqu'à 17 si une main du joueur peut encore gagner. */
    async function playDealer() {
      state.phase = 'dealer';
      showTotals();
      refresh();
      view.focusDealer();
      await dealToDealer();
      const needsMoreCards = state.hands.some(
        (hand) => !rules.isBust(hand.cards) && !(rules.isBlackjack(hand.cards) && !hand.fromSplit),
      );
      if (needsMoreCards && !rules.isBlackjack(state.dealerCards)) {
        while (rules.dealerShouldHit(state.dealerCards)) await dealToDealer();
      }
      await finishRound();
    }

    /*
     * Passe à la main suivante. Une main issue d'une séparation reçoit d'abord sa seconde carte ;
     * les as séparés et les mains à 21 sont terminés d'office.
     */
    async function advanceHand() {
      state.activeHand += 1;
      while (state.activeHand < state.hands.length) {
        const index = state.activeHand;
        const hand = state.hands[index];
        view.focusHand(index);
        showTotals();
        if (hand.cards.length === 1) await dealToPlayer(index);
        if (!hand.splitAces && totalOf(hand) < 21) return;
        state.activeHand += 1;
      }
      await playDealer();
    }

    async function startPlayerTurn() {
      state.phase = 'player';
      state.activeHand = 0;
      showTotals();
      if (rules.isBlackjack(state.hands[0].cards)) await playDealer();
    }

    function deal() {
      if (state.phase !== 'betting' || sum(state.betChips) < MIN_BET) return;
      return exclusive(async () => {
        if (state.shoe.length === 0) await shuffleShoe();
        state.lastBetChips = state.betChips.slice();
        state.hands = [createHand(state.betChips)];
        state.betChips = [];
        state.phase = 'dealing';
        profile.saveTreasure(state.balance);
        refresh();

        await dealToPlayer(0);
        await dealToDealer();
        await dealToPlayer(0);

        const cost = rules.insuranceCost(handBet(state.hands[0]));
        const insurable = state.dealerCards[0].rank === 'A' && cost > 0 && state.balance >= cost;
        if (insurable && !rules.isBlackjack(state.hands[0].cards)) {
          state.phase = 'insurance';
          return;
        }
        await startPlayerTurn();
      });
    }

    function takeInsurance() {
      if (state.phase !== 'insurance') return;
      return exclusive(async () => {
        const cost = rules.insuranceCost(handBet(state.hands[0]));
        state.balance -= cost;
        state.insurance = cost;
        view.placeInsurance(cost);
        await startPlayerTurn();
      });
    }

    function declineInsurance() {
      if (state.phase !== 'insurance') return;
      return exclusive(startPlayerTurn);
    }

    function hit() {
      if (state.phase !== 'player') return;
      return exclusive(async () => {
        const hand = activeHand();
        await dealToPlayer(state.activeHand);
        if (totalOf(hand) >= 21) await advanceHand();
      });
    }

    function stand() {
      if (state.phase !== 'player') return;
      return exclusive(advanceHand);
    }

    function double() {
      if (!snapshot().canDouble) return;
      return exclusive(async () => {
        const index = state.activeHand;
        const hand = state.hands[index];
        hand.chips.slice().forEach((value) => {
          state.balance -= value;
          hand.chips.push(value);
          view.placeChip(value, index, hand.chips.length - 1);
        });
        refresh();
        await dealToPlayer(index);
        await advanceHand();
      });
    }

    function split() {
      if (!snapshot().canSplit) return;
      return exclusive(async () => {
        const index = state.activeHand;
        const hand = state.hands[index];
        const chips = hand.chips.slice();
        const splitAces = hand.cards[0].rank === 'A';
        state.balance -= sum(chips);

        const newHand = createHand(chips, true, splitAces);
        newHand.cards.push(hand.cards.pop());
        hand.fromSplit = true;
        hand.splitAces = splitAces;
        state.hands.splice(index + 1, 0, newHand);
        refresh();

        await view.splitHand(index, chips);
        showTotals();
        await dealToPlayer(index);
        if (splitAces || totalOf(hand) >= 21) await advanceHand();
      });
    }

    /* Premier mélange, dès que le joueur s'assoit. */
    function prepareShoe() {
      if (state.shoe.length > 0) return;
      return exclusive(shuffleShoe);
    }

    return {
      prepareShoe,
      addChip,
      clearBet,
      rebet,
      restoreTreasure,
      resetStats,
      deal,
      takeInsurance,
      declineInsurance,
      hit,
      stand,
      double,
      split,
      getStats: () => state.stats,
      refresh,
    };
  }

  root.DragonJack.createGame = createGame;
})(window);
