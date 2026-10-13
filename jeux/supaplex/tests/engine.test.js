// Tests du moteur de Supaplex : lancer `npm test` depuis la racine du projet.
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../js/core/engine.js');

const level = (map, needed) => ({ map, needed });
const typeAt = (state, x, y) => engine.at(state, x, y).type;

test('Murphy mange les circuits et ramasse les infotrons', () => {
  const state = engine.replay(level(['#####', '#M.I#', '#####']), 'RR');
  assert.equal(state.murphy.x, 3);
  assert.equal(state.collected, 1);
  assert.equal(typeAt(state, 2, 1), 'empty');
});

test('la sortie reste fermée tant qu\'il manque des infotrons', () => {
  const locked = engine.replay(level(['#####', '#ME.#', '#..I#', '#####']), 'R');
  assert.equal(locked.status, 'playing');
  const open = engine.replay(level(['#####', '#ME.#', '#..I#', '#####']), 'DRRUL');
  assert.equal(open.status, 'won');
});

test('un zonk tombe dans le vide puis roule sur un autre zonk', () => {
  const falling = engine.replay(level(['#####', '#MO #', '#   #', '#   #', '#####']), '..');
  assert.equal(typeAt(falling, 2, 3), 'zonk');
  const rolling = engine.replay(level(['#####', '#MO #', '# O #', '#####']), '..');
  assert.ok(typeAt(rolling, 1, 2) === 'zonk' || typeAt(rolling, 3, 2) === 'zonk');
});

test('un zonk qui tombe sur Murphy le fait exploser', () => {
  const state = engine.replay(level(['#####', '# O #', '#   #', '#.M.#', '#####']), '..');
  assert.equal(state.status, 'dead');
});

test('Murphy pousse un zonk de côté s\'il y a de la place derrière', () => {
  const state = engine.replay(level(['######', '#MO  #', '######']), 'R');
  assert.equal(typeAt(state, 3, 1), 'zonk');
  assert.equal(state.murphy.x, 2);
  const blocked = engine.replay(level(['#####', '#MO##', '#####']), 'R');
  assert.equal(blocked.murphy.x, 1);
});

test('un port à sens unique se traverse seulement dans son sens', () => {
  const through = engine.replay(level(['######', '#M> .#', '######']), 'R');
  assert.equal(through.murphy.x, 3);
  const wrongWay = engine.replay(level(['######', '#M< .#', '######']), 'R');
  assert.equal(wrongWay.murphy.x, 1);
});

test('aspirer ramasse sans bouger', () => {
  const state = engine.replay(level(['#####', '#MI #', '#####']), 'r');
  assert.equal(state.murphy.x, 1);
  assert.equal(state.collected, 1);
});

test('un snik snak qui touche Murphy le fait exploser', () => {
  const state = engine.replay(level(['#######', '#M   S#', '#######']), '......');
  assert.equal(state.status, 'dead');
});

test('un électron écrasé laisse des infotrons', () => {
  // L'électron est coincé entre deux puces ; un zonk en pleine chute arrive juste au-dessus.
  const state = engine.createState(level(['#######', '#M    #', '#  O  #', '# RLR #', '#######'], 0));
  engine.at(state, 3, 2).falling = true;
  for (let i = 0; i < 6; i += 1) engine.step(state, {});
  assert.ok(state.cells.filter((cell) => cell.type === 'infotron').length >= 3);
});

test('une disquette rouge posée explose après un délai et détruit les puces RAM voisines', () => {
  // Murphy ramasse la disquette, la pose contre les puces RAM, puis s'éloigne par le bas.
  const start = level(['#######', '#dMRR #', '#  ...#', '#######'], 0);
  const state = engine.replay(start, 'LRXDRR' + '.'.repeat(20));
  assert.equal(state.status, 'playing');
  assert.equal(typeAt(state, 3, 1), 'empty');
  assert.equal(state.redDisks, 0);
});

test('rester sur sa disquette posée est fatal', () => {
  const state = engine.replay(level(['#####', '#dM #', '#####'], 0), 'LX' + '.'.repeat(20));
  assert.equal(state.status, 'dead');
});

test('toucher le terminal fait exploser les disquettes jaunes', () => {
  const start = level(['#########', '#MT  #RR#', '#    #yR#', '#########'], 0);
  const state = engine.replay(start, 'R......');
  assert.equal(typeAt(state, 6, 2), 'empty');
  assert.equal(typeAt(state, 7, 1), 'empty');
});

test('une disquette orange explose en touchant le sol après une chute', () => {
  const state = engine.replay(level(['######', '#M o #', '#  . #', '#  R #', '######'], 0), 'RR' + '.'.repeat(8));
  assert.equal(typeAt(state, 3, 3), 'empty');
});
