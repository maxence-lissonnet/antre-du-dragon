// Tests de la machine à sous : lancer `npm test` depuis la racine du projet.
const test = require('node:test');
const assert = require('node:assert/strict');
const slots = require('../js/core/slots.js');

const fill = (symbol) => [[symbol, symbol, symbol], [symbol, symbol, symbol], [symbol, symbol, symbol]];

test('chaque rouleau compte 20 cases et un seul dragon', () => {
  const strips = slots.createStrips();
  assert.equal(strips.length, 3);
  strips.forEach((strip) => {
    assert.equal(strip.length, 20);
    assert.equal(strip.filter((symbol) => symbol === 'dragon').length, 1);
  });
});

test('la grille montre la case d\'arrêt au milieu, entourée de ses voisines', () => {
  const strip = ['coin', 'egg', 'sword', 'chalice'];
  const grid = slots.visibleGrid([strip, strip, strip], [0, 1, 3]);
  assert.deepEqual(grid[1], ['coin', 'egg', 'chalice']);
  assert.deepEqual(grid[0], ['chalice', 'coin', 'sword']);
  assert.deepEqual(grid[2], ['egg', 'sword', 'coin']);
});

test('trois symboles identiques sur une ligne paient selon la table, en mise par ligne', () => {
  const grid = [['egg', 'coin', 'sword'], ['sword', 'sword', 'sword'], ['coin', 'egg', 'egg']];
  const result = slots.evaluate(grid, 50, 2000);
  assert.deepEqual(result.wins, [{ lineIndex: 0, symbol: 'sword', amount: 250, jackpot: false }]);
  assert.equal(result.total, 250);
});

test('les diagonales gagnent aussi', () => {
  const grid = [['crown', 'coin', 'egg'], ['coin', 'crown', 'sword'], ['egg', 'sword', 'crown']];
  const result = slots.evaluate(grid, 10, 2000);
  assert.deepEqual(result.wins.map((win) => win.lineIndex), [3]);
  assert.equal(result.total, 160);
});

test('trois dragons à la mise maximale remportent le jackpot une seule fois', () => {
  const result = slots.evaluate(fill('dragon'), 100, 2345.6);
  assert.equal(result.jackpotWon, true);
  assert.equal(result.wins.filter((win) => win.jackpot).length, 1);
  assert.equal(result.wins[0].amount, 2345);
  assert.equal(result.total, 2345 + 4 * 200 * 20);
});

test('sous la mise maximale, trois dragons paient 200 fois la mise par ligne', () => {
  const grid = [['coin', 'egg', 'sword'], ['dragon', 'dragon', 'dragon'], ['egg', 'sword', 'coin']];
  const result = slots.evaluate(grid, 50, 5000);
  assert.equal(result.jackpotWon, false);
  assert.equal(result.total, 2000);
});

test('le jackpot grossit de 2 % de chaque mise', () => {
  assert.equal(slots.jackpotAfterBet(2000, 100), 2002);
});

test('la machine rend environ 87 % des mises hors jackpot', () => {
  const rate = slots.expectedReturn();
  assert.ok(rate > 0.84 && rate < 0.9, `taux de retour : ${rate}`);
});
