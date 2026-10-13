/*
 * Point d'entrée : assemble la scène 3D, le dragon, l'interface et la partie, puis branche les contrôles.
 */
(function (root) {
  'use strict';

  const DJ = root.DragonJack;
  const THREE = root.THREE;
  const $ = (id) => document.getElementById(id);

  const TABLE_CENTER = new THREE.Vector3(0, 0, 0.6);
  // Là où se tient le joueur : le dragon s'incline dans cette direction.
  const PLAYER_POSITION = new THREE.Vector3(0, 2, 8);
  const AWAKEN_DELAY_SECONDS = 1.1;

  function loadDragonChoice() {
    const saved = DJ.profile.loadDragon();
    return DJ.DRAGON_THEMES.includes(saved) ? saved : DJ.DEFAULT_DRAGON;
  }

  function createView({ hud, pieces, dragon, stage, audio, goldRain, streakEffects }) {
    /* Blackjack du joueur : pluie d'or sur la table et révérence du dragon. */
    async function celebrateBlackjack() {
      audio.play('treasure');
      audio.play('coins');
      audio.play('roar');
      dragon.lookAt(PLAYER_POSITION);
      stage.shake(0.15);
      await Promise.all([goldRain.trigger(), dragon.bow()]);
    }

    async function dragonReact(reaction, handIndex) {
      if (reaction === 'blackjack') {
        await celebrateBlackjack();
      } else if (reaction === 'fire') {
        dragon.lookAt(pieces.betTarget(handIndex));
        audio.play('roar');
        await dragon.breatheFire(() => stage.shake(0.35));
      } else if (reaction === 'sulk') {
        audio.play('treasure');
        audio.play('grumble');
        await dragon.sulk();
      } else {
        await dragon.huff();
      }
      dragon.lookAt(TABLE_CENTER);
    }

    return {
      render: hud.render,
      notify: hud.notify,
      showTotals: hud.showTotals,
      hideTotals: hud.hideTotals,
      showResult: hud.showResult,
      hideResult: hud.hideResult,
      placeChip: pieces.placeChip,
      clearChips: pieces.clearChips,
      placeInsurance: pieces.placeInsurance,
      settleInsurance: pieces.settleInsurance,
      settleHands: pieces.settleHands,
      splitHand: pieces.splitHand,
      shoeChanged: pieces.shoeChanged,
      cutCardOut: pieces.cutCardOut,
      burnCards: pieces.burnCards,
      async shuffleShoe(total, cutRemaining) {
        dragon.lookAt(pieces.shuffleCenter());
        await pieces.shuffleShoe(total, cutRemaining);
        dragon.lookAt(TABLE_CENTER);
      },
      dragonReact,
      async celebrateStreak(milestone) {
        hud.showMilestone(milestone);
        await streakEffects.play(milestone.kind);
      },
      statsChanged: (stats) => hud.renderStats(stats, DJ.stats.winRate(stats)),
      focusHand: (handIndex) => dragon.lookAt(pieces.handCenter(handIndex)),
      focusDealer: () => dragon.lookAt(pieces.dealerCenter()),
      async dealCard(card, owner, handIndex) {
        dragon.lookAt(owner === 'player' ? pieces.handCenter(handIndex) : pieces.dealerCenter());
        await pieces.dealCard(card, owner, handIndex);
      },
      async collectCards() {
        dragon.lookAt(TABLE_CENTER);
        await pieces.collectCards();
      },
    };
  }

  function bindSettingsDialog(dragon) {
    const dialog = $('settings');
    const choice = loadDragonChoice();
    $('settings-open').addEventListener('click', () => {
      dialog.showModal();
      // Le focus va sur le dragon choisi, pas sur le premier de la liste.
      dialog.querySelector('input[name="dragon"]:checked')?.focus();
    });
    document.querySelectorAll('input[name="dragon"]').forEach((input) => {
      input.checked = input.value === choice;
      // Le dragon change aussitôt, visible derrière la fenêtre.
      input.addEventListener('change', () => {
        dragon.setTheme(input.value);
        DJ.profile.saveDragon(input.value);
      });
    });
  }

  function bindStatsDialog(game) {
    const dialog = $('stats');
    const reset = $('stats-reset');
    const resetLabel = reset.textContent;
    // Remise à zéro en deux temps, pour éviter d'effacer ses statistiques par erreur.
    const disarmReset = () => {
      delete reset.dataset.armed;
      reset.textContent = resetLabel;
    };
    $('stats-open').addEventListener('click', () => dialog.showModal());
    $('stats-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', disarmReset);
    reset.addEventListener('click', () => {
      if (!reset.dataset.armed) {
        reset.dataset.armed = 'true';
        reset.textContent = 'Confirmer la remise à zéro';
        return;
      }
      game.resetStats();
      disarmReset();
    });
  }

  function bindControls({ game, audio, hud, dragon, onStart }) {
    const withSound = (action) => () => {
      audio.start();
      action();
    };

    document.querySelectorAll('[data-chip]').forEach((button) => {
      button.addEventListener('click', withSound(() => game.addChip(Number(button.dataset.chip))));
    });
    const buttonActions = {
      'clear-bet': game.clearBet,
      rebet: game.rebet,
      deal: game.deal,
      restore: game.restoreTreasure,
      hit: game.hit,
      stand: game.stand,
      double: game.double,
      split: game.split,
      'insurance-accept': game.takeInsurance,
      'insurance-decline': game.declineInsurance,
      start: onStart,
    };
    Object.entries(buttonActions).forEach(([id, action]) => $(id).addEventListener('click', withSound(action)));

    DJ.hudKit.bindSoundToggle($('sound-toggle'), audio);

    const rules = $('rules');
    $('rules-open').addEventListener('click', () => rules.showModal());
    $('rules-close').addEventListener('click', () => rules.close());
    bindStatsDialog(game);
    bindSettingsDialog(dragon);

    const shortcuts = { t: game.hit, r: game.stand, d: game.double, s: game.split, a: game.takeInsurance, n: game.declineInsurance };
    document.addEventListener('keydown', (event) => {
      const dialogOpen = document.querySelector('dialog[open]');
      if (dialogOpen || document.body.classList.contains('is-intro') || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (shortcuts[key]) {
        withSound(shortcuts[key])();
      } else if (key === 'enter' && !event.target.closest('button')) {
        withSound(game.deal)();
      }
    });
  }

  async function init() {
    if (!DJ.boot.hasWebGL()) {
      DJ.boot.showFallback(DJ.boot.MESSAGES.noWebGL);
      return;
    }
    await DJ.boot.loadFonts();

    const audio = DJ.createAudio();
    const hud = DJ.createHud();
    const stage = DJ.createStage($('stage'));
    const particles = DJ.createParticles();
    stage.scene.add(particles.points);
    stage.onResize((height, fov) => particles.setProjectionScale(height, fov));

    const environment = DJ.createEnvironment({ scene: stage.scene, renderer: stage.renderer, particles });
    const dragon = DJ.createDragon({ particles });
    stage.scene.add(dragon.group);
    dragon.setTheme(loadDragonChoice());
    dragon.setEyeGlow(0.12);
    const goldRain = DJ.createGoldRain({ scene: stage.scene, particles, groundHeight: environment.groundHeight });

    const streakEffects = DJ.createStreakEffects({ scene: stage.scene, particles, environment, dragon, stage, audio });
    const pieces = DJ.createTablePieces({ scene: stage.scene, renderer: stage.renderer, audio, particles });
    hud.setAnchors(
      stage.projectToScreen,
      (handIndex) => pieces.handAnchor('player', handIndex),
      () => pieces.handAnchor('dealer'),
    );

    stage.onFrame((dt, time) => {
      DJ.tween.update(dt);
      environment.update(dt, time);
      dragon.update(dt, time);
      goldRain.update(dt);
      streakEffects.update(dt);
      particles.update(dt);
      hud.updateAnchors();
    });

    const game = DJ.createGame(createView({ hud, pieces, dragon, stage, audio, goldRain, streakEffects }));
    game.refresh();
    hud.renderStats(game.getStats(), DJ.stats.winRate(game.getStats()));

    async function start() {
      const intro = $('intro');
      intro.classList.add('is-leaving');
      document.body.classList.remove('is-intro');
      stage.flyIn();
      await DJ.tween.wait(AWAKEN_DELAY_SECONDS);
      audio.play('grumble');
      await dragon.awaken();
      intro.hidden = true;
      await game.prepareShoe();
      document.querySelector('[data-chip]:not(:disabled)')?.focus({ preventScroll: true });
    }

    /* Jeu en ligne : on demande le nom, puis party.js trouve une salle publique et mène les donnes. */
    async function startParty() {
      audio.start();
      $('bet-panel').hidden = true;
      const intro = $('intro');
      intro.classList.add('is-leaving');
      document.body.classList.remove('is-intro');
      stage.flyIn();
      await DJ.tween.wait(AWAKEN_DELAY_SECONDS);
      audio.play('grumble');
      dragon.awaken();
      intro.hidden = true;
      pieces.shoeChanged(DJ.rules.DECK_COUNT * 52);
      const nameInput = $('online-name');
      nameInput.value = DJ.profile.loadName();
      $('online-panel').hidden = false;
      nameInput.focus({ preventScroll: true });
      $('online-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const name = nameInput.value.trim().slice(0, 16);
        if (!name) return;
        if (!DJ.net.available()) {
          hud.notify('Le jeu en ligne n’est pas disponible (bibliothèque réseau absente).');
          return;
        }
        DJ.profile.saveName(name);
        $('online-panel').hidden = true;
        const partyPieces = DJ.createPartyPieces({ scene: stage.scene, renderer: stage.renderer, audio });
        DJ.startBlackjackOnline({ name, stage, pieces: partyPieces, dragon, audio, notify: hud.notify });
      });
    }

    bindControls({ game, audio, hud, dragon, onStart: start });
    $('party-start').addEventListener('click', startParty);
    const startButton = $('start');
    startButton.disabled = false;
    startButton.textContent = 'Prendre place';
    $('party-start').disabled = false;
  }

  init().catch((error) => {
    console.error(error);
    DJ.boot.showFallback(DJ.boot.MESSAGES.loadError);
  });
})(window);
