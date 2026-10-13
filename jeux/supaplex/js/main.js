/*
 * Supaplex : boucle de jeu (8 tics par seconde), commandes clavier et tactiles, menu des niveaux,
 * progression et récompenses. La version (classique ou dragon) se choisit dans l'adresse : ?version=dragon.
 */
(function (root) {
  'use strict';

  const DJ = root.DragonJack;
  const THREE = root.THREE;
  const engine = DJ.supaplex;
  const { LEVELS, SERIES, reward } = DJ.supaplexLevels;
  const kit = DJ.hudKit;
  const $ = (id) => document.getElementById(id);

  const TICK_SECONDS = 0.125;
  const PROGRESS_KEY = 'antre-du-dragon.supaplex';
  const RESTART_DELAY = 1.6;
  // Le grand bandeau du conseil reste affiché quelques secondes au début du niveau.
  const HINT_BANNER_MS = 8000;
  const KEY_DIRECTIONS = {
    arrowleft: 'left', q: 'left', a: 'left',
    arrowright: 'right', d: 'right',
    arrowup: 'up', z: 'up', w: 'up',
    arrowdown: 'down', s: 'down',
  };
  const CAMERA = {
    target: new THREE.Vector3(),
    direction: new THREE.Vector3(0, 10, 6),
    baseDistance: 10,
    visibleHalfWidth: { landscape: 7.5, portrait: 4.2 },
    introOffset: new THREE.Vector3(0, 6, 6),
  };

  function loadProgress() {
    try {
      const saved = JSON.parse(root.localStorage.getItem(PROGRESS_KEY));
      return Array.isArray(saved && saved.completed) ? saved : { completed: [] };
    } catch (error) {
      return { completed: [] };
    }
  }

  function saveProgress(progress) {
    try {
      root.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch (error) {
      // Navigation privée : la progression ne sera pas retenue.
    }
  }

  /* Applique le vocabulaire du thème (titre, noms des objets dans les règles). */
  function applyTheme(theme) {
    document.title = theme.title;
    $('game-title').textContent = theme.title;
    $('rules-title').textContent = theme.title;
    $('collect-label').textContent = theme.collectName;
    $('disks-label').textContent = theme.diskName;
    document.querySelectorAll('[data-term]').forEach((element) => {
      const term = theme.terms[element.dataset.term];
      if (term) element.textContent = term;
    });
  }

  /* Touches et boutons tactiles tenus : la dernière direction pressée l'emporte. */
  function createInput() {
    const held = [];
    let snapToggle = false;
    let shiftHeld = false;
    let dropQueued = false;
    const press = (dir) => {
      if (!held.includes(dir)) held.push(dir);
    };
    const release = (dir) => {
      const index = held.indexOf(dir);
      if (index >= 0) held.splice(index, 1);
    };
    return {
      press,
      release,
      setShift: (value) => {
        shiftHeld = value;
      },
      toggleSnap: () => {
        snapToggle = !snapToggle;
        return snapToggle;
      },
      queueDrop: () => {
        dropQueued = true;
      },
      clear: () => {
        held.length = 0;
        dropQueued = false;
      },
      read() {
        const input = { dir: held[held.length - 1] || null, snap: shiftHeld || snapToggle, drop: dropQueued };
        dropQueued = false;
        return input;
      },
    };
  }

  async function init() {
    // Sans version dans l'adresse, on demande d'abord laquelle jouer.
    const version = new URLSearchParams(root.location.search).get('version');
    if (!DJ.supaplexThemes[version]) {
      document.querySelector('.game').hidden = true;
      $('version-picker').hidden = false;
      return;
    }
    if (!DJ.boot.hasWebGL()) {
      DJ.boot.showFallback(DJ.boot.MESSAGES.noWebGL);
      return;
    }
    await DJ.boot.loadFonts();

    const theme = DJ.supaplexThemes[version];
    applyTheme(theme);

    const audio = DJ.createAudio();
    const notify = kit.createNotifier($('toast'));
    const result = kit.createResultPanel($('result'));
    const wallet = kit.createWallet({ balanceElement: $('balance'), restoreButton: $('restore'), minBet: 0, notify });

    const stage = DJ.createStage($('stage'), { ...CAMERA, ...theme.camera });
    document.body.dataset.theme = version;
    const { scene } = stage;
    scene.background = new THREE.Color(theme.background);
    // Brume chaude seulement dans l'antre ; la version originale reste nette, vue de haut.
    if (version === 'dragon') scene.fog = new THREE.Fog(theme.background, 14, 30);
    scene.add(new THREE.HemisphereLight(theme.lights.ambient, '#101010', theme.lights.ambientIntensity));
    const key = new THREE.DirectionalLight(theme.lights.key, theme.lights.keyIntensity);
    key.position.set(-4, 12, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.normalBias = 0.03;
    Object.assign(key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
    scene.add(key, key.target);
    const particles = DJ.createParticles();
    scene.add(particles.points);
    stage.onResize((height, fov) => particles.setProjectionScale(height, fov));
    const updateEmbers = version === 'dragon'
      ? DJ.lair.createDriftingEmbers({ particles, floorY: 0, area: { minX: -10, maxX: 10, minZ: -8, maxZ: 8 } })
      : () => {};

    const board = DJ.createSupaplexBoard({ scene, theme, particles });
    const input = createInput();
    const progress = loadProgress();
    const game = { phase: 'menu', levelIndex: 0, state: null, elapsed: 0, restartTimer: 0 };
    const cameraTarget = new THREE.Vector3();

    const isUnlocked = (index) => index === 0 || progress.completed.includes(index - 1);

    /* Menu en deux séries : un titre par série, puis ses niveaux (débloqués l'un après l'autre). */
    function renderMenu() {
      const list = $('level-list');
      const items = [];
      SERIES.forEach((series) => {
        const heading = document.createElement('li');
        heading.className = 'level-series';
        heading.textContent = series.label;
        items.push(heading);
        LEVELS.forEach((level, index) => {
          if (level.series === series.id) items.push(levelItem(level, index));
        });
      });
      list.replaceChildren(...items);
    }

    function levelItem(level, index) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'level-button';
      const done = progress.completed.includes(index);
      button.dataset.done = String(done);
      button.disabled = !isUnlocked(index);
      const numberInSeries = LEVELS.filter((other, i) => other.series === level.series && i <= index).length;
      const number = document.createElement('span');
      number.className = 'level-number';
      number.textContent = `${level.series === 'grands' ? 'Grand circuit' : 'Niveau'} ${numberInSeries}`;
      const title = document.createElement('span');
      title.className = 'level-title';
      title.textContent = level.name;
      const status = document.createElement('span');
      status.className = 'level-status';
      status.textContent = done ? 'Réussi' : isUnlocked(index) ? `${kit.formatCoins(reward(index))} à gagner` : 'Verrouillé';
      button.append(number, title, status);
      button.addEventListener('click', () => startLevel(index));
      item.append(button);
      return item;
    }

    function renderPanels() {
      $('menu-panel').hidden = game.phase !== 'menu';
      $('play-panel').hidden = game.phase !== 'play';
      $('top-stats').hidden = game.phase === 'menu';
      $('end-panel').hidden = game.phase !== 'won';
      $('next').disabled = game.levelIndex >= LEVELS.length - 1;
    }

    function renderStats() {
      const { state } = game;
      if (!state) return;
      $('level-name').textContent = `${game.levelIndex + 1}. ${LEVELS[game.levelIndex].name}`;
      $('collected').textContent = `${state.collected} / ${state.needed}`;
      $('disks').textContent = String(state.redDisks);
    }

    let hintTimer = null;
    function showHint() {
      $('hint-text').textContent = theme.translate(LEVELS[game.levelIndex].hint);
      $('hint-banner').hidden = false;
      root.clearTimeout(hintTimer);
      hintTimer = root.setTimeout(() => {
        $('hint-banner').hidden = true;
      }, HINT_BANNER_MS);
    }

    /* `quiet` : on recommence le même niveau (après une explosion), inutile de réafficher le grand conseil. */
    function startLevel(index, { quiet = false } = {}) {
      audio.start();
      game.levelIndex = index;
      game.state = engine.createState(LEVELS[index]);
      game.phase = 'play';
      game.elapsed = 0;
      game.restartTimer = 0;
      input.clear();
      board.load(game.state);
      cameraTarget.copy(board.murphyPosition(game.state));
      stage.setTarget(cameraTarget);
      result.hide();
      renderPanels();
      renderStats();
      $('level-hint').textContent = `Conseil : ${theme.translate(LEVELS[index].hint)}`;
      if (!quiet) showHint();
    }

    function showMenu() {
      game.phase = 'menu';
      $('hint-banner').hidden = true;
      result.hide();
      renderMenu();
      renderPanels();
    }

    function onWin() {
      game.phase = 'won';
      audio.play('fanfare');
      const firstTime = !progress.completed.includes(game.levelIndex);
      if (firstTime) {
        progress.completed.push(game.levelIndex);
        saveProgress(progress);
        wallet.earn(reward(game.levelIndex));
      }
      result.show({
        heading: 'Niveau réussi !',
        detail: firstTime ? `+ ${kit.formatCoins(reward(game.levelIndex))}` : 'Déjà réussi : pas de nouvelle récompense',
        tone: 'win',
      });
      renderPanels();
    }

    const SOUNDS = { collect: 'chip', push: 'card', explode: 'boom', terminal: 'riffle', drop: 'card' };

    function playEvents(events) {
      events.forEach((event) => {
        if (SOUNDS[event.type]) audio.play(SOUNDS[event.type]);
        if (event.type === 'locked') {
          const missing = game.state.needed - game.state.collected;
          notify(`Il manque encore ${missing} ${theme.collectName.toLowerCase()} pour ouvrir la sortie.`);
        }
        if (event.type === 'explode') stage.shake(0.15);
      });
    }

    function tick() {
      const events = engine.step(game.state, input.read());
      board.sync(game.state, events);
      playEvents(events);
      renderStats();
      if (game.state.status === 'won') onWin();
      if (game.state.status === 'dead' && game.restartTimer === 0) {
        game.restartTimer = RESTART_DELAY;
        result.show({ heading: version === 'dragon' ? 'Le petit dragon a explosé' : 'Murphy a explosé', detail: 'Le niveau recommence…', tone: 'lose' });
      }
    }

    stage.onFrame((dt, time) => {
      DJ.tween.update(dt);
      particles.update(dt);
      updateEmbers(dt);
      if (!game.state) return;
      if (game.phase === 'play') {
        game.elapsed += dt;
        // Une explosion fatale laisse le temps de voir ce qui s'est passé, puis le niveau repart.
        if (game.restartTimer > 0) {
          game.restartTimer -= dt;
          if (game.restartTimer <= 0) startLevel(game.levelIndex, { quiet: true });
        }
        while (game.elapsed >= TICK_SECONDS && game.phase === 'play') {
          game.elapsed -= TICK_SECONDS;
          tick();
        }
      }
      board.update(Math.min(game.elapsed / TICK_SECONDS, 1), time, game.state);
      cameraTarget.lerp(board.murphyPosition(game.state), Math.min(dt * 4, 1));
      stage.setTarget(cameraTarget);
    });

    // Clavier : touches tenues pour se déplacer, Maj pour aspirer, Espace pour poser une disquette.
    document.addEventListener('keydown', (event) => {
      if (document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (KEY_DIRECTIONS[key] && game.phase === 'play') {
        event.preventDefault();
        audio.start();
        input.press(KEY_DIRECTIONS[key]);
      } else if (key === 'shift') {
        input.setShift(true);
      } else if (key === ' ' && game.phase === 'play') {
        event.preventDefault();
        input.queueDrop();
      } else if (key === 'r' && game.phase !== 'menu') {
        startLevel(game.levelIndex, { quiet: true });
      } else if (key === 'escape' && game.phase !== 'menu') {
        showMenu();
      } else if (key === 'enter' && game.phase === 'won' && !event.target.closest?.('button')) {
        if (game.levelIndex < LEVELS.length - 1) startLevel(game.levelIndex + 1);
      }
    });
    document.addEventListener('keyup', (event) => {
      const key = event.key.toLowerCase();
      if (KEY_DIRECTIONS[key]) input.release(KEY_DIRECTIONS[key]);
      if (key === 'shift') input.setShift(false);
    });
    root.addEventListener('blur', () => input.clear());

    // Croix tactile : on maintient le doigt sur une flèche pour avancer.
    document.querySelectorAll('.pad-button').forEach((button) => {
      const dir = button.dataset.dir;
      const start = (event) => {
        event.preventDefault();
        audio.start();
        input.press(dir);
        button.classList.add('is-held');
      };
      const stop = () => {
        input.release(dir);
        button.classList.remove('is-held');
      };
      button.addEventListener('pointerdown', start);
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) => button.addEventListener(type, stop));
    });
    $('snap-toggle').addEventListener('click', () => {
      $('snap-toggle').setAttribute('aria-pressed', String(input.toggleSnap()));
    });
    $('drop').addEventListener('click', () => input.queueDrop());
    $('restart').addEventListener('click', () => startLevel(game.levelIndex, { quiet: true }));
    $('show-hint').addEventListener('click', showHint);
    $('retry').addEventListener('click', () => startLevel(game.levelIndex));
    $('to-menu').addEventListener('click', showMenu);
    $('end-menu').addEventListener('click', showMenu);
    $('next').addEventListener('click', () => startLevel(game.levelIndex + 1));
    kit.bindSoundToggle($('sound-toggle'), audio);
    kit.bindDialog($('rules'), $('rules-open'), $('rules-close'));

    // En fond du menu : le premier niveau déjà en place, pour voir le décor.
    game.state = engine.createState(LEVELS[0]);
    board.load(game.state);
    cameraTarget.copy(board.murphyPosition(game.state));
    stage.setTarget(cameraTarget);
    showMenu();
    stage.flyIn();
  }

  init().catch((error) => {
    console.error(error);
    DJ.boot.showFallback(DJ.boot.MESSAGES.loadError);
  });
})(window);
