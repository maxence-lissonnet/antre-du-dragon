/*
 * Apparence « classique » : l'esprit du Supaplex d'origine (circuits verts, Murphy rouge, zonks gris,
 * infotrons en atomes), redessiné en 3D avec des formes simples. Aucune image d'origine n'est reprise.
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;

  const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2, ...options });
  const MATERIALS = {
    metal: mat('#8f969e', { metalness: 0.7, roughness: 0.35 }),
    metalDark: mat('#4e545b', { metalness: 0.7, roughness: 0.4 }),
    zonk: mat('#9aa0a6', { roughness: 0.6 }),
    zonkBand: mat('#5d636a', { roughness: 0.6 }),
    murphy: mat('#e0302a', { roughness: 0.35 }),
    white: mat('#ffffff', { roughness: 0.3 }),
    black: mat('#111111'),
    infotron: mat('#ff4a6a', { emissive: '#8a0a24', emissiveIntensity: 0.6 }),
    orbitA: mat('#4ad06a', { emissive: '#0a4a1a' }),
    orbitB: mat('#4a8aff', { emissive: '#0a1a5a' }),
    chip: mat('#1a1a1e', { roughness: 0.4 }),
    pin: mat('#d8dde2', { metalness: 0.9, roughness: 0.25 }),
    screen: mat('#1aff6a', { emissive: '#0a8a3a', emissiveIntensity: 0.9 }),
    electron: new THREE.MeshBasicMaterial({ color: '#ffe84a' }),
    ledRed: new THREE.MeshBasicMaterial({ color: '#ff3a2a' }),
    ledGreen: new THREE.MeshBasicMaterial({ color: '#3aff6a' }),
    resistor: mat('#c8a46a'),
    capacitor: mat('#3a5fc4', { metalness: 0.4 }),
    blade: mat('#dfe4ea', { metalness: 0.9, roughness: 0.2 }),
    explosion: new THREE.MeshBasicMaterial({ color: '#ffb340', transparent: true, opacity: 0.9 }),
    disk: {
      redDisk: mat('#d42a2a'),
      droppedDisk: mat('#ff3a3a', { emissive: '#ff0000', emissiveIntensity: 0.4 }),
      orangeDisk: mat('#ee8a1a'),
      yellowDisk: mat('#f0d22a'),
    },
  };

  function canvasTexture(width, height, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  // Circuit imprimé : fond vert, pistes cuivrées et pastilles.
  const baseTexture = canvasTexture(128, 128, (ctx, w) => {
    ctx.fillStyle = '#1f7a3a';
    ctx.fillRect(0, 0, w, w);
    ctx.strokeStyle = '#d8b24a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(10, 30);
    ctx.lineTo(60, 30);
    ctx.lineTo(80, 60);
    ctx.lineTo(118, 60);
    ctx.moveTo(30, 118);
    ctx.lineTo(30, 80);
    ctx.lineTo(70, 90);
    ctx.stroke();
    ctx.fillStyle = '#e8c86a';
    [[10, 30], [118, 60], [30, 118], [70, 90], [96, 20]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    });
  });
  const exitTexture = canvasTexture(128, 128, (ctx, w) => {
    ctx.fillStyle = '#b81e1e';
    ctx.fillRect(0, 0, w, w);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', w / 2, w / 2);
  });

  function box(width, height, depth, material, y = height / 2) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.y = y;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function floppy(material) {
    const group = new THREE.Group();
    group.add(box(0.8, 0.12, 0.8, material, 0.06));
    const shutter = box(0.36, 0.02, 0.32, MATERIALS.metal, 0.13);
    shutter.position.z = -0.2;
    const label = box(0.6, 0.02, 0.28, MATERIALS.white, 0.13);
    label.position.z = 0.2;
    group.add(shutter, label);
    return group;
  }

  const BUILDERS = {
    /*
     * Mur « matériel » : plaque de métal rivetée, comme dans le jeu d'origine. Selon sa position,
     * certaines plaques portent un composant (diode, résistance, condensateur) pour varier le décor.
     */
    wall(x = 0, y = 0) {
      const group = new THREE.Group();
      group.add(box(1, 0.7, 1, MATERIALS.metal));
      group.add(box(0.7, 0.05, 0.7, MATERIALS.metalDark, 0.72));
      [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]].forEach(([rx, rz]) => {
        const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), MATERIALS.metalDark);
        rivet.position.set(rx, 0.71, rz);
        group.add(rivet);
      });
      const variant = (x * 7 + y * 13) % 9;
      if (variant === 1) {
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), (x + y) % 2 ? MATERIALS.ledRed : MATERIALS.ledGreen);
        led.position.y = 0.78;
        group.add(led);
      } else if (variant === 4) {
        const resistor = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 12), MATERIALS.resistor);
        resistor.rotation.z = Math.PI / 2;
        resistor.position.y = 0.82;
        group.add(resistor);
        [-0.1, 0.05].forEach((offset, index) => {
          const band = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.05, 12), index ? MATERIALS.ledRed : MATERIALS.zonkBand);
          band.rotation.z = Math.PI / 2;
          band.position.set(offset, 0.82, 0);
          group.add(band);
        });
      } else if (variant === 7) {
        const capacitor = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 14), MATERIALS.capacitor);
        capacitor.position.y = 0.88;
        group.add(capacitor);
      }
      return group;
    },
    base() {
      return box(0.98, 0.2, 0.98, new THREE.MeshStandardMaterial({ map: baseTexture, roughness: 0.7 }), 0.1);
    },
    ram() {
      const group = new THREE.Group();
      group.add(box(0.86, 0.35, 0.7, MATERIALS.chip, 0.2));
      for (let i = 0; i < 4; i += 1) {
        [-1, 1].forEach((side) => {
          const pin = box(0.08, 0.08, 0.14, MATERIALS.pin, 0.08);
          pin.position.set(-0.3 + i * 0.2, 0.08, side * 0.41);
          group.add(pin);
        });
      }
      return group;
    },
    zonk() {
      const group = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.44, 24, 16), MATERIALS.zonk);
      ball.castShadow = true;
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.04, 8, 32), MATERIALS.zonkBand);
      band.rotation.x = Math.PI / 2;
      const band2 = band.clone();
      band2.rotation.set(0, 0, Math.PI / 2);
      group.add(ball, band, band2);
      group.position.y = 0.45;
      return wrap(group);
    },
    infotron() {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), MATERIALS.infotron));
      const orbitA = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 8, 36), MATERIALS.orbitA);
      const orbitB = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 8, 36), MATERIALS.orbitB);
      orbitA.rotation.x = Math.PI / 3;
      orbitB.rotation.x = -Math.PI / 3;
      group.add(orbitA, orbitB);
      group.position.y = 0.45;
      return wrap(group);
    },
    murphy() {
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 20), MATERIALS.murphy);
      body.castShadow = true;
      group.add(body);
      [-0.15, 0.15].forEach((x) => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), MATERIALS.white);
        eye.position.set(x, 0.12, 0.34);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), MATERIALS.black);
        pupil.position.set(x, 0.12, 0.44);
        group.add(eye, pupil);
      });
      const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 16, Math.PI), MATERIALS.black);
      mouth.position.set(0, -0.08, 0.38);
      mouth.rotation.z = Math.PI;
      group.add(mouth);
      group.position.y = 0.44;
      return wrap(group);
    },
    exit() {
      const group = new THREE.Group();
      group.add(box(0.96, 0.5, 0.96, MATERIALS.metalDark));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshStandardMaterial({ map: exitTexture, emissive: '#ffffff', emissiveMap: exitTexture, emissiveIntensity: 0.2 }));
      face.rotation.x = -Math.PI / 2;
      face.position.y = 0.51;
      group.add(face);
      group.userData.face = face;
      return group;
    },
    snik() {
      // Snik snak : deux lames de ciseaux qui s'ouvrent et se ferment.
      const group = new THREE.Group();
      const pivot = new THREE.Group();
      [-1, 1].forEach((side) => {
        const blade = box(0.12, 0.06, 0.8, MATERIALS.blade, 0);
        blade.rotation.y = side * 0.4;
        blade.userData.side = side;
        pivot.add(blade);
      });
      pivot.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), MATERIALS.metalDark));
      pivot.position.y = 0.3;
      group.add(pivot);
      group.userData.blades = pivot.children.filter((child) => child.userData.side);
      return group;
    },
    electron() {
      const group = new THREE.Group();
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), MATERIALS.electron);
      const glow = new THREE.PointLight('#ffe060', 0.8, 2.5, 2);
      group.add(star, glow);
      group.position.y = 0.45;
      return wrap(group);
    },
    redDisk: () => floppy(MATERIALS.disk.redDisk),
    droppedDisk: () => floppy(MATERIALS.disk.droppedDisk),
    orangeDisk: () => floppy(MATERIALS.disk.orangeDisk),
    yellowDisk: () => floppy(MATERIALS.disk.yellowDisk),
    terminal() {
      const group = new THREE.Group();
      group.add(box(0.8, 0.6, 0.6, MATERIALS.metalDark));
      const screen = box(0.6, 0.4, 0.04, MATERIALS.screen, 0.36);
      screen.position.z = 0.31;
      group.add(screen);
      return group;
    },
    explosion() {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), MATERIALS.explosion.clone());
      ball.position.y = 0.4;
      return wrap(ball);
    },
  };

  // Ports : plaque de métal surmontée d'une flèche dans le sens de passage.
  const PORT_ANGLES = { portRight: -Math.PI / 2, portLeft: Math.PI / 2, portUp: Math.PI, portDown: 0 };
  Object.entries(PORT_ANGLES).forEach(([type, angle]) => {
    BUILDERS[type] = () => {
      const group = new THREE.Group();
      group.add(box(0.96, 0.15, 0.96, MATERIALS.metalDark));
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 4), MATERIALS.metal);
      arrow.rotation.x = Math.PI / 2;
      arrow.position.y = 0.3;
      const holder = new THREE.Group();
      holder.add(arrow);
      holder.rotation.y = angle;
      group.add(holder);
      return group;
    };
  });

  /* Enveloppe : la position du groupe sert au déplacement, l'objet intérieur peut tourner librement. */
  function wrap(object) {
    const holder = new THREE.Group();
    holder.add(object);
    holder.userData.inner = object;
    return holder;
  }

  function build(type, x, y) {
    const builder = BUILDERS[type];
    return builder ? builder(x, y) : new THREE.Group();
  }

  function buildFloor(width, height) {
    const texture = canvasTexture(64, 64, (ctx, w) => {
      ctx.fillStyle = '#16181c';
      ctx.fillRect(0, 0, w, w);
      ctx.strokeStyle = '#2a2e35';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, w - 2);
    });
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(width, height);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    return floor;
  }

  function animate(type, object, time, { state }) {
    if (type === 'infotron') object.userData.inner.rotation.y = time * 2;
    if (type === 'electron') object.userData.inner.rotation.y = time * 4;
    if (type === 'snik') {
      const open = 0.15 + Math.abs(Math.sin(time * 8)) * 0.45;
      object.userData.blades.forEach((blade) => {
        blade.rotation.y = blade.userData.side * open;
      });
    }
    if (type === 'explosion') object.userData.inner.scale.setScalar(0.8 + Math.sin(time * 30) * 0.15);
    if (type === 'droppedDisk') object.visible = Math.floor(time * 6) % 2 === 0;
    if (type === 'exit' && state) {
      const open = state.collected >= state.needed;
      object.userData.face.material.emissiveIntensity = open ? 0.6 + Math.sin(time * 4) * 0.3 : 0.15;
    }
  }

  function burst(particles, position, count, ramp, speed = 2) {
    for (let i = 0; i < count; i += 1) {
      particles.emit({
        position: { x: position.x, y: position.y + 0.4, z: position.z },
        velocity: { x: (Math.random() - 0.5) * speed, y: Math.random() * speed, z: (Math.random() - 0.5) * speed },
        life: 0.4 + Math.random() * 0.4,
        size: 0.35,
        endSize: 0.05,
        ramp,
      });
    }
  }

  root.DragonJack = root.DragonJack || {};
  root.DragonJack.supaplexThemes = root.DragonJack.supaplexThemes || {};
  root.DragonJack.supaplexThemes['classique'] = {
    id: 'classique',
    background: '#0c0d10',
    lights: { ambient: '#c8d0dc', ambientIntensity: 0.55, key: '#ffffff', keyIntensity: 1.1 },
    title: 'Supaplex',
    // Vue presque verticale, comme la vue de dessus du jeu d'origine.
    camera: { direction: new THREE.Vector3(0, 14, 2.5), visibleHalfWidth: { landscape: 9, portrait: 4.8 } },
    collectName: 'Infotrons',
    diskName: 'Disquettes',
    terms: {},
    translate: (text) => text,
    build,
    buildFloor,
    animate,
    onExplosion: (particles, position) => burst(particles, position, 18, 'fire', 4),
    onEat: (particles, position) => burst(particles, position, 4, 'spectral', 1),
    onCollect: (particles, position) => burst(particles, position, 10, 'shadow', 2),
  };
})(window);
