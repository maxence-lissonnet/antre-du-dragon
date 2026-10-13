/*
 * Le décor du blackjack : la grotte et le trésor communs (shared/js/lair.js), plus la table en pierre et son tapis.
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;
  const textures = root.DragonJack.textures;
  const lair = root.DragonJack.lair;

  const FLOOR_Y = -2.2;

  /* Positions de jeu sur la table (en unités du monde, table vue depuis le joueur). */
  const LAYOUT = {
    table: { halfWidth: 6.4, dealerEdgeZ: -2.6, depth: 6.8, rimInset: 0.4 },
    playerCards: { z: 1.75 },
    dealerCards: { z: -1.25 },
    cardSpacing: 0.62,
    betSpot: { x: 0, z: 3.05 },
    insuranceSpot: { x: 2.35, z: -0.4 },
    feltArc: { center: { x: 0, z: 6 }, radius: 5.35 },
    // Sabot (à droite) et défausse (à gauche) : position sur la table et orientation.
    shoe: { x: 4.4, z: -1.0, yaw: -0.35 },
    discard: { x: -4.4, z: -1.0, yaw: 0.35 },
    shuffleZ: -0.35,
    dealerTrayZ: -2.15,
  };

  // Collines d'or derrière et autour de la table.
  const MOUNDS = [
    { x: 0, z: -12, radius: 6.5, height: 3.4 },
    { x: -7, z: -9, radius: 5.4, height: 2.8 },
    { x: 7, z: -9.5, radius: 5.8, height: 3 },
    { x: 0, z: -8, radius: 4.2, height: 1.4 },
    { x: -11.5, z: -5, radius: 4.6, height: 2.2 },
    { x: 11.5, z: -5, radius: 4.6, height: 2.3 },
    { x: -10.5, z: -0.5, radius: 3.8, height: 1.5 },
    { x: 10.5, z: -0.5, radius: 3.8, height: 1.4 },
    { x: -4, z: -5.8, radius: 3, height: 1 },
    { x: 4, z: -6, radius: 3, height: 1.1 },
  ];

  function tableShape(inset) {
    const { halfWidth, dealerEdgeZ, depth } = LAYOUT.table;
    const rx = halfWidth - inset;
    const ry = depth - inset * 2;
    // Dans la forme 2D, y = -z du monde : le bord droit est côté dragon.
    const edgeY = -dealerEdgeZ - inset;
    const shape = new THREE.Shape();
    shape.moveTo(-rx, edgeY);
    shape.lineTo(rx, edgeY);
    shape.absellipse(0, edgeY, rx, ry, 0, Math.PI, true);
    return shape;
  }

  function extrudeFlat(shape, depth, bevel) {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      curveSegments: 48,
    });
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }

  function buildTable(renderer) {
    const group = new THREE.Group();
    const { rimInset } = LAYOUT.table;
    const stone = new THREE.MeshStandardMaterial({ color: '#3a302b', roughness: 0.85, metalness: 0.05, flatShading: true });
    const rimMaterial = new THREE.MeshStandardMaterial({ color: '#2a1c16', roughness: 0.55, metalness: 0.2 });

    const slabBevel = 0.08;
    const slab = new THREE.Mesh(extrudeFlat(tableShape(0), 0.5, slabBevel), stone);
    // Le biseau déborde au-dessus de l'épaisseur : on abaisse la dalle pour que le tapis reste visible.
    slab.position.y = -0.5 - slabBevel;
    slab.receiveShadow = true;
    group.add(slab);

    const rimShape = tableShape(0.02);
    rimShape.holes.push(tableShape(rimInset));
    const rim = new THREE.Mesh(extrudeFlat(rimShape, 0.1, 0.06), rimMaterial);
    rim.position.y = 0.02;
    rim.castShadow = true;
    rim.receiveShadow = true;
    group.add(rim);

    const feltGeometry = new THREE.ShapeGeometry(tableShape(rimInset), 48);
    feltGeometry.rotateX(-Math.PI / 2);
    feltGeometry.computeBoundingBox();
    const box = feltGeometry.boundingBox;
    const bounds = { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z };
    const uv = feltGeometry.attributes.uv;
    const position = feltGeometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      uv.setXY(
        i,
        (position.getX(i) - bounds.minX) / (bounds.maxX - bounds.minX),
        1 - (position.getZ(i) - bounds.minZ) / (bounds.maxZ - bounds.minZ),
      );
    }
    const feltTexture = textures.createFelt(
      bounds,
      {
        arcCenter: LAYOUT.feltArc.center,
        arcRadius: LAYOUT.feltArc.radius,
        betSpot: LAYOUT.betSpot,
        insuranceSpot: LAYOUT.insuranceSpot,
      },
      renderer,
    );
    const felt = new THREE.Mesh(feltGeometry, new THREE.MeshStandardMaterial({ map: feltTexture, roughness: 0.95 }));
    felt.position.y = 0.002;
    felt.receiveShadow = true;
    group.add(felt);

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, -FLOOR_Y - 0.5, 7), stone);
    pedestal.position.set(0, (FLOOR_Y - 0.5) / 2, 1);
    group.add(pedestal);

    return group;
  }

  const TABLE_TOP = 0.03;

  /* Hauteur sur laquelle un objet retombe : le dessus de la table (une demi-ellipse) ou le sol. */
  function groundHeight(x, z) {
    const { halfWidth, dealerEdgeZ, depth } = LAYOUT.table;
    if (z < dealerEdgeZ) return FLOOR_Y + 0.05;
    const dz = (z - dealerEdgeZ) / depth;
    const overTable = Math.abs(x) <= halfWidth * Math.sqrt(Math.max(0, 1 - dz * dz));
    return overTable ? TABLE_TOP : FLOOR_Y + 0.05;
  }

  function createEnvironment({ scene, renderer, particles }) {
    scene.background = new THREE.Color('#140c0a');
    scene.fog = new THREE.FogExp2('#140c0a', 0.034);

    scene.add(lair.buildCave({ floorY: FLOOR_Y }), lair.buildHoard(MOUNDS, FLOOR_Y), buildTable(renderer));

    const ambient = new THREE.HemisphereLight('#4a3428', '#0a0505', 0.7);
    scene.add(ambient);

    const tableLight = new THREE.SpotLight('#ffe2b8', 1.7, 30, 0.62, 0.6, 1.2);
    tableLight.position.set(0, 12, 3.5);
    tableLight.target.position.set(0, 0, 0.4);
    tableLight.castShadow = true;
    tableLight.shadow.mapSize.set(1024, 1024);
    tableLight.shadow.bias = -0.0006;
    scene.add(tableLight, tableLight.target);

    // Lueur du trésor qui éclaire le dragon par en dessous.
    const hoardGlow = new THREE.PointLight('#e0a63a', 1.1, 20, 1.5);
    hoardGlow.position.set(0, -0.8, -9.5);
    scene.add(hoardGlow);

    const braziers = lair.createBraziers({ scene, particles, floorY: FLOOR_Y, positions: [{ x: -7.6, z: 2.2 }, { x: 7.6, z: 2.2 }] });
    const updateEmbers = lair.createDriftingEmbers({ particles, floorY: FLOOR_Y, area: { minX: -11, maxX: 11, minZ: -12, maxZ: 4 } });

    // 1 = éclairage normal ; plus bas, la grotte s'assombrit (quand le dragon s'empare du trésor).
    let lightLevel = 1;
    const baseIntensities = [ambient, tableLight, hoardGlow].map((light) => [light, light.intensity]);

    function setLightLevel(level) {
      lightLevel = level;
      baseIntensities.forEach(([light, intensity]) => {
        light.intensity = intensity * level;
      });
    }

    function update(dt, time) {
      braziers.update(dt, time, lightLevel);
      updateEmbers(dt);
    }

    return { update, setLightLevel, groundHeight };
  }

  root.DragonJack.LAYOUT = LAYOUT;
  root.DragonJack.createEnvironment = createEnvironment;
})(window);
