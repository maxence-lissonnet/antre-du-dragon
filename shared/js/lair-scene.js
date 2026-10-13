/*
 * Mise en place d'une scène de jeu dans l'antre : rendu, grotte, trésor, braseros, lumières
 * et dragon (avec l'apparence choisie par le joueur). Chaque jeu y ajoute ensuite ses propres objets.
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;
  const DJ = root.DragonJack;

  const FLOOR_Y = -2.2;

  function createLairScene({
    container,
    camera,
    mounds,
    braziers = [{ x: -7.6, z: 2.2 }, { x: 7.6, z: 2.2 }],
    dragonPosition = new THREE.Vector3(),
    dragonScale = 1,
    keyLightTarget = new THREE.Vector3(0, 0, 0),
  }) {
    const stage = DJ.createStage(container, camera);
    const { scene } = stage;
    scene.background = new THREE.Color('#140c0a');
    scene.fog = new THREE.FogExp2('#140c0a', 0.032);

    const particles = DJ.createParticles();
    scene.add(particles.points);
    stage.onResize((height, fov) => particles.setProjectionScale(height, fov));

    scene.add(DJ.lair.buildCave({ floorY: FLOOR_Y }), DJ.lair.buildHoard(mounds, FLOOR_Y));
    const fires = DJ.lair.createBraziers({ scene, particles, floorY: FLOOR_Y, positions: braziers });
    const updateEmbers = DJ.lair.createDriftingEmbers({ particles, floorY: FLOOR_Y, area: { minX: -11, maxX: 11, minZ: -12, maxZ: 4 } });

    const ambient = new THREE.HemisphereLight('#4a3428', '#0a0505', 0.7);
    const keyLight = new THREE.SpotLight('#ffe2b8', 1.6, 34, 0.7, 0.6, 1.2);
    keyLight.position.set(0, 12, 6);
    keyLight.target.position.copy(keyLightTarget);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.0006;
    // Évite les stries d'ombre (« acné ») sur les grandes surfaces planes.
    keyLight.shadow.normalBias = 0.03;
    const hoardGlow = new THREE.PointLight('#e0a63a', 1.2, 22, 1.5);
    hoardGlow.position.set(0, 0.5, -8);
    scene.add(ambient, keyLight, keyLight.target, hoardGlow);

    const dragon = DJ.createDragon({ particles });
    dragon.group.position.copy(dragonPosition);
    dragon.group.scale.setScalar(dragonScale);
    const chosen = DJ.profile.loadDragon();
    dragon.setTheme(DJ.DRAGON_THEMES.includes(chosen) ? chosen : DJ.DEFAULT_DRAGON);
    scene.add(dragon.group);

    stage.onFrame((dt, time) => {
      DJ.tween.update(dt);
      fires.update(dt, time);
      updateEmbers(dt);
      dragon.update(dt, time);
      particles.update(dt);
    });

    return { stage, scene, particles, dragon, floorY: FLOOR_Y };
  }

  DJ.createLairScene = createLairScene;
})(window);
