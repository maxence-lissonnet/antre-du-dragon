/*
 * Machine à sous du trésor : relie les règles (slots.js), la machine 3D, le dragon et l'interface.
 */
(function (root) {
  'use strict';

  const DJ = root.DragonJack;
  const THREE = root.THREE;
  const slots = DJ.slots;
  const kit = DJ.hudKit;
  const $ = (id) => document.getElementById(id);

  const JACKPOT_KEY = 'antre-du-dragon.machine.jackpot';
  // Un gain d'au moins 10 fois la mise fait bouder le dragon.
  const BIG_WIN_FACTOR = 10;
  // Tirer le levier de cette distance (en pixels) l'amène tout en bas ; au-delà de 75 %, les rouleaux partent.
  const LEVER_DRAG_PX = 160;
  const LEVER_TRIGGER = 0.75;
  const SYMBOL_NAMES = { coin: 'Pièce', egg: 'Œuf de dragon', sword: 'Épée', chalice: 'Calice', crown: 'Couronne', dragon: 'Dragon' };
  const MOUNDS = [
    { x: 0, z: -7.5, radius: 6.5, height: 4.8 },
    { x: -7, z: -8, radius: 5, height: 2.8 },
    { x: 7, z: -8.5, radius: 5.2, height: 3 },
    { x: -10.5, z: -2, radius: 3.8, height: 1.6 },
    { x: 10.5, z: -2, radius: 3.8, height: 1.5 },
  ];

  function loadJackpot() {
    try {
      const saved = Number(root.localStorage.getItem(JACKPOT_KEY));
      return Number.isFinite(saved) && saved >= slots.JACKPOT_SEED ? saved : slots.JACKPOT_SEED;
    } catch (error) {
      return slots.JACKPOT_SEED;
    }
  }

  function saveJackpot(amount) {
    try {
      root.localStorage.setItem(JACKPOT_KEY, String(amount));
    } catch (error) {
      // Navigation privée : le jackpot repartira de sa valeur de départ.
    }
  }

  function buildPaytable() {
    const list = $('paytable');
    slots.SYMBOLS.slice().reverse().forEach((symbol) => {
      const item = document.createElement('li');
      const canvas = document.createElement('canvas');
      canvas.width = 88;
      canvas.height = 88;
      canvas.setAttribute('aria-hidden', 'true');
      DJ.slotSymbols.drawIcon(canvas, symbol);
      const text = document.createElement('div');
      const name = document.createElement('span');
      name.textContent = SYMBOL_NAMES[symbol];
      const gain = document.createElement('strong');
      gain.textContent = symbol === 'dragon' ? 'Jackpot (mise 100)' : `× ${slots.PAYOUTS[symbol]}`;
      text.append(name, gain);
      item.append(canvas, text);
      list.append(item);
    });
  }

  /* Gerbe de pièces qui jaillit du plateau de la machine. */
  function coinBurst(particles, position, count) {
    for (let i = 0; i < count; i += 1) {
      particles.emit({
        position,
        velocity: { x: (Math.random() - 0.5) * 3, y: 2 + Math.random() * 3, z: 1 + Math.random() * 2 },
        life: 0.8 + Math.random() * 0.5,
        size: 0.3,
        endSize: 0.08,
        buoyancy: -6,
        ramp: 'gold',
      });
    }
  }

  async function init() {
    if (!DJ.boot.hasWebGL()) {
      DJ.boot.showFallback(DJ.boot.MESSAGES.noWebGL);
      return;
    }
    await DJ.boot.loadFonts();

    const audio = DJ.createAudio();
    const notify = kit.createNotifier($('toast'));
    const result = kit.createResultPanel($('result'));
    const lair = DJ.createLairScene({
      container: $('stage'),
      camera: {
        target: new THREE.Vector3(0, 1.1, 0),
        direction: new THREE.Vector3(0, 0.9, 4),
        baseDistance: 8.5,
        visibleHalfWidth: { landscape: 4.8, portrait: 2.7 },
        introOffset: new THREE.Vector3(0, 3, 7),
      },
      mounds: MOUNDS,
      dragonPosition: new THREE.Vector3(0, 1.5, -2.5),
      keyLightTarget: new THREE.Vector3(0, 0.5, 0),
    });
    const { stage, scene, particles, dragon } = lair;
    const goldRain = DJ.createGoldRain({ scene, particles, groundHeight: () => lair.floorY + 0.05, area: { minX: -6, maxX: 6, minZ: -2, maxZ: 5 } });
    const strips = slots.createStrips();
    const machine = DJ.createSlotMachine({ scene, renderer: stage.renderer, strips, lines: slots.LINES, audio });
    stage.onFrame((dt, time) => {
      goldRain.update(dt);
      machine.update(time);
    });
    let stops = slots.spin(strips);
    machine.setStops(stops);

    let jackpot = loadJackpot();
    const showJackpot = () => {
      machine.setJackpot(jackpot);
      $('jackpot-readout').textContent = kit.formatCoins(Math.floor(jackpot));
    };
    showJackpot();

    let spinning = false;
    let picker = null;
    const wallet = kit.createWallet({
      balanceElement: $('balance'),
      restoreButton: $('restore'),
      minBet: slots.BETS[0],
      notify,
      onChange: (balance) => {
        if (picker) picker.update(balance, spinning);
        $('spin').disabled = spinning || balance < slots.BETS[0];
      },
    });
    picker = kit.createBetPicker({ container: $('bet-picker'), values: slots.BETS, initial: slots.BETS[0] });
    picker.update(wallet.balance());

    function setSpinning(value) {
      spinning = value;
      picker.update(wallet.balance(), spinning);
      $('spin').disabled = spinning || wallet.balance() < slots.BETS[0];
    }

    async function react(outcome, bet) {
      if (outcome.jackpotWon) {
        audio.play('fanfare');
        audio.play('coins');
        dragon.lookAt(new THREE.Vector3(0, 2, 8));
        await Promise.all([goldRain.trigger(), dragon.bow(1.6)]);
      } else if (outcome.total >= bet * BIG_WIN_FACTOR) {
        audio.play('treasure');
        audio.play('grumble');
        await dragon.sulk();
      } else if (outcome.total > 0) {
        audio.play('treasure');
      }
      dragon.lookAt(machine.windowCenter);
    }

    function describe(outcome, bet) {
      if (outcome.jackpotWon) return { heading: 'Jackpot !', detail: `+ ${kit.formatCoins(outcome.total)}`, tone: 'win' };
      if (outcome.total === 0) return { heading: 'Pas d’alignement', detail: `Le dragon garde ta mise de ${kit.formatCoins(bet)}`, tone: 'lose' };
      const lines = outcome.wins.length > 1 ? `${outcome.wins.length} lignes gagnantes` : '1 ligne gagnante';
      const heading = outcome.total >= bet * BIG_WIN_FACTOR ? 'Gros gain !' : lines;
      return { heading, detail: `+ ${kit.formatCoins(outcome.total)}`, tone: 'win' };
    }

    /* `leverAlreadyPulled` : le joueur a lui-même tiré le levier, inutile de l'animer à nouveau. */
    async function spin(leverAlreadyPulled = false) {
      if (spinning) return;
      audio.start();
      const bet = picker.value();
      if (!wallet.canAfford(bet)) {
        notify('Ton trésor est trop maigre pour cette mise.');
        return;
      }
      setSpinning(true);
      result.hide();
      wallet.spend(bet);
      jackpot = slots.jackpotAfterBet(jackpot, bet);
      saveJackpot(jackpot);
      showJackpot();

      audio.play('riffle');
      dragon.lookAt(machine.windowCenter);
      if (leverAlreadyPulled !== true) machine.pullLever();
      stops = slots.spin(strips);
      await machine.spinTo(stops);

      const outcome = slots.evaluate(slots.visibleGrid(strips, stops), bet, jackpot);
      if (outcome.jackpotWon) {
        jackpot = slots.JACKPOT_SEED;
        saveJackpot(jackpot);
        showJackpot();
      }
      if (outcome.total > 0) {
        wallet.earn(outcome.total);
        coinBurst(particles, machine.trayPosition, Math.min(120, 20 + Math.round(outcome.total / bet) * 6));
      }
      result.show(describe(outcome, bet));
      await Promise.all([machine.showWins(outcome.wins.map((win) => win.lineIndex)), react(outcome, bet)]);
      setSpinning(false);
    }

    /* Geste du levier : attraper la poignée, tirer vers le bas, relâcher. */
    function bindLeverGesture() {
      const canvas = stage.renderer.domElement;
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let drag = null;

      function overLever(event) {
        const rect = canvas.getBoundingClientRect();
        pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, stage.camera);
        return raycaster.intersectObject(machine.leverGrip, false).length > 0;
      }

      canvas.addEventListener('pointerdown', (event) => {
        if (spinning || !overLever(event)) return;
        audio.start();
        drag = { startY: event.clientY, pull: 0 };
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = 'grabbing';
        event.preventDefault();
      });
      canvas.addEventListener('pointermove', (event) => {
        if (!drag) {
          canvas.style.cursor = !spinning && overLever(event) ? 'grab' : '';
          return;
        }
        drag.pull = Math.min(Math.max((event.clientY - drag.startY) / LEVER_DRAG_PX, 0), 1);
        machine.holdLever(drag.pull);
      });
      const release = () => {
        if (!drag) return;
        const pulledEnough = drag.pull >= LEVER_TRIGGER;
        drag = null;
        canvas.style.cursor = '';
        machine.releaseLever();
        if (pulledEnough) spin(true);
        else notify('Tire le levier plus bas pour lancer les rouleaux.');
      };
      canvas.addEventListener('pointerup', release);
      canvas.addEventListener('pointercancel', release);
    }

    buildPaytable();
    bindLeverGesture();
    $('spin').addEventListener('click', () => spin());
    kit.bindSoundToggle($('sound-toggle'), audio);
    kit.bindDialog($('rules'), $('rules-open'), $('rules-close'));
    kit.bindShortcuts({ ' ': () => spin(), enter: () => spin() });

    dragon.lookAt(machine.windowCenter);
    stage.flyIn();
    dragon.awaken();
  }

  init().catch((error) => {
    console.error(error);
    DJ.boot.showFallback(DJ.boot.MESSAGES.loadError);
  });
})(window);
