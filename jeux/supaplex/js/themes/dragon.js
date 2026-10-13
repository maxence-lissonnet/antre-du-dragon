/*
 * Apparence « dragon » : les mêmes règles que Supaplex, transposées dans l'antre.
 * Murphy → bébé dragon, zonk → rocher, infotron → rubis, circuit → terre semée d'or, mur → roche,
 * puce RAM → stalagmites, snik snak → chauve-souris, électron → feu follet, disquettes → potion de feu,
 * pierre de lave et baril de poudre, terminal → pierre runique, sortie → portail.
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;

  const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true, ...options });
  const MATERIALS = {
    rock: mat('#4a3c34'),
    rockDark: mat('#1e1814'),
    caveFloor: mat('#0e0a08', { roughness: 1 }),
    soil: mat('#4a2e18', { roughness: 0.95 }),
    goldFleck: mat('#e8b24a', { metalness: 0.8, roughness: 0.3 }),
    boulder: mat('#7a6a5c'),
    dragon: mat('#3f8c58'),
    belly: mat('#d8b46a'),
    horn: mat('#efe4cc'),
    eye: new THREE.MeshBasicMaterial({ color: '#ffd24a' }),
    ruby: mat('#e02a3a', { emissive: '#6a0612', emissiveIntensity: 0.7, metalness: 0.3, roughness: 0.15 }),
    stalagmite: mat('#8a7a6a'),
    bat: mat('#2a1e2e'),
    batWing: mat('#4a2a3e', { side: THREE.DoubleSide }),
    wisp: new THREE.MeshBasicMaterial({ color: '#ffb040' }),
    potion: mat('#d42a2a', { emissive: '#5a0606', roughness: 0.2 }),
    potionLit: mat('#ff3a2a', { emissive: '#ff2000', emissiveIntensity: 0.9 }),
    glass: mat('#d8e8f0', { transparent: true, opacity: 0.6, roughness: 0.1 }),
    lava: mat('#ff7a1a', { emissive: '#a03a06', emissiveIntensity: 0.8 }),
    keg: mat('#8a5a2a'),
    kegBand: mat('#e0c040', { metalness: 0.7, roughness: 0.3 }),
    rune: mat('#3a3a4a'),
    runeGlow: new THREE.MeshBasicMaterial({ color: '#6ad8ff' }),
    portal: mat('#c8932e', { metalness: 0.8, roughness: 0.3 }),
    portalCore: new THREE.MeshBasicMaterial({ color: '#b46aff', transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
    fire: new THREE.MeshBasicMaterial({ color: '#ff8a2a', transparent: true, opacity: 0.85 }),
  };

  function mesh(geometry, material, x = 0, y = 0, z = 0) {
    const result = new THREE.Mesh(geometry, material);
    result.position.set(x, y, z);
    result.castShadow = true;
    result.receiveShadow = true;
    return result;
  }

  function wrap(object) {
    const holder = new THREE.Group();
    holder.add(object);
    holder.userData.inner = object;
    return holder;
  }

  const BUILDERS = {
    wall() {
      const rock = mesh(new THREE.DodecahedronGeometry(0.62, 0), MATERIALS.rock, 0, 0.35);
      rock.scale.set(1, 0.75, 1);
      rock.rotation.y = Math.random() * Math.PI;
      return rock;
    },
    base() {
      const group = new THREE.Group();
      const soil = mesh(new THREE.BoxGeometry(0.98, 0.22, 0.98), MATERIALS.soil, 0, 0.11);
      group.add(soil);
      for (let i = 0; i < 3; i += 1) {
        group.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8), MATERIALS.goldFleck, (Math.random() - 0.5) * 0.7, 0.23, (Math.random() - 0.5) * 0.7));
      }
      return group;
    },
    ram() {
      const group = new THREE.Group();
      [[0, 0, 0.75], [-0.25, 0.2, 0.5], [0.25, -0.2, 0.55]].forEach(([x, z, height]) => {
        group.add(mesh(new THREE.ConeGeometry(0.2, height, 6), MATERIALS.stalagmite, x, height / 2, z));
      });
      return group;
    },
    zonk() {
      const rock = mesh(new THREE.DodecahedronGeometry(0.42, 0), MATERIALS.boulder);
      const holder = wrap(rock);
      rock.position.y = 0.42;
      return holder;
    },
    infotron() {
      const gem = mesh(new THREE.OctahedronGeometry(0.3, 0), MATERIALS.ruby);
      gem.scale.set(1, 1.3, 1);
      const holder = wrap(gem);
      gem.position.y = 0.45;
      return holder;
    },
    murphy() {
      // Bébé dragon : tête ronde, museau, cornes et grands yeux dorés.
      const group = new THREE.Group();
      group.add(mesh(new THREE.SphereGeometry(0.36, 20, 14), MATERIALS.dragon));
      const snout = mesh(new THREE.SphereGeometry(0.2, 14, 10), MATERIALS.belly, 0, -0.08, 0.28);
      snout.scale.set(1.2, 0.8, 1);
      group.add(snout);
      [-1, 1].forEach((side) => {
        const horn = mesh(new THREE.ConeGeometry(0.06, 0.28, 6), MATERIALS.horn, side * 0.17, 0.32, -0.1);
        horn.rotation.x = -0.5;
        group.add(horn);
        group.add(mesh(new THREE.SphereGeometry(0.08, 10, 8), MATERIALS.eye, side * 0.15, 0.1, 0.28));
        const wing = mesh(new THREE.ConeGeometry(0.16, 0.36, 3), MATERIALS.dragon, side * 0.38, 0.05, -0.1);
        wing.rotation.z = side * -1.2;
        group.add(wing);
      });
      group.position.y = 0.4;
      return wrap(group);
    },
    exit() {
      // Portail : arche dorée et voile violet, qui s'illumine une fois ouvert.
      const group = new THREE.Group();
      const ring = mesh(new THREE.TorusGeometry(0.38, 0.07, 10, 28), MATERIALS.portal, 0, 0.48);
      const core = new THREE.Mesh(new THREE.CircleGeometry(0.34, 28), MATERIALS.portalCore.clone());
      core.position.y = 0.48;
      group.add(ring, core, mesh(new THREE.BoxGeometry(0.9, 0.08, 0.5), MATERIALS.rockDark, 0, 0.04));
      group.userData.core = core;
      return group;
    },
    snik() {
      // Chauve-souris : petit corps sombre et deux ailes qui battent.
      const group = new THREE.Group();
      group.add(mesh(new THREE.SphereGeometry(0.16, 12, 8), MATERIALS.bat, 0, 0.45));
      const wings = [-1, 1].map((side) => {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(side * 0.42, 0.12);
        shape.lineTo(side * 0.34, -0.06);
        shape.lineTo(side * 0.2, 0.02);
        shape.lineTo(side * 0.12, -0.1);
        shape.closePath();
        const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape), MATERIALS.batWing);
        wing.position.y = 0.45;
        wing.userData.side = side;
        group.add(wing);
        return wing;
      });
      group.add(mesh(new THREE.SphereGeometry(0.03, 6, 4), MATERIALS.eye, -0.06, 0.5, 0.14));
      group.add(mesh(new THREE.SphereGeometry(0.03, 6, 4), MATERIALS.eye, 0.06, 0.5, 0.14));
      group.userData.wings = wings;
      return group;
    },
    electron() {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), MATERIALS.wisp));
      group.add(new THREE.PointLight('#ff9a3a', 1, 3, 2));
      group.position.y = 0.5;
      return wrap(group);
    },
    redDisk: () => potion(MATERIALS.potion),
    droppedDisk: () => potion(MATERIALS.potionLit),
    orangeDisk() {
      const rock = mesh(new THREE.DodecahedronGeometry(0.34, 0), MATERIALS.lava);
      rock.position.y = 0.36;
      return wrap(rock);
    },
    yellowDisk() {
      const group = new THREE.Group();
      group.add(mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.6, 14), MATERIALS.keg, 0, 0.3));
      group.add(mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 20), MATERIALS.kegBand, 0, 0.15).rotateX(Math.PI / 2));
      group.add(mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 20), MATERIALS.kegBand, 0, 0.45).rotateX(Math.PI / 2));
      return group;
    },
    terminal() {
      const group = new THREE.Group();
      group.add(mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), MATERIALS.rune, 0, 0.4));
      const glyph = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 6), MATERIALS.runeGlow);
      glyph.position.set(0, 0.5, 0.16);
      group.add(glyph);
      return group;
    },
    explosion() {
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), MATERIALS.fire.clone());
      ball.position.y = 0.4;
      return wrap(ball);
    },
  };

  function potion(material) {
    const group = new THREE.Group();
    group.add(mesh(new THREE.SphereGeometry(0.24, 16, 12), material, 0, 0.26));
    group.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.2, 10), MATERIALS.glass, 0, 0.55));
    group.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10), MATERIALS.keg, 0, 0.68));
    return group;
  }

  // Ports : dalle de pierre gravée d'une flèche dans le sens de passage.
  const PORT_ANGLES = { portRight: -Math.PI / 2, portLeft: Math.PI / 2, portUp: Math.PI, portDown: 0 };
  Object.entries(PORT_ANGLES).forEach(([type, angle]) => {
    BUILDERS[type] = () => {
      const group = new THREE.Group();
      group.add(mesh(new THREE.BoxGeometry(0.96, 0.14, 0.96), MATERIALS.rockDark, 0, 0.07));
      const arrow = mesh(new THREE.ConeGeometry(0.24, 0.5, 3), MATERIALS.goldFleck);
      arrow.rotation.x = Math.PI / 2;
      arrow.position.y = 0.24;
      const holder = new THREE.Group();
      holder.add(arrow);
      holder.rotation.y = angle;
      group.add(holder);
      return group;
    };
  });

  function build(type, x, y) {
    const builder = BUILDERS[type];
    return builder ? builder(x, y) : new THREE.Group();
  }

  function buildFloor(width, height) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width + 6, height + 6, width, height), MATERIALS.caveFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    floor.receiveShadow = true;
    return floor;
  }

  function animate(type, object, time, { state }) {
    if (type === 'infotron') object.userData.inner.rotation.y = time * 1.5;
    if (type === 'electron') object.userData.inner.position.y = 0.5 + Math.sin(time * 6) * 0.08;
    if (type === 'snik') {
      const flap = Math.sin(time * 18) * 0.7;
      object.userData.wings.forEach((wing) => {
        wing.rotation.y = wing.userData.side * flap;
      });
    }
    if (type === 'explosion') object.userData.inner.scale.setScalar(0.85 + Math.sin(time * 25) * 0.15);
    if (type === 'droppedDisk') object.scale.setScalar(1 + Math.sin(time * 14) * 0.08);
    if (type === 'exit' && state) {
      const open = state.collected >= state.needed;
      object.userData.core.material.opacity = open ? 0.6 + Math.sin(time * 4) * 0.25 : 0.12;
      object.userData.core.rotation.z = time;
    }
  }

  function burst(particles, position, count, ramp, speed = 2) {
    for (let i = 0; i < count; i += 1) {
      particles.emit({
        position: { x: position.x, y: position.y + 0.4, z: position.z },
        velocity: { x: (Math.random() - 0.5) * speed, y: Math.random() * speed, z: (Math.random() - 0.5) * speed },
        life: 0.4 + Math.random() * 0.4,
        size: 0.4,
        endSize: 0.05,
        buoyancy: ramp === 'fire' ? 2 : 0,
        ramp,
      });
    }
  }

  root.DragonJack = root.DragonJack || {};
  root.DragonJack.supaplexThemes = root.DragonJack.supaplexThemes || {};
  root.DragonJack.supaplexThemes['dragon'] = {
    id: 'dragon',
    background: '#140c0a',
    lights: { ambient: '#ffcf9a', ambientIntensity: 0.32, key: '#ffd9a8', keyIntensity: 0.85 },
    title: 'Supaplex du dragon',
    camera: {},
    collectName: 'Rubis',
    diskName: 'Potions',
    // Vocabulaire des règles dans l'antre (remplace les noms d'origine marqués data-term).
    terms: {
      collect: 'rubis',
      exit: 'portail',
      base: 'terres semées d’or',
      zonk: 'rochers',
      snik: 'chauves-souris',
      electron: 'feux follets',
      redDisk: 'Potion de feu',
      orangeDisk: 'Pierre de lave',
      yellowDisk: 'Baril de poudre',
      terminal: 'la pierre runique',
      zonkOne: 'un rocher',
      electronOne: 'un feu follet',
      diskOne: 'une potion',
    },
    /* Conseils des niveaux : les mots d'origine sont remplacés par ceux de l'antre (du plus long au plus court). */
    translate(text) {
      const words = [
        ['Les zonks tombent', 'Les rochers tombent'],
        ['les zonks', 'les rochers'],
        ['un zonk', 'un rocher'],
        ['le zonk', 'le rocher'],
        ['Les snik snaks', 'Les chauves-souris'],
        ['Un électron écrasé se change en infotrons', 'Un feu follet écrasé se change en rubis'],
        ['un électron écrasé se change en infotrons', 'un feu follet écrasé se change en rubis'],
        ['l’électron', 'le feu follet'],
        ['circuits verts', 'terres semées d’or'],
        ['le circuit', 'la terre'],
        ['infotrons', 'rubis'],
        ['la sortie', 'le portail'],
        ['une disquette rouge', 'une potion de feu'],
        ['toutes les disquettes jaunes', 'tous les barils de poudre'],
        ['les disquettes jaunes', 'les barils de poudre'],
        ['le terminal', 'la pierre runique'],
        ['des puces', 'des stalagmites'],
      ];
      return words.reduce((result, [from, to]) => result.split(from).join(to), text);
    },
    build,
    buildFloor,
    animate,
    onExplosion: (particles, position) => burst(particles, position, 24, 'fire', 4),
    onEat: (particles, position) => burst(particles, position, 4, 'smoke', 1),
    onCollect: (particles, position) => burst(particles, position, 10, 'gold', 2),
  };
})(window);
