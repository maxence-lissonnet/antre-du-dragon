/*
 * Décor commun à tous les jeux de l'antre : grotte, collines d'or, braseros.
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;

  const COIN_DENSITY = 32;
  const MOUND_PROFILE_STEPS = 14;
  const BRAZIER_FLAME_RATE = 40;

  // Relief pseudo-aléatoire mais stable, pour les parois et le sol.
  function rockNoise(x, y, z) {
    return (
      Math.sin(x * 0.35 + y * 0.21) * Math.cos(z * 0.31 - x * 0.12) +
      0.5 * Math.sin(x * 0.9 + z * 0.77) * Math.cos(y * 0.83) +
      0.25 * Math.sin(y * 2.1 + z * 1.7)
    );
  }

  function displace(geometry, amount) {
    const position = geometry.attributes.position;
    const vertex = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 1) {
      vertex.fromBufferAttribute(position, i);
      const length = vertex.length();
      const offset = rockNoise(vertex.x, vertex.y, vertex.z) * amount;
      vertex.multiplyScalar((length + offset) / length);
      position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    geometry.computeVertexNormals();
  }

  /*
   * Grotte : parois bosselées, sol rocheux et stalactites.
   * Les stalactites restent au fond et sur les côtés (`stalactiteArc`, en fractions de tour)
   * pour ne jamais masquer ce qui se passe au premier plan.
   */
  function buildCave({ floorY, radius = 30, stalactiteCenterZ = -4, stalactiteArc = [1.05, 1.95] }) {
    const group = new THREE.Group();
    const rock = new THREE.MeshStandardMaterial({ color: '#2a211d', roughness: 1, flatShading: true });

    const wallsGeometry = new THREE.IcosahedronGeometry(radius, 4);
    displace(wallsGeometry, radius * 0.107);
    const walls = new THREE.Mesh(wallsGeometry, rock.clone());
    walls.material.side = THREE.BackSide;
    walls.position.y = 6;
    group.add(walls);

    const floorGeometry = new THREE.CircleGeometry(radius, 64);
    floorGeometry.rotateX(-Math.PI / 2);
    const floorPositions = floorGeometry.attributes.position;
    for (let i = 0; i < floorPositions.count; i += 1) {
      floorPositions.setY(i, rockNoise(floorPositions.getX(i), 0, floorPositions.getZ(i)) * 0.25);
    }
    floorGeometry.computeVertexNormals();
    const floor = new THREE.Mesh(floorGeometry, new THREE.MeshStandardMaterial({ color: '#251b17', roughness: 0.95, flatShading: true }));
    floor.position.y = floorY;
    floor.receiveShadow = true;
    group.add(floor);

    const stalactite = new THREE.ConeGeometry(0.6, 1, 5);
    stalactite.rotateX(Math.PI);
    const [arcStart, arcEnd] = stalactiteArc;
    for (let i = 0; i < 26; i += 1) {
      const angle = Math.PI * (arcStart + (i / 26) * (arcEnd - arcStart));
      const distance = 12 + (i % 5) * 2.6;
      const length = 2 + ((i * 7) % 5);
      const spike = new THREE.Mesh(stalactite, rock);
      spike.scale.set(1 + (i % 3) * 0.4, length, 1 + (i % 2) * 0.5);
      spike.position.set(Math.cos(angle) * distance, 13 - length / 2, Math.sin(angle) * distance + stalactiteCenterZ);
      group.add(spike);
    }
    return group;
  }

  function moundHeight(mound, distance) {
    const t = Math.min(distance / mound.radius, 1);
    return mound.height * Math.pow(1 - t * t, 0.8);
  }

  function buildMound(mound, material, floorY) {
    // Profil de la colline, du bord vers le sommet, tourné autour de l'axe vertical.
    const profile = [];
    for (let i = MOUND_PROFILE_STEPS; i >= 0; i -= 1) {
      const distance = (i / MOUND_PROFILE_STEPS) * mound.radius;
      profile.push(new THREE.Vector2(distance, moundHeight(mound, distance)));
    }
    const geometry = new THREE.LatheGeometry(profile, 28);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const y = position.getY(i);
      if (y > 0.05) position.setY(i, y + rockNoise(position.getX(i) * 3 + mound.x, 0, position.getZ(i) * 3 + mound.z) * 0.08);
    }
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(mound.x, floorY - 0.05, mound.z);
    mesh.receiveShadow = true;
    return mesh;
  }

  /*
   * Le trésor : des collines d'or pleines (pas de sol visible au travers),
   * couvertes de pièces posées sur leur surface, avec quelques gemmes.
   * `mounds` : liste de { x, z, radius, height }.
   */
  function buildHoard(mounds, floorY) {
    const group = new THREE.Group();
    const moundMaterial = new THREE.MeshStandardMaterial({
      color: '#c48f2c',
      metalness: 0.85,
      roughness: 0.42,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    mounds.forEach((mound) => group.add(buildMound(mound, moundMaterial, floorY)));

    // Nombre de pièces proportionnel à la surface de chaque colline.
    const coinsPerMound = mounds.map((mound) => Math.round((mound.radius * mound.radius * COIN_DENSITY) / 3));
    const coinCount = coinsPerMound.reduce((total, count) => total + count, 0);
    const gold = new THREE.MeshStandardMaterial({ color: '#e8b24a', metalness: 0.9, roughness: 0.3 });
    const coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.2, 0.035, 10), gold, coinCount);
    const dummy = new THREE.Object3D();
    let instance = 0;
    mounds.forEach((mound, moundIndex) => {
      for (let i = 0; i < coinsPerMound[moundIndex]; i += 1) {
        const distance = Math.sqrt(Math.random()) * mound.radius * 1.02;
        const angle = Math.random() * Math.PI * 2;
        dummy.position.set(
          mound.x + Math.cos(angle) * distance,
          floorY + moundHeight(mound, distance) + 0.02,
          mound.z + Math.sin(angle) * distance,
        );
        dummy.rotation.set((Math.random() - 0.5) * 1.2, Math.random() * Math.PI, (Math.random() - 0.5) * 1.2);
        const coinSize = 0.8 + Math.random() * 0.5;
        dummy.scale.set(coinSize, 1, coinSize);
        dummy.updateMatrix();
        coins.setMatrixAt(instance, dummy.matrix);
        instance += 1;
      }
    });
    coins.receiveShadow = true;
    group.add(coins);

    const gemColors = ['#c0262d', '#2f8f6a', '#3a5fc4', '#9b3fc0'];
    const gemGeometry = new THREE.OctahedronGeometry(0.22, 0);
    for (let i = 0; i < 24; i += 1) {
      const mound = mounds[i % mounds.length];
      const color = gemColors[i % gemColors.length];
      const gem = new THREE.Mesh(
        gemGeometry,
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.15, flatShading: true }),
      );
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * mound.radius * 0.7;
      gem.position.set(
        mound.x + Math.cos(angle) * distance,
        floorY + moundHeight(mound, distance) + 0.08,
        mound.z + Math.sin(angle) * distance,
      );
      gem.rotation.set(Math.random(), Math.random(), Math.random());
      group.add(gem);
    }
    return group;
  }

  function buildBrazier(x, z, floorY) {
    const group = new THREE.Group();
    const iron = new THREE.MeshStandardMaterial({ color: '#2b2422', metalness: 0.7, roughness: 0.5, flatShading: true });
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.4, 2.2, 6), iron);
    stand.position.y = floorY + 1.1;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.4, 0.6, 8, 1, true), iron);
    bowl.material.side = THREE.DoubleSide;
    bowl.position.y = floorY + 2.5;
    const coals = new THREE.Mesh(new THREE.CircleGeometry(0.82, 8), new THREE.MeshBasicMaterial({ color: '#ff7a2a' }));
    coals.rotation.x = -Math.PI / 2;
    coals.position.y = floorY + 2.6;
    group.add(stand, bowl, coals);
    group.position.set(x, 0, z);

    const light = new THREE.PointLight('#ff8a3a', 2.2, 22, 1.6);
    light.position.set(x, floorY + 3.6, z);
    return { group, light, flameOrigin: new THREE.Vector3(x, floorY + 2.7, z) };
  }

  /* Braseros allumés : flammes réglées sur le temps écoulé et lumière qui vacille. */
  function createBraziers({ scene, particles, floorY, positions }) {
    const braziers = positions.map(({ x, z }) => buildBrazier(x, z, floorY));
    braziers.forEach(({ group, light }) => scene.add(group, light));
    let flameBudget = 0;
    const velocity = { x: 0, y: 0, z: 0 };

    function update(dt, time, lightLevel = 1) {
      flameBudget += dt * BRAZIER_FLAME_RATE;
      const flameCount = Math.floor(flameBudget);
      flameBudget -= flameCount;
      braziers.forEach(({ light, flameOrigin }, index) => {
        light.intensity = (2 + Math.sin(time * 9 + index) * 0.25 + Math.random() * 0.35) * lightLevel;
        for (let i = 0; i < flameCount; i += 1) {
          velocity.x = (Math.random() - 0.5) * 0.5;
          velocity.y = 1.2 + Math.random() * 0.8;
          velocity.z = (Math.random() - 0.5) * 0.5;
          particles.emit({
            position: {
              x: flameOrigin.x + (Math.random() - 0.5) * 0.9,
              y: flameOrigin.y,
              z: flameOrigin.z + (Math.random() - 0.5) * 0.9,
            },
            velocity,
            life: 0.5 + Math.random() * 0.4,
            size: 0.55,
            endSize: 0.15,
            buoyancy: 1.5,
            ramp: 'flame',
          });
        }
      });
    }

    return { update };
  }

  /* Braises qui dérivent lentement dans l'air de la grotte. */
  function createDriftingEmbers({ particles, floorY, area }) {
    let timer = 0;
    return function update(dt) {
      timer -= dt;
      if (timer >= 0) return;
      timer = 0.08;
      particles.emit({
        position: {
          x: area.minX + Math.random() * (area.maxX - area.minX),
          y: floorY + Math.random() * 2,
          z: area.minZ + Math.random() * (area.maxZ - area.minZ),
        },
        velocity: { x: (Math.random() - 0.5) * 0.3, y: 0.5 + Math.random() * 0.5, z: (Math.random() - 0.5) * 0.3 },
        life: 4 + Math.random() * 3,
        size: 0.09,
        endSize: 0.05,
        buoyancy: 0.15,
        ramp: 'ember',
      });
    };
  }

  root.DragonJack = root.DragonJack || {};
  root.DragonJack.lair = { buildCave, buildHoard, createBraziers, createDriftingEmbers };
})(window);
