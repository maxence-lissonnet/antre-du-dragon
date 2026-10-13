/*
 * Table 3D du Mille Bornes : une table ronde dans l'antre, un coin par joueur.
 * Chaque coin montre la pile de bataille, la pile de vitesse, les bornes rangées par valeur
 * et les bottes (posées de travers pour un coup-fourré). La pioche et la défausse sont au centre.
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;
  const { tween } = root.DragonJack.tween;
  const cards = root.DragonJack.milleBornesCards;

  const CARD = { width: 0.62, depth: 0.93 };
  const TABLE_RADIUS = 5.2;
  const SEAT_RADIUS = 3.3;
  const DISTANCE_TYPES = ['km25', 'km50', 'km75', 'km100', 'km200'];
  const STACK_STEP = 0.16;
  // Angle de chaque place autour de la table : le joueur local est toujours devant (vers la caméra).
  const SEAT_ANGLES = {
    2: [0, Math.PI],
    3: [0, Math.PI * 0.7, -Math.PI * 0.7],
    4: [0, Math.PI / 2, Math.PI, -Math.PI / 2],
  };

  function createTableView({ scene, labels }) {
    const stone = new THREE.MeshStandardMaterial({ color: '#3a302b', roughness: 0.85, flatShading: true });
    const felt = new THREE.MeshStandardMaterial({ color: '#1f5a3a', roughness: 0.95 });
    const table = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, 0.3, 48), stone);
    top.position.y = -0.15;
    top.receiveShadow = true;
    const cloth = new THREE.Mesh(new THREE.CircleGeometry(TABLE_RADIUS - 0.35, 48), felt);
    cloth.rotation.x = -Math.PI / 2;
    cloth.position.y = 0.005;
    cloth.receiveShadow = true;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 2.05, 8), stone);
    foot.position.y = -1.27;
    table.add(top, cloth, foot);
    scene.add(table);

    const cardGroup = new THREE.Group();
    scene.add(cardGroup);
    const geometry = new THREE.PlaneGeometry(CARD.width, CARD.depth);
    geometry.rotateX(-Math.PI / 2);
    const materials = new Map();
    const backMaterial = new THREE.MeshStandardMaterial({ map: textureOf(cards.drawBack()), roughness: 0.6 });
    const seen = new Set();
    let seatFrames = [];

    function textureOf(canvas) {
      const texture = new THREE.CanvasTexture(canvas);
      texture.encoding = THREE.sRGBEncoding;
      return texture;
    }

    function materialFor(card) {
      if (!materials.has(card.type)) {
        materials.set(card.type, new THREE.MeshStandardMaterial({ map: textureOf(cards.drawCard(card, labels)), roughness: 0.6 }));
      }
      return materials.get(card.type);
    }

    /* Repère d'une place : origine devant le joueur, axe x vers sa droite, axe z vers lui. */
    function seatFrame(index, count, localIndex) {
      const angles = SEAT_ANGLES[count] || SEAT_ANGLES[4];
      const relative = (index - localIndex + count) % count;
      const angle = angles[relative];
      const frame = new THREE.Object3D();
      frame.position.set(Math.sin(angle) * SEAT_RADIUS, 0, Math.cos(angle) * SEAT_RADIUS);
      frame.rotation.y = angle;
      frame.updateMatrixWorld();
      return frame;
    }

    function placeCard(card, frame, x, z, { faceDown = false, turned = false, lift = 0 } = {}) {
      const mesh = new THREE.Mesh(geometry, faceDown ? backMaterial : materialFor(card));
      mesh.receiveShadow = true;
      const local = new THREE.Vector3(x, 0.01 + lift, z);
      mesh.position.copy(frame.localToWorld(local));
      mesh.rotation.y = frame.rotation.y + (turned ? Math.PI / 2 : 0);
      cardGroup.add(mesh);
      // Une carte qu'on n'avait jamais vue apparaît en douceur.
      if (card && !seen.has(card.id)) {
        seen.add(card.id);
        mesh.scale.setScalar(0.01);
        tween({ duration: 0.35, ease: 'outBack', onUpdate: (k) => mesh.scale.setScalar(Math.max(0.01, k)) });
      }
      return mesh;
    }

    /* Redessine toute la table à partir de la vue (état visible par ce joueur). */
    function render(view, localIndex) {
      cardGroup.clear();
      const count = view.players.length;
      seatFrames = view.players.map((_, index) => seatFrame(index, count, localIndex));
      view.players.forEach((player, index) => {
        const frame = seatFrames[index];
        const battle = player.battle[player.battle.length - 1];
        const speed = player.speed[player.speed.length - 1];
        if (battle) placeCard(battle, frame, -1.9, 0);
        if (speed) placeCard(speed, frame, -1.15, 0);
        DISTANCE_TYPES.forEach((type, column) => {
          player.distance
            .filter((card) => card.type === type)
            .forEach((card, row) => placeCard(card, frame, -0.25 + column * 0.68, -0.25 + row * STACK_STEP, { lift: row * 0.002 }));
        });
        player.safeties.forEach((entry, slot) => {
          placeCard(entry.card, frame, -1.9 + slot * 0.75, -1.15, { turned: entry.coupFourre });
        });
      });
      const center = new THREE.Object3D();
      center.updateMatrixWorld();
      for (let i = 0; i < Math.min(6, Math.ceil(view.draw / 15)); i += 1) {
        placeCard(null, center, -0.5, 0, { faceDown: true, lift: i * 0.02 });
      }
      const discard = view.discard[view.discard.length - 1];
      if (discard) placeCard(discard, center, 0.5, 0);
    }

    /*
     * Point du monde où placer l'étiquette d'un joueur : au bord de la table pour les adversaires,
     * côté centre pour le joueur local (sinon la barre du bas la cacherait).
     */
    function seatAnchor(index, isLocal = false) {
      const frame = seatFrames[index];
      return frame ? frame.localToWorld(new THREE.Vector3(0, 0, isLocal ? -1.9 : 1.1)) : new THREE.Vector3();
    }

    function seatCenter(index) {
      const frame = seatFrames[index];
      return frame ? frame.position.clone() : new THREE.Vector3();
    }

    return { render, seatAnchor, seatCenter };
  }

  root.DragonJack.createMilleBornesTable = createTableView;
})(window);
