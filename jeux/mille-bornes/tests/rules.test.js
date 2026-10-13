// Tests des règles du Mille Bornes : lancer `npm test` depuis la racine du projet.
const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../js/core/rules.js');
const bot = require('../js/core/bot.js');

let nextId = 1000;
const card = (kind, type, value = 0) => ({ id: nextId++, kind, type, value });
const KINDS = {
  km25: ['distance', 25], km50: ['distance', 50], km75: ['distance', 75], km100: ['distance', 100], km200: ['distance', 200],
  redLight: ['hazard'], speedLimit: ['hazard'], outOfGas: ['hazard'], flatTire: ['hazard'], accident: ['hazard'],
  greenLight: ['remedy'], endOfLimit: ['remedy'], gas: ['remedy'], spareTire: ['remedy'], repairs: ['remedy'],
  rightOfWay: ['safety'], fuelTank: ['safety'], punctureProof: ['safety'], drivingAce: ['safety'],
};
const make = (type) => card(KINDS[type][0], type, KINDS[type][1] || 0);

/* Partie à deux, mains et piles choisies, prête à jouer pour le joueur 0. */
function setup({ hand = [], battle = [], speed = [], km = 0, distance = [], other = {}, safeties = [] } = {}) {
  const state = rules.createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
  const [a, b] = state.players;
  a.hand = hand.map(make);
  a.battle = battle.map(make);
  a.speed = speed.map(make);
  a.km = km;
  a.distance = distance.map(make);
  a.safeties = safeties.map((type) => ({ card: make(type), coupFourre: false }));
  b.hand = (other.hand || []).map(make);
  b.battle = (other.battle || []).map(make);
  b.km = other.km || 0;
  b.safeties = (other.safeties || []).map((type) => ({ card: make(type), coupFourre: false }));
  state.phase = 'play';
  return state;
}
const playable = (state, type, target) =>
  rules.legalMoves(state).some((m) => m.action === 'play' && state.players[0].hand.find((c) => c.id === m.cardId).type === type && m.target === target);
const moveFor = (state, type, target) =>
  rules.legalMoves(state).find((m) => m.action === 'play' && state.players[0].hand.find((c) => c.id === m.cardId).type === type && m.target === target);

test('le jeu compte 106 cartes : 46 bornes, 18 attaques, 38 parades, 4 bottes', () => {
  const deck = rules.createDeck();
  const count = (kind) => deck.filter((c) => c.kind === kind).length;
  assert.equal(deck.length, 106);
  assert.deepEqual([count('distance'), count('hazard'), count('remedy'), count('safety')], [46, 18, 38, 4]);
});

