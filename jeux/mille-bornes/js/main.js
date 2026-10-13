/*
 * Mille Bornes : salon (bots ou en ligne), déroulement de la partie, table 3D et main du joueur.
 * En solo et chez l'hôte, la partie tourne ici et chaque invité reçoit sa propre vue
 * (sans les cartes des autres). Un invité envoie seulement ses coups à l'hôte.
 */
(function (root) {
  'use strict';

  const DJ = root.DragonJack;
  const THREE = root.THREE;
  const rules = DJ.milleBornes;
  const bot = DJ.milleBornesBot;
  const kit = DJ.hudKit;
  const cards = DJ.milleBornesCards;
  const $ = (id) => document.getElementById(id);

  const BOT_NAMES = ['Le dragon', 'La wyverne', 'La salamandre'];
  const BOT_DELAY_MS = 900;
  const DRAW_DELAY_MS = 350;
  const BOT_COUP_FOURRE_MS = 700;
  // Délai laissé à un joueur humain pour décider d'un coup-fourré.
  const COUP_FOURRE_TIMEOUT_MS = 10000;
  const MOUNDS = [
    { x: 0, z: -12, radius: 7, height: 3.4 },
    { x: -8.5, z: -8, radius: 5, height: 2.6 },
    { x: 8.5, z: -8.5, radius: 5.2, height: 2.8 },
    { x: -11, z: 0, radius: 3.6, height: 1.4 },
    { x: 11, z: 0, radius: 3.6, height: 1.3 },
  ];

  /* Phrase qui décrit ce qui vient de se passer. */
  function describe(event, view) {
    const name = (index) => view.players[index].name;
    const label = (card) => rules.LABELS[card.type];
    switch (event.type) {
      case 'distance': return `${name(event.player)} avance de ${event.card.value} bornes.`;
      case 'attack': return `${name(event.player)} pose « ${label(event.card)} » sur ${name(event.target)}.`;
      case 'remedy': return `${name(event.player)} joue « ${label(event.card)} ».`;
      case 'safety': return `${name(event.player)} pose la botte « ${label(event.card)} » et rejoue.`;
      case 'coupFourre': return `Coup-fourré de ${name(event.player)} avec « ${label(event.card)} » !`;
      case 'discard': return `${name(event.player)} défausse « ${label(event.card)} ».`;
      case 'goal': return `${name(event.player)} atteint les 1000 bornes !`;
      default: return '';
    }
  }

  /* État affiché sous le nom d'un joueur. */
  function statusOf(player) {
    const battle = rules.top(player.battle);
    if (battle && battle.kind === 'hazard') return { text: rules.LABELS[battle.type], alert: true };
    if (!rules.isRolling(player)) return { text: 'À l’arrêt : feu vert attendu', alert: true };
    return { text: rules.isLimited(player) ? 'Roule, limité à 50' : 'Roule', alert: rules.isLimited(player) };
  }

  async function init() {
    if (!DJ.boot.hasWebGL()) {
      DJ.boot.showFallback(DJ.boot.MESSAGES.noWebGL);
      return;
    }
    await DJ.boot.loadFonts();

    const audio = DJ.createAudio();
    const notify = kit.createNotifier($('toast'));
    const lair = DJ.createLairScene({
      container: $('stage'),
      camera: {
        target: new THREE.Vector3(0, 0, 0.6),
        direction: new THREE.Vector3(0, 9, 6.5),
        baseDistance: 12,
        visibleHalfWidth: { landscape: 5.8, portrait: 5.2 },
        introOffset: new THREE.Vector3(0, 4, 6),
      },
      mounds: MOUNDS,
      // Le dragon s'accoude au bout de la table et surveille la partie.
      dragonPosition: new THREE.Vector3(0, 0, -2.6),
      keyLightTarget: new THREE.Vector3(0, 0, 0),
    });
    const { stage, scene, dragon } = lair;
    const table = DJ.createMilleBornesTable({ scene, labels: rules.LABELS });

    let session = null;
    let state = null;
    let view = null;
    let timer = null;
    let selectedCard = null;
    const labels = [];

    // ---- Affichage (commun à l'hôte, au solo et aux invités) ----

    function renderSeatLabels() {
      const container = $('seat-labels');
      while (labels.length < view.players.length) {
        const label = document.createElement('div');
        label.className = 'seat-label';
        label.innerHTML = '<div class="seat-name"></div><div class="seat-km"><span></span></div><div class="seat-status"></div>';
        container.append(label);
        labels.push(label);
      }
      view.players.forEach((player, index) => {
        const label = labels[index];
        const status = statusOf(player);
        const handCount = typeof player.hand === 'number' ? `, ${player.hand} cartes` : '';
        label.querySelector('.seat-name').textContent = `${player.name}${index === session.localIndex ? ' (toi)' : ''}`;
        label.querySelector('.seat-km span').style.width = `${(player.km / rules.GOAL) * 100}%`;
        const statusLine = label.querySelector('.seat-status');
        statusLine.textContent = `${player.km} bornes. ${status.text}${handCount}`;
        statusLine.dataset.alert = String(status.alert);
        label.dataset.active = String(index === view.turn && view.phase !== 'over');
      });
    }

    function placeSeatLabels() {
      if (!view) return;
      labels.forEach((label, index) => {
        const { x, y } = stage.projectToScreen(table.seatAnchor(index, index === session.localIndex));
        label.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`;
      });
    }

    function renderHand() {
      const me = view.players[session.localIndex];
      const myTurn = view.phase === 'play' && view.turn === session.localIndex;
      const moves = myTurn ? rules.legalMoves(view, session.localIndex) : [];
      const list = $('hand');
      list.replaceChildren(
        ...me.hand.map((card) => {
          const item = document.createElement('li');
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'hand-card';
          button.disabled = !myTurn;
          button.setAttribute('aria-pressed', String(selectedCard === card.id));
          button.dataset.playable = String(moves.some((move) => move.cardId === card.id && move.action === 'play'));
          button.setAttribute('aria-label', rules.LABELS[card.type]);
          const image = document.createElement('img');
          image.src = cards.cardImage(card, rules.LABELS);
          image.alt = '';
          button.append(image);
          button.addEventListener('click', () => {
            selectedCard = selectedCard === card.id ? null : card.id;
            renderHand();
          });
          item.append(button);
          return item;
        }),
      );
      // Boutons d'action pour la carte choisie : jouer, attaquer tel joueur, défausser.
      const actions = $('card-actions');
      const forCard = moves.filter((move) => move.cardId === selectedCard);
      actions.hidden = forCard.length === 0;
      actions.replaceChildren(
        ...forCard.map((move) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = move.action === 'discard' ? 'button button-quiet' : 'button button-primary';
          button.textContent = move.action === 'discard' ? 'Défausser' : move.target !== undefined ? `Attaquer ${view.players[move.target].name}` : 'Jouer';
          button.addEventListener('click', () => {
            selectedCard = null;
            sendMove(move);
          });
          return button;
        }),
      );
      const coupFourre = view.phase === 'coupFourre' && view.pending && view.pending.target === session.localIndex && view.pending.safetyId;
      $('coup-fourre').hidden = !coupFourre;
    }

    function renderScores(scores) {
      $('end-panel').hidden = false;
      $('play-panel').hidden = true;
      const best = Math.max(...scores.map((entry) => entry.total));
      const winners = scores.filter((entry) => entry.total === best).map((entry) => view.players[entry.player].name);
      $('end-title').textContent = winners.length > 1 ? `Égalité : ${winners.join(' et ')}` : `${winners[0]} gagne la manche !`;
      $('scores').replaceChildren(
        ...scores.map((entry) => {
          const card = document.createElement('section');
          card.className = 'score-card';
          card.dataset.winner = String(entry.total === best);
          const title = document.createElement('h3');
          title.textContent = view.players[entry.player].name;
          card.append(title);
          entry.lines.forEach((line) => {
            const row = document.createElement('div');
            row.className = 'score-line';
            row.append(Object.assign(document.createElement('span'), { textContent: line.label }), Object.assign(document.createElement('span'), { textContent: kit.numberFormat.format(line.points) }));
            card.append(row);
          });
          const total = document.createElement('div');
          total.className = 'score-total';
          total.append(Object.assign(document.createElement('span'), { textContent: 'Total' }), Object.assign(document.createElement('span'), { textContent: kit.numberFormat.format(entry.total) }));
          card.append(total);
          return card;
        }),
      );
      const won = winners.includes(view.players[session.localIndex].name);
      audio.play(won ? 'fanfare' : 'grumble');
      if (won) dragon.bow(1.2);
      else dragon.huff();
    }

    function showView(nextView, events = [], scores = null) {
      view = nextView;
      table.render(view, session.localIndex);
      renderSeatLabels();
      renderHand();
      const myTurn = view.turn === session.localIndex;
      const banner = $('turn-banner');
      banner.dataset.mine = String(myTurn && view.phase !== 'over');
      banner.textContent = view.phase === 'over' ? 'Fin de la manche' : myTurn ? 'À toi de jouer' : `Au tour de ${view.players[view.turn].name}`;
      const text = events.map((event) => describe(event, view)).filter(Boolean).join(' ');
      if (text) $('action-log').textContent = text;
      events.forEach((event) => {
        if (['distance', 'remedy', 'discard', 'attack'].includes(event.type)) audio.play('card');
        if (event.type === 'attack' && event.target === session.localIndex) audio.play('grumble');
        if (event.type === 'coupFourre' || event.type === 'safety') audio.play('treasure');
      });
      dragon.lookAt(table.seatCenter(view.turn));
      if (scores) renderScores(scores);
    }

    // ---- Déroulement de la partie (solo et hôte uniquement) ----

    function publish(events) {
      const scores = state.phase === 'over' ? rules.score(state) : null;
      session.seats.forEach((seat, index) => {
        if (!seat.isBot && !seat.isLocal) session.sendTo(index, { type: 'view', view: rules.viewFor(state, index), events, scores });
      });
      showView(rules.viewFor(state, session.localIndex), events, scores);
    }

    function applyMove(move) {
      let events;
      try {
        events = rules.play(state, move);
      } catch (error) {
        return;
      }
      publish(events);
      schedule();
    }

    function applyCoupFourre(accept) {
      if (state.phase !== 'coupFourre') return;
      publish(rules.respondCoupFourre(state, accept));
      schedule();
    }

    /* Lance l'étape suivante : pioche automatique, coup d'un bot, ou attente d'un joueur. */
    function schedule() {
      root.clearTimeout(timer);
      if (state.phase === 'over') return;
      if (state.phase === 'draw') {
        timer = root.setTimeout(() => {
          publish(rules.drawCard(state));
          schedule();
        }, DRAW_DELAY_MS);
        return;
      }
      if (state.phase === 'play' && session.seats[state.turn].isBot) {
        timer = root.setTimeout(() => applyMove(bot.chooseMove(state)), BOT_DELAY_MS);
        return;
      }
      if (state.phase === 'coupFourre') {
        const isBot = session.seats[state.pending.target].isBot;
        timer = root.setTimeout(() => applyCoupFourre(isBot ? bot.wantsCoupFourre() : false), isBot ? BOT_COUP_FOURRE_MS : COUP_FOURRE_TIMEOUT_MS);
      }
    }

    function onRemoteAction(index, message) {
      if (!message) return;
      if (message.type === 'move' && state.phase === 'play' && state.turn === index) applyMove(message.move);
      if (message.type === 'coupFourre' && state.phase === 'coupFourre' && state.pending.target === index) applyCoupFourre(Boolean(message.accept));
    }

    /* Un invité qui part est remplacé par un bot, pour que la partie continue. */
    function onRemoteLeave(index) {
      const seat = session.seats[index];
      seat.isBot = true;
      state.players[index].isBot = true;
      notify(`${seat.name} a quitté la partie : un bot prend sa place.`);
      schedule();
    }

    // ---- Actions du joueur local ----

    function sendMove(move) {
      audio.start();
      if (session.mode === 'client') session.sendToHost({ type: 'move', move });
      else applyMove(move);
    }

    function sendCoupFourre(accept) {
      $('coup-fourre').hidden = true;
      if (session.mode === 'client') session.sendToHost({ type: 'coupFourre', accept });
      else applyCoupFourre(accept);
    }

    function startSession(started) {
      session = started;
      audio.start();
      $('lobby-panel').hidden = true;
      $('play-panel').hidden = false;
      if (session.mode === 'client') {
        session.onMessage((message) => {
          if (message && message.type === 'view') showView(message.view, message.events, message.scores);
        });
        $('turn-banner').textContent = 'La partie commence…';
        return;
      }
      state = rules.createGame(session.seats.map((seat, index) => ({ id: index, name: seat.name, isBot: seat.isBot })));
      session.onMessage(onRemoteAction);
      session.onLeave(onRemoteLeave);
      publish([]);
      schedule();
    }

    $('cf-yes').addEventListener('click', () => sendCoupFourre(true));
    $('cf-no').addEventListener('click', () => sendCoupFourre(false));
    $('again').addEventListener('click', () => root.location.reload());
    kit.bindSoundToggle($('sound-toggle'), audio);
    kit.bindDialog($('rules'), $('rules-open'), $('rules-close'));
    stage.onFrame(placeSeatLabels);

    DJ.createLobby({
      container: $('lobby-panel'),
      game: 'mille-bornes',
      minPlayers: 2,
      maxPlayers: 4,
      botNames: BOT_NAMES,
      notify,
      onStart: startSession,
    });
    dragon.lookAt(new THREE.Vector3(0, 0, 2));
    stage.flyIn();
  }

  init().catch((error) => {
    console.error(error);
    DJ.boot.showFallback(DJ.boot.MESSAGES.loadError);
  });
})(window);
