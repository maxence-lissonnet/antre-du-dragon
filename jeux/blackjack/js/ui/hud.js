/*
 * Interface par-dessus la scène 3D : trésor, mise, boutons d'action, totaux et messages.
 */
(function (root) {
  'use strict';

  const { wait } = root.DragonJack.tween;
  const { numberFormat, formatCoins, createTreasureCounter, createNotifier } = root.DragonJack.hudKit;

  const RESULT_TEXT = {
    blackjack: { title: 'Blackjack !', tone: 'win' },
    win: { title: 'Tu bats le dragon', tone: 'win' },
    dealerBust: { title: 'Le dragon dépasse 21', tone: 'win' },
    push: { title: 'Égalité', tone: 'push' },
    roundWin: { title: 'Tu remportes la donne', tone: 'win' },
    roundLose: { title: 'Le dragon remporte la donne', tone: 'lose' },
    lose: { title: 'Le dragon l’emporte', tone: 'lose' },
    bust: { title: 'Tu dépasses 21', tone: 'lose' },
  };
  const OUTCOME_TONES = { blackjack: 'win', win: 'win', dealerBust: 'win', push: 'push', lose: 'lose', bust: 'lose' };
  const RESULT_DISPLAY_SECONDS = 1.9;

  const $ = (id) => document.getElementById(id);

  function formatHand({ total, soft }) {
    return soft && total < 21 ? `${total - 10} ou ${total}` : String(total);
  }

  function createHud() {
    const el = {
      balance: $('balance'),
      betAmount: $('bet-amount'),
      betPanel: $('bet-panel'),
      chipRow: $('chip-row'),
      chipButtons: Array.from(document.querySelectorAll('[data-chip]')),
      clearBet: $('clear-bet'),
      rebet: $('rebet'),
      deal: $('deal'),
      restore: $('restore'),
      playPanel: $('play-panel'),
      hit: $('hit'),
      stand: $('stand'),
      double: $('double'),
      split: $('split'),
      insurancePanel: $('insurance-panel'),
      insuranceCost: $('insurance-cost'),
      playerTotals: $('player-totals'),
      dealerTotal: $('dealer-total'),
      statValues: Array.from(document.querySelectorAll('[data-stat]')),
      result: $('result'),
      resultTitle: $('result-title'),
      resultAmount: $('result-amount'),
      toast: $('toast'),
    };

    const setBalance = createTreasureCounter(el.balance);
    const notify = createNotifier(el.toast);
    let anchors = null;
    let playerLabels = [];

    function render(state) {
      setBalance(state.balance);
      el.betAmount.textContent = numberFormat.format(state.bet);

      const betting = state.phase === 'betting';
      const insurance = state.phase === 'insurance';
      el.betPanel.hidden = !betting;
      el.insurancePanel.hidden = !insurance;
      el.playPanel.hidden = betting || insurance || state.phase === 'result';
      el.insuranceCost.textContent = formatCoins(state.insuranceCost);
      el.insurancePanel.querySelectorAll('button').forEach((button) => {
        button.disabled = state.busy;
      });

      el.chipRow.hidden = state.isBroke;
      el.restore.hidden = !state.isBroke;
      el.chipButtons.forEach((button) => {
        const value = Number(button.dataset.chip);
        button.disabled = state.busy || value > state.balance || state.bet + value > state.maxBet;
      });
      el.clearBet.disabled = state.busy || state.bet === 0;
      el.rebet.disabled = state.busy || !state.canRebet;
      el.deal.disabled = state.busy || !state.canDeal;

      const canAct = state.phase === 'player' && !state.busy;
      el.hit.disabled = !canAct;
      el.stand.disabled = !canAct;
      el.double.disabled = !canAct || !state.canDouble;
      el.split.disabled = !canAct || !state.canSplit;
    }

    function createLabel() {
      const label = document.createElement('p');
      label.className = 'hand-label';
      label.append(document.createElement('span'), document.createElement('strong'));
      el.playerTotals.append(label);
      return label;
    }

    function setLabel(label, prefix, value) {
      label.hidden = value === null;
      if (value === null) return;
      label.querySelector('span').textContent = prefix;
      label.querySelector('strong').textContent = formatHand(value);
      label.classList.toggle('is-bust', value.total > 21);
    }

    /* Un total par main du joueur (plusieurs après une séparation), plus celui du dragon. */
    function showTotals({ hands, dealer }) {
      while (playerLabels.length < hands.length) playerLabels.push(createLabel());
      playerLabels.forEach((label, index) => {
        const hand = hands[index];
        if (!hand) {
          label.hidden = true;
          return;
        }
        setLabel(label, hands.length > 1 ? `Main ${index + 1}` : 'Toi', hand.value);
        label.classList.toggle('is-active', hand.active);
        label.dataset.tone = hand.outcome ? OUTCOME_TONES[hand.outcome] : '';
      });
      setLabel(el.dealerTotal, 'Dragon', dealer);
    }

    function hideTotals() {
      playerLabels.forEach((label) => {
        label.hidden = true;
      });
      el.dealerTotal.hidden = true;
    }

    /* Les totaux suivent les mains à l'écran : on projette leur position 3D à chaque image. */
    function setAnchors(project, playerAnchor, dealerAnchor) {
      anchors = { project, playerAnchor, dealerAnchor };
    }

    function updateAnchors() {
      if (!anchors) return;
      const place = (element, point) => {
        if (element.hidden) return;
        const { x, y } = anchors.project(point);
        element.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`;
      };
      playerLabels.forEach((label, index) => place(label, anchors.playerAnchor(index)));
      place(el.dealerTotal, anchors.dealerAnchor());
    }

    async function showResult(outcome, net, { insuranceWon = false } = {}) {
      const { title, tone } = RESULT_TEXT[outcome];
      el.resultTitle.textContent = title;
      let amount = 'Ta mise te revient';
      if (net > 0) amount = `+ ${formatCoins(net)}`;
      else if (net < 0) amount = `− ${formatCoins(net)}`;
      el.resultAmount.textContent = insuranceWon ? `${amount}, l’assurance a payé` : amount;
      el.result.dataset.tone = tone;
      el.result.hidden = false;
      await wait(RESULT_DISPLAY_SECONDS);
    }

    /* Palier de série : le message remplace celui du résultat, dans la barre du bas. */
    function showMilestone({ kind, count }) {
      const isWin = kind === 'win';
      el.resultTitle.textContent = isWin ? 'Sacre du joueur !' : 'Le dragon s’empare du trésor';
      el.resultAmount.textContent = `${count} donnes ${isWin ? 'gagnées' : 'perdues'} d’affilée`;
      el.result.dataset.tone = isWin ? 'win' : 'lose';
      el.result.hidden = false;
    }

    function hideResult() {
      el.result.hidden = true;
    }

    function renderStats(stats, winRate) {
      const values = {
        handsPlayed: numberFormat.format(stats.handsPlayed),
        winRate: winRate === null ? '—' : `${winRate} %`,
        handsWon: numberFormat.format(stats.handsWon),
        handsLost: numberFormat.format(stats.handsLost),
        handsPushed: numberFormat.format(stats.handsPushed),
        blackjacks: numberFormat.format(stats.blackjacks),
        biggestWin: formatCoins(stats.biggestWin),
        bestStreak: `${stats.bestStreak} donne${stats.bestStreak > 1 ? 's' : ''}`,
        highestBalance: formatCoins(stats.highestBalance),
      };
      el.statValues.forEach((element) => {
        element.textContent = values[element.dataset.stat];
      });
    }

    return { render, showTotals, hideTotals, setAnchors, updateAnchors, showResult, showMilestone, hideResult, notify, renderStats };
  }

  root.DragonJack.createHud = createHud;
})(window);