test('chacun reçoit 6 cartes et le premier joueur commence par piocher', () => {
  const state = rules.createGame([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  assert.ok(state.players.every((p) => p.hand.length === 6));
  assert.equal(state.draw.length, 106 - 18);
  rules.drawCard(state);
  assert.equal(state.players[0].hand.length, 7);
  assert.equal(state.phase, 'play');
});

test('sans feu vert, on ne peut pas avancer', () => {
  assert.equal(playable(setup({ hand: ['km100', 'greenLight'] }), 'km100'), false);
  assert.equal(playable(setup({ hand: ['km100', 'greenLight'] }), 'greenLight'), true);
  assert.equal(playable(setup({ hand: ['km100'], battle: ['greenLight'] }), 'km100'), true);
});

test('on n\'attaque qu\'un adversaire qui roule, sauf la limitation de vitesse', () => {
  assert.equal(playable(setup({ hand: ['accident'] }), 'accident', 1), false);
  assert.equal(playable(setup({ hand: ['accident'], other: { battle: ['greenLight'] } }), 'accident', 1), true);
  assert.equal(playable(setup({ hand: ['speedLimit'] }), 'speedLimit', 1), true);
});

test('une attaque se répare avec la bonne parade, puis il faut un feu vert', () => {
  const state = setup({ hand: ['spareTire', 'km50'], battle: ['greenLight', 'flatTire'] });
  assert.equal(playable(state, 'km50'), false);
  rules.play(state, moveFor(state, 'spareTire'));
  assert.equal(rules.isRolling(state.players[0]), false);
  assert.equal(rules.top(state.players[0].battle).type, 'spareTire');
});

test('limité, on ne joue pas d\'étape de plus de 50 bornes', () => {
  const state = setup({ hand: ['km75', 'km50'], battle: ['greenLight'], speed: ['speedLimit'] });
  assert.equal(playable(state, 'km75'), false);
  assert.equal(playable(state, 'km50'), true);
});

test('il faut atteindre 1000 bornes tout juste, avec au plus deux étapes de 200', () => {
  assert.equal(playable(setup({ hand: ['km100'], battle: ['greenLight'], km: 950 }), 'km100'), false);
  assert.equal(playable(setup({ hand: ['km200'], battle: ['greenLight'], distance: ['km200', 'km200'], km: 400 }), 'km200'), false);
  const state = setup({ hand: ['km50'], battle: ['greenLight'], km: 950 });
  rules.play(state, moveFor(state, 'km50'));
  assert.equal(state.winner, 0);
  assert.equal(state.phase, 'over');
});

test('le véhicule prioritaire permet de rouler sans feu vert et protège du feu rouge', () => {
  const state = setup({ hand: ['km100'], safeties: ['rightOfWay'], other: { hand: ['redLight'] } });
  assert.equal(playable(state, 'km100'), true);
  assert.equal(rules.canAttack(state.players[0], 'redLight'), false);
  assert.equal(rules.canAttack(state.players[0], 'speedLimit'), false);
});

test('une botte fait rejouer et annule l\'attaque en cours', () => {
  const state = setup({ hand: ['punctureProof'], battle: ['greenLight', 'flatTire'] });
  rules.play(state, moveFor(state, 'punctureProof'));
  assert.equal(state.turn, 0);
  assert.equal(state.phase, 'draw');
  assert.equal(rules.top(state.players[0].battle).type, 'greenLight');
});

test('coup-fourré : la cible pose sa botte, l\'attaque est annulée et c\'est à elle de jouer', () => {
  const state = setup({ hand: ['accident'], other: { battle: ['greenLight'], hand: ['drivingAce', 'km25'] } });
  rules.play(state, moveFor(state, 'accident', 1));
  assert.equal(state.phase, 'coupFourre');
  rules.respondCoupFourre(state, true);
  const b = state.players[1];
  assert.equal(b.safeties[0].coupFourre, true);
  assert.equal(rules.top(b.battle).type, 'greenLight');
  assert.equal(state.turn, 1);
});

test('refuser le coup-fourré laisse l\'attaque en place', () => {
  const state = setup({ hand: ['accident'], other: { battle: ['greenLight'], hand: ['drivingAce'] } });
  rules.play(state, moveFor(state, 'accident', 1));
  rules.respondCoupFourre(state, false);
  assert.equal(rules.top(state.players[1].battle).type, 'accident');
  assert.equal(state.turn, 1);
  assert.equal(state.phase, 'draw');
});

test('décompte : bornes, bottes, coup-fourré, voyage achevé, sans les 200 et capot', () => {
  const state = setup({ hand: ['km50'], battle: ['greenLight'], km: 950, distance: ['km100'] });
  state.players[0].safeties = [{ card: make('drivingAce'), coupFourre: true }];
  rules.play(state, moveFor(state, 'km50'));
  const [a] = rules.score(state);
  assert.equal(a.total, 1000 + 100 + 300 + 400 + 300 + 500);
});

test('la vue d\'un joueur cache la main des autres', () => {
  const state = rules.createGame([{ id: 'a' }, { id: 'b' }]);
  const view = rules.viewFor(state, 0);
  assert.equal(view.players[0].hand.length, 6);
  assert.equal(view.players[1].hand, 6);
  assert.equal(typeof view.draw, 'number');
});

test('le bot finit à 1000 quand il le peut, sinon il répare ou attaque le meneur', () => {
  const finishing = setup({ hand: ['km100', 'km50'], battle: ['greenLight'], km: 950 });
  assert.equal(finishing.players[0].hand.find((c) => c.id === bot.chooseMove(finishing).cardId).type, 'km50');
  const repairing = setup({ hand: ['gas', 'km100'], battle: ['greenLight', 'outOfGas'] });
  assert.equal(repairing.players[0].hand.find((c) => c.id === bot.chooseMove(repairing).cardId).type, 'gas');
  const attacking = setup({ hand: ['accident', 'km25'], other: { battle: ['greenLight'], km: 600 } });
  const move = bot.chooseMove(attacking);
  assert.equal(move.target, 1);
});

test('quatre bots vont au bout d\'une manche sans coup interdit', () => {
  for (let round = 0; round < 20; round += 1) {
    const state = rules.createGame([1, 2, 3, 4].map((id) => ({ id, name: `Bot ${id}`, isBot: true })));
    for (let guard = 0; guard < 2000 && state.phase !== 'over'; guard += 1) {
      if (state.phase === 'draw') rules.drawCard(state);
      else if (state.phase === 'coupFourre') rules.respondCoupFourre(state, bot.wantsCoupFourre());
      else rules.play(state, bot.chooseMove(state));
    }
    assert.equal(state.phase, 'over', `manche ${round} non terminée`);
    const cards = state.draw.length + state.discard.length + state.players.reduce(
      (sum, p) => sum + p.hand.length + p.battle.length + p.speed.length + p.distance.length + p.safeties.length, 0);
    assert.equal(cards, 106, 'aucune carte ne doit se perdre');
  }
});
