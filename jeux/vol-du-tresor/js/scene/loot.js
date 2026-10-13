/*
 * Les dix objets précieux posés devant le dragon endormi, chacun sur son petit tas de pièces.
 * Ils scintillent, s'envolent vers le joueur quand on les vole, et réapparaissent à la partie suivante.
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;
  const { tween } = root.DragonJack.tween;

  const FLOOR_Y = -2.2;
  const PILE_HEIGHT = 0.45;
  // Deux rangées de cinq objets, devant le dragon.
  const SPOTS = [
    [-4.5, -0.6], [-2.25, -0.9], [0, -1.1], [2.25, -0.9], [4.5, -0.6],
    [-4, 1.3], [-2, 1.55], [0, 1.7], [2, 1.55], [4, 1.3],
  ];
  const SPARKLE_INTERVAL = 0.35;

  const gold = new THREE.MeshStandardMaterial({ color: '#e8b24a', metalness: 0.9, roughness: 0.25, emissive: '#3a2404' });
  const silver = new THREE.MeshStandardMaterial({ color: '#d8dde2', metalness: 0.9, roughness: 0.2 });
  const gem = (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.1, flatShading: true });

  function mesh(geometry, material, x = 0, y = 0, z = 0) {
    const result = new THREE.Mesh(geometry, material);
    result.position.set(x, y, z);
    result.castShadow = true;
    return result;
  }

  // Chaque fonction construit un objet d'environ 0,8 unité de haut, posé sur y = 0.
  const BUILDERS = {
    crown() {
      const group = new THREE.Group();
      const band = mesh(new THREE.CylinderGeometry(0.38, 0.34, 0.28, 24, 1, true), gold, 0, 0.14);
      band.material = gold.clone();
      band.material.side = THREE.DoubleSide;
      group.add(band);
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2;
        group.add(mesh(new THREE.ConeGeometry(0.07, 0.3, 4), gold, Math.cos(angle) * 0.36, 0.42, Math.sin(angle) * 0.36));
      }
      group.add(mesh(new THREE.OctahedronGeometry(0.08), gem('#c0262d'), 0, 0.15, 0.37));
      return group;
    },
    goblet() {
      const group = new THREE.Group();
      group.add(mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.05, 20), gold, 0, 0.03));
      group.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 10), gold, 0, 0.22));
      group.add(mesh(new THREE.CylinderGeometry(0.28, 0.1, 0.36, 20), gold, 0, 0.55));
      group.add(mesh(new THREE.OctahedronGeometry(0.06), gem('#2f8f6a'), 0, 0.55, 0.22));
      return group;
    },
    ruby() {
      const group = new THREE.Group();
      const stone = mesh(new THREE.OctahedronGeometry(0.35, 0), gem('#d4202a'), 0, 0.4);
      stone.scale.set(1, 1.3, 1);
      group.add(stone);
      return group;
    },
    necklace() {
      const group = new THREE.Group();
      const chain = mesh(new THREE.TorusGeometry(0.32, 0.03, 8, 32), gold, 0, 0.45);
      group.add(chain, mesh(new THREE.OctahedronGeometry(0.11), gem('#3a5fc4'), 0, 0.13));
      return group;
    },
    sword() {
      const group = new THREE.Group();
      group.add(mesh(new THREE.BoxGeometry(0.08, 0.7, 0.02), silver, 0, 0.62));
      group.add(mesh(new THREE.BoxGeometry(0.34, 0.06, 0.06), gold, 0, 0.25));
      group.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), new THREE.MeshStandardMaterial({ color: '#5a3420' }), 0, 0.12));
      group.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), gem('#c0262d'), 0, 0.01));
      group.rotation.z = 0.35;
      return group;
    },
    egg() {
      const group = new THREE.Group();
      const shell = mesh(new THREE.SphereGeometry(0.28, 20, 16), gem('#2f7a62'), 0, 0.36);
      shell.material.emissiveIntensity = 0.25;
      shell.scale.set(1, 1.3, 1);
      group.add(shell);
      return group;
    },
    chest() {
      const group = new THREE.Group();
      const wood = new THREE.MeshStandardMaterial({ color: '#5a3420', roughness: 0.6 });
      group.add(mesh(new THREE.BoxGeometry(0.6, 0.32, 0.4), wood, 0, 0.16));
      const lid = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 16, 1, false, 0, Math.PI), wood, 0, 0.32);
      lid.rotation.z = Math.PI / 2;
      group.add(lid);
      group.add(mesh(new THREE.BoxGeometry(0.62, 0.05, 0.42), gold, 0, 0.32));
      group.add(mesh(new THREE.BoxGeometry(0.08, 0.1, 0.04), gold, 0, 0.26, 0.21));
      return group;
    },
    scepter() {
      const group = new THREE.Group();
      group.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.8, 10), gold, 0, 0.4));
      group.add(mesh(new THREE.SphereGeometry(0.12, 14, 10), gem('#9b3fc0'), 0, 0.86));
      group.rotation.z = -0.4;
      return group;
    },
    ring() {
      const group = new THREE.Group();
      const band = mesh(new THREE.TorusGeometry(0.2, 0.05, 10, 28), gold, 0, 0.25);
      group.add(band, mesh(new THREE.OctahedronGeometry(0.1), gem('#e8f4ff'), 0, 0.48));
      return group;
    },
    helmet() {
      const group = new THREE.Group();
      group.add(mesh(new THREE.SphereGeometry(0.32, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), silver, 0, 0.05));
      group.add(mesh(new THREE.ConeGeometry(0.06, 0.4, 6), gold, -0.25, 0.4, 0));
      group.add(mesh(new THREE.ConeGeometry(0.06, 0.4, 6), gold, 0.25, 0.4, 0));
      return group;
    },
  };
  const ORDER = ['crown', 'goblet', 'ruby', 'necklace', 'sword', 'egg', 'chest', 'scepter', 'ring', 'helmet'];

  function createLoot({ scene, particles }) {
    const items = ORDER.map((kind, index) => {
      const [x, z] = SPOTS[index];
      const object = BUILDERS[kind]();
      const home = new THREE.Vector3(x, FLOOR_Y + PILE_HEIGHT, z);
      object.position.copy(home);
      object.rotation.y = (index * 1.7) % (Math.PI * 2);
      scene.add(object);
      // Zone cliquable plus large que l'objet, pour viser facilement au doigt.
      const hitbox = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.3, 1.2), new THREE.MeshBasicMaterial({ visible: false }));
      hitbox.position.copy(home).add(new THREE.Vector3(0, 0.5, 0));
      scene.add(hitbox);
      return { kind, object, hitbox, home, taken: false };
    });
    let sparkleTimer = 0;

    function update(dt, time) {
      items.forEach((item, index) => {
        if (item.taken) return;
        item.object.position.y = item.home.y + 0.08 + Math.sin(time * 1.6 + index) * 0.05;
        item.object.rotation.y += dt * 0.4;
      });
      sparkleTimer -= dt;
      if (sparkleTimer > 0) return;
      sparkleTimer = SPARKLE_INTERVAL;
      const available = items.filter((item) => !item.taken);
      if (available.length === 0) return;
      const item = available[Math.floor(Math.random() * available.length)];
      particles.emit({
        position: item.object.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.4 + Math.random() * 0.3, (Math.random() - 0.5) * 0.5)),
        velocity: { x: 0, y: 0.3, z: 0 },
        life: 0.6,
        size: 0.35,
        endSize: 0.02,
        ramp: 'gold',
      });
    }

    /* L'objet s'envole vers `destination` (devant la caméra) en rétrécissant, puis disparaît. */
    function take(item, destination) {
      item.taken = true;
      const from = item.object.position.clone();
      return tween({
        duration: 0.7,
        ease: 'inOutCubic',
        onUpdate: (k) => {
          item.object.position.lerpVectors(from, destination, k);
          item.object.position.y += Math.sin(k * Math.PI) * 1.2;
          item.object.scale.setScalar(1 - k * 0.85);
        },
      }).then(() => {
        item.object.visible = false;
      });
    }

    /* Tous les objets reviennent à leur place pour la partie suivante. */
    function restore() {
      items.forEach((item) => {
        item.taken = false;
        item.object.visible = true;
        item.object.position.copy(item.home);
        item.object.scale.setScalar(0.01);
        tween({ duration: 0.6, ease: 'outBack', onUpdate: (k) => item.object.scale.setScalar(Math.max(0.01, k)) });
      });
    }

    return {
      items,
      update,
      take,
      restore,
      hitboxes: items.map((item) => item.hitbox),
    };
  }

  root.DragonJack.createLoot = createLoot;
  // Petits tas de pièces sous chaque objet, à ajouter au trésor de la grotte.
  root.DragonJack.LOOT_PILES = SPOTS.map(([x, z]) => ({ x, z, radius: 0.9, height: PILE_HEIGHT }));
})(window);
