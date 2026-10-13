/*
 * La machine à sous en 3D : meuble de pierre et d'or, trois rouleaux cylindriques, levier,
 * plaque du jackpot et guirlande d'ampoules. Les lignes gagnantes s'allument après le tour.
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;
  const { tween } = root.DragonJack.tween;
  const symbols = root.DragonJack.slotSymbols;
  const numberFormat = new Intl.NumberFormat('fr-FR');

  const FLOOR_Y = -2.2;
  const WINDOW = { centerY: 0.9, halfWidth: 1.65, halfHeight: 0.65 };
  const REEL = { radius: 1.35, width: 0.95, spacing: 1.08, centerZ: -0.65 };
  // Écart vertical entre deux rangées visibles : un cran de rouleau vu de face.
  const ROW_OFFSET = REEL.radius * Math.sin(Math.PI / 10);
  const BULB_COUNT = 14;
  // Angle maximal du levier tiré vers le joueur (en radians).
  const LEVER_MAX_ANGLE = 0.95;

  const materials = {
    stone: new THREE.MeshStandardMaterial({ color: '#2e2622', roughness: 0.85, flatShading: true }),
    wood: new THREE.MeshStandardMaterial({ color: '#3a2218', roughness: 0.6, metalness: 0.1 }),
    gold: new THREE.MeshStandardMaterial({ color: '#d39a2e', roughness: 0.3, metalness: 0.9 }),
    ruby: new THREE.MeshStandardMaterial({ color: '#c0262d', roughness: 0.2, metalness: 0.3, emissive: '#4a0606' }),
    line: new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0 }),
  };

  function box(width, height, depth, material, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function buildCabinet(group) {
    const top = WINDOW.centerY + WINDOW.halfHeight;
    const bottom = WINDOW.centerY - WINDOW.halfHeight;
    group.add(
      box(4.4, 2.0, 2.0, materials.stone, 0, FLOOR_Y + 1.0, 0),
      box(4.6, 0.12, 2.2, materials.gold, 0, FLOOR_Y + 2.0, 0),
      // Cadre autour de la fenêtre des rouleaux.
      box(4.0, 2.2 - top, 1.6, materials.wood, 0, (top + 2.2) / 2, 0),
      box(4.0, bottom + 0.2, 1.6, materials.wood, 0, (bottom - 0.2) / 2, 0),
      box(2.0 - WINDOW.halfWidth, top - bottom, 1.6, materials.wood, -(WINDOW.halfWidth + 2.0) / 2, WINDOW.centerY, 0),
      box(2.0 - WINDOW.halfWidth, top - bottom, 1.6, materials.wood, (WINDOW.halfWidth + 2.0) / 2, WINDOW.centerY, 0),
      box(3.4, 0.06, 0.08, materials.gold, 0, top + 0.03, 0.82),
      box(3.4, 0.06, 0.08, materials.gold, 0, bottom - 0.03, 0.82),
      // Plateau où tombent les gains.
      box(2.2, 0.14, 0.6, materials.gold, 0, -0.15, 1.05),
      // Fond derrière les rouleaux.
      box(3.4, 1.6, 0.1, new THREE.MeshStandardMaterial({ color: '#0e0806' }), 0, WINDOW.centerY, -2.2),
    );
    // Séparations dorées entre les rouleaux.
    [-REEL.spacing / 2, REEL.spacing / 2].forEach((x) => group.add(box(0.05, WINDOW.halfHeight * 2, 0.6, materials.gold, x, WINDOW.centerY, 0.5)));
  }

  function createJackpotPlaque(group, renderer) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 220;
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const face = new THREE.MeshStandardMaterial({ map: texture, emissive: '#ffffff', emissiveMap: texture, emissiveIntensity: 0.35, roughness: 0.5 });
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.82, 0.2), [
      materials.gold, materials.gold, materials.gold, materials.gold, face, materials.gold,
    ]);
    plaque.position.set(0, 2.75, 0.55);
    group.add(plaque);

    return function draw(amount) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1a0f0c';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#e0a63a';
      ctx.lineWidth = 8;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e0a63a';
      ctx.font = '52px "Grenze Gotisch", Georgia, serif';
      ctx.fillText('Jackpot', canvas.width / 2, 62);
      ctx.fillStyle = '#ffe9a8';
      ctx.font = '104px "Grenze Gotisch", Georgia, serif';
      ctx.fillText(`${numberFormat.format(Math.floor(amount))} pièces`, canvas.width / 2, 148);
      texture.needsUpdate = true;
    };
  }

  function buildBulbs(group) {
    const bulbs = [];
    for (let i = 0; i < BULB_COUNT; i += 1) {
      const t = i / (BULB_COUNT - 1);
      const material = new THREE.MeshBasicMaterial({ color: '#ffcf6a' });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), material);
      bulb.position.set(-1.85 + t * 3.7, 3.22, 0.68);
      group.add(bulb);
      bulbs.push(material);
    }
    return bulbs;
  }

  function buildLever(group) {
    const lever = new THREE.Group();
    lever.position.set(2.25, 0.5, 0.2);
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), materials.gold);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 10), materials.gold);
    arm.position.y = 0.75;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), materials.ruby);
    knob.position.y = 1.55;
    // Zone de prise invisible autour de la poignée et du manche, plus facile à attraper.
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.9, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
    grip.position.y = 1.0;
    lever.add(socket, arm, knob, grip);
    group.add(lever);
    lever.userData.grip = grip;
    return lever;
  }

  /* Lignes lumineuses posées devant les rouleaux, une par ligne gagnante. */
  function buildLines(group, lines) {
    const length = WINDOW.halfWidth * 2 - 0.1;
    return lines.map((line) => {
      const rise = (line[0] - line[2]) * ROW_OFFSET;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(length, rise), 0.05, 0.02), materials.line.clone());
      const middleRow = line[1];
      mesh.position.set(0, WINDOW.centerY + (1 - middleRow) * ROW_OFFSET, 0.86);
      mesh.rotation.z = Math.atan2(rise, length);
      group.add(mesh);
      return mesh;
    });
  }

  function createSlotMachine({ scene, renderer, strips, lines, audio }) {
    const group = new THREE.Group();
    scene.add(group);
    buildCabinet(group);
    const drawJackpot = createJackpotPlaque(group, renderer);
    const bulbs = buildBulbs(group);
    const lever = buildLever(group);
    const lineMeshes = buildLines(group, lines);

    const windowLight = new THREE.PointLight('#ffd9a0', 1.6, 5, 1.5);
    windowLight.position.set(0, WINDOW.centerY, 1.6);
    group.add(windowLight);

    const reels = strips.map((strip, index) => {
      const pivot = new THREE.Group();
      pivot.position.set((index - 1) * REEL.spacing, WINDOW.centerY, REEL.centerZ);
      const geometry = new THREE.CylinderGeometry(REEL.radius, REEL.radius, REEL.width, 64, 1, true);
      // Le cylindre est couché : son axe devient horizontal (gauche-droite).
      geometry.rotateZ(-Math.PI / 2);
      // Une case est moins haute (arc du rouleau) que large : le dessin est compensé pour rester proportionné.
      const cellAspect = (2 * Math.PI * REEL.radius) / strip.length / REEL.width;
      const texture = symbols.createReelTexture(strip, renderer, cellAspect);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55 }));
      pivot.add(mesh);
      group.add(pivot);
      return { pivot, length: strip.length };
    });

    /* Angle qui place la case `stop` au centre de la fenêtre. */
    function angleFor(stop, length) {
      return (-2 * Math.PI * (stop + 0.5)) / length;
    }

    function setStops(stops) {
      reels.forEach((reel, index) => {
        reel.pivot.rotation.x = angleFor(stops[index], reel.length);
      });
    }

    let spinning = false;
    let celebrating = 0;

    /* Les rouleaux défilent vers le bas et s'arrêtent l'un après l'autre, avec un petit rebond. */
    function spinTo(stops) {
      spinning = true;
      return Promise.all(
        reels.map((reel, index) => {
          const from = reel.pivot.rotation.x;
          const target = angleFor(stops[index], reel.length);
          const fullTurns = Math.ceil((from - target) / (2 * Math.PI)) + 3 + index;
          const to = target + fullTurns * 2 * Math.PI;
          return tween({
            duration: 1.1 + index * 0.45,
            ease: 'outBack',
            onUpdate: (k) => {
              reel.pivot.rotation.x = from + (to - from) * k;
            },
          }).then(() => {
            reel.pivot.rotation.x = target;
            audio.play('chip');
          });
        }),
      ).then(() => {
        spinning = false;
      });
    }

    function pullLever() {
      return tween({
        duration: 0.5,
        ease: 'linear',
        onUpdate: (k) => {
          lever.rotation.x = Math.sin(k * Math.PI) * LEVER_MAX_ANGLE;
        },
      });
    }

    /* Le joueur tient le levier : `pull` va de 0 (au repos) à 1 (tiré jusqu'en bas). */
    function holdLever(pull) {
      lever.rotation.x = THREE.MathUtils.clamp(pull, 0, 1) * LEVER_MAX_ANGLE;
    }

    /* Relâché, le levier remonte avec un petit rebond. */
    function releaseLever() {
      const from = lever.rotation.x;
      return tween({
        duration: 0.45,
        ease: 'outBack',
        onUpdate: (k) => {
          lever.rotation.x = from * (1 - k);
        },
      });
    }

    /* Fait clignoter les lignes gagnantes pendant quelques instants. */
    async function showWins(lineIndices, seconds = 1.6) {
      celebrating += 1;
      await tween({
        duration: seconds,
        ease: 'linear',
        onUpdate: (k) => {
          const pulse = 0.55 + 0.45 * Math.sin(k * Math.PI * 8);
          lineIndices.forEach((index) => {
            lineMeshes[index].material.opacity = pulse * (1 - Math.max(0, k - 0.85) / 0.15);
          });
        },
      });
      lineMeshes.forEach((mesh) => {
        mesh.material.opacity = 0;
      });
      celebrating -= 1;
    }

    /* Ampoules : chenillard pendant le tour, clignotement pendant un gain, lueur douce au repos. */
    function update(time) {
      bulbs.forEach((material, index) => {
        let level = 0.55 + 0.25 * Math.sin(time * 1.5 + index * 0.4);
        if (spinning) level = (Math.floor(time * 14) + index) % 4 === 0 ? 1.4 : 0.35;
        if (celebrating > 0) level = Math.floor(time * 8) % 2 === index % 2 ? 1.6 : 0.3;
        material.color.setRGB(1 * level, 0.81 * level, 0.42 * level);
      });
    }

    return {
      setStops,
      spinTo,
      pullLever,
      holdLever,
      releaseLever,
      leverGrip: lever.userData.grip,
      showWins,
      setJackpot: drawJackpot,
      update,
      trayPosition: new THREE.Vector3(0, -0.05, 1.1),
      windowCenter: new THREE.Vector3(0, WINDOW.centerY, 0.8),
    };
  }

  root.DragonJack.createSlotMachine = createSlotMachine;
})(window);
