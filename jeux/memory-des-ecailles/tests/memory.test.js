// Tests du memory des écailles en duel : lancer `npm test` depuis la racine du projet.
const test = require('node:test');
const assert = require('node:assert/strict');
const memory = require('../js/core/memory.js');

const always = (value) => () => value;

test('chaque niveau a la bonne taille et chaque motif apparaît deux fois', () => {
  assert.equal(memory.createBoard('easy').length, 16);
  assert.equal(memory.createBoard('medium').length, 24);
  const board = memory.createBoard('hard');
  assert.equal(board.length, 36);
  for (let symbol = 0; symbol < 18; symbol += 1) {
    assert.equal(board.filter((value) => value === symbol).length, 2);
  }
});

test('le joueur a plus de vies quand le niveau monte', () => {
  assert.deepEqual(['easy', 'medium', 'hard'].map((key) => memory.LEVELS[key].lives), [3, 4, 5]);
});

test('plus de paires que le dragon double la mise, l\'égalité la rend', () => {
  assert.equal(memory.outcome(5, 3, 1), 'win');
  assert.equal(memory.payout(50, 'win'), 100);
  assert.equal(memory.outcome(4, 4, 2), 'draw');
  assert.equal(memory.payout(50, 'draw'), 50);
});

test('sans vie restante, ou avec moins de paires, la partie est perdue', () => {
  assert.equal(memory.outcome(6, 2, 0), 'lose');
  assert.equal(memory.outcome(2, 6, 3), 'lose');
  assert.equal(memory.payout(50, 'lose'), 0);
});

test('le dragon ne retient une écaille qu\'avec la chance de son niveau', () => {
  const remembered = new Map();
  memory.observe(remembered, 3, 7, 0.6, always(0.5));
  memory.observe(remembered, 4, 7, 0.6, always(0.7));
  assert.deepEqual([...remembered], [[3, 7]]);
});

test('s\'il connaît une paire, le dragon commence par elle puis la complète', () => {
  const remembered = new Map([[2, 5], [9, 1], [11, 5]]);
  const available = [0, 1, 2, 3, 9, 10, 11];
  const first = memory.chooseFirst(remembered, available, always(0));
  assert.equal(first, 2);
  assert.equal(memory.chooseSecond(remembered, available, first, 5, always(0)), 11);
});

test('sinon, il retourne une écaille qu\'il n\'a jamais vue', () => {
  const remembered = new Map([[0, 3], [1, 4]]);
  const first = memory.chooseFirst(remembered, [0, 1, 2], always(0));
  assert.equal(first, 2);
  assert.equal(memory.chooseSecond(remembered, [0, 1, 2], 2, 6, always(0)), 0);
});

test('il oublie les écailles déjà appariées', () => {
  const remembered = new Map([[2, 5], [11, 5], [4, 1]]);
  memory.forget(remembered, [2, 11]);
  assert.deepEqual([...remembered], [[4, 1]]);
});
