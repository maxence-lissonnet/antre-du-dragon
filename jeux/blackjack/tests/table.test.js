// Tests de la table à plusieurs : lancer avec `npm test`
const test = require('node:test');
const assert = require('node:assert/strict');
const table = require('../js/core/table.js');
const rules = require('../js/core/rules.js');

const card = (rank, suit = 'spades') => ({ rank, suit });
// Le sabot se tire par la fin : on écrit les cartes dans l'ordre de sortie, puis on remplit.
const stack = (...ranks) => [...Array(120).fill(card('2')), ...ranks.reverse().map((rank) => card(rank))];

test('la donne : deux cartes par place, une seule au dragon', () => {
  const state = table.startRound([{ bet: 10, bankroll: 100 }, { bet: 20, bankroll: 100 }], stack('9', '5', 'K', '7', '8'));
  assert.deepEqual(state.seats[0].hands[0].cards.map((c) => c.rank), ['9', '7']);
  assert.deepEqual(state.seats[1].hands[0].cards.map((c) => c.rank), ['5', '8']);
  assert.deepEqual(state.dealer.map((c) => c.rank), ['K']);
  assert.equal(state.phase, 'play');
  assert.equal(state.turn, 0);
});

test('une place à blackjack est sautée', () => {
  const state = table.startRound([{ bet: 10, bankroll: 100 }, { bet: 10, bankroll: 100 }], stack('A', '5', '9', 'K', '8'));
  assert.equal(state.turn, 1);
});

test('chacun son tour, puis le dragon tire jusqu’à 17 et paie', () => {
  const state = table.startRound([{ bet: 10, bankroll: 100 }, { bet: 10, bankroll: 100 }], stack('10', '9', '6', '8', '9', '10', '5', '10'));
  assert.throws(() => table.act(state, 1, 'stand'), /interdite/);
  table.act(state, 0, 'stand');
  assert.equal(state.turn, 1);
  table.act(state, 1, 'hit');
  assert.equal(state.phase, 'dealer');
  while (table.dealerStep(state));
  // Dragon : 6 + 10 + 5 = 21.
  assert.equal(state.phase, 'done');
  assert.deepEqual(state.seats[0].result.outcomes, ['lose']);
  assert.equal(state.seats[0].result.net, -10);
  assert.deepEqual(state.seats[1].result.outcomes, ['bust']);
});

test('doubler : une seule carte et mise doublée', () => {
  const state = table.startRound([{ bet: 50, bankroll: 100 }], stack('6', '9', '5', 'K', '10', '8'));
  table.act(state, 0, 'double');
  assert.equal(state.seats[0].hands[0].bet, 100);
  assert.equal(state.seats[0].bankroll, 50);
  while (table.dealerStep(state));
  // Joueur 21 contre dragon 9 + 10 = 19 : il gagne sa mise doublée.
  assert.equal(state.seats[0].result.net, 100);
});

test('séparer une paire crée deux mains jouées l’une après l’autre', () => {
  const state = table.startRound([{ bet: 10, bankroll: 100 }], stack('8', '7', '8', '3', '10'));
  table.act(state, 0, 'split');
  const seat = state.seats[0];
  assert.equal(seat.hands.length, 2);
  assert.equal(seat.bankroll, 90);
  table.act(state, 0, 'stand');
  assert.equal(seat.active, 1);
  assert.equal(seat.hands[1].cards.length, 2);
  table.act(state, 0, 'stand');
  assert.equal(state.phase, 'dealer');
  assert.equal(table.staked(seat), 20);
});

test('assurance proposée quand le dragon montre un as', () => {
  const state = table.startRound([{ bet: 20, bankroll: 100 }, { bet: 20, bankroll: 5 }], stack('9', '5', 'A', '7', '8', 'K'));
  assert.equal(state.phase, 'insurance');
  assert.deepEqual(table.legalActions(state, 1), [], 'pas assez de trésor pour s’assurer');
  table.act(state, 0, 'insurance');
  assert.equal(state.phase, 'play');
  table.act(state, 0, 'stand');
  table.act(state, 1, 'stand');
  while (table.dealerStep(state));
  // Le dragon a blackjack : l'assurance (10) paie 2 pour 1, la mise est perdue.
  assert.equal(state.seats[0].result.insuranceWon, true);
  assert.equal(state.seats[0].result.net, -20 + 20);
});

test('des bots jouent 200 donnes à 4 sans coup interdit', () => {
  let shoe = null;
  for (let round = 0; round < 200; round += 1) {
    const state = table.startRound([1, 2, 3, 4].map(() => ({ bet: 50, bankroll: 500 })), shoe);
    let guard = 0;
    while (state.phase === 'insurance' || state.phase === 'play') {
      const seat = state.phase === 'play' ? state.turn : state.seats.findIndex((s) => !s.insuranceAnswered);
      table.act(state, seat, table.botAction(state, seat));
      assert.ok((guard += 1) < 200);
    }
    while (table.dealerStep(state));
    assert.equal(state.phase, 'done');
    state.seats.forEach((seat) => {
      assert.ok(seat.bankroll >= 0);
      seat.hands.forEach((hand) => assert.ok(hand.cards.length >= 2));
      assert.ok(Number.isInteger(seat.result.net));
    });
    assert.ok(rules.handValue(state.dealer).total >= 17 || state.seats.every((s) => s.hands.every((h) => rules.isBust(h.cards) || (!h.fromSplit && rules.isBlackjack(h.cards)))));
    shoe = state.shoe;
  }
});
