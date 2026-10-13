/*
 * Mises en scène des séries de 10 donnes :
 * - « Sacre du joueur » : une couronne d'or descend sur la table au milieu de feux d'artifice dorés ;
 * - « Le dragon s'empare du trésor » : vague de feu, grotte assombrie, l'or de la table s'envole vers sa montagne.
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;
  const { tween, wait, reducedMotion } = root.DragonJack.tween;

  const CROWN_HOVER = new THREE.Vector3(0, 2.6, 0.9);
  const CROWN_START_HEIGHT = 10;
  const CROWN_POINTS = 8;
  const FIREWORK_SPARKS = reducedMotion ? 30 : 70;
  const FIREWORK_SPOTS = [
    new THREE.Vector3(-4, 5.5, -1),
    new THREE.Vector3(4, 6, -1.5),
    new THREE.Vector3(0, 7, -3),
    new THREE.Vector3(-2.5, 4.5, 1.5),
    new THREE.Vector3(2.5, 5, 1),
  ];
  const STOLEN_COINS = reducedMotion ? 60 : 160;
  const HOARD_PEAK = new THREE.Vector3(0, 0.8, -11);
  const FIRE_WAVE = { from: new THREE.Vector3(-6.5, 0, 2.2), to: new THREE.Vector3(6.5, 0, 2.2) };
  const DARK_LEVEL = 0.35;

  function buildCrown() {
    const crown = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: '#f0bd4a', metalness: 0.95, roughness: 0.22, emissive: '#6a4208' });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.7, 0.35, 32, 1, true), gold);
    band.material.side = THREE.DoubleSide;
    crown.add(band);
    const gemColors = ['#c0262d', '#2f8f6a', '#3a5fc4'];
    for (let i = 0; i < CROWN_POINTS; i += 1) {
      const angle = (i / CROWN_POINTS) * Math.PI * 2;
      const point = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 4), gold);
      point.position.set(Math.cos(angle) * 0.72, 0.42, Math.sin(angle) * 0.72);
      crown.add(point);
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), gold);
      pearl.position.set(point.position.x, 0.72, point.position.z);
      crown.add(pearl);
      const color = gemColors[i % gemColors.length];
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.09, 0),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, flatShading: true }),
      );
      gem.position.set(Math.cos(angle) * 0.76, 0, Math.sin(angle) * 0.76);
      crown.add(gem);
    }
    crown.visible = false;
    return crown;
  }

  function createStreakEffects({ scene, particles, environment, dragon, stage, audio }) {
    const crown = buildCrown();
    const crownLight = new THREE.PointLight('#ffd27a', 0, 12, 1.5);
    crown.add(crownLight);
    scene.add(crown);

    // Les pièces volées luisent d'elles-mêmes : la grotte est assombrie pendant le vol.
    const coinMaterial = new THREE.MeshStandardMaterial({
      color: '#f0bd4a',
      metalness: 0.6,
      roughness: 0.35,
      emissive: '#c88a1c',
      emissiveIntensity: 0.9,
    });
    const stolen = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 10), coinMaterial, STOLEN_COINS);
    stolen.visible = false;
    stolen.frustumCulled = false;
    scene.add(stolen);
    const dummy = new THREE.Object3D();

    let crownSpin = 0;

    function update(dt) {
      if (!crown.visible) return;
      crownSpin += dt * 0.8;
      crown.rotation.y = crownSpin;
    }

    function firework(center) {
      for (let i = 0; i < FIREWORK_SPARKS; i += 1) {
        const direction = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        const speed = 3 + Math.random() * 2.5;
        particles.emit({
          position: center,
          velocity: { x: direction.x * speed, y: direction.y * speed, z: direction.z * speed },
          life: 1 + Math.random() * 0.6,
          size: 0.35,
          endSize: 0.1,
          buoyancy: -2.5,
          ramp: 'gold',
        });
      }
      audio.play('chip');
    }

    /* Sacre : la couronne descend en tournant, les feux d'artifice éclatent, le dragon s'incline longuement. */
    async function crownPlayer() {
      audio.play('fanfare');
      crown.visible = true;
      crown.scale.setScalar(1);
      crown.position.copy(CROWN_HOVER).setY(CROWN_START_HEIGHT);
      dragon.lookAt(CROWN_HOVER);
      const descent = tween({
        duration: 2.2,
        ease: 'outCubic',
        onUpdate: (k) => {
          crown.position.y = CROWN_START_HEIGHT + (CROWN_HOVER.y - CROWN_START_HEIGHT) * k;
          crownLight.intensity = 3 * k;
        },
      });
      const fireworks = (async () => {
        for (let round = 0; round < 2; round += 1) {
          for (const spot of FIREWORK_SPOTS) {
            firework(spot);
            await wait(0.35);
          }
        }
      })();
      await descent;
      await Promise.all([fireworks, dragon.bow(2.2)]);
      await tween({
        duration: 0.8,
        onUpdate: (k) => {
          crown.scale.setScalar(1 - k);
          crown.position.y = CROWN_HOVER.y + k * 1.5;
          crownLight.intensity = 3 * (1 - k);
        },
      });
      crown.visible = false;
    }

    /* Le flot d'or : chaque pièce part d'un point de la table et file en arc vers la montagne du trésor. */
    function stealGold(duration) {
      const starts = Array.from({ length: STOLEN_COINS }, () =>
        new THREE.Vector3((Math.random() - 0.5) * 9, 0.05, -0.5 + Math.random() * 4.5),
      );
      const delays = starts.map(() => Math.random() * 0.5);
      stolen.visible = true;
      return tween({
        duration,
        ease: 'linear',
        onUpdate: (k) => {
          starts.forEach((start, index) => {
            const t = THREE.MathUtils.clamp((k - delays[index]) / 0.5, 0, 1);
            const eased = t * t * (3 - 2 * t);
            dummy.position.lerpVectors(start, HOARD_PEAK, eased);
            dummy.position.y += Math.sin(eased * Math.PI) * 4;
            dummy.rotation.set(eased * 12 + index, eased * 6, 0);
            dummy.scale.setScalar(t >= 1 ? 0 : 1);
            dummy.updateMatrix();
            stolen.setMatrixAt(index, dummy.matrix);
          });
          stolen.instanceMatrix.needsUpdate = true;
        },
      }).then(() => {
        stolen.visible = false;
      });
    }

    /* Le dragon s'empare du trésor : la grotte s'assombrit, une vague de feu balaie la table, l'or s'envole. */
    async function seizeTreasure() {
      audio.play('roar');
      await tween({ duration: 0.8, onUpdate: (k) => environment.setLightLevel(1 - (1 - DARK_LEVEL) * k) });
      dragon.lookAt(FIRE_WAVE.from);
      const sweepTarget = new THREE.Vector3();
      const sweep = tween({
        duration: 1.6,
        delay: 0.55,
        ease: 'inOutCubic',
        onUpdate: (k) => dragon.lookAt(sweepTarget.lerpVectors(FIRE_WAVE.from, FIRE_WAVE.to, k)),
      });
      await Promise.all([dragon.breatheFire(() => stage.shake(0.4)), sweep]);
      audio.play('coins');
      dragon.lookAt(HOARD_PEAK);
      await stealGold(2.4);
      dragon.lookAt(new THREE.Vector3(0, 0, 0.6));
      await tween({ duration: 0.8, onUpdate: (k) => environment.setLightLevel(DARK_LEVEL + (1 - DARK_LEVEL) * k) });
    }

    return {
      update,
      play: (kind) => (kind === 'win' ? crownPlayer() : seizeTreasure()),
    };
  }

  root.DragonJack.createStreakEffects = createStreakEffects;
})(window);
