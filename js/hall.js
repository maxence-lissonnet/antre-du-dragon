/*
 * La salle des jeux en 3D : le dragon couché sur son trésor veille sur une rangée d'alcôves,
 * une par mini-jeu. La caméra glisse vers l'alcôve survolée et plonge dedans pour entrer.
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;
  const DJ = root.DragonJack;
  const { tween, reducedMotion } = DJ.tween;

  const FLOOR_Y = 0;
  // Le dragon trône en hauteur sur sa montagne d'or, au-dessus des alcôves.
  const DRAGON_POSITION = new THREE.Vector3(0, 4.2, -10);
  const DRAGON_SCALE = 1.35;
  const ALCOVE_SPACING = 3.9;
  // Les alcôves forment un arc peu prononcé : celles du bord reculent un peu.
  const ALCOVE_ARC_DEPTH = 0.3;
  const ALCOVE_BASE_Z = -1.5;
  const CAMERA_OFFSET = new THREE.Vector3(0, 8, 15);
  const CAMERA_LOOK = new THREE.Vector3(0, 4, -5);
  // Demi-largeur de salle à garder visible : toutes les alcôves en paysage, celle choisie en portrait.
  // En paysage, la largeur visible dépend du nombre d'alcôves (marge comprise).
  const VISIBLE_HALF_WIDTH = { landscapeMargin: 2.6, portrait: 2.6 };
  const PAN_SHARE = { landscape: 0.25, portrait: 1 };
  const ENTRY_CAMERA_OFFSET = new THREE.Vector3(0, 0.2, 1.2);
  const ENTRY_LOOK_OFFSET = new THREE.Vector3(0, 0, -2);
  const MOUNDS = [
    { x: 0, z: -14, radius: 9, height: 4.8 },
    { x: -8, z: -11, radius: 5.5, height: 2.4 },
    { x: 8, z: -11.5, radius: 5.8, height: 2.6 },
    { x: -13, z: -5, radius: 4.6, height: 1.8 },
    { x: 13, z: -5, radius: 4.6, height: 1.9 },
    { x: -4.5, z: -7, radius: 3, height: 0.9 },
    { x: 4.5, z: -7, radius: 3, height: 1 },
  ];

  function createHall({ container, games, onSelect }) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#140c0a');
    scene.fog = new THREE.FogExp2('#140c0a', 0.03);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 120);

    const particles = DJ.createParticles();
    scene.add(particles.points);
    scene.add(DJ.lair.buildCave({ floorY: FLOOR_Y, radius: 32, stalactiteCenterZ: -6 }), DJ.lair.buildHoard(MOUNDS, FLOOR_Y));
    const braziers = DJ.lair.createBraziers({
      scene,
      particles,
      floorY: FLOOR_Y,
      positions: [{ x: -10.5, z: 1 }, { x: 10.5, z: 1 }],
    });
    const updateEmbers = DJ.lair.createDriftingEmbers({ particles, floorY: FLOOR_Y, area: { minX: -14, maxX: 14, minZ: -14, maxZ: 4 } });

    scene.add(new THREE.HemisphereLight('#4a3428', '#0a0505', 0.75));
    const hoardGlow = new THREE.PointLight('#e0a63a', 1.6, 24, 1.4);
    hoardGlow.position.set(0, 4.5, -7);
    scene.add(hoardGlow);
    const keyLight = new THREE.SpotLight('#ffe2b8', 1.4, 40, 0.75, 0.6, 1.2);
    keyLight.position.set(0, 16, 8);
    keyLight.target.position.set(0, 1, -3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight, keyLight.target);

    // Le dragon, couché sur sa montagne d'or, garde l'œil sur les alcôves.
    const dragon = DJ.createDragon({ particles });
    dragon.group.position.copy(DRAGON_POSITION);
    dragon.group.scale.setScalar(DRAGON_SCALE);
    scene.add(dragon.group);

    const alcoves = games.map((game, index) => {
      const alcove = DJ.createAlcove(game);
      const x = (index - (games.length - 1) / 2) * ALCOVE_SPACING;
      alcove.group.position.set(x, FLOOR_Y, ALCOVE_BASE_Z - Math.abs(x) * ALCOVE_ARC_DEPTH);
      alcove.group.rotation.y = Math.atan2(-x, CAMERA_OFFSET.z) * 0.6;
      scene.add(alcove.group);
      return { game, ...alcove };
    });
    const hitboxes = alcoves.map((alcove) => alcove.hitbox);

    let focusedIndex = 0;
    const panTarget = new THREE.Vector3();
    const pan = new THREE.Vector3();
    // 0 = vue de la salle, 1 = caméra entrée dans l'alcôve.
    let flightProgress = 0;
    let distance = CAMERA_OFFSET.length();
    let panShare = PAN_SHARE.landscape;

    function resize() {
      const width = container.clientWidth;
      const height = container.clientHeight;
      const aspect = width / height;
      const portrait = aspect < 1;
      renderer.setSize(width, height, false);
      camera.aspect = aspect;
      camera.fov = portrait ? 55 : 45;
      camera.updateProjectionMatrix();
      const rowHalfWidth = ((games.length - 1) * ALCOVE_SPACING) / 2;
      const halfWidth = portrait ? VISIBLE_HALF_WIDTH.portrait : rowHalfWidth + VISIBLE_HALF_WIDTH.landscapeMargin;
      const halfHorizontalFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * aspect);
      distance = Math.max(CAMERA_OFFSET.length(), halfWidth / Math.tan(halfHorizontalFov) + 6);
      panShare = portrait ? PAN_SHARE.portrait : PAN_SHARE.landscape;
      particles.setProjectionScale(height * renderer.getPixelRatio(), camera.fov);
      focus(focusedIndex);
    }

    function alcoveWorldPoint(alcove) {
      return alcove.group.localToWorld(alcove.entrance.clone());
    }

    /* Met une alcôve en avant : lumière, regard du dragon et léger glissement de la caméra. */
    function focus(index) {
      focusedIndex = index;
      alcoves.forEach((alcove, i) => alcove.setFocused(i === index));
      const point = alcoveWorldPoint(alcoves[index]);
      panTarget.set(point.x * panShare, 0, 0);
      dragon.lookAt(point);
    }

    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    function alcoveUnderPointer(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(hitboxes, false)[0];
      return hit ? hitboxes.indexOf(hit.object) : -1;
    }

    let entering = false;
    renderer.domElement.addEventListener('pointermove', (event) => {
      if (entering) return;
      const index = alcoveUnderPointer(event);
      renderer.domElement.style.cursor = index >= 0 ? 'pointer' : '';
      if (index >= 0 && index !== focusedIndex) onSelect(index, { activate: false });
    });
    renderer.domElement.addEventListener('click', (event) => {
      if (entering) return;
      const index = alcoveUnderPointer(event);
      if (index >= 0) onSelect(index, { activate: true });
    });

    /* Plongée de la caméra dans l'alcôve, avant de charger le jeu. */
    function enter(index) {
      entering = true;
      focus(index);
      return tween({
        duration: reducedMotion ? 0.4 : 1.4,
        ease: 'inOutCubic',
        onUpdate: (k) => {
          flightProgress = k;
        },
      });
    }

    function rattle(index) {
      focus(index);
      return alcoves[index].rattle();
    }

    const lookPoint = new THREE.Vector3();
    const cameraPosition = new THREE.Vector3();
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const time = clock.elapsedTime;
      DJ.tween.update(dt);
      braziers.update(dt, time);
      updateEmbers(dt);
      dragon.update(dt, time);
      particles.update(dt);

      pan.lerp(panTarget, Math.min(dt * 2.5, 1));
      cameraPosition.copy(CAMERA_OFFSET).setLength(distance).add(pan);
      lookPoint.copy(CAMERA_LOOK).add(pan);
      if (!reducedMotion) cameraPosition.x += Math.sin(time * 0.2) * 0.3;
      // Pendant l'entrée, la caméra rejoint l'alcôve et la vise.
      if (flightProgress > 0) {
        const entrance = alcoveWorldPoint(alcoves[focusedIndex]);
        cameraPosition.lerp(entrance.clone().add(ENTRY_CAMERA_OFFSET), flightProgress);
        lookPoint.lerp(entrance.add(ENTRY_LOOK_OFFSET), flightProgress);
      }
      camera.position.copy(cameraPosition);
      camera.lookAt(lookPoint);
      renderer.render(scene, camera);
    });

    root.addEventListener('resize', resize);
    resize();

    return { focus, enter, rattle, setDragonTheme: dragon.setTheme, awaken: dragon.awaken, setEyeGlow: dragon.setEyeGlow };
  }

  DJ.createHall = createHall;
})(window);
