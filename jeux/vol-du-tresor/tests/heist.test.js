// Tests du vol du trésor : lancer `npm test` depuis la racine du projet.
const test = require('node:test');
const assert = require('node:assert/strict');
const heist = require('../js/core/heist.js');

test('le multiplicateur part de 1 et ne fait que monter', () => {
  assert.equal(heist.multiplier(0), 1);
  for (let stolen = 1; stolen <= heist.MAX_STEALS; stolen += 1) {
    assert.ok(heist.multiplier(stolen) > heist.multiplier(stolen - 1), `vol ${stolen}`);
  }
  assert.equal(heist.multiplier(1), 1.13);
});

test('le risque de réveil grandit à chaque vol', () => {
  assert.equal(heist.wakeRisk(0), 15);
  assert.equal(heist.wakeRisk(heist.MAX_STEALS - 1), 40);
  assert.equal(heist.wakeRisk(heist.MAX_STEALS), 100);
});

test('un vol réussit seulement si le hasard tombe sous la chance de sommeil', () => {
  assert.equal(heist.attemptSteal(0, 0.84), true);
  assert.equal(heist.attemptSteal(0, 0.86), false);
  assert.equal(heist.attemptSteal(heist.MAX_STEALS, 0), false);
});

test('le butin est arrondi à la pièce inférieure', () => {
  assert.equal(heist.payout(25, 1), 28);
  assert.equal(heist.payout(100, 0), 100);
});

test('quelle que soit la stratégie, le jeu rend environ 96 % des mises', () => {
  for (let target = 1; target <= heist.MAX_STEALS; target += 1) {
    let survive = 1;
    for (let i = 0; i < target; i += 1) survive *= 1 - heist.wakeRisk(i) / 100;
    const expected = survive * heist.multiplier(target);
    assert.ok(Math.abs(expected - 0.96) < 0.01, `en visant ${target} vols : ${expected}`);
  }
});
