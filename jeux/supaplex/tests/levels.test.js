// Chaque niveau de Supaplex doit rester faisable : on rejoue une solution connue.
// Touches : L R U D (déplacer), l r u d (aspirer), X (poser une disquette), . (attendre un tic).
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../js/core/engine.js');
const { LEVELS, reward } = require('../js/core/levels.js');

const wait = (ticks) => '.'.repeat(ticks);
const SOLUTIONS = [
  'DDDDRRRUULDDRRRRRRRUUDDLLLLLLLLLUUUURRRRRDDRRUURRRRRDDDDR',
  'DDDDRDDRRRRRRUUUULRRRRRRRUUDDDDDD',
  'RR.RRR.RRR.RRRRR',
  'DRRRUDRRRRRRLLDDLLLLLLLLLRRRRRRRRRRDRRURD',
  'DDDDDDDRLUUUUUUURRRRRRRDDRRRRDDRRDDD',
  `DDDDUUUURRRRRRRDDXDD${wait(21)}URDRRRRRUUUUDDDDDD`,
  `RRRRRRDRRRRRR${wait(6)}LLDDUULLLLLLLLLLDDDDRRRRRRRRRRRRR`,
  `RR${wait(6)}DRRRDDRRRLLLUURRRRRRRRRDDDDDLLLLLLLDLRURRRRRRRD`,
  // Grands circuits : solutions trouvées par le joueur automatique de conception.
  "DDRRRRRRRDDDRDDDDLDDLLDULULRURURRUURRRRRDRRDLDLDRDRLDDLLUDDDRURURRRRRUUUDRDDDRRRDDRRRRRRRUURRRRRRRURUDLDLDLLLLLLLLUURURRLLUUUUUURUUULULLLUULLLLLDLLLURDDRRRDRRRRRRDDDRDDDDDDDDRDDDRRRRRRRR",
  "DRRRDDDRRRRRDRUURRRRUDDDDDDLLLDLLDLLLDDDDDRRRRULUUUUUURURRRRUURRRRRRRRRDRRDDDDDDDDRRRRRRRRRRRRDRDD",
  "DRRRRRRRRRRRDDLDDRDRURRRLUUURURRULLDDLDDDDDDUUUURRRRRRRRRRDURRDDRRRDRDRRRRRRUDDRLUUUUUULLLLURRDRRDDDDLLLLLLULLLDDDDRDDDDDDULLLLLLUDLLDDRURURUURRRRRRRRRRRRDDRRDD",
  "DDDRRRDRRDDLLLLLDDDDRDRDRRRURRRURRRRRRRURRRRRDDDRDDRUURRULLUUUULLUUUURUUUDRRRDRDRRRULLLDLLLLLLLDDDDDDRRRRRRRRRRRURURRDDDDDDRRDRRDRDD",
  "DDRDRRDDDDDRDDDDRDLLLDULRDDRRRRR.DLLLDLLUUURURRURUURURURRRRRULLUUUUDDDLLDLDDRDDRRULLUUUURRRRRRRRRURUUUURRRURRRRDDDDRRRDLUURRURRRRURRRUDDLDDDDDDLDDRDDDDDRDD",
  "DRRDDDDRRRDRRRRDDDDDUUUUULULLLLLLUUUUURRRRRRDDRRRURRRLLDDDRDLDRDUULLLRRUURRRDRRRDDRRDDLLLDUURUURRDURURRRRRRRRRRRRDDRDRURRLLLDLDDLLLLDDDLDDDLLULLLLLDDDRRURRRRDRRRRRRRRRR",
];

test("il y a 8 niveaux d'initiation et 6 grands circuits, tous bordés de murs, avec un Murphy et une sortie", () => {
  assert.equal(LEVELS.filter((level) => level.series === 'initiation').length, 8);
  assert.equal(LEVELS.filter((level) => level.series === 'grands').length, 6);
  LEVELS.forEach((level) => {
    const map = level.map.join('\n');
    assert.equal((map.match(/M/g) || []).length, 1, level.name);
    assert.ok(map.includes('E'), level.name);
    assert.ok(/^#+$/.test(level.map[0]) && /^#+$/.test(level.map[level.map.length - 1]), level.name);
    level.map.forEach((row) => assert.ok(row.startsWith('#') && row.endsWith('#'), `${level.name} : ${row}`));
  });
});

LEVELS.forEach((level, index) => {
  test(`le niveau ${index + 1} (« ${level.name} ») se termine`, () => {
    const state = engine.replay(level, SOLUTIONS[index]);
    assert.equal(state.status, 'won');
  });
});

test('la récompense grandit avec la difficulté, et bien plus pour les grands circuits', () => {
  assert.equal(reward(0), 50);
  assert.equal(reward(7), 225);
  assert.equal(reward(8), 300);
  assert.equal(reward(13), 550);
});

test('les grands circuits font 40 × 20 cases', () => {
  LEVELS.filter((level) => level.series === 'grands').forEach((level) => {
    assert.equal(level.map.length, 20, level.name);
    level.map.forEach((row) => assert.equal(row.length, 40, level.name));
  });
});
