/*
 * Moteur de Supaplex : fonctions pures, sans affichage, avancées « tic » par tic.
 * À chaque tic, Murphy agit (selon la touche tenue), puis les objets tombent ou roulent,
 * puis les ennemis avancent, puis les explosions et les disquettes posées évoluent.
 *
 * Plan d'un niveau (une lettre par case) :
 *   #  mur (indestructible)        .  circuit (Murphy le mange)    (espace) vide
 *   M  Murphy                      O  zonk (tombe et roule)        I  infotron (à ramasser, tombe et roule)
 *   E  sortie                      R  puce RAM (mur sur lequel on roule)
 *   S  snik snak (ciseaux, suit le mur à gauche)      L  électron (suit le mur à droite, laisse des infotrons)
 *   d  disquette rouge (se ramasse, se pose avec Espace)
 *   o  disquette orange (tombe, explose à l'atterrissage)
 *   y  disquette jaune (se pousse, explose quand on touche un terminal)
 *   T  terminal                    < > ^ v  ports à sens unique
 */
(function (root) {
  'use strict';

  const CODES = {
    '#': 'wall', '.': 'base', ' ': 'empty', M: 'murphy', O: 'zonk', I: 'infotron', E: 'exit', R: 'ram',
    S: 'snik', L: 'electron', d: 'redDisk', o: 'orangeDisk', y: 'yellowDisk', T: 'terminal',
    '<': 'portLeft', '>': 'portRight', '^': 'portUp', v: 'portDown',
  };
  const DIRECTIONS = {
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 },
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
  };
  const PORT_FOR = { left: 'portLeft', right: 'portRight', up: 'portUp', down: 'portDown' };
  const TURN_LEFT = { up: 'left', left: 'down', down: 'right', right: 'up' };
  const TURN_RIGHT = { up: 'right', right: 'down', down: 'left', left: 'up' };
  const FALLERS = ['zonk', 'infotron', 'orangeDisk'];
  // Objets arrondis : ce qui est posé dessus peut rouler sur le côté.
  const ROUND = ['zonk', 'infotron', 'ram'];
  const ENEMIES = ['snik', 'electron'];
  const EXPLOSIVES = ['redDisk', 'orangeDisk', 'yellowDisk', 'droppedDisk', 'snik', 'electron'];
  // Seuls les murs et la sortie résistent aux explosions.
  const UNBREAKABLE = ['wall', 'exit'];
  const EXPLOSION_TICKS = 4;
  const DROPPED_DISK_TICKS = 16;

  /* Crée l'état de départ d'un niveau à partir de son plan. */
  function createState(level) {
    const rows = level.map;
    const height = rows.length;
    const width = Math.max(...rows.map((row) => row.length));
    const cells = [];
    let nextId = 1;
    let murphy = null;
    let infotrons = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const type = CODES[rows[y][x] || ' '];
        if (!type) throw new Error(`Case inconnue « ${rows[y][x]} » en (${x}, ${y})`);
        const cell = { type, id: type === 'empty' ? 0 : nextId++ };
        if (ENEMIES.includes(type)) cell.dir = 'left';
        if (type === 'murphy') murphy = { x, y };
        if (type === 'infotron') infotrons += 1;
        cells.push(cell);
      }
    }
    if (!murphy) throw new Error('Le niveau n’a pas de Murphy');
    return {
      width,
      height,
      cells,
      nextId,
      murphy,
      needed: level.needed !== undefined ? level.needed : infotrons,
      collected: 0,
      redDisks: 0,
      bombs: [],
      pendingBlasts: [],
      status: 'playing',
      tick: 0,
    };
  }

  const inside = (state, x, y) => x >= 0 && y >= 0 && x < state.width && y < state.height;
  const at = (state, x, y) => (inside(state, x, y) ? state.cells[y * state.width + x] : { type: 'wall', id: -1 });
  function put(state, x, y, cell) {
    state.cells[y * state.width + x] = cell;
  }
  const empty = () => ({ type: 'empty', id: 0 });

  function move(state, x, y, nx, ny, events) {
    const cell = at(state, x, y);
    put(state, nx, ny, cell);
    // Une disquette posée par Murphy apparaît sur la case qu'il vient de quitter.
    const bomb = cell.type === 'murphy' && state.bombs.find((b) => b.x === x && b.y === y && !b.placed);
    if (bomb) {
      bomb.placed = true;
      put(state, x, y, { type: 'droppedDisk', id: state.nextId++ });
    } else {
      put(state, x, y, empty());
    }
    if (cell.type === 'murphy') {
      state.murphy = { x: nx, y: ny };
    }
    events.push({ type: 'move', id: cell.id, from: { x, y }, to: { x: nx, y: ny } });
  }

  /* Explosion en 3 × 3. Un électron laisse des infotrons à la place. Les explosifs touchés sautent au tic suivant. */
  function explode(state, cx, cy, events, source) {
    const leaves = source === 'electron' ? 'infotron' : 'empty';
    events.push({ type: 'explode', x: cx, y: cy, source });
    for (let y = cy - 1; y <= cy + 1; y += 1) {
      for (let x = cx - 1; x <= cx + 1; x += 1) {
        if (!inside(state, x, y)) continue;
        const cell = at(state, x, y);
        if (UNBREAKABLE.includes(cell.type)) continue;
        if (cell.type === 'murphy') {
          state.status = 'dead';
          events.push({ type: 'dead', x, y });
        }
        const isCenter = x === cx && y === cy;
        if (!isCenter && EXPLOSIVES.includes(cell.type)) {
          state.pendingBlasts.push({ x, y, source: cell.type });
        }
        put(state, x, y, { type: 'explosion', id: state.nextId++, timer: EXPLOSION_TICKS, leaves });
      }
    }
    state.bombs = state.bombs.filter((bomb) => Math.abs(bomb.x - cx) > 1 || Math.abs(bomb.y - cy) > 1);
  }

  function collectAt(state, cell, events, x, y) {
    if (cell.type === 'infotron') {
      state.collected += 1;
      events.push({ type: 'collect', x, y, what: 'infotron' });
    } else if (cell.type === 'redDisk') {
      state.redDisks += 1;
      events.push({ type: 'collect', x, y, what: 'redDisk' });
    } else if (cell.type === 'base') {
      events.push({ type: 'eat', x, y });
    }
  }

  function murphyAct(state, input, events) {
    const { x, y } = state.murphy;
    if (input.drop && state.redDisks > 0 && !state.bombs.some((b) => !b.placed)) {
      state.redDisks -= 1;
      state.bombs.push({ x, y, timer: DROPPED_DISK_TICKS, placed: false });
      events.push({ type: 'drop', x, y });
    }
    if (!input.dir) return;
    const { dx, dy } = DIRECTIONS[input.dir];
    const tx = x + dx;
    const ty = y + dy;
    const target = at(state, tx, ty);

    if (input.snap) {
      if (['base', 'infotron', 'redDisk'].includes(target.type)) {
        collectAt(state, target, events, tx, ty);
        put(state, tx, ty, empty());
      }
      return;
    }

    if (['empty', 'base', 'infotron', 'redDisk'].includes(target.type)) {
      collectAt(state, target, events, tx, ty);
      move(state, x, y, tx, ty, events);
      return;
    }
    if (target.type === 'exit') {
      if (state.collected >= state.needed) {
        move(state, x, y, tx, ty, events);
        state.status = 'won';
        events.push({ type: 'won' });
      } else {
        events.push({ type: 'locked', x: tx, y: ty });
      }
      return;
    }
    if (ENEMIES.includes(target.type)) {
      explode(state, x, y, events, 'murphy');
      return;
    }
    // Pousser : zonks et disquettes orange de côté, disquettes jaunes dans tous les sens.
    const pushable = (dy === 0 && ['zonk', 'orangeDisk'].includes(target.type) && !target.falling) || target.type === 'yellowDisk';
    if (pushable && at(state, tx + dx, ty + dy).type === 'empty') {
      move(state, tx, ty, tx + dx, ty + dy, events);
      move(state, x, y, tx, ty, events);
      events.push({ type: 'push', x: tx + dx, y: ty + dy });
      return;
    }
    // Un port se traverse dans le sens de sa flèche, vers une case vide ou un circuit (mangé au passage).
    const beyond = at(state, tx + dx, ty + dy);
    if (target.type === PORT_FOR[input.dir] && ['empty', 'base'].includes(beyond.type)) {
      collectAt(state, beyond, events, tx + dx, ty + dy);
      move(state, x, y, tx + dx, ty + dy, events);
      return;
    }
    if (target.type === 'terminal') {
      events.push({ type: 'terminal', x: tx, y: ty });
      state.cells.forEach((cell, index) => {
        if (cell.type === 'yellowDisk') {
          state.pendingBlasts.push({ x: index % state.width, y: Math.floor(index / state.width), source: 'yellowDisk' });
        }
      });
    }
  }

  /* Gravité : de bas en haut, chaque objet tombe, écrase, explose ou roule. */
  function applyGravity(state, events, moved) {
    for (let y = state.height - 2; y >= 0; y -= 1) {
      for (let x = 0; x < state.width; x += 1) {
        const cell = at(state, x, y);
        if (!FALLERS.includes(cell.type) || moved.has(cell.id)) continue;
        const below = at(state, x, y + 1);
        if (below.type === 'empty') {
          cell.falling = true;
          move(state, x, y, x, y + 1, events);
          moved.add(cell.id);
          continue;
        }
        if (cell.falling) {
          cell.falling = false;
          if (below.type === 'murphy') {
            explode(state, x, y + 1, events, 'murphy');
            continue;
          }
          if (ENEMIES.includes(below.type)) {
            explode(state, x, y + 1, events, below.type);
            continue;
          }
          if (cell.type === 'orangeDisk') {
            explode(state, x, y, events, 'orangeDisk');
            continue;
          }
        }
        if (!ROUND.includes(below.type)) continue;
        for (const side of [-1, 1]) {
          if (at(state, x + side, y).type === 'empty' && at(state, x + side, y + 1).type === 'empty') {
            move(state, x, y, x + side, y, events);
            moved.add(cell.id);
            break;
          }
        }
      }
    }
  }

  /* Snik snaks et électrons longent les murs ; toucher Murphy le fait exploser. */
  function moveEnemies(state, events, moved) {
    const enemies = [];
    state.cells.forEach((cell, index) => {
      if (ENEMIES.includes(cell.type) && !moved.has(cell.id)) enemies.push({ cell, x: index % state.width, y: Math.floor(index / state.width) });
    });
    enemies.forEach(({ cell, x, y }) => {
      if (at(state, x, y) !== cell) return;
      const preferred = cell.type === 'snik' ? TURN_LEFT : TURN_RIGHT;
      const fallback = cell.type === 'snik' ? TURN_RIGHT : TURN_LEFT;
      for (const dir of [preferred[cell.dir], cell.dir]) {
        const { dx, dy } = DIRECTIONS[dir];
        const next = at(state, x + dx, y + dy);
        if (next.type === 'murphy') {
          explode(state, x + dx, y + dy, events, 'murphy');
          return;
        }
        if (next.type === 'empty') {
          cell.dir = dir;
          move(state, x, y, x + dx, y + dy, events);
          moved.add(cell.id);
          return;
        }
      }
      cell.dir = fallback[cell.dir];
    });
  }

  function updateTimers(state, events) {
    state.cells.forEach((cell, index) => {
      if (cell.type !== 'explosion') return;
      cell.timer -= 1;
      if (cell.timer > 0) return;
      const x = index % state.width;
      const y = Math.floor(index / state.width);
      put(state, x, y, cell.leaves === 'infotron' ? { type: 'infotron', id: state.nextId++ } : empty());
    });
    state.bombs.forEach((bomb) => {
      bomb.timer -= 1;
    });
    state.bombs.filter((bomb) => bomb.timer <= 0).forEach((bomb) => state.pendingBlasts.push({ x: bomb.x, y: bomb.y, source: 'droppedDisk' }));
    state.bombs = state.bombs.filter((bomb) => bomb.timer > 0);
  }

  /*
   * Avance d'un tic. `input` : { dir: 'left' | 'right' | 'up' | 'down' | null, snap, drop }.
   * Renvoie la liste des événements (déplacements, explosions, ramassages…) pour l'affichage et les sons.
   */
  function step(state, input = {}) {
    const events = [];
    if (state.status !== 'playing') return events;
    state.tick += 1;
    const blasts = state.pendingBlasts;
    state.pendingBlasts = [];
    blasts.forEach(({ x, y, source }) => explode(state, x, y, events, source));
    const moved = new Set();
    if (state.status === 'playing') murphyAct(state, input, events);
    if (state.status !== 'won') {
      applyGravity(state, events, moved);
      moveEnemies(state, events, moved);
      updateTimers(state, events);
    }
    return events;
  }

  /* Rejoue une suite de touches : L R U D (déplacer), l r u d (aspirer sans bouger), X (poser une disquette), . (attendre). */
  function replay(level, keys) {
    const state = createState(level);
    const map = { L: 'left', R: 'right', U: 'up', D: 'down' };
    for (const key of keys) {
      if (state.status !== 'playing') break;
      const lower = key.toUpperCase() !== key;
      const input = key === 'X' ? { drop: true } : key === '.' ? {} : { dir: map[key.toUpperCase()], snap: lower };
      step(state, input);
    }
    return state;
  }

  const api = { CODES, createState, step, replay, at };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.DragonJack = root.DragonJack || {};
    root.DragonJack.supaplex = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
