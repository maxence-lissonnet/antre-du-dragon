// Tests des statistiques : lancer avec `npm test`
const test = require('node:test');
const assert = require('node:assert/strict');
const stats = require('../js/core/stats.js');

test('une donne gagnée compte la main, le gain et la série', () => {
  const result = stats.recordRound(stats.createStats(), { outcomes: ['blackjack'], net: 150, balance: 1150 });
  assert.equal(result.handsPlayed, 1);
  assert.equal(result.handsWon, 1);
  assert.equal(result.blackjacks, 1);
  assert.equal(result.biggestWin, 150);
  assert.equal(result.bestStreak, 1);
  assert.equal(result.highestBalance, 1150);
});

test('une donne séparée compte chaque main', () => {
  const result = stats.recordRound(stats.createStats(), { outcomes: ['win', 'bust', 'push'], net: 0, balance: 1000 });
  assert.equal(result.handsPlayed, 3);
  assert.equal(result.handsWon, 1);
  assert.equal(result.handsLost, 1);
  assert.equal(result.handsPushed, 1);
});

test('une défaite casse la série, une égalité la garde', () => {
  let s = stats.createStats();
  s = stats.recordRound(s, { outcomes: ['win'], net: 100, balance: 1100 });
  s = stats.recordRound(s, { outcomes: ['win'], net: 100, balance: 1200 });
  s = stats.recordRound(s, { outcomes: ['push'], net: 0, balance: 1200 });
  assert.equal(s.currentStreak, 2);
  s = stats.recordRound(s, { outcomes: ['lose'], net: -100, balance: 1100 });
  assert.equal(s.currentStreak, 0);
  assert.equal(s.bestStreak, 2);
});

test('le taux de victoire est arrondi et vide avant la première main', () => {
  assert.equal(stats.winRate(stats.createStats()), null);
  const s = stats.recordRound(stats.createStats(), { outcomes: ['win', 'lose', 'lose'], net: -100, balance: 900 });
  assert.equal(stats.winRate(s), 33);
});

test('une animation salue chaque dizaine de donnes gagnées ou perdues d\'affilée', () => {
  let s = stats.createStats();
  const milestones = [];
  const play = (net) => {
    const next = stats.recordRound(s, { outcomes: [net > 0 ? 'win' : net < 0 ? 'lose' : 'push'], net, balance: 1000 });
    milestones.push(stats.streakMilestone(s, next));
    s = next;
  };
  for (let i = 0; i < 9; i += 1) play(-10);
  play(0);
  assert.equal(milestones.filter(Boolean).length, 0, 'une égalité ne compte pas');
  play(-10);
  assert.deepEqual(milestones.at(-1), { kind: 'loss', count: 10 });
  play(10);
  assert.equal(s.currentLossStreak, 0, 'une victoire casse la série de défaites');
  for (let i = 0; i < 19; i += 1) play(10);
  assert.deepEqual(milestones.filter(Boolean).slice(-2), [{ kind: 'win', count: 10 }, { kind: 'win', count: 20 }]);
});
