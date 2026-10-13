/*
 * Plateau 3D de Supaplex, commun aux deux versions. Le moteur avance tic par tic ; ici, chaque objet
 * glisse en douceur de son ancienne case à la nouvelle entre deux tics.
 * Le thème (classique ou dragon) fournit l'apparence : `theme.build(type)` renvoie un objet 3D centré.
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;

  const CELL = 1;
  // Objets qui tournent sur eux-mêmes quand ils roulent ou tombent.
  const ROLLERS = ['zonk', 'infotron'];
  const FACING = { left: Math.PI / 2, right: -Math.PI / 2, up: Math.PI, down: 0 };

  function createBoard({ scene, theme, particles }) {
    const group = new THREE.Group();
    scene.add(group);
    let floor = null;
    let meshes = new Map();
    let width = 0;
    let height = 0;

    const toWorld = (x, y) => new THREE.Vector3((x - (width - 1) / 2) * CELL, 0, (y - (height - 1) / 2) * CELL);

    function clear() {
      meshes.forEach(({ object }) => group.remove(object));
      meshes = new Map();
      if (floor) group.remove(floor);
    }

    function createMesh(cell, x, y) {
      const object = theme.build(cell.type, x, y);
      const position = toWorld(x, y);
      object.position.copy(position);
      group.add(object);
      return { object, type: cell.type, from: position.clone(), to: position.clone(), born: performance.now() };
    }

    /* Construit tout le plateau d'un niveau à partir de l'état initial du moteur. */
    function load(state) {
      clear();
      width = state.width;
      height = state.height;
      floor = theme.buildFloor(width, height);
      group.add(floor);
      state.cells.forEach((cell, index) => {
        if (cell.id <= 0 || cell.type === 'empty') return;
        meshes.set(cell.id, createMesh(cell, index % width, Math.floor(index / width)));
      });
    }

    /*
     * Après un tic : chaque objet reçoit sa nouvelle case cible, les nouveaux apparaissent,
     * ceux qui ont disparu sont retirés (avec un petit effet selon la raison).
     */
    function sync(state, events) {
      const alive = new Set();
      state.cells.forEach((cell, index) => {
        if (cell.id <= 0 || cell.type === 'empty') return;
        alive.add(cell.id);
        const x = index % width;
        const y = Math.floor(index / width);
        let entry = meshes.get(cell.id);
        if (entry && entry.type !== cell.type) {
          group.remove(entry.object);
          entry = null;
        }
        if (!entry) {
          entry = createMesh(cell, x, y);
          meshes.set(cell.id, entry);
          if (cell.type === 'explosion') theme.onExplosion(particles, entry.to);
          return;
        }
        entry.from.copy(entry.object.position);
        entry.to.copy(toWorld(x, y));
        entry.cell = cell;
      });
      meshes.forEach((entry, id) => {
        if (alive.has(id)) return;
        group.remove(entry.object);
        meshes.delete(id);
      });
      events.forEach((event) => {
        if (event.type === 'eat') theme.onEat(particles, toWorld(event.x, event.y));
        if (event.type === 'collect') theme.onCollect(particles, toWorld(event.x, event.y), event.what);
      });
    }

    /* `progress` : avancement (0 à 1) entre le tic précédent et le suivant. */
    function update(progress, time, state) {
      meshes.forEach((entry) => {
        const { object, from, to } = entry;
        object.position.lerpVectors(from, to, progress);
        const moved = to.clone().sub(from);
        if (ROLLERS.includes(entry.type) && moved.lengthSq() > 0) {
          // Rouler : l'objet intérieur tourne sur son propre centre, perpendiculairement au déplacement.
          const spinner = object.userData.inner || object;
          spinner.rotation.z -= moved.x * 0.25;
          spinner.rotation.x += moved.z * 0.25;
        }
        // Murphy regarde dans le sens de sa marche ; les ennemis dans le sens où ils avancent.
        if (entry.type === 'murphy' && moved.lengthSq() > 0) object.rotation.y = Math.atan2(moved.x, moved.z);
        const cell = entry.cell;
        if (cell && cell.dir && FACING[cell.dir] !== undefined) {
          object.rotation.y += (FACING[cell.dir] - object.rotation.y) * 0.3;
        }
        theme.animate(entry.type, object, time, { state, progress });
      });
    }

    function murphyPosition(state) {
      return toWorld(state.murphy.x, state.murphy.y);
    }

    return { load, sync, update, murphyPosition, toWorld };
  }

  root.DragonJack = root.DragonJack || {};
  root.DragonJack.createSupaplexBoard = createBoard;
})(window);
