/*
 * Blackjack à plusieurs (2 à 4 places, bots et/ou amis en ligne) face au dragon croupier.
 * Chacun mise depuis son propre trésor ; le gain ou la perte de la donne lui revient à la fin.
 *
 * L'hôte (ou l'appareil seul avec des bots) fait tourner la table (table.js) et diffuse après chaque étape
 * un instantané : cartes, mises, tour en cours, coups permis, résultats. Tout le monde affiche ces instantanés.
 */
(function (root) {
  'use strict';

  const DJ = root.DragonJack;
  const table = DJ.table;
  const rules = DJ.rules;
  const kit = DJ.hudKit;
  const $ = (id) => document.getElementById(id);

  const BOT_THINK_MS = 900;
  const DEALER_STEP_MS = 750;
  const RESULT_PAUSE_MS = 4200;
  const BOT_BETS = [25, 50, 100];
  // Un joueur qui ne décide pas à temps reste (ou refuse l'assurance), pour ne pas bloquer la table.
  const TURN_TIMEOUT_MS = 40000;
  const ACTION_LABELS = { hit: 'tire', stand: 'reste', double: 'double', split: 'sépare', insurance: 'prend l’assurance', noInsurance: 'refuse l’assurance' };
  const OUTCOME_LABELS = { blackjack: 'Blackjack', win: 'Gagné', dealerBust: 'Gagné', push: 'Égalité', lose: 'Perdu', bust: 'Dépassé' };

  function formatHand(cards) {
    const { total, soft } = rules.handValue(cards);
    return soft && total < 21 ? `${total - 10}/${total}` : String(total);
  }

  function startBlackjackParty({ session, stage, pieces, dragon, audio, notify }) {
    const seats = session.seats;
    const local = session.localIndex;
    const labels = [];
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

    function renderLabels(snapshot) {
      snapshot.seats.forEach((seat, index) => {
        const label = seatLabel(index);
        label.dataset.active = String(snapshot.turn === index);
        label.dataset.local = String(index === local);
        label.children[0].textContent = `${seats[index].name}${index === local ? ' (toi)' : ''}`;
        const hands = seat.hands.map((hand, handIndex) => {
          const outcome = seat.outcomes ? ` ${OUTCOME_LABELS[seat.outcomes[handIndex]]}` : '';
          return `${formatHand(hand.cards)}${outcome}`;
        });
        label.children[1].textContent = hands.length ? hands.join(' · ') : snapshot.phase === 'betting' ? (seat.ready ? 'Prêt' : 'Choisit sa mise…') : '';
        let bet = seat.staked ? `Mise ${kit.formatCoins(seat.staked)}` : '';
        if (seat.net !== null && seat.net !== undefined) bet = seat.net === 0 ? 'Mise rendue' : `${seat.net > 0 ? '+' : '−'} ${kit.formatCoins(Math.abs(seat.net))}`;
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
      labels.forEach((label, index) => label && place(label, pieces.seatAnchor(index)));
      if (!dealerLabel.hidden) place(dealerLabel, pieces.dealerAnchor());
    });

    function turnText(snapshot) {
      if (snapshot.phase === 'betting') return betSent ? 'En attente des autres mises…' : 'Choisis ta mise';
      if (snapshot.phase === 'insurance') return snapshot.seats[local].legal.length ? 'Le dragon montre un as : t’assurer ?' : 'Les autres décident de l’assurance…';
      if (snapshot.phase === 'play') return snapshot.turn === local ? 'À toi de jouer' : `${seats[snapshot.turn].name} joue…`;
      if (snapshot.phase === 'dealer') return 'Le dragon tire…';
      return 'Fin de la donne';
    }

    function renderDock(snapshot) {
      const mine = snapshot.seats[local];
      const betting = snapshot.phase === 'betting' && !betSent;
      $('party-turn').textContent = turnText(snapshot);
      $('party-turn').dataset.turn = snapshot.turn === local || betting ? 'player' : 'dragon';
      $('party-bet').hidden = !betting;
      $('party-insurance').hidden = !(snapshot.phase === 'insurance' && mine.legal.length);
      $('party-play').hidden = !(snapshot.phase === 'play' && snapshot.turn === local);
      ['hit', 'stand', 'double', 'split'].forEach((action) => {
        $(`party-${action}`).disabled = !mine.legal.includes(action);
      });
      if (snapshot.phase === 'insurance') $('party-insurance-cost').textContent = kit.formatCoins(mine.insuranceCost);
      $('party-bet-confirm').disabled = wallet.balance() < table.MIN_BET;
    }

    /* Fin de la donne : chacun reçoit son dû dans son propre trésor, une seule fois. */
    function settleLocal(snapshot) {
      if (snapshot.phase !== 'done' || appliedRound === snapshot.round || betSent === null) return;
      appliedRound = snapshot.round;
      const { net } = snapshot.seats[local];
      wallet.earn(betSent + net);
      betSent = null;
      const any = (outcome) => snapshot.seats[local].outcomes.includes(outcome);
      if (any('blackjack')) {
        audio.play('treasure');
        dragon.bow();
      } else if (net > 0) {
        audio.play('coins');
        dragon.sulk();
      } else if (net < 0) {
        audio.play('roar');
        dragon.breatheFire(() => stage.shake(0.25));
      } else {
        dragon.huff();
      }
    }

    function display(snapshot) {
      if (last && snapshot.round !== last.round) betSent = null;
      last = snapshot;
      if (snapshot.phase === 'betting' && snapshot.seats[local].ready && betSent === null) betSent = snapshot.seats[local].bet;
      const dealing = pieces.render(snapshot);
      renderLabels(snapshot);
      renderDock(snapshot);
      if (snapshot.phase === 'play' && snapshot.turn >= 0) dragon.lookAt(pieces.seatCards(snapshot.turn));
      if (snapshot.message) root.setTimeout(() => notify(snapshot.message), dealing * 1000);
      settleLocal(snapshot);
    }

    // ---- Commandes du joueur ----

    function send(message) {
      audio.start();
      if (session.mode === 'client') session.sendToHost(message);
      else receive(local, message);
    }

    function placeBet() {
      if (!last || last.phase !== 'betting' || betSent !== null) return;
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
      if (last && last.seats[local].legal.includes(action)) send({ type: 'act', action });
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

    $('party-panel').hidden = false;

    if (session.mode === 'client') {
      session.onMessage((message) => {
        if (message && message.type === 'snapshot') display(message.snapshot);
      });
      return;
    }

    // ---- Déroulement de la table (hôte, ou seul avec des bots) ----

    const host = {
      phase: 'betting',
      round: 1,
      bets: seats.map(() => null),
      state: null,
      shoe: null,
      timer: null,
    };

    function snapshot(message = '') {
      const { state } = host;
      return {
        round: host.round,
        phase: host.phase,
        message,
        turn: state && host.phase === 'play' ? state.turn : -1,
        dealer: state ? state.dealer.slice() : [],
        seats: seats.map((seat, index) => {
          const tableSeat = state && state.seats[index];
          return {
            ready: host.bets[index] !== null,
            bet: host.bets[index] ? host.bets[index].bet : 0,
            hands: tableSeat ? tableSeat.hands.map((hand) => ({ cards: hand.cards.slice() })) : [],
            staked: tableSeat ? table.staked(tableSeat) : host.bets[index] ? host.bets[index].bet : 0,
            outcomes: tableSeat && tableSeat.result ? tableSeat.result.outcomes : null,
            net: tableSeat && tableSeat.result ? tableSeat.result.net : null,
            legal: state && host.phase !== 'done' ? table.legalActions(state, index) : [],
            insuranceCost: state ? table.insuranceCostFor(state, index) : 0,
          };
        }),
      };
    }

    function publish(message) {
      const snap = snapshot(message);
      session.broadcast({ type: 'snapshot', snapshot: snap });
      display(snap);
      schedule();
    }

    function syncPhase() {
      host.phase = host.state.phase;
    }

    function startRound() {
      host.state = table.startRound(host.bets.map(({ bet, bankroll }) => ({ bet, bankroll })), host.shoe);
      syncPhase();
      publish('Le dragon distribue.');
    }

    function receive(seatIndex, message) {
      if (!message) return;
      if (message.type === 'bet' && host.phase === 'betting' && host.bets[seatIndex] === null) {
        const bet = Number(message.amount);
        if (!table.BETS.includes(bet)) return;
        const bankroll = Math.max(0, Math.floor(Number(message.bankroll) || 0));
        host.bets[seatIndex] = { bet, bankroll };
        publish();
        return;
      }
      if (message.type === 'act' && host.state && table.legalActions(host.state, seatIndex).includes(message.action)) {
        table.act(host.state, seatIndex, message.action);
        syncPhase();
        publish(`${seats[seatIndex].name} ${ACTION_LABELS[message.action]}.`);
      }
    }

    /* Ce qui doit se passer ensuite : mise des bots, coups des bots, tirage du dragon, nouvelle donne. */
    function schedule() {
      root.clearTimeout(host.timer);
      const { state } = host;
      if (host.phase === 'betting') {
        const botIndex = seats.findIndex((seat, index) => seat.isBot && host.bets[index] === null);
        if (botIndex >= 0) {
          host.timer = root.setTimeout(() => receive(botIndex, { type: 'bet', amount: BOT_BETS[Math.floor(Math.random() * BOT_BETS.length)], bankroll: 1e6 }), 500);
        } else if (host.bets.every((bet) => bet !== null)) {
          host.timer = root.setTimeout(startRound, 600);
        }
        return;
      }
      if (host.phase === 'insurance' || host.phase === 'play') {
        const waiting = host.phase === 'play' ? [state.turn] : seats.map((_, index) => index).filter((index) => !state.seats[index].insuranceAnswered);
        const bot = waiting.find((index) => seats[index].isBot);
        if (bot !== undefined) {
          host.timer = root.setTimeout(() => receive(bot, { type: 'act', action: table.botAction(state, bot) }), BOT_THINK_MS);
        } else {
          host.timer = root.setTimeout(() => {
            waiting.forEach((index) => {
              const legal = table.legalActions(state, index);
              const fallback = legal.includes('noInsurance') ? 'noInsurance' : 'stand';
              if (legal.includes(fallback)) receive(index, { type: 'act', action: fallback });
            });
          }, TURN_TIMEOUT_MS);
        }
        return;
      }
      if (host.phase === 'dealer') {
        host.timer = root.setTimeout(() => {
          table.dealerStep(state);
          syncPhase();
          publish(host.phase === 'done' ? 'Le dragon paie la table.' : '');
        }, DEALER_STEP_MS);
        return;
      }
      if (host.phase === 'done') {
        host.timer = root.setTimeout(() => {
          host.shoe = state.shoe;
          host.state = null;
          host.bets = seats.map(() => null);
          host.round += 1;
          host.phase = 'betting';
          publish('Nouvelle donne : misez !');
        }, RESULT_PAUSE_MS);
      }
    }

    session.onMessage(receive);
    // Un invité qui part est remplacé par un bot (il joue sa main au plus simple).
    session.onLeave((seatIndex) => {
      seats[seatIndex].isBot = true;
      notify(`${seats[seatIndex].name} a quitté la table : un bot prend sa place.`);
      schedule();
    });

    publish('Misez, puis le dragon distribue.');
  }

  DJ.startBlackjackParty = startBlackjackParty;
})(window);
