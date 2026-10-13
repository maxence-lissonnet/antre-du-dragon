/*
 * Les alcôves de la salle : une arche de pierre par jeu, avec une plaque gravée.
 * Le blackjack montre une petite table de jeu ; les jeux à venir sont fermés par une herse et un cadenas.
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;
  const { tween } = root.DragonJack.tween;

  const ARCH = { width: 3.2, pillarHeight: 2.6, opening: 2.3, depth: 0.7 };
  const PLAQUE = { width: 2.6, height: 0.62, y: 4.75 };
  const DISPLAY_FONT = '"Grenze Gotisch", Georgia, serif';
  const GLOW_LIGHT = { idle: 0.6, focused: 3.2 };

  const stone = new THREE.MeshStandardMaterial({ color: '#3a302b', roughness: 0.9, flatShading: true });
  const iron = new THREE.MeshStandardMaterial({ color: '#2b2422', metalness: 0.75, roughness: 0.45 });
  const gold = new THREE.MeshStandardMaterial({ color: '#d39a2e', metalness: 0.9, roughness: 0.3 });

  /* Forme d'arche : deux piliers et un cintre en demi-cercle. */
  function archShape(width, pillarHeight) {
    const half = width / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-half, 0);
    shape.lineTo(-half, pillarHeight);
    shape.absarc(0, pillarHeight, half, Math.PI, 0, true);
    shape.lineTo(half, 0);
    shape.lineTo(-half, 0);
    return shape;
  }

  function buildArch() {
    const outer = archShape(ARCH.width, ARCH.pillarHeight);
    outer.holes.push(archShape(ARCH.opening, ARCH.pillarHeight));
    const geometry = new THREE.ExtrudeGeometry(outer, {
      depth: ARCH.depth,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 2,
      curveSegments: 24,
    });
    geometry.translate(0, 0, -ARCH.depth / 2);
    const arch = new THREE.Mesh(geometry, stone);
    arch.castShadow = true;
    arch.receiveShadow = true;
    return arch;
  }

  /* Fond sombre de l'alcôve, pour que l'intérieur se détache. */
  function buildRecess() {
    const recess = new THREE.Mesh(
      new THREE.ShapeGeometry(archShape(ARCH.opening, ARCH.pillarHeight), 24),
      new THREE.MeshStandardMaterial({ color: '#120b09', roughness: 1 }),
    );
    recess.position.z = -ARCH.depth / 2 - 0.9;
    return recess;
  }

  function createPlaqueTexture(text, available) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 122;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1e1411';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = available ? '#e0a63a' : '#6a5a4c';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    ctx.fillStyle = available ? '#f3d48a' : '#9a8a78';
    // Les noms longs (« Memory des écailles ») sont réduits pour tenir sur la plaque.
    let fontSize = 64;
    ctx.font = `${fontSize}px ${DISPLAY_FONT}`;
    while (ctx.measureText(text).width > canvas.width - 60 && fontSize > 30) {
      fontSize -= 2;
      ctx.font = `${fontSize}px ${DISPLAY_FONT}`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  function buildPlaque(text, available) {
    const material = new THREE.MeshStandardMaterial({
      map: createPlaqueTexture(text, available),
      roughness: 0.6,
      emissive: '#ffffff',
      emissiveMap: null,
      emissiveIntensity: 0,
    });
    material.emissiveMap = material.map;
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(PLAQUE.width, PLAQUE.height, 0.08), [
      iron, iron, iron, iron, material, iron,
    ]);
    plaque.position.set(0, PLAQUE.y, ARCH.depth / 2 + 0.05);
    return { plaque, material };
  }

  /* Petite table de blackjack : tapis rouge en demi-lune, deux cartes et des jetons. */
  function buildMiniBlackjack() {
    const group = new THREE.Group();
    const felt = new THREE.MeshStandardMaterial({ color: '#5e1c16', roughness: 0.9 });
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.12, 32, 1, false, -Math.PI / 2, Math.PI), [
      new THREE.MeshStandardMaterial({ color: '#2a1c16', roughness: 0.6 }),
      felt,
      felt,
    ]);
    table.position.y = 0.95;
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 0.9, 8), stone);
    pedestal.position.set(0, 0.45, 0.3);
    group.add(table, pedestal);

    const cardMaterial = new THREE.MeshStandardMaterial({ color: '#efe4cc', roughness: 0.6 });
    const backMaterial = new THREE.MeshStandardMaterial({ color: '#7a1e14', roughness: 0.6 });
    [[-0.18, 0.15], [0.12, -0.1]].forEach(([x, yaw]) => {
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.01, 0.4), [
        cardMaterial, cardMaterial, cardMaterial, backMaterial, cardMaterial, cardMaterial,
      ]);
      card.position.set(x, 1.02, 0.35);
      card.rotation.y = yaw;
      group.add(card);
    });
    const chipColors = ['#e9dcc0', '#2f6f5f', '#d39a2e'];
    chipColors.forEach((color, column) => {
      for (let i = 0; i < 4 + column; i += 1) {
        const chip = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
        chip.position.set(-0.3 + column * 0.25, 1.03 + i * 0.03, 0.65);
        group.add(chip);
      }
    });
    group.position.z = -0.4;
    return group;
  }

  /* Petite machine à sous : meuble doré, trois rouleaux clairs et un levier. */
  function buildMiniSlot() {
    const group = new THREE.Group();
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.6), new THREE.MeshStandardMaterial({ color: '#3a2218', roughness: 0.6 }));
    cabinet.position.y = 0.75;
    group.add(cabinet);
    const reelMaterial = new THREE.MeshStandardMaterial({ color: '#efe4cc', roughness: 0.5 });
    [-0.3, 0, 0.3].forEach((x, index) => {
      const reel = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.4, 0.05), reelMaterial);
      reel.position.set(x, 1.0, 0.31);
      const symbol = new THREE.Mesh(
        new THREE.CircleGeometry(0.07, 16),
        new THREE.MeshBasicMaterial({ color: ['#e0a63a', '#c0262d', '#2f8f6a'][index] }),
      );
      symbol.position.set(x, 1.0, 0.34);
      group.add(reel, symbol);
    });
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.22, 0.08), gold);
    plaque.position.set(0, 1.42, 0.3);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), gold);
    arm.position.set(0.65, 1.05, 0);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshStandardMaterial({ color: '#c0262d', roughness: 0.3 }));
    knob.position.set(0.65, 1.38, 0);
    group.add(plaque, arm, knob);
    group.position.z = -0.4;
    return group;
  }

  /* Petit butin : un tas d'or, un coffre entrouvert et un sac de voleur. */
  function buildMiniHeist() {
    const group = new THREE.Group();
    const pile = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold);
    pile.scale.y = 0.55;
    const wood = new THREE.MeshStandardMaterial({ color: '#5a3420', roughness: 0.6 });
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.34), wood);
    chest.position.set(-0.45, 0.5, 0.2);
    chest.rotation.y = 0.4;
    const sack = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 10), new THREE.MeshStandardMaterial({ color: '#7a6248', roughness: 0.9 }));
    sack.scale.set(1, 1.2, 1);
    sack.position.set(0.5, 0.3, 0.45);
    const ruby = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.12),
      new THREE.MeshStandardMaterial({ color: '#d4202a', emissive: '#d4202a', emissiveIntensity: 0.5, flatShading: true }),
    );
    ruby.position.set(0.1, 0.55, 0.3);
    group.add(pile, chest, sack, ruby);
    group.position.z = -0.3;
    return group;
  }

  /* Petite dalle de pierre couverte d'écailles, dont deux retournées. */
  function buildMiniMemory() {
    const group = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 1.1), stone);
    slab.position.y = 0.9;
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 0.82, 8), stone);
    pedestal.position.y = 0.41;
    group.add(slab, pedestal);
    const back = new THREE.MeshStandardMaterial({ color: '#3a6a52', metalness: 0.3, roughness: 0.5 });
    const face = new THREE.MeshStandardMaterial({ color: '#efe4cc', roughness: 0.5 });
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        const revealed = (row === 1 && column === 1) || (row === 2 && column === 3);
        const tile = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 6), revealed ? face : back);
        tile.position.set(-0.48 + column * 0.32, 1.0, -0.32 + row * 0.32);
        group.add(tile);
      }
    }
    group.position.z = -0.4;
    return group;
  }

  /* Petit plateau de Supaplex : une grille de dalles avec le héros et un objet rond. */
  function buildMiniSupaplex({ tile, hero, ball }) {
    const group = new THREE.Group();
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 0.82, 8), stone);
    pedestal.position.y = 0.41;
    group.add(pedestal);
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.36), tile);
        plate.position.set(-0.38 + column * 0.38, 0.86, -0.38 + row * 0.38);
        group.add(plate);
      }
    }
    const heroMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), hero);
    heroMesh.position.set(-0.38, 1.06, 0.38);
    const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), ball);
    ballMesh.position.set(0.38, 1.06, -0.38);
    group.add(heroMesh, ballMesh);
    group.position.z = -0.4;
    return group;
  }

  /* Petite table de Mille Bornes : quelques cartes posées et un feu tricolore. */
  function buildMiniMilleBornes() {
    const group = new THREE.Group();
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 0.82, 8), stone);
    pedestal.position.y = 0.41;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 24), new THREE.MeshStandardMaterial({ color: '#1f5a3a', roughness: 0.9 }));
    top.position.y = 0.86;
    group.add(pedestal, top);
    ['#1f5fae', '#c8251f', '#2a8f3e', '#d9a21a'].forEach((color, index) => {
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.01, 0.32), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
      card.position.set(-0.36 + index * 0.24, 0.91, 0.15);
      card.rotation.y = (index - 1.5) * 0.15;
      group.add(card);
    });
    const light = new THREE.Group();
    light.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.12), new THREE.MeshStandardMaterial({ color: '#2b2b2b' })));
    [['#ff3a2a', 0.13], ['#5a4a16', 0], ['#3aff6a', -0.13]].forEach(([color, y]) => {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color }));
      lamp.position.set(0, y, 0.065);
      light.add(lamp);
    });
    light.position.set(0.3, 1.15, -0.25);
    group.add(light);
    group.position.z = -0.4;
    return group;
  }

  // Décor de chaque alcôve, selon l'identifiant du jeu (voir games.js).
  const DECORS = {
    blackjack: buildMiniBlackjack,
    'machine-a-sous': buildMiniSlot,
    'vol-du-tresor': buildMiniHeist,
    'memory-des-ecailles': buildMiniMemory,
    'mille-bornes': buildMiniMilleBornes,
    supaplex: () =>
      buildMiniSupaplex({
        tile: new THREE.MeshStandardMaterial({ color: '#1f7a3a', roughness: 0.7 }),
        hero: new THREE.MeshStandardMaterial({ color: '#e0302a', roughness: 0.35 }),
        ball: new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.6 }),
      }),
  };

  /* Herse de fer et cadenas : le jeu n'est pas encore ouvert. */
  function buildPortcullis() {
    const group = new THREE.Group();
    const halfOpening = ARCH.opening / 2;
    for (let i = 0; i <= 6; i += 1) {
      const x = -halfOpening + (i / 6) * ARCH.opening;
      // Les barreaux suivent le cintre de l'arche.
      const height = ARCH.pillarHeight + Math.sqrt(Math.max(0, halfOpening * halfOpening - x * x));
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, height, 6), iron);
      bar.position.set(x, height / 2, 0);
      group.add(bar);
    }
    [0.7, 1.5, 2.3].forEach((y) => {
      const crossbar = new THREE.Mesh(new THREE.BoxGeometry(ARCH.opening, 0.06, 0.06), iron);
      crossbar.position.y = y;
      group.add(crossbar);
    });
    const lock = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.14), gold);
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 16, Math.PI), gold);
    shackle.position.y = 0.18;
    lock.add(body, shackle);
    lock.position.set(0, 1.5, 0.12);
    group.add(lock);
    group.position.z = ARCH.depth / 2 - 0.05;
    return { group, lock };
  }

  function createAlcove(game) {
    const group = new THREE.Group();
    group.add(buildArch(), buildRecess());
    const { plaque, material: plaqueMaterial } = buildPlaque(game.available ? game.name : 'Bientôt', game.available);
    group.add(plaque);

    let lock = null;
    if (game.available && DECORS[game.id]) {
      group.add(DECORS[game.id]());
    } else {
      const portcullis = buildPortcullis();
      lock = portcullis.lock;
      group.add(portcullis.group);
    }

    // Lumière intérieure : chaude pour un jeu ouvert, froide et faible pour un jeu à venir.
    const light = new THREE.PointLight(game.available ? '#ffb45a' : '#7a8aa0', GLOW_LIGHT.idle, 6, 1.6);
    light.position.set(0, 2.4, 0.6);
    group.add(light);

    // Zone cliquable invisible, plus simple à viser que l'arche elle-même.
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(ARCH.width, PLAQUE.y + PLAQUE.height, ARCH.depth + 0.4),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitbox.position.y = (PLAQUE.y + PLAQUE.height) / 2;
    hitbox.userData.gameId = game.id;
    group.add(hitbox);

    let focus = 0;
    function setFocused(focused) {
      const from = focus;
      const to = focused ? 1 : 0;
      tween({
        duration: 0.35,
        ease: 'outCubic',
        onUpdate: (k) => {
          focus = from + (to - from) * k;
          light.intensity = GLOW_LIGHT.idle + (GLOW_LIGHT.focused - GLOW_LIGHT.idle) * focus * (game.available ? 1 : 0.5);
          plaqueMaterial.emissiveIntensity = focus * 0.6;
        },
      });
    }

    /* Le cadenas tremble : ce jeu n'est pas encore disponible. */
    function rattle() {
      if (!lock) return Promise.resolve();
      return tween({
        duration: 0.5,
        ease: 'linear',
        onUpdate: (k) => {
          lock.rotation.z = Math.sin(k * Math.PI * 8) * 0.3 * (1 - k);
        },
      });
    }

    return { group, hitbox, setFocused, rattle, entrance: new THREE.Vector3(0, 1.4, 0) };
  }

  root.DragonJack.createAlcove = createAlcove;
})(window);
