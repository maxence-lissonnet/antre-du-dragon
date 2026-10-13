/*
 * Memory des écailles en duel : relie les règles (memory.js), la dalle et ses écailles 3D,
 * le dragon (qui joue avec sa propre mémoire) et l'interface.
 */
(function (root) {
  'use strict';

  const DJ = root.DragonJack;
  const THREE = root.THREE;
  const memory = DJ.memory;
  const kit = DJ.hudKit;
  const $ = (id) => document.getElementById(id);

  const MISMATCH_PAUSE = 0.9;
  // Temps de « réflexion » du dragon avant chaque écaille, pour qu'on le voie choisir.
  const DRAGON_THINK = 0.75;
  // Sans coup joué pendant ce délai, le dragon s'impatiente.
  const IMPATIENCE_MS = 12000;
  const MOUNDS = [
    { x: 0, z: -11, radius: 6.5, height: 3.2 },
    { x: -8, z: -8, radius: 5, height: 2.6 },
    { x: 8, z: -8.5, radius: 5.2, height: 2.8 },
    { x: -10.5, z: 0, radius: 3.6, height: 1.4 },
    { x: 10.5, z: 0, radius: 3.6, height: 1.3 },
  ];

  function buildLevelPicker(container, onChange) {
    let selected = 'easy';
    const buttons = Object.entries(memory.LEVELS).map(([key, level]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'level-option';
      const name = document.createElement('span');
      name.className = 'level-name';
      name.textContent = level.label;
      const detail = document.createElement('span');
      detail.className = 'level-detail';
      detail.textContent = `${level.columns * level.rows} écailles, ${level.lives} vies`;
      button.append(name, detail);
      button.addEventListener('click', () => {
        selected = key;
        render();
        onChange(key);
      });
      container.append(button);
      return { button, key };
    });
    function render() {
      buttons.forEach(({ button, key }) => button.setAttribute('aria-pressed', String(key === selected)));
    }
    render();
    return { value: () => selected, setDisabled: (disabled) => buttons.forEach(({ button }) => (button.disabled = disabled)) };
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
    const announce = (message) => {
      $('announcer').textContent = message;
    };
    const lair = DJ.createLairScene({
      container: $('stage'),
      camera: {
        target: new THREE.Vector3(0, 0, 0.6),
        direction: new THREE.Vector3(0, 6, 8.5),
        baseDistance: 11,
        visibleHalfWidth: { landscape: 4.4, portrait: 2.4 },
        introOffset: new THREE.Vector3(0, 4, 6),
      },
      mounds: MOUNDS,
      // Comme au blackjack, le dragon s'appuie sur le bord de la dalle.
      dragonPosition: new THREE.Vector3(0, 0, -0.4),
      keyLightTarget: new THREE.Vector3(0, 0, 0.6),
    });
    const { stage, scene, particles, dragon } = lair;
    const board = DJ.createBoardView({ scene, renderer: stage.renderer, audio });
    const goldRain = DJ.createGoldRain({
      scene,
      particles,
      groundHeight: (x, z) => (Math.abs(x) < 3.6 && z > -3.3 && z < 4.5 ? 0.03 : lair.floorY + 0.05),
      area: { minX: -5, maxX: 5, minZ: -3, maxZ: 4.5 },
    });
    stage.onFrame((dt) => goldRain.update(dt));
    dragon.lookAt(board.center());

    const game = {
      phase: 'setup',
      level: 'easy',
      bet: 0,
      symbols: [],
      matched: new Set(),
      revealed: [],
      turn: 'player',
      pairs: { player: 0, dragon: 0 },
      lives: 0,
      dragonMemory: new Map(),
      busy: false,
      cursor: 0,
      lastMove: 0,
    };

    const levelPicker = buildLevelPicker($('level-picker'), (key) => {
      game.level = key;
      stage.frame(board.framingFor(memory.LEVELS[key]));
    });
    let betPicker = null;
    const wallet = kit.createWallet({
      balanceElement: $('balance'),
      restoreButton: $('restore'),
      minBet: memory.BETS[0],
      notify,
      onChange: (balance) => {
        if (betPicker) betPicker.update(balance, game.phase !== 'setup');
        $('start').disabled = balance < memory.BETS[0];
      },
    });
    betPicker = kit.createBetPicker({ container: $('bet-picker'), values: memory.BETS });
    betPicker.update(wallet.balance());

    function render() {
      if (game.phase === 'party') return;
      $('setup-panel').hidden = game.phase !== 'setup';
      $('play-panel').hidden = game.phase !== 'play';
      $('end-panel').hidden = game.phase !== 'end';
      levelPicker.setDisabled(game.phase !== 'setup');
      betPicker.update(wallet.balance(), game.phase !== 'setup');
      if (game.phase !== 'play') return;
      const maxLives = memory.LEVELS[game.level].lives;
      $('player-pairs').textContent = game.pairs.player;
      $('dragon-pairs').textContent = game.pairs.dragon;
      $('lives').textContent = '♥'.repeat(game.lives) + '♡'.repeat(maxLives - game.lives);
      $('lives').setAttribute('aria-label', `Vies : ${game.lives} sur ${maxLives}`);
      const turn = $('turn');
      turn.dataset.turn = game.turn;
      turn.textContent = game.turn === 'player' ? 'À toi de jouer' : 'Le dragon réfléchit…';
      $('give-up').disabled = game.turn !== 'player' || game.busy;
    }

    function available() {
      return game.symbols.map((_, index) => index).filter((index) => !game.matched.has(index));
    }

    /* Retourne une écaille, que ce soit le joueur ou le dragon. Le dragon mémorise ce qu'il voit. */
    async function reveal(index) {
      game.revealed.push(index);
      dragon.lookAt(board.tilePosition(index));
      await board.flip(index, true);
      memory.observe(game.dragonMemory, index, game.symbols[index], memory.LEVELS[game.level].dragonMemory);
    }

    /* Deux écailles sont retournées : paire trouvée (on rejoue) ou ratée (on passe la main). */
    async function resolvePair() {
      const [first, second] = game.revealed;
      game.revealed = [];
      const who = game.turn;
      const seen = `${who === 'player' ? 'Tu retournes' : 'Le dragon retourne'} : ${DJ.describeScaleSymbol(game.symbols[first])} et ${DJ.describeScaleSymbol(game.symbols[second])}.`;
      if (game.symbols[first] === game.symbols[second]) {
        game.matched.add(first).add(second);
        memory.forget(game.dragonMemory, [first, second]);
        game.pairs[who] += 1;
        audio.play(who === 'player' ? 'chip' : 'grumble');
        announce(`${seen} Paire trouvée !`);
        await board.markMatched([first, second], who);
        render();
        return 'match';
      }
      announce(`${seen} Pas de paire.`);
      await DJ.tween.wait(MISMATCH_PAUSE);
      await Promise.all([board.flip(first, false), board.flip(second, false)]);
      if (who === 'player') {
        game.lives -= 1;
        render();
      }
      return 'miss';
    }

    async function finish() {
      game.phase = 'end';
      board.setCursor(null);
      const outcome = memory.outcome(game.pairs.player, game.pairs.dragon, game.lives);
      const returned = memory.payout(game.bet, outcome);
      if (returned > 0) wallet.earn(returned);
      render();
      const score = `${game.pairs.player} paire${game.pairs.player > 1 ? 's' : ''} contre ${game.pairs.dragon}`;
      if (outcome === 'win') {
        result.show({ heading: 'Tu bats le dragon !', detail: `+ ${kit.formatCoins(returned - game.bet)}, ${score}`, tone: 'win' });
        audio.play('treasure');
        const flawless = game.lives === memory.LEVELS[game.level].lives;
        if (flawless) {
          audio.play('coins');
          dragon.lookAt(new THREE.Vector3(0, 2, 8));
          await Promise.all([goldRain.trigger(), dragon.bow(1.4)]);
        } else {
          audio.play('grumble');
          await dragon.sulk();
        }
      } else if (outcome === 'draw') {
        result.show({ heading: 'Égalité', detail: `Ta mise te revient, ${score}`, tone: 'push' });
        await dragon.huff();
      } else {
        const why = game.lives <= 0 ? 'Plus de vies' : 'Le dragon a plus de paires';
        result.show({ heading: why, detail: `Il garde ta mise de ${kit.formatCoins(game.bet)}, ${score}`, tone: 'lose' });
        audio.play('roar');
        dragon.lookAt(board.center());
        await Promise.all([dragon.breatheFire(() => stage.shake(0.3)), board.revealAll()]);
      }
      dragon.lookAt(board.center());
    }

    const allFound = () => game.matched.size === game.symbols.length;

    /* Tour du dragon : il rejoue tant qu'il trouve des paires. */
    async function dragonTurn() {
      game.turn = 'dragon';
      game.busy = true;
      board.setCursor(null);
      render();
      while (game.phase === 'play' && !allFound()) {
        await DJ.tween.wait(DRAGON_THINK);
        const first = memory.chooseFirst(game.dragonMemory, available());
        await reveal(first);
        await DJ.tween.wait(DRAGON_THINK);
        const second = memory.chooseSecond(game.dragonMemory, available(), first, game.symbols[first]);
        await reveal(second);
        if ((await resolvePair()) === 'miss') break;
        if (Math.random() < 0.5) dragon.huff();
      }
      if (allFound()) {
        await finish();
        return;
      }
      game.turn = 'player';
      game.busy = false;
      game.lastMove = root.performance.now();
      board.setCursor(game.cursor);
      render();
    }

    async function pick(index) {
      if (game.phase !== 'play' || game.turn !== 'player' || game.busy) return;
      if (game.matched.has(index) || game.revealed.includes(index)) return;
      audio.start();
      game.lastMove = root.performance.now();
      game.cursor = index;
      board.setCursor(index);
      game.busy = true;
      await reveal(index);
      if (game.revealed.length < 2) {
        announce(`Écaille : ${DJ.describeScaleSymbol(game.symbols[index])}.`);
        game.busy = false;
        return;
      }
      const verdict = await resolvePair();
      game.busy = false;
      if (allFound() || game.lives <= 0) {
        await finish();
        return;
      }
      if (verdict === 'miss') await dragonTurn();
      else render();
    }

    function start() {
      if (game.phase !== 'setup') return;
      audio.start();
      const bet = betPicker.value();
      if (!wallet.canAfford(bet)) {
        notify('Ton trésor est trop maigre pour cette mise.');
        return;
      }
      wallet.spend(bet);
      const level = memory.LEVELS[game.level];
      Object.assign(game, {
        phase: 'play',
        bet,
        symbols: memory.createBoard(game.level),
        matched: new Set(),
        revealed: [],
        turn: 'player',
        pairs: { player: 0, dragon: 0 },
        lives: level.lives,
        dragonMemory: new Map(),
        busy: false,
        cursor: 0,
        lastMove: root.performance.now(),
      });
      result.hide();
      stage.frame(board.framingFor(level));
      board.deal(game.symbols, level);
      board.setCursor(null);
      audio.play('riffle');
      render();
    }

    function giveUp() {
      if (game.phase !== 'play' || game.turn !== 'player' || game.busy) return;
      game.lives = 0;
      finish();
    }

    function again() {
      if (game.phase !== 'end') return;
      board.clear();
      result.hide();
      game.phase = 'setup';
      render();
    }

    /* Curseur clavier : se déplace sur la grille, sans sortir des bords. */
    function moveCursor(dx, dy) {
      if (game.phase !== 'play' || game.turn !== 'player') return;
      const level = memory.LEVELS[game.level];
      const column = Math.min(level.columns - 1, Math.max(0, (game.cursor % level.columns) + dx));
      const row = Math.min(level.rows - 1, Math.max(0, Math.floor(game.cursor / level.columns) + dy));
      game.cursor = row * level.columns + column;
      board.setCursor(game.cursor);
    }

    function confirm() {
      if (game.phase === 'setup') start();
      else if (game.phase === 'play') pick(game.cursor);
      else if (game.phase === 'end') again();
    }

    // Retourner une écaille directement dans la scène.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    stage.renderer.domElement.addEventListener('click', (event) => {
      if (game.phase !== 'play') return;
      const rect = stage.renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, stage.camera);
      const hit = raycaster.intersectObjects(board.hitTargets(), false)[0];
      if (hit) pick(hit.object.userData.tileIndex);
    });

    // Le dragon s'impatiente si le joueur traîne.
    root.setInterval(() => {
      if (game.phase !== 'play' || game.turn !== 'player' || game.busy) return;
      if (root.performance.now() - game.lastMove < IMPATIENCE_MS) return;
      game.lastMove = root.performance.now();
      notify('Le dragon s’impatiente…');
      audio.play('grumble');
      dragon.huff();
    }, 1000);

    /* Mode à plusieurs : le salon choisit les joueurs, puis party.js mène la partie. */
    function openParty() {
      if (game.phase !== 'setup') return;
      audio.start();
      game.phase = 'party';
      $('setup-panel').hidden = true;
      $('lobby-panel').hidden = false;
      DJ.createLobby({
        container: $('lobby-panel'),
        game: 'memory',
        minPlayers: 2,
        maxPlayers: 4,
        botNames: ['Le dragon', 'La wyverne', 'La salamandre'],
        notify,
        onStart: (session) => {
          $('lobby-panel').hidden = true;
          DJ.startMemoryParty({ session, levelKey: game.level, board, stage, dragon, audio, notify, announce });
        },
      });
    }

    $('start').addEventListener('click', start);
    $('party-open').addEventListener('click', openParty);
    $('give-up').addEventListener('click', giveUp);
    $('again').addEventListener('click', again);
    kit.bindSoundToggle($('sound-toggle'), audio);
    kit.bindDialog($('rules'), $('rules-open'), $('rules-close'));
    kit.bindShortcuts({
      enter: confirm,
      ' ': confirm,
      arrowleft: () => moveCursor(-1, 0),
      arrowright: () => moveCursor(1, 0),
      arrowup: () => moveCursor(0, -1),
      arrowdown: () => moveCursor(0, 1),
    });

    stage.frame(board.framingFor(memory.LEVELS[game.level]));
    render();
    stage.flyIn();
  }

  init().catch((error) => {
    console.error(error);
    DJ.boot.showFallback(DJ.boot.MESSAGES.loadError);
  });
})(window);
