/*
 * Table 3D du Mille Bornes : une table ronde dans l'antre, un coin par joueur.
 * Chaque coin montre la pile de bataille, la pile de vitesse, les bornes rangées par valeur
 * et les bottes (posées de travers pour un coup-fourré). La pioche et la défausse sont au centre.
 * Tout autour, une route de 1 000 km : chaque joueur y a sa voie et sa voiture, une borne marque chaque centaine.
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;
  const { tween } = root.DragonJack.tween;
  const cards = root.DragonJack.milleBornesCards;

  const CARD = { width: 0.62, depth: 0.93 };
  const TABLE_RADIUS = 6.1;
  const FELT_RADIUS = 4.55;
  const ROAD = { inner: 4.7, outer: 5.95 };
  const CAR_SCALE = 1.6;
  const GOAL_KM = 1000;
  // Une couleur de voiture par place.
  const CAR_COLORS = ['#d8342a', '#2f6fe0', '#e8b52a', '#2fa45e'];
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
    const cloth = new THREE.Mesh(new THREE.CircleGeometry(FELT_RADIUS, 48), felt);
    cloth.rotation.x = -Math.PI / 2;
    cloth.position.y = 0.005;
    cloth.receiveShadow = true;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 2.05, 8), stone);
    foot.position.y = -1.27;
    table.add(top, cloth, foot);
    scene.add(table);
    const cars = [];

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

    /*
     * La route part devant la caméra et fait le tour de la table dans le sens des aiguilles d'une montre :
     * 0 km au départ, 1 000 km à l'arrivée, au même endroit (damier).
     */
    function roadPoint(km, radius) {
      const angle = (Math.min(km, GOAL_KM) / GOAL_KM) * Math.PI * 2;
      return { position: new THREE.Vector3(-Math.sin(angle) * radius, 0, Math.cos(angle) * radius), angle };
    }

    function kmPlate(km) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f4f0e4';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(km), 64, 34);
      return canvas;
    }

    function buildRoad() {
      const asphalt = new THREE.Mesh(
        new THREE.RingGeometry(ROAD.inner, ROAD.outer, 96),
        new THREE.MeshStandardMaterial({ color: '#1b1a1e', roughness: 0.9 }),
      );
      asphalt.rotation.x = -Math.PI / 2;
      asphalt.position.y = 0.012;
      asphalt.receiveShadow = true;
      table.add(asphalt);
      // Bords blancs de la route.
      [ROAD.inner, ROAD.outer].forEach((radius) => {
        const edge = new THREE.Mesh(new THREE.RingGeometry(radius - 0.03, radius + 0.03, 96), new THREE.MeshBasicMaterial({ color: '#e8e2d0' }));
        edge.rotation.x = -Math.PI / 2;
        edge.position.y = 0.016;
        table.add(edge);
      });
      // Ligne de départ et d'arrivée en damier.
      const checker = document.createElement('canvas');
      checker.width = 64;
      checker.height = 16;
      const ctx = checker.getContext('2d');
      for (let x = 0; x < 8; x += 1) {
        for (let y = 0; y < 2; y += 1) {
          ctx.fillStyle = (x + y) % 2 ? '#111111' : '#f4f0e4';
          ctx.fillRect(x * 8, y * 8, 8, 8);
        }
      }
      const finish = new THREE.Mesh(new THREE.PlaneGeometry(ROAD.outer - ROAD.inner, 0.22), new THREE.MeshBasicMaterial({ map: textureOf(checker) }));
      finish.rotation.x = -Math.PI / 2;
      finish.position.set(0, 0.02, (ROAD.inner + ROAD.outer) / 2);
      table.add(finish);
      // Une borne kilométrique (blanche, tête rouge) toutes les centaines, au bord extérieur, et son chiffre sur la route.
      const white = new THREE.MeshStandardMaterial({ color: '#f1ece0', roughness: 0.6 });
      const red = new THREE.MeshStandardMaterial({ color: '#c8281e', roughness: 0.5 });
      for (let km = 100; km < GOAL_KM; km += 100) {
        const { position, angle } = roadPoint(km, ROAD.outer + 0.12);
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.1), white);
        body.position.set(position.x, 0.12, position.z);
        body.rotation.y = -angle;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), red);
        head.position.set(position.x, 0.24, position.z);
        body.castShadow = true;
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshBasicMaterial({ map: textureOf(kmPlate(km)), transparent: true }));
        const inside = roadPoint(km, ROAD.inner - 0.2).position;
        plate.rotation.set(-Math.PI / 2, 0, -angle);
        plate.position.set(inside.x, 0.02, inside.z);
        table.add(body, head, plate);
      }
    }
    buildRoad();

    /* Petite voiture en volumes simples : caisse, habitacle, quatre roues. */
    function createCar(color) {
      const car = new THREE.Group();
      const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.3 });
      const glass = new THREE.MeshStandardMaterial({ color: '#9fc6e8', roughness: 0.2, metalness: 0.4 });
      const rubber = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.8 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.5), paint);
      body.position.y = 0.09;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.24), glass);
      cabin.position.set(0, 0.18, -0.02);
      car.add(body, cabin);
      [[-0.14, 0.16], [0.14, 0.16], [-0.14, -0.16], [0.14, -0.16]].forEach(([x, z]) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 12), rubber);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.055, z);
        car.add(wheel);
      });
      car.children.forEach((part) => {
        part.castShadow = true;
      });
      car.userData.km = 0;
      car.scale.setScalar(CAR_SCALE);
      scene.add(car);
      return car;
    }

    /* Chaque voiture roule sur sa voie jusqu'à ses bornes, en suivant la courbe de la route. */
    function placeCars(players) {
      const laneWidth = (ROAD.outer - ROAD.inner) / players.length;
      players.forEach((player, index) => {
        if (!cars[index]) cars[index] = createCar(CAR_COLORS[index % CAR_COLORS.length]);
        const car = cars[index];
        const radius = ROAD.inner + laneWidth * (index + 0.5);
        const put = (km) => {
          const { position, angle } = roadPoint(km, radius);
          car.position.copy(position);
          // L'avant de la voiture (axe -z) suit la route.
          car.rotation.y = Math.PI / 2 - angle;
        };
        const from = car.userData.km;
        const to = player.km;
        car.userData.km = to;
        if (from === to) put(to);
        else tween({ duration: 0.9, ease: 'outCubic', onUpdate: (k) => put(from + (to - from) * k) });
      });
    }

    /* Redessine toute la table à partir de la vue (état visible par ce joueur). */
    function render(view, localIndex) {
      placeCars(view.players);
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
     * Point du monde où placer l'étiquette d'un joueur : au bord de sa place, côté route
     * (un peu moins loin pour le joueur local, que la barre du bas cacherait sinon).
     */
    function seatAnchor(index, isLocal = false) {
      const frame = seatFrames[index];
      return frame ? frame.localToWorld(new THREE.Vector3(0, 0, isLocal ? 0.9 : 1.1)) : new THREE.Vector3();
    }

    function seatCenter(index) {
      const frame = seatFrames[index];
      return frame ? frame.position.clone() : new THREE.Vector3();
    }

    return { render, seatAnchor, seatCenter, carColor: (index) => CAR_COLORS[index % CAR_COLORS.length] };
  }

  root.DragonJack.createMilleBornesTable = createTableView;
})(window);
