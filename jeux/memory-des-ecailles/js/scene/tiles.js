/*
 * Les écailles du memory : tuiles en forme d'écaille de dragon posées sur une dalle de pierre.
 * Dos commun (motif d'écailles dorées) et 18 motifs : 6 formes en 3 couleurs de gemme.
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;
  const { tween } = root.DragonJack.tween;

  const TILE = { width: 0.9, depth: 1.02, thickness: 0.06 };
  const SPACING = { x: 1.05, z: 1.16 };
  const SLAB = { width: 7.2, depth: 7.8, centerZ: 0.6 };
  const FLOOR_Y = -2.2;
  const SHAPES = ['gem', 'star', 'moon', 'flame', 'eye', 'rune'];
  const COLORS = [
    { fill: '#d4303a', dark: '#6a0e12' },
    { fill: '#2fa07a', dark: '#0e4a36' },
    { fill: '#4a74e0', dark: '#132a6a' },
  ];
  const TEXTURE_SIZE = 256;

  /* Contour d'une écaille : bord supérieur arrondi, pointe vers le joueur. */
  function scaleShape() {
    const w = TILE.width / 2;
    const d = TILE.depth / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-w, d * 0.35);
    shape.quadraticCurveTo(-w, d, 0, d);
    shape.quadraticCurveTo(w, d, w, d * 0.35);
    shape.quadraticCurveTo(w * 0.85, -d * 0.55, 0, -d);
    shape.quadraticCurveTo(-w * 0.85, -d * 0.55, -w, d * 0.35);
    return shape;
  }

  /* Plaque plate en forme d'écaille, à plat (face vers le haut), textures de 0 à 1 sur toute la tuile. */
  function faceGeometry(shape) {
    const geometry = new THREE.ShapeGeometry(shape, 16);
    const uv = geometry.attributes.uv;
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      uv.setXY(i, position.getX(i) / TILE.width + 0.5, position.getY(i) / TILE.depth + 0.5);
    }
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }

  function makeCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    return { canvas, ctx: canvas.getContext('2d') };
  }

  function toTexture(canvas, renderer) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  function createBackTexture(renderer) {
    const { canvas, ctx } = makeCanvas();
    const gradient = ctx.createLinearGradient(0, 0, 0, TEXTURE_SIZE);
    gradient.addColorStop(0, '#4a6a5a');
    gradient.addColorStop(1, '#1e3a2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    ctx.strokeStyle = 'rgba(224, 166, 58, 0.55)';
    ctx.lineWidth = 3;
    for (let row = 0; row < 9; row += 1) {
      for (let col = -1; col < 9; col += 1) {
        ctx.beginPath();
        ctx.arc(col * 32 + (row % 2) * 16, row * 30, 16, 0, Math.PI);
        ctx.stroke();
      }
    }
    return toTexture(canvas, renderer);
  }

  const DRAW = {
    gem(ctx, r) {
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.75, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.75, 0);
      ctx.closePath();
    },
    star(ctx, r) {
      for (let i = 0; i < 10; i += 1) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const radius = i % 2 === 0 ? r : r * 0.45;
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      ctx.closePath();
    },
    moon(ctx, r) {
      ctx.arc(0, 0, r, Math.PI * 0.25, Math.PI * 1.75, false);
      ctx.arc(r * 0.45, 0, r * 0.75, Math.PI * 1.6, Math.PI * 0.4, true);
      ctx.closePath();
    },
    flame(ctx, r) {
      ctx.moveTo(0, r);
      ctx.bezierCurveTo(-r, r * 0.6, -r * 0.7, -r * 0.2, -r * 0.1, -r);
      ctx.bezierCurveTo(0, -r * 0.4, r * 0.4, -r * 0.5, r * 0.35, -r * 0.8);
      ctx.bezierCurveTo(r, -r * 0.1, r * 0.9, r * 0.6, 0, r);
      ctx.closePath();
    },
    eye(ctx, r) {
      ctx.moveTo(-r, 0);
      ctx.quadraticCurveTo(0, -r * 1.05, r, 0);
      ctx.quadraticCurveTo(0, r * 1.05, -r, 0);
      ctx.closePath();
    },
    rune(ctx, r) {
      const t = r * 0.28;
      ctx.moveTo(-t, -r);
      ctx.lineTo(t, -r);
      ctx.lineTo(t, -t);
      ctx.lineTo(r, -t);
      ctx.lineTo(r, t);
      ctx.lineTo(t, t);
      ctx.lineTo(t, r);
      ctx.lineTo(-t, r);
      ctx.lineTo(-t, t);
      ctx.lineTo(-r, t);
      ctx.lineTo(-r, -t);
      ctx.lineTo(-t, -t);
      ctx.closePath();
    },
  };

  /* Motif n°symbol : la forme change tous les 3 motifs, la couleur à chaque motif. */
  function createSymbolTexture(symbol, renderer) {
    const { canvas, ctx } = makeCanvas();
    const shape = SHAPES[Math.floor(symbol / COLORS.length) % SHAPES.length];
    const color = COLORS[symbol % COLORS.length];
    ctx.fillStyle = '#efe4cc';
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    ctx.strokeStyle = 'rgba(160, 110, 40, 0.6)';
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 14, TEXTURE_SIZE - 28, TEXTURE_SIZE - 28);
    ctx.save();
    ctx.translate(TEXTURE_SIZE / 2, TEXTURE_SIZE / 2 + 6);
    ctx.beginPath();
    DRAW[shape](ctx, TEXTURE_SIZE * 0.3);
    const gradient = ctx.createLinearGradient(0, -80, 0, 80);
    gradient.addColorStop(0, color.fill);
    gradient.addColorStop(1, color.dark);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#221a16';
    ctx.stroke();
    if (shape === 'eye') {
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 30, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#221a16';
      ctx.fill();
    }
    ctx.restore();
    return toTexture(canvas, renderer);
  }

  function describeSymbol(symbol) {
    const shapes = { gem: 'gemme', star: 'étoile', moon: 'lune', flame: 'flamme', eye: 'œil', rune: 'rune' };
    const colors = ['rouge', 'verte', 'bleue'];
    return `${shapes[SHAPES[Math.floor(symbol / COLORS.length)]]} ${colors[symbol % COLORS.length]}`;
  }

  function createBoardView({ scene, renderer, audio }) {
    const stone = new THREE.MeshStandardMaterial({ color: '#2e2622', roughness: 0.85, flatShading: true });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(SLAB.width, 0.4, SLAB.depth), stone);
    slab.position.set(0, -0.2, SLAB.centerZ);
    slab.receiveShadow = true;
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.8, -FLOOR_Y - 0.4, 8), stone);
    pedestal.position.set(0, (FLOOR_Y - 0.4) / 2, SLAB.centerZ);
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(SLAB.width + 0.1, 0.06, SLAB.depth + 0.1),
      new THREE.MeshStandardMaterial({ color: '#c8932e', metalness: 0.85, roughness: 0.35 }),
    );
    // Le cadre reste un peu sous le dessus de la dalle : deux surfaces à la même hauteur scintillent.
    rim.position.set(0, -0.06, SLAB.centerZ);
    scene.add(slab, pedestal, rim);

    const shape = scaleShape();
    const topGeometry = faceGeometry(shape);
    // La face du dessous est la même plaque retournée d'un demi-tour : après le retournement de la tuile,
    // le motif apparaît à l'endroit.
    const bottomGeometry = faceGeometry(shape);
    bottomGeometry.rotateZ(Math.PI);
    const bodyGeometry = new THREE.ExtrudeGeometry(shape, { depth: TILE.thickness, bevelEnabled: false, curveSegments: 16 });
    bodyGeometry.rotateX(-Math.PI / 2);
    bodyGeometry.translate(0, -TILE.thickness / 2, 0);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#c8932e', metalness: 0.8, roughness: 0.35, emissive: '#000000' });
    const backMaterial = new THREE.MeshStandardMaterial({ map: createBackTexture(renderer), roughness: 0.5, metalness: 0.2 });
    const symbolMaterials = new Map();
    const cursorRing = new THREE.Mesh(
      new THREE.RingGeometry(0.58, 0.66, 32),
      new THREE.MeshBasicMaterial({ color: '#f3d48a', transparent: true, opacity: 0.9 }),
    );
    cursorRing.rotation.x = -Math.PI / 2;
    cursorRing.visible = false;
    scene.add(cursorRing);

    let tiles = [];
    let columns = 0;

    function symbolMaterial(symbol) {
      if (!symbolMaterials.has(symbol)) {
        symbolMaterials.set(symbol, new THREE.MeshStandardMaterial({ map: createSymbolTexture(symbol, renderer), roughness: 0.5, emissive: '#000000' }));
      }
      return symbolMaterials.get(symbol);
    }

    function slotPosition(index, rows) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      return new THREE.Vector3((column - (columns - 1) / 2) * SPACING.x, 0.05, SLAB.centerZ + (row - (rows - 1) / 2) * SPACING.z);
    }

    function clear() {
      tiles.forEach((tile) => scene.remove(tile.group));
      tiles = [];
      cursorRing.visible = false;
    }

    /* Pose les tuiles face cachée, en les faisant tomber une à une sur la dalle. */
    function deal(board, level) {
      clear();
      columns = level.columns;
      tiles = board.map((symbol, index) => {
        const group = new THREE.Group();
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial.clone());
        body.castShadow = true;
        const top = new THREE.Mesh(topGeometry, backMaterial);
        top.position.y = TILE.thickness / 2 + 0.002;
        // Motif encore inconnu (partie en ligne, côté invité) : il sera posé au moment du retournement.
        const bottom = new THREE.Mesh(bottomGeometry, symbol === null ? backMaterial : symbolMaterial(symbol));
        bottom.position.y = -TILE.thickness / 2 - 0.002;
        group.add(body, top, bottom);
        const home = slotPosition(index, level.rows);
        group.position.copy(home).setY(home.y + 3);
        scene.add(group);
        tween({ duration: 0.45, delay: index * 0.025, ease: 'outBack', onUpdate: (k) => group.position.setY(home.y + 3 * (1 - k)) });
        body.userData.tileIndex = index;
        return { group, body, home, symbol, faceUp: false };
      });
    }

    function flip(index, faceUp) {
      const tile = tiles[index];
      tile.faceUp = faceUp;
      const from = tile.group.rotation.z;
      const to = faceUp ? Math.PI : 0;
      audio.play('card');
      return tween({
        duration: 0.35,
        onUpdate: (k) => {
          tile.group.rotation.z = from + (to - from) * k;
          tile.group.position.y = tile.home.y + Math.sin(k * Math.PI) * 0.45;
        },
      });
    }

    // Couleur du bord des paires trouvées : or pour le joueur, braise pour le dragon.
    const OWNER_GLOW = { player: new THREE.Color(0.55, 0.38, 0.05), dragon: new THREE.Color(0.7, 0.12, 0.03) };

    /* Une paire trouvée flamboie à la couleur de celui qui l'a trouvée, puis s'enfonce légèrement. */
    function markMatched(indices, owner = 'player') {
      const glow = OWNER_GLOW[owner];
      return Promise.all(
        indices.map((index) => {
          const tile = tiles[index];
          const body = tile.group.children[0];
          return tween({
            duration: 0.6,
            onUpdate: (k) => {
              const flare = 1 + Math.sin(k * Math.PI);
              body.material.emissive.copy(glow).multiplyScalar(flare * 0.6);
              tile.group.position.y = tile.home.y - 0.04 * k;
            },
          });
        }),
      );
    }

    function revealAll() {
      return Promise.all(tiles.map((tile, index) => (tile.faceUp ? null : flip(index, true))));
    }

    function setCursor(index) {
      if (index === null || !tiles[index]) {
        cursorRing.visible = false;
        return;
      }
      cursorRing.visible = true;
      cursorRing.position.copy(tiles[index].home).setY(0.02);
    }

    return {
      deal,
      /* Donne son motif à une écaille (connu seulement quand on la retourne, en ligne). */
      setSymbol(index, symbol) {
        const tile = tiles[index];
        if (!tile || tile.symbol === symbol) return;
        tile.symbol = symbol;
        tile.group.children[2].material = symbolMaterial(symbol);
      },
      flip,
      markMatched,
      revealAll,
      clear,
      setCursor,
      hitTargets: () => tiles.map((tile) => tile.body),
      center: () => new THREE.Vector3(0, 0, SLAB.centerZ),
      tilePosition: (index) => tiles[index].home.clone(),
      /*
       * Cadrage d'un niveau : assez large pour toutes les colonnes et toutes les rangées,
       * et visé un peu en avant de la dalle pour que la grille reste au-dessus de la barre du bas.
       */
      framingFor: (level) => {
        const halfGrid = Math.max((level.columns * SPACING.x) / 2, (level.rows * SPACING.z) / 2);
        return {
          target: new THREE.Vector3(0, 1.1, SLAB.centerZ + 0.4 + level.rows * 0.12),
          visibleHalfWidth: { landscape: Math.max(5.8, halfGrid + 3.6), portrait: halfGrid + 0.4 },
        };
      },
    };
  }

  root.DragonJack.createBoardView = createBoardView;
  root.DragonJack.describeScaleSymbol = describeSymbol;
})(window);
