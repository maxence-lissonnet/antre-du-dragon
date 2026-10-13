/*
 * Blackjack en ligne, en salles publiques : on rejoint directement la première salle qui a de la place
 * (6 joueurs au plus) ; si toutes sont pleines, une nouvelle salle s'ouvre. Pas de bots.
 * Chacun mise depuis son propre trésor ; le gain ou la perte de la donne lui revient à la fin.
 *
 * Le premier arrivé dans une salle en est l'hôte : son navigateur fait tourner la table (table.js)
 * et diffuse après chaque étape un instantané que tout le monde affiche, hôte compris.
 * Si l'hôte part, les autres se reconnectent et le plus ancien joueur reprend la salle ;
 * la donne interrompue est annulée et chacun récupère sa mise.
 */
(function (root) {
  'use strict';

  const DJ = root.DragonJack;
  const table = DJ.table;
  const rules = DJ.rules;
  const kit = DJ.hudKit;
  const $ = (id) => document.getElementById(id);

  const GAME = 'blackjack';
  const MAX_PLAYERS = 6;
  const MAX_ROOMS = 30;
  const DEALER_STEP_MS = 750;
  const RESULT_PAUSE_MS = 4200;
  // Dès la première mise, les autres ont ce délai pour miser, sinon la donne part sans eux.
  const BET_WINDOW_MS = 20000;
  // Un joueur qui ne décide pas à temps reste (ou refuse l'assurance), pour ne pas bloquer la table.
  const TURN_TIMEOUT_MS = 40000;
  // Après le départ de l'hôte, chacun attend son tour (ordre d'arrivée) avant de reprendre la salle.
  const TAKEOVER_STEP_MS = 1500;
  // Battement de cœur : un petit signal toutes les 2 s ; après 7 s de silence, l'autre est considéré parti
  // (un onglet fermé ne coupe pas toujours la connexion de façon visible).
  const HEARTBEAT_MS = 2000;
  const SILENCE_LIMIT_MS = 7000;
  const ACTION_LABELS = { hit: 'tire', stand: 'reste', double: 'double', split: 'sépare', insurance: 'prend l’assurance', noInsurance: 'refuse l’assurance' };
  const OUTCOME_LABELS = { blackjack: 'Blackjack', win: 'Gagné', dealerBust: 'Gagné', push: 'Égalité', lose: 'Perdu', bust: 'Dépassé' };

  const wait = (ms) => new Promise((resolve) => root.setTimeout(resolve, ms));

  function formatHand(cards) {
    const { total, soft } = rules.handValue(cards);
    return soft && total < 21 ? `${total - 10}/${total}` : String(total);
  }

  function startBlackjackOnline({ name, stage, pieces, dragon, audio, notify }) {
    const labels = [];
    let me = null;
    let link = null;
    let host = null;
    let last = null;
    let appliedRound = null;
    let betSent = null;
    let betPicker = null;

    const wallet = kit.createWallet({
      balanceElement: $('balance'),
      restoreButton: $('party-restore'),
      minBet: table.MIN_BET,
      notify,
      onChange: (balance) => betPicker && betPicker.update(balance),
    });
    betPicker = kit.createBetPicker({ container: $('party-bets'), values: table.BETS, initial: 25 });
    betPicker.update(wallet.balance());

    // ---- Affichage, commun à tous les appareils ----

    const dealerLabel = document.createElement('p');
    dealerLabel.className = 'hand-label';
    dealerLabel.hidden = true;
    dealerLabel.append(Object.assign(document.createElement('span'), { textContent: 'Dragon' }), document.createElement('strong'));
    $('party-labels').append(dealerLabel);

    function seatLabel(index) {
      if (!labels[index]) {
        const label = document.createElement('div');
        label.className = 'party-seat';
        label.append(
          Object.assign(document.createElement('p'), { className: 'party-seat-name' }),
          Object.assign(document.createElement('p'), { className: 'party-seat-hands' }),
          Object.assign(document.createElement('p'), { className: 'party-seat-bet' }),
        );
        $('party-labels').append(label);
        labels[index] = label;
      }
      return labels[index];
    }

    const localIndex = (snapshot) => snapshot.seats.findIndex((seat) => seat.id === me);

    function renderLabels(snapshot) {
      const local = localIndex(snapshot);
      $('party-labels').dataset.count = String(snapshot.seats.length);
      labels.forEach((label, index) => {
        label.hidden = index >= snapshot.seats.length;
      });
      snapshot.seats.forEach((seat, index) => {
        const label = seatLabel(index);
        label.dataset.active = String(snapshot.turn === index);
        label.dataset.local = String(index === local);
        label.children[0].textContent = `${seat.name}${index === local ? ' (toi)' : ''}`;
        let hands = seat.hands.map((hand, handIndex) => `${formatHand(hand.cards)}${seat.outcomes ? ` ${OUTCOME_LABELS[seat.outcomes[handIndex]]}` : ''}`).join(' · ');
        if (!hands && snapshot.phase === 'betting') hands = seat.ready ? 'Prêt' : 'Choisit sa mise…';
        if (!hands && snapshot.phase !== 'betting') hands = 'Prochaine donne';
        label.children[1].textContent = hands;
        let bet = seat.staked ? `Mise ${kit.formatCoins(seat.staked)}` : '';
        if (seat.net !== null) bet = seat.net === 0 ? 'Mise rendue' : `${seat.net > 0 ? '+' : '−'} ${kit.formatCoins(Math.abs(seat.net))}`;
        label.children[2].textContent = bet;
        label.dataset.tone = seat.net > 0 ? 'win' : seat.net < 0 ? 'lose' : '';
      });
      dealerLabel.hidden = snapshot.dealer.length === 0;
      if (!dealerLabel.hidden) dealerLabel.querySelector('strong').textContent = formatHand(snapshot.dealer);
    }

    // Les étiquettes suivent les places à l'écran.
    stage.onFrame(() => {
      if (!last) return;
      const place = (element, point) => {
        const { x, y } = stage.projectToScreen(point);
        element.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`;
      };
      labels.forEach((label, index) => !label.hidden && place(label, pieces.seatAnchor(index)));
      if (!dealerLabel.hidden) place(dealerLabel, pieces.dealerAnchor());
    });

    function turnText(snapshot, mine) {
      if (snapshot.phase === 'betting') {
        if (!mine) return 'Tu joueras à la prochaine donne';
        return betSent !== null ? 'En attente des autres mises…' : 'Choisis ta mise';
      }
      if (snapshot.phase === 'insurance') return mine && mine.legal.length ? 'Le dragon montre un as : t’assurer ?' : 'Les autres décident de l’assurance…';
      if (snapshot.phase === 'play') return snapshot.seats[snapshot.turn].id === me ? 'À toi de jouer' : `${snapshot.seats[snapshot.turn].name} joue…`;
      if (snapshot.phase === 'dealer') return 'Le dragon tire…';
      return 'Fin de la donne';
    }

    function renderDock(snapshot) {
      const mine = snapshot.seats[localIndex(snapshot)];
      const legal = mine ? mine.legal : [];
      const betting = snapshot.phase === 'betting' && Boolean(mine) && betSent === null;
      $('party-room').textContent = `Salle ${snapshot.room} · ${snapshot.seats.length}/${MAX_PLAYERS} joueurs`;
      $('party-turn').textContent = turnText(snapshot, mine);
      $('party-turn').dataset.turn = (mine && snapshot.turn === localIndex(snapshot)) || betting ? 'player' : 'dragon';
      $('party-bet').hidden = !betting;
      $('party-insurance').hidden = !(snapshot.phase === 'insurance' && legal.length);
      $('party-play').hidden = !(snapshot.phase === 'play' && legal.length);
      ['hit', 'stand', 'double', 'split'].forEach((action) => {
        $(`party-${action}`).disabled = !legal.includes(action);
      });
      if (mine && snapshot.phase === 'insurance') $('party-insurance-cost').textContent = kit.formatCoins(mine.insuranceCost);
      $('party-bet-confirm').disabled = wallet.balance() < table.MIN_BET;
    }

    /* Fin de la donne : chacun reçoit son dû dans son propre trésor, une seule fois. */
    function settleLocal(snapshot) {
      const mine = snapshot.seats[localIndex(snapshot)];
      if (snapshot.phase !== 'done' || appliedRound === snapshot.round || betSent === null || !mine || mine.net === null) return;
      appliedRound = snapshot.round;
      wallet.earn(betSent + mine.net);
      betSent = null;
      if (mine.outcomes.includes('blackjack')) {
        audio.play('treasure');
        dragon.bow();
      } else if (mine.net > 0) {
        audio.play('coins');
        dragon.sulk();
      } else if (mine.net < 0) {
        audio.play('roar');
        dragon.breatheFire(() => stage.shake(0.25));
      } else {
        dragon.huff();
      }
    }

    function display(snapshot) {
      last = snapshot;
      const mine = snapshot.seats[localIndex(snapshot)];
      if (snapshot.phase === 'betting' && mine && mine.ready && betSent === null) betSent = mine.bet;
      const dealing = pieces.render(snapshot);
      renderLabels(snapshot);
      renderDock(snapshot);
      if (snapshot.phase === 'play' && snapshot.turn >= 0) dragon.lookAt(pieces.seatCards(snapshot.turn));
      if (snapshot.message) root.setTimeout(() => notify(snapshot.message), dealing * 1000);
      settleLocal(snapshot);
    }

    function showStatus(text) {
      $('party-turn').textContent = text;
      $('party-turn').dataset.turn = 'dragon';
      ['party-bet', 'party-insurance', 'party-play'].forEach((id) => {
        $(id).hidden = true;
      });
    }

    // ---- Commandes du joueur ----

    function send(message) {
      audio.start();
      if (host) host.receive(me, message);
      else if (link) link.send(message);
    }

    function placeBet() {
      if (!last || last.phase !== 'betting' || betSent !== null || localIndex(last) < 0) return;
      const amount = betPicker.value();
      if (!wallet.canAfford(amount)) {
        notify('Ton trésor est trop maigre pour cette mise.');
        return;
      }
      wallet.spend(amount);
      betSent = amount;
      audio.play('chip');
      send({ type: 'bet', amount, bankroll: wallet.balance() });
      renderDock(last);
    }

    const act = (action) => () => {
      const mine = last && last.seats[localIndex(last)];
      if (mine && mine.legal.includes(action)) send({ type: 'act', action });
    };
    $('party-bet-confirm').addEventListener('click', placeBet);
    $('party-hit').addEventListener('click', act('hit'));
    $('party-stand').addEventListener('click', act('stand'));
    $('party-double').addEventListener('click', act('double'));
    $('party-split').addEventListener('click', act('split'));
    $('party-insurance-yes').addEventListener('click', act('insurance'));
    $('party-insurance-no').addEventListener('click', act('noInsurance'));
    $('party-quit').addEventListener('click', () => root.location.reload());
    document.addEventListener('keydown', (event) => {
      if (document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input')) return;
      const keys = { t: 'hit', r: 'stand', d: 'double', s: 'split', a: 'insurance', n: 'noInsurance' };
      const key = event.key.toLowerCase();
      if (keys[key]) act(keys[key])();
      else if (key === 'enter' && !event.target.closest('button')) placeBet();
    });

    // ---- Connexion aux salles ----

    /* Rejoint la salle n comme invité. Renvoie 'joined', 'full' ou 'absent' (personne ne l'a ouverte). */
    async function tryJoin(room) {
      let answer = null;
      let connection;
      let early = null;
      const answered = new Promise((resolve) => {
        answer = resolve;
      });
      try {
        connection = await DJ.net.joinRoom({
          game: GAME,
          room,
          name,
          onMessage: (message) => {
            if (!message) return;
            heardFromHost = Date.now();
            if (message.type === 'full') answer('full');
            else if (message.type === 'welcome') answer('joined');
            else if (message.type === 'snapshot' && link === connection) display(message.snapshot);
            else if (message.type === 'snapshot') early = message.snapshot;
          },
          onClose: () => {
            if (link === connection) hostLost(room);
          },
        });
      } catch (error) {
        return error.type === 'peer-unavailable' || error.type === 'timeout' ? 'absent' : 'error';
      }
      const result = await Promise.race([answered, wait(8000).then(() => 'absent')]);
      if (result !== 'joined') {
        connection.close();
        return result;
      }
      me = connection.id;
      link = connection;
      heardFromHost = Date.now();
      if (early) display(early);
      return 'joined';
    }

    /* Ouvre la salle n et en devient l'hôte. Renvoie 'hosting' ou 'taken' (quelqu'un l'a ouverte entre-temps). */
    async function tryHost(room) {
      const id = `hote-salle-${room}`;
      let handle;
      const handlers = { join() {}, leave() {}, message() {} };
      try {
        handle = await DJ.net.openRoom({
          game: GAME,
          room,
          onJoin: (guest) => handlers.join(guest),
          onLeave: (guestId) => handlers.leave(guestId),
          onMessage: (guestId, message) => handlers.message(guestId, message),
        });
      } catch (error) {
        return error.type === 'unavailable-id' ? 'taken' : 'error';
      }
      me = id;
      host = createHost({ room, handle, handlers, selfId: id, selfName: name });
      return 'hosting';
    }

    /* Cherche une salle à partir de la n-ième : rejoindre si elle existe, l'ouvrir sinon, la suivante si elle est pleine. */
    async function connectFrom(firstRoom, attempts = 3) {
      for (let room = firstRoom; room <= MAX_ROOMS; room += 1) {
        showStatus(`Recherche d’une place (salle ${room})…`);
        for (let attempt = 0; attempt < (room === firstRoom ? attempts : 3); attempt += 1) {
          const joined = await tryJoin(room);
          if (joined === 'joined') return;
          if (joined === 'full') break;
          if (joined === 'absent') {
            const hosted = await tryHost(room);
            if (hosted === 'hosting') return;
          }
          // Salle en train de changer d'hôte, ou réseau capricieux : on réessaie un peu plus tard.
          await wait(1000 + Math.random() * 1500);
        }
      }
      showStatus('Aucune salle disponible pour le moment. Réessaie plus tard.');
    }

    let heardFromHost = 0;
    root.setInterval(() => {
      if (!link) return;
      link.send({ type: 'ping' });
      if (Date.now() - heardFromHost > SILENCE_LIMIT_MS) {
        const lost = link;
        link = null;
        lost.close();
        hostLost(last ? last.room : 1);
      }
    }, HEARTBEAT_MS);

    /* L'hôte est parti : on rend la mise en cours, puis on se reconnecte (le plus ancien joueur reprend la salle). */
    async function hostLost(room) {
      link = null;
      if (betSent !== null && (!last || last.phase !== 'done')) {
        wallet.earn(betSent);
        notify('L’hôte de la salle est parti : la donne est annulée et ta mise t’est rendue.');
      }
      betSent = null;
      const order = last ? Math.max(0, last.seats.filter((seat) => seat.id !== last.hostId).findIndex((seat) => seat.id === me)) : 0;
      showStatus('Reconnexion à la salle…');
      await wait(400 + order * TAKEOVER_STEP_MS);
      await connectFrom(room, 6);
    }

    // ---- Hôte : déroulement de la table ----

    function createHost({ room, handle, handlers, selfId, selfName }) {
      const players = [{ id: selfId, name: selfName, left: false }];
      const bets = new Map();
      let phase = 'betting';
      let roundNumber = 1;
      let round = null;
      let shoe = null;
      let timer = null;
      let betDeadline = null;

      const seatOf = (id) => (round ? round.ids.indexOf(id) : -1);

      function snapshot(message = '') {
        const state = round && round.state;
        const turnId = state && phase === 'play' ? round.ids[state.turn] : null;
        return {
          room,
          hostId: selfId,
          round: `${selfId}:${roundNumber}`,
          phase,
          message,
          turn: turnId ? players.findIndex((player) => player.id === turnId) : -1,
          dealer: state ? state.dealer.slice() : [],
          seats: players.map((player) => {
            const index = seatOf(player.id);
            const tableSeat = index >= 0 ? state.seats[index] : null;
            const bet = bets.get(player.id);
            return {
              id: player.id,
              name: player.name,
              ready: Boolean(bet),
              bet: bet ? bet.bet : 0,
              hands: tableSeat ? tableSeat.hands.map((hand) => ({ cards: hand.cards.slice() })) : [],
              staked: tableSeat ? table.staked(tableSeat) : bet ? bet.bet : 0,
              outcomes: tableSeat && tableSeat.result ? tableSeat.result.outcomes : null,
              net: tableSeat && tableSeat.result ? tableSeat.result.net : null,
              legal: tableSeat && phase !== 'done' ? table.legalActions(state, index) : [],
              insuranceCost: tableSeat ? table.insuranceCostFor(state, index) : 0,
            };
          }),
        };
      }

      function publish(message) {
        const snap = snapshot(message);
        handle.broadcast({ type: 'snapshot', snapshot: snap });
        display(snap);
        schedule();
      }

      function startRound() {
        const ids = players.filter((player) => !player.left && bets.has(player.id)).map((player) => player.id);
        betDeadline = null;
        if (ids.length === 0) {
          bets.clear();
          publish();
          return;
        }
        round = { ids, state: table.startRound(ids.map((id) => bets.get(id)), shoe) };
        phase = round.state.phase;
        publish('Le dragon distribue.');
      }

      const heard = new Map();
      root.setInterval(() => {
        handle.broadcast({ type: 'ping' });
        heard.forEach((time, id) => {
          if (Date.now() - time > SILENCE_LIMIT_MS) {
            heard.delete(id);
            handle.kick(id);
            handlers.leave(id);
          }
        });
      }, HEARTBEAT_MS);

      function receive(id, message) {
        if (id !== selfId) heard.set(id, Date.now());
        const player = players.find((entry) => entry.id === id && !entry.left);
        if (!player || !message || message.type === 'ping') return;
        if (message.type === 'bet' && phase === 'betting' && !bets.has(id)) {
          const bet = Number(message.amount);
          if (!table.BETS.includes(bet)) return;
          bets.set(id, { bet, bankroll: Math.max(0, Math.floor(Number(message.bankroll) || 0)) });
          if (betDeadline === null) betDeadline = Date.now() + BET_WINDOW_MS;
          publish();
          return;
        }
        const index = seatOf(id);
        if (message.type === 'act' && index >= 0 && table.legalActions(round.state, index).includes(message.action)) {
          table.act(round.state, index, message.action);
          phase = round.state.phase;
          publish(`${player.name} ${ACTION_LABELS[message.action]}.`);
        }
      }

      /* Ce qui doit se passer ensuite : départ de la donne, joueurs absents, tirage du dragon, nouvelle donne. */
      function schedule() {
        root.clearTimeout(timer);
        const state = round && round.state;
        if (phase === 'betting') {
          const present = players.filter((player) => !player.left);
          if (bets.size > 0 && present.every((player) => bets.has(player.id))) timer = root.setTimeout(startRound, 600);
          else if (betDeadline !== null) timer = root.setTimeout(startRound, Math.max(0, betDeadline - Date.now()));
          return;
        }
        if (phase === 'insurance' || phase === 'play') {
          const waiting = phase === 'play' ? [state.turn] : round.ids.map((_, index) => index).filter((index) => !state.seats[index].insuranceAnswered);
          const fallback = (index) => {
            const legal = table.legalActions(state, index);
            const action = legal.includes('noInsurance') ? 'noInsurance' : 'stand';
            if (!legal.includes(action)) return;
            table.act(state, index, action);
            phase = state.phase;
          };
          const gone = waiting.filter((index) => players.some((player) => player.id === round.ids[index] && player.left));
          // Un joueur parti « reste » aussitôt ; les autres ont un délai pour décider.
          timer = root.setTimeout(() => {
            (gone.length ? gone : waiting).forEach(fallback);
            publish();
          }, gone.length ? 300 : TURN_TIMEOUT_MS);
          return;
        }
        if (phase === 'dealer') {
          timer = root.setTimeout(() => {
            table.dealerStep(state);
            phase = state.phase;
            publish(phase === 'done' ? 'Le dragon paie la table.' : '');
          }, DEALER_STEP_MS);
          return;
        }
        if (phase === 'done') {
          timer = root.setTimeout(() => {
            shoe = state.shoe;
            round = null;
            bets.clear();
            for (let i = players.length - 1; i >= 0; i -= 1) if (players[i].left) players.splice(i, 1);
            roundNumber += 1;
            phase = 'betting';
            publish('Nouvelle donne : misez !');
          }, RESULT_PAUSE_MS);
        }
      }

      handlers.join = ({ id, name: guestName }) => {
        if (players.filter((player) => !player.left).length >= MAX_PLAYERS) {
          handle.send(id, { type: 'full' });
          root.setTimeout(() => handle.kick(id), 500);
          return;
        }
        players.push({ id, name: String(guestName).slice(0, 16) || 'Joueur', left: false });
        heard.set(id, Date.now());
        handle.send(id, { type: 'welcome' });
        publish(`${guestName} rejoint la salle.`);
      };
      handlers.leave = (id) => {
        heard.delete(id);
        const player = players.find((entry) => entry.id === id);
        if (!player || player.left) return;
        player.left = true;
        bets.delete(id);
        if (seatOf(id) < 0) players.splice(players.indexOf(player), 1);
        publish(`${player.name} quitte la salle.`);
      };
      handlers.message = receive;

      publish(`Tu ouvres la salle ${room}. Misez, puis le dragon distribue.`);
      return { receive };
    }

    $('party-panel').hidden = false;
    connectFrom(1);
  }

  DJ.startBlackjackOnline = startBlackjackOnline;
})(window);
