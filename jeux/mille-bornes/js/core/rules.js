/*
 * Règles du Mille Bornes (règle française, une manche) : fonctions pures, sans affichage ni réseau.
 *
 * Tour de jeu : on pioche une carte, puis on joue ou on défausse une carte.
 * - Pour avancer (bornes), il faut « rouler » : un feu vert sur sa pile de bataille (ou le véhicule prioritaire).
 * - Une attaque se pose sur un adversaire qui roule ; il doit la réparer avec la parade correspondante,
 *   puis remettre un feu vert. La limitation de vitesse (pile à part) interdit les étapes de plus de 50 bornes.
 * - Une botte protège pour toute la manche et fait rejouer ; posée au moment même de l'attaque,
 *   c'est un coup-fourré (bonus de points, et la main passe à celui qui l'a joué).
 * - Il faut atteindre 1000 bornes tout juste, avec au plus deux étapes de 200.
 */
(function (root) {
  'use strict';

  const GOAL = 1000;
  const HAND_SIZE = 6;
  const MAX_200 = 2;
  const SPEED_LIMIT = 50;

  // Composition officielle du jeu : 106 cartes.
  const DECK = [
    ['distance', 'km25', 10, 25], ['distance', 'km50', 10, 50], ['distance', 'km75', 10, 75],
    ['distance', 'km100', 12, 100], ['distance', 'km200', 4, 200],
    ['hazard', 'redLight', 5], ['hazard', 'speedLimit', 4], ['hazard', 'outOfGas', 3],
    ['hazard', 'flatTire', 3], ['hazard', 'accident', 3],
    ['remedy', 'greenLight', 14], ['remedy', 'endOfLimit', 6], ['remedy', 'gas', 6],
    ['remedy', 'spareTire', 6], ['remedy', 'repairs', 6],
    ['safety', 'rightOfWay', 1], ['safety', 'fuelTank', 1], ['safety', 'punctureProof', 1], ['safety', 'drivingAce', 1],
  ];

  const REMEDY_FOR = { redLight: 'greenLight', speedLimit: 'endOfLimit', outOfGas: 'gas', flatTire: 'spareTire', accident: 'repairs' };
  const SAFETY_FOR = { redLight: 'rightOfWay', speedLimit: 'rightOfWay', outOfGas: 'fuelTank', flatTire: 'punctureProof', accident: 'drivingAce' };

  const LABELS = {
    km25: '25 bornes', km50: '50 bornes', km75: '75 bornes', km100: '100 bornes', km200: '200 bornes',
    redLight: 'Feu rouge', speedLimit: 'Limitation de vitesse', outOfGas: 'Panne d’essence', flatTire: 'Crevaison', accident: 'Accident',
    greenLight: 'Feu vert', endOfLimit: 'Fin de limitation', gas: 'Essence', spareTire: 'Roue de secours', repairs: 'Réparations',
    rightOfWay: 'Véhicule prioritaire', fuelTank: 'Citerne d’essence', punctureProof: 'Increvable', drivingAce: 'As du volant',
  };

  // Décompte des points à la fin de la manche (règle française).
  const POINTS = { safety: 100, allSafeties: 300, coupFourre: 300, tripCompleted: 400, delayedAction: 300, safeTrip: 300, shutout: 500 };

  function randomIndex(max) {
    const cryptoApi = root.crypto || (typeof globalThis !== 'undefined' ? globalThis.crypto : null);
    if (cryptoApi && cryptoApi.getRandomValues) {
      const buffer = new Uint32Array(1);
      cryptoApi.getRandomValues(buffer);
      return buffer[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function createDeck(pickIndex = randomIndex) {
    const cards = [];
    let id = 1;
    DECK.forEach(([kind, type, count, value]) => {
      for (let i = 0; i < count; i += 1) cards.push({ id: id++, kind, type, value: value || 0 });
    });
    for (let i = cards.length - 1; i > 0; i -= 1) {
      const j = pickIndex(i + 1);
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  /* `players` : [{ id, name, isBot }]. Chacun reçoit 6 cartes ; le premier joueur commence. */
  function createGame(players, pickIndex = randomIndex) {
    const draw = createDeck(pickIndex);
    return {
      players: players.map((player) => ({
        ...player,
        hand: draw.splice(-HAND_SIZE),
        battle: [],
        speed: [],
        distance: [],
        safeties: [],
        km: 0,
      })),
      draw,
      discard: [],
      turn: 0,
      phase: 'draw',
      pending: null,
      drawExhausted: false,
      winner: null,
      log: [],
    };
  }

  const top = (pile) => (pile.length ? pile[pile.length - 1] : null);
  const hasSafety = (player, type) => player.safeties.some((entry) => entry.card.type === type);

  /* Le joueur peut-il avancer ? Feu vert sur sa pile, ou véhicule prioritaire sans attaque en cours. */
  function isRolling(player) {
    const battle = top(player.battle);
    if (battle && battle.type === 'greenLight') return true;
    return hasSafety(player, 'rightOfWay') && (!battle || battle.kind === 'remedy');
  }

  function isLimited(player) {
    const speed = top(player.speed);
    return Boolean(speed && speed.type === 'speedLimit') && !hasSafety(player, 'rightOfWay');
  }

  const count200 = (player) => player.distance.filter((card) => card.type === 'km200').length;

  /* Une attaque peut-elle viser ce joueur ? */
  function canAttack(target, type) {
    if (hasSafety(target, SAFETY_FOR[type])) return false;
    if (type === 'speedLimit') {
      const speed = top(target.speed);
      return !speed || speed.type !== 'speedLimit';
    }
    return isRolling(target);
  }

  /* Une parade peut-elle se poser sur sa propre pile ? */
  function canRemedy(player, type) {
    if (type === 'endOfLimit') {
      const speed = top(player.speed);
      return Boolean(speed && speed.type === 'speedLimit');
    }
    const battle = top(player.battle);
    if (type === 'greenLight') {
      if (isRolling(player)) return false;
      return !battle || battle.type === 'redLight' || battle.kind === 'remedy';
    }
    return Boolean(battle && battle.kind === 'hazard' && REMEDY_FOR[battle.type] === type);
  }

  function canDrive(player, card) {
    if (!isRolling(player)) return false;
    if (player.km + card.value > GOAL) return false;
    if (isLimited(player) && card.value > SPEED_LIMIT) return false;
    return card.type !== 'km200' || count200(player) < MAX_200;
  }

  /*
   * Coups possibles pour le joueur dont c'est le tour (phase « play ») :
   * [{ cardId, action: 'play' | 'discard', target }]. `target` = indice du joueur visé par une attaque.
   */
  function legalMoves(state, playerIndex = state.turn) {
    if (state.phase !== 'play' || playerIndex !== state.turn) return [];
    const player = state.players[playerIndex];
    const moves = [];
    player.hand.forEach((card) => {
      if (card.kind === 'distance' && canDrive(player, card)) moves.push({ cardId: card.id, action: 'play' });
      if (card.kind === 'remedy' && canRemedy(player, card.type)) moves.push({ cardId: card.id, action: 'play' });
      if (card.kind === 'safety') moves.push({ cardId: card.id, action: 'play' });
      if (card.kind === 'hazard') {
        state.players.forEach((other, index) => {
          if (index !== playerIndex && canAttack(other, card.type)) moves.push({ cardId: card.id, action: 'play', target: index });
        });
      }
      moves.push({ cardId: card.id, action: 'discard' });
    });
    return moves;
  }

  function takeFromHand(player, cardId) {
    const index = player.hand.findIndex((card) => card.id === cardId);
    if (index < 0) throw new Error('Cette carte n’est pas dans la main');
    return player.hand.splice(index, 1)[0];
  }

  function nextTurn(state, index) {
    state.turn = index;
    state.phase = 'draw';
    // Pioche vide et plus aucune carte en main : la manche est finie.
    if (state.draw.length === 0 && state.players.every((player) => player.hand.length === 0)) state.phase = 'over';
  }

  function advance(state) {
    nextTurn(state, (state.turn + 1) % state.players.length);
    // Un joueur sans carte (pioche vide) passe son tour.
    let guard = state.players.length;
    while (state.phase === 'draw' && state.draw.length === 0 && state.players[state.turn].hand.length === 0 && guard > 0) {
      state.turn = (state.turn + 1) % state.players.length;
      guard -= 1;
    }
  }

  /* Pioche du joueur dont c'est le tour (si la pioche est vide, on joue avec ce qu'on a). */
  function drawCard(state) {
    if (state.phase !== 'draw') throw new Error('Ce n’est pas le moment de piocher');
    const player = state.players[state.turn];
    if (state.draw.length > 0) player.hand.push(state.draw.pop());
    if (state.draw.length === 0) state.drawExhausted = true;
    if (player.hand.length === 0) {
      advance(state);
      return [{ type: 'pass', player: state.turn }];
    }
    state.phase = 'play';
    return [{ type: 'draw', player: state.turn }];
  }

  /* Une botte retire l'attaque qu'elle contre, si elle est en cours. */
  function clearCounteredAttacks(state, player, safetyType) {
    const battle = top(player.battle);
    if (battle && battle.kind === 'hazard' && SAFETY_FOR[battle.type] === safetyType) state.discard.push(player.battle.pop());
    const speed = top(player.speed);
    if (safetyType === 'rightOfWay' && speed && speed.type === 'speedLimit') state.discard.push(player.speed.pop());
  }

  function finishIfGoal(state, playerIndex, events) {
    if (state.players[playerIndex].km !== GOAL) return false;
    state.winner = playerIndex;
    state.phase = 'over';
    events.push({ type: 'goal', player: playerIndex });
    return true;
  }

  /* Joue ou défausse une carte (`move` vient de legalMoves). Renvoie les événements pour l'affichage. */
  function play(state, move) {
    const legal = legalMoves(state).some((m) => m.cardId === move.cardId && m.action === move.action && m.target === move.target);
    if (!legal) throw new Error('Coup interdit');
    const playerIndex = state.turn;
    const player = state.players[playerIndex];
    const card = takeFromHand(player, move.cardId);
    const events = [];

    if (move.action === 'discard') {
      state.discard.push(card);
      events.push({ type: 'discard', player: playerIndex, card });
      advance(state);
      return events;
    }
    if (card.kind === 'distance') {
      player.distance.push(card);
      player.km += card.value;
      events.push({ type: 'distance', player: playerIndex, card });
      if (finishIfGoal(state, playerIndex, events)) return events;
    } else if (card.kind === 'remedy') {
      (card.type === 'endOfLimit' ? player.speed : player.battle).push(card);
      events.push({ type: 'remedy', player: playerIndex, card });
    } else if (card.kind === 'safety') {
      player.safeties.push({ card, coupFourre: false });
      clearCounteredAttacks(state, player, card.type);
      events.push({ type: 'safety', player: playerIndex, card });
      // Une botte fait rejouer : le même joueur pioche à nouveau.
      nextTurn(state, playerIndex);
      return events;
    } else {
      const target = state.players[move.target];
      (card.type === 'speedLimit' ? target.speed : target.battle).push(card);
      events.push({ type: 'attack', player: playerIndex, target: move.target, card });
      const counter = target.hand.find((c) => c.type === SAFETY_FOR[card.type]);
      if (counter) {
        // La cible peut répondre par un coup-fourré avant que le jeu continue.
        state.phase = 'coupFourre';
        state.pending = { target: move.target, attacker: playerIndex, safetyId: counter.id, attack: card };
        return events;
      }
    }
    advance(state);
    return events;
  }

  /* Réponse à une attaque quand on détient la botte : `accept` = coup-fourré. */
  function respondCoupFourre(state, accept) {
    if (state.phase !== 'coupFourre') throw new Error('Pas de coup-fourré en attente');
    const { target, attacker, safetyId, attack } = state.pending;
    state.pending = null;
    if (!accept) {
      state.turn = attacker;
      advance(state);
      return [{ type: 'coupFourreDeclined', player: target }];
    }
    const player = state.players[target];
    const safety = takeFromHand(player, safetyId);
    player.safeties.push({ card: safety, coupFourre: true });
    // L'attaque retourne à la défausse ; on repioche la carte jouée, puis c'est à soi de jouer.
    const pile = attack.type === 'speedLimit' ? player.speed : player.battle;
    state.discard.push(pile.pop());
    clearCounteredAttacks(state, player, safety.type);
    if (state.draw.length > 0) player.hand.push(state.draw.pop());
    nextTurn(state, target);
    return [{ type: 'coupFourre', player: target, card: safety }];
  }

  /* Points de la manche pour chaque joueur, détaillés. */
  function score(state) {
    return state.players.map((player, index) => {
      const lines = [{ label: 'Bornes parcourues', points: player.km }];
      const safeties = player.safeties.length;
      if (safeties) lines.push({ label: `${safeties} botte${safeties > 1 ? 's' : ''}`, points: safeties * POINTS.safety });
      if (safeties === 4) lines.push({ label: 'Les 4 bottes', points: POINTS.allSafeties });
      const coups = player.safeties.filter((entry) => entry.coupFourre).length;
      if (coups) lines.push({ label: `${coups} coup${coups > 1 ? 's' : ''}-fourré${coups > 1 ? 's' : ''}`, points: coups * POINTS.coupFourre });
      if (state.winner === index) {
        lines.push({ label: 'Voyage achevé', points: POINTS.tripCompleted });
        if (state.drawExhausted) lines.push({ label: 'Couronnement retardé', points: POINTS.delayedAction });
        if (count200(player) === 0) lines.push({ label: 'Sans les 200', points: POINTS.safeTrip });
        if (state.players.every((other, i) => i === index || other.km === 0)) lines.push({ label: 'Capot', points: POINTS.shutout });
      }
      return { player: index, lines, total: lines.reduce((sum, line) => sum + line.points, 0) };
    });
  }

  /* Vue d'un joueur : tout est public sauf la main des autres (on n'en montre que le nombre de cartes). */
  function viewFor(state, playerIndex) {
    return {
      ...state,
      draw: state.draw.length,
      players: state.players.map((player, index) => ({
        ...player,
        hand: index === playerIndex ? player.hand : player.hand.length,
      })),
      pending: state.pending && state.pending.target === playerIndex ? state.pending : state.pending && { target: state.pending.target },
    };
  }

  const api = {
    GOAL, LABELS, POINTS, REMEDY_FOR, SAFETY_FOR,
    createDeck, createGame, legalMoves, drawCard, play, respondCoupFourre, score, viewFor,
    isRolling, isLimited, canAttack, canRemedy, top,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.DragonJack = root.DragonJack || {};
    root.DragonJack.milleBornes = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
