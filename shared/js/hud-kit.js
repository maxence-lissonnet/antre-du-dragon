/*
 * Petites briques d'interface communes aux jeux : trésor animé, messages, bouton du son, choix de la mise.
 */
(function (root) {
  'use strict';

  const numberFormat = new Intl.NumberFormat('fr-FR');
  const TOAST_MS = 3200;

  function formatCoins(amount) {
    const absolute = Math.abs(amount);
    return `${numberFormat.format(absolute)} pièce${absolute > 1 ? 's' : ''}`;
  }

  /* Compteur de pièces qui défile jusqu'à sa nouvelle valeur. */
  function createTreasureCounter(element) {
    let shown = null;
    let frame = null;
    return function set(value) {
      if (shown === null || root.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        shown = value;
        element.textContent = numberFormat.format(value);
        return;
      }
      const from = shown;
      const start = root.performance.now();
      shown = value;
      root.cancelAnimationFrame(frame);
      const step = (now) => {
        const k = Math.min((now - start) / 600, 1);
        const eased = 1 - Math.pow(1 - k, 3);
        element.textContent = numberFormat.format(Math.round(from + (value - from) * eased));
        if (k < 1) frame = root.requestAnimationFrame(step);
      };
      frame = root.requestAnimationFrame(step);
    };
  }

  function createNotifier(element) {
    let timer = null;
    return function notify(message) {
      element.textContent = message;
      element.classList.add('is-visible');
      root.clearTimeout(timer);
      timer = root.setTimeout(() => element.classList.remove('is-visible'), TOAST_MS);
    };
  }

  function bindSoundToggle(button, audio) {
    const render = (muted) => {
      button.setAttribute('aria-pressed', String(muted));
      button.setAttribute('aria-label', muted ? 'Activer le son' : 'Couper le son');
    };
    render(audio.isMuted());
    button.addEventListener('click', () => {
      audio.start();
      render(audio.toggleMute());
    });
  }

  /*
   * Rangée de mises au choix (une seule active). `update(balance, locked)` grise les mises
   * trop chères ou toutes les mises pendant une partie.
   */
  function createBetPicker({ container, values, initial = values[0], onChange = () => {} }) {
    let selected = initial;
    const buttons = values.map((value) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bet-option';
      button.textContent = numberFormat.format(value);
      button.setAttribute('aria-label', `Miser ${formatCoins(value)}`);
      button.addEventListener('click', () => {
        selected = value;
        render();
        onChange(value);
      });
      container.append(button);
      return { button, value };
    });

    function render() {
      buttons.forEach(({ button, value }) => button.setAttribute('aria-pressed', String(value === selected)));
    }

    function update(balance, locked = false) {
      buttons.forEach(({ button, value }) => {
        button.disabled = locked || value > balance;
      });
      // Si la mise choisie devient trop chère, on prend la plus grosse encore possible.
      if (selected > balance) {
        const affordable = values.filter((value) => value <= balance);
        if (affordable.length > 0) selected = affordable[affordable.length - 1];
        render();
      }
    }

    render();
    return { update, value: () => selected };
  }

  /*
   * Porte-monnaie d'un jeu : le trésor commun (profil), son affichage et le prêt du dragon
   * quand il ne reste plus de quoi miser.
   */
  function createWallet({ balanceElement, restoreButton, minBet, notify, onChange = () => {} }) {
    const profile = root.DragonJack.profile;
    const show = createTreasureCounter(balanceElement);
    let balance = profile.loadTreasure();

    function refresh() {
      show(balance);
      restoreButton.hidden = balance >= minBet;
      onChange(balance);
    }

    function change(amount) {
      balance += amount;
      profile.saveTreasure(balance);
      refresh();
    }

    restoreButton.addEventListener('click', () => {
      balance = profile.STARTING_TREASURE;
      profile.saveTreasure(balance);
      notify(`Le dragon te prête un nouveau trésor de ${formatCoins(balance)}.`);
      refresh();
    });

    refresh();
    return {
      balance: () => balance,
      canAfford: (amount) => amount <= balance,
      spend: (amount) => change(-amount),
      earn: (amount) => change(amount),
    };
  }

  /* Annonce du résultat dans la barre du bas (éléments .result, .result-title, .result-amount). */
  function createResultPanel(element) {
    const title = element.querySelector('.result-title');
    const amount = element.querySelector('.result-amount');
    return {
      show({ heading, detail, tone }) {
        title.textContent = heading;
        amount.textContent = detail;
        element.dataset.tone = tone;
        element.hidden = false;
      },
      hide() {
        element.hidden = true;
      },
    };
  }

  function bindDialog(dialog, openButton, closeButton) {
    openButton.addEventListener('click', () => dialog.showModal());
    closeButton.addEventListener('click', () => dialog.close());
  }

  /* Raccourcis clavier, ignorés quand une fenêtre est ouverte ou qu'un bouton a le focus (il réagit déjà). */
  function bindShortcuts(shortcuts) {
    document.addEventListener('keydown', (event) => {
      if (document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey) return;
      const action = shortcuts[event.key.toLowerCase()];
      if (!action) return;
      const onControl = event.target instanceof Element && event.target.closest('button, a');
      if ((event.key === ' ' || event.key === 'Enter') && onControl) return;
      event.preventDefault();
      action();
    });
  }

  root.DragonJack = root.DragonJack || {};
  root.DragonJack.hudKit = {
    formatCoins,
    numberFormat,
    createTreasureCounter,
    createNotifier,
    bindSoundToggle,
    createBetPicker,
    createWallet,
    createResultPanel,
    bindDialog,
    bindShortcuts,
  };
})(window);
