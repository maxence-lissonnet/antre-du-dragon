/*
 * Memory à plusieurs (2 à 4 joueurs : bots et/ou amis en ligne), sans mise ni vies :
 * chacun son tour retourne deux écailles, une paire trouvée fait rejouer, le plus de paires gagne.
 *
 * L'hôte (ou l'appareil seul avec des bots) fait tourner la partie et diffuse après chaque étape
 * un « instantané » : écailles visibles, paires trouvées, joueur dont c'est le tour, scores.
 * Tout le monde, hôte compris, affiche la partie à partir de ces instantanés.
 */
(function (root) {
  'use strict';

  const DJ = root.DragonJack;
  const memory = DJ.memory;
  const $ = (id) => document.getElementById(id);

  const BOT_THINK_MS = 800;
  const MISMATCH_PAUSE_MS = 1100;

  function startMemoryParty({ session, levelKey, board, stage, dragon, audio, notify, announce }) {
    const seats = session.seats;
    const local = session.localIndex;
    let dealt = false;
    const shownUp = new Set();
    const shownMatched = new Set();

    // ---- Affichage, commun à tous les appareils ----

    function renderPanel(snapshot) {
      const turn = $('party-turn');
      const mine = snapshot.turn === local;
      turn.dataset.turn = mine ? 'player' : 'dragon';
      turn.textContent = snapshot.phase === 'over' ? 'Partie terminée' : mine ? 'À toi de jouer' : `${seats[snapshot.turn].name} joue…`;
      $('party-scores').replaceChildren(
        ...seats.map((seat, index) => {
          const item = document.createElement('li');
          item.className = 'party-score';
          item.dataset.active = String(index === snapshot.turn && snapshot.phase !== 'over');
          item.append(
            Object.assign(document.createElement('span'), { textContent: `${seat.name}${index === local ? ' (toi)' : ''}` }),
            Object.assign(document.createElement('strong'), { textContent: `${snapshot.pairs[index]} paire${snapshot.pairs[index] > 1 ? 's' : ''}` }),
          );
          return item;
        }),
      );
    }

    function showEnd(snapshot) {
      const best = Math.max(...snapshot.pairs);
      const winners = seats.filter((_, index) => snapshot.pairs[index] === best).map((seat) => seat.name);
      $('party-end').hidden = false;
      $('party-end-title').textContent = winners.length > 1 ? `Égalité : ${winners.join(' et ')}` : `${winners[0]} gagne la partie !`;
      const won = snapshot.pairs[local] === best;
      audio.play(won ? 'fanfare' : 'grumble');
      if (won) dragon.bow(1.2);
      else dragon.huff();
    }

    /* Met la dalle en accord avec un instantané : retourne, assortit ou recouvre les écailles. */
    function applySnapshot(snapshot) {
      if (!dealt) {
        dealt = true;
        const level = memory.LEVELS[snapshot.level];
        stage.frame(board.framingFor(level));
        board.deal(new Array(snapshot.size).fill(null), level);
        audio.play('riffle');
      }
      const upNow = new Set(snapshot.faceUp.map((tile) => tile.index));
      snapshot.faceUp.concat(snapshot.matched).forEach(({ index, symbol }) => board.setSymbol(index, symbol));
      snapshot.faceUp.forEach(({ index }) => {
        if (!shownUp.has(index)) {
          shownUp.add(index);
          dragon.lookAt(board.tilePosition(index));
          board.flip(index, true);
        }
      });
      snapshot.matched.forEach(({ index, seat }) => {
        if (shownMatched.has(index)) return;
        shownMatched.add(index);
        if (!shownUp.has(index)) board.flip(index, true);
        shownUp.add(index);
        board.markMatched([index], seat === local ? 'player' : 'dragon');
      });
      [...shownUp].forEach((index) => {
        if (!upNow.has(index) && !shownMatched.has(index)) {
          shownUp.delete(index);
          board.flip(index, false);
        }
      });
      if (snapshot.message) announce(snapshot.message);
      renderPanel(snapshot);
      if (snapshot.phase === 'over') showEnd(snapshot);
    }

    function sendPick(index) {
      audio.start();
      if (session.mode === 'client') session.sendToHost({ type: 'pick', index });
      else hostPick(local, index);
    }

    // Retourner une écaille en cliquant dessus, quand c'est son tour.
    const raycaster = new root.THREE.Raycaster();
    const pointer = new root.THREE.Vector2();
    let lastSnapshot = null;
    stage.renderer.domElement.addEventListener('click', (event) => {
      if (!lastSnapshot || lastSnapshot.turn !== local || lastSnapshot.phase !== 'play') return;
      const rect = stage.renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, stage.camera);
      const hit = raycaster.intersectObjects(board.hitTargets(), false)[0];
      if (hit) sendPick(hit.object.userData.tileIndex);
    });

    function display(snapshot) {
      lastSnapshot = snapshot;
      applySnapshot(snapshot);
    }

    $('party-panel').hidden = false;
    $('party-quit').addEventListener('click', () => root.location.reload());
    $('party-again').addEventListener('click', () => root.location.reload());

    if (session.mode === 'client') {
      session.onMessage((message) => {
        if (message && message.type === 'snapshot') display(message.snapshot);
      });
      return;
    }

    // ---- Déroulement de la partie (hôte, ou seul avec des bots) ----

    const level = memory.LEVELS[levelKey];
    const game = {
      symbols: memory.createBoard(levelKey),
      matched: new Map(),
      faceUp: [],
      turn: 0,
      pairs: seats.map(() => 0),
      memories: seats.map(() => new Map()),
      phase: 'play',
      busy: false,
    };
    const describe = (index) => DJ.describeScaleSymbol(game.symbols[index]);

    function snapshot(message = '') {
      return {
        level: levelKey,
        size: game.symbols.length,
        faceUp: game.faceUp.map((index) => ({ index, symbol: game.symbols[index] })),
        matched: [...game.matched].map(([index, seat]) => ({ index, seat, symbol: game.symbols[index] })),
        turn: game.turn,
        pairs: game.pairs.slice(),
        phase: game.phase,
        message,
      };
    }

    function publish(message) {
      const snap = snapshot(message);
      session.broadcast({ type: 'snapshot', snapshot: snap });
      display(snap);
    }

    const available = () => game.symbols.map((_, index) => index).filter((index) => !game.matched.has(index) && !game.faceUp.includes(index));

    /* Tous les bots voient chaque écaille retournée, et la retiennent selon leur mémoire. */
    function observe(index) {
      seats.forEach((seat, i) => {
        if (seat.isBot) memory.observe(game.memories[i], index, game.symbols[index], level.dragonMemory);
      });
    }

    function nextTurn() {
      game.turn = (game.turn + 1) % seats.length;
    }

    function hostPick(seatIndex, index) {
      if (game.phase !== 'play' || game.busy || seatIndex !== game.turn) return;
      if (game.matched.has(index) || game.faceUp.includes(index)) return;
      game.faceUp.push(index);
      observe(index);
      if (game.faceUp.length < 2) {
        publish(`${seats[seatIndex].name} retourne : ${describe(index)}.`);
        scheduleBot();
        return;
      }
      game.busy = true;
      const [first, second] = game.faceUp;
      const seen = `${seats[seatIndex].name} retourne : ${describe(first)} et ${describe(second)}.`;
      publish(seen);
      root.setTimeout(() => {
        game.faceUp = [];
        if (game.symbols[first] === game.symbols[second]) {
          game.matched.set(first, seatIndex).set(second, seatIndex);
          game.pairs[seatIndex] += 1;
          seats.forEach((_, i) => memory.forget(game.memories[i], [first, second]));
          audio.play('chip');
          if (game.matched.size === game.symbols.length) game.phase = 'over';
          game.busy = false;
          publish(`${seen} Paire trouvée !`);
        } else {
          nextTurn();
          game.busy = false;
          publish(`${seen} Pas de paire.`);
        }
        scheduleBot();
      }, MISMATCH_PAUSE_MS);
    }

    /* Si c'est au tour d'un bot, il réfléchit puis retourne une écaille. */
    function scheduleBot() {
      if (game.phase !== 'play' || game.busy || !seats[game.turn].isBot) return;
      const seatIndex = game.turn;
      root.setTimeout(() => {
        if (game.turn !== seatIndex || game.busy) return;
        const remember = game.memories[seatIndex];
        const choice = game.faceUp.length === 0
          ? memory.chooseFirst(remember, available())
          : memory.chooseSecond(remember, available().concat(game.faceUp), game.faceUp[0], game.symbols[game.faceUp[0]]);
        hostPick(seatIndex, choice);
      }, BOT_THINK_MS);
    }

    session.onMessage((seatIndex, message) => {
      if (message && message.type === 'pick') hostPick(seatIndex, message.index);
    });
    // Un invité qui part est remplacé par un bot.
    session.onLeave((seatIndex) => {
      seats[seatIndex].isBot = true;
      notify(`${seats[seatIndex].name} a quitté la partie : un bot prend sa place.`);
      scheduleBot();
    });

    publish('La partie commence.');
    scheduleBot();
  }

  DJ.startMemoryParty = startMemoryParty;
})(window);
