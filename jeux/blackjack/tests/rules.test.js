// Tests des règles : lancer avec `node --test tests/`
const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../js/core/rules.js');

const card = (rank, suit = 'spades') => ({ rank, suit });
const hand = (...ranks) => ranks.map((rank) => card(rank));

test('le sabot contient 8 jeux de 52 cartes', () => {
  assert.equal(rules.createShoe().length, 416);
});

test('la carte de coupe laisse entre 20 % et 30 % du sabot', () => {
  assert.equal(rules.cutCardRemaining(416, () => 0), 83);
  assert.equal(rules.cutCardRemaining(416, () => 999), 125);
});

test('un as vaut 11 tant que la main ne dépasse pas 21', () => {
  assert.deepEqual(rules.handValue(hand('A', '6')), { total: 17, soft: true });
  assert.deepEqual(rules.handValue(hand('A', '6', '9')), { total: 16, soft: false });
  assert.deepEqual(rules.handValue(hand('A', 'A', '9')), { total: 21, soft: true });
});

test('les figures valent 10', () => {
  assert.equal(rules.handValue(hand('K', 'Q')).total, 20);
});

test('un blackjack ne compte qu\'avec deux cartes', () => {
  assert.equal(rules.isBlackjack(hand('A', 'K')), true);
  assert.equal(rules.isBlackjack(hand('7', '7', '7')), false);
});

test('le croupier tire à 16 et reste sur un 17 souple', () => {
  assert.equal(rules.dealerShouldHit(hand('10', '6')), true);
  assert.equal(rules.dealerShouldHit(hand('A', '6')), false);
});

test('doubler demande deux cartes et assez de pièces', () => {
  assert.equal(rules.canDouble(hand('5', '6'), 100, 100), true);
  assert.equal(rules.canDouble(hand('5', '6'), 50, 100), false);
  assert.equal(rules.canDouble(hand('5', '6', '2'), 500, 100), false);
});

test('les gains sont calculés mise comprise', () => {
  assert.deepEqual(rules.settle(hand('A', 'K'), hand('10', '9'), 100), { outcome: 'blackjack', returned: 250 });
  assert.deepEqual(rules.settle(hand('10', '9'), hand('10', '8'), 100), { outcome: 'win', returned: 200 });
  assert.deepEqual(rules.settle(hand('10', '8'), hand('10', '8'), 100), { outcome: 'push', returned: 100 });
  assert.deepEqual(rules.settle(hand('10', '7'), hand('10', '8'), 100), { outcome: 'lose', returned: 0 });
  assert.deepEqual(rules.settle(hand('10', '8', '5'), hand('10', '6', '9'), 100), { outcome: 'bust', returned: 0 });
  assert.deepEqual(rules.settle(hand('10', '8'), hand('10', '6', '9'), 100), { outcome: 'dealerBust', returned: 200 });
  assert.deepEqual(rules.settle(hand('A', 'K'), hand('A', 'Q'), 100), { outcome: 'push', returned: 100 });
  assert.deepEqual(rules.settle(hand('10', 'K'), hand('A', 'Q'), 100), { outcome: 'lose', returned: 0 });
});

test('le mélange garde toutes les cartes', () => {
  const shoe = rules.createShoe(1);
  const keys = new Set(shoe.map((c) => c.rank + c.suit));
  assert.equal(keys.size, 52);
});

test('un blackjack sur une mise impaire est arrondi à la pièce inférieure', () => {
  assert.deepEqual(rules.settle(hand('A', 'K'), hand('10', '9'), 25), { outcome: 'blackjack', returned: 62 });
});

test('on sépare deux cartes de même valeur si le trésor couvre la nouvelle mise', () => {
  assert.equal(rules.canSplit(hand('8', '8'), 100, 100), true);
  assert.equal(rules.canSplit(hand('K', 'Q'), 100, 100), true);
  assert.equal(rules.canSplit(hand('8', '9'), 100, 100), false);
  assert.equal(rules.canSplit(hand('8', '8'), 50, 100), false);
});

test('règle européenne : un blackjack du dragon rafle aussi une mise doublée', () => {
  assert.deepEqual(rules.settle(hand('5', '6', '10'), hand('A', 'K'), 200), { outcome: 'lose', returned: 0 });
});

test('après une séparation, un 21 en deux cartes n\'est pas un blackjack', () => {
  assert.deepEqual(rules.settle(hand('A', 'K'), hand('10', '9'), 100, { fromSplit: true }), { outcome: 'win', returned: 200 });
});

test('l\'assurance coûte la moitié de la mise et paie 2 pour 1', () => {
  assert.equal(rules.insuranceCost(100), 50);
  assert.equal(rules.insuranceCost(25), 12);
  assert.equal(rules.settleInsurance(50, hand('A', 'K')), 150);
  assert.equal(rules.settleInsurance(50, hand('A', '7')), 0);
});
