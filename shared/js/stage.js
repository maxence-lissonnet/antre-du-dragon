/*
 * Rendu 3D commun aux jeux : moteur WebGL, caméra adaptée à la taille de l'écran, boucle d'animation.
 * Chaque jeu règle sa caméra (point visé, direction, largeur à garder visible) ; les valeurs par défaut
 * sont celles de la table de blackjack.
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;
  const { tween, reducedMotion } = root.DragonJack.tween;

  const DEFAULT_CAMERA = {
    target: new THREE.Vector3(0, 0.7, -0.3),
    direction: new THREE.Vector3(0, 7.4, 11.8),
    baseDistance: 14,
    // Demi-largeur de scène qui doit rester visible : tout en paysage, l'essentiel en portrait.
    visibleHalfWidth: { landscape: 7.4, portrait: 3.5 },
    introOffset: new THREE.Vector3(0, 9, 14),
  };

  function createStage(container, cameraOptions = {}) {
    const settings = { ...DEFAULT_CAMERA, ...cameraOptions };
    const CAMERA_TARGET = settings.target.clone();
    const CAMERA_DIRECTION = settings.direction.clone().normalize();
    const BASE_DISTANCE = settings.baseDistance;
    let VISIBLE_HALF_WIDTH = settings.visibleHalfWidth;
    const INTRO_OFFSET = settings.introOffset;
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
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 120);

    const restPosition = new THREE.Vector3();
    let distance = BASE_DISTANCE;
    const introOffset = new THREE.Vector3();
    const shakeOffset = new THREE.Vector3();
    let shakeStrength = 0;
    const frameCallbacks = [];
    const resizeCallbacks = [];

    function resize() {
      const width = container.clientWidth;
      const height = container.clientHeight;
      const aspect = width / height;
      renderer.setSize(width, height, false);
      camera.aspect = aspect;
      camera.fov = aspect < 1 ? 52 : 45;

      const halfWidth = aspect < 1 ? VISIBLE_HALF_WIDTH.portrait : VISIBLE_HALF_WIDTH.landscape;
      const halfHorizontalFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * aspect);
      distance = Math.max(BASE_DISTANCE, halfWidth / Math.tan(halfHorizontalFov) + 3);
      restPosition.copy(CAMERA_TARGET).addScaledVector(CAMERA_DIRECTION, distance);
      camera.updateProjectionMatrix();
      resizeCallbacks.forEach((callback) => callback(height * renderer.getPixelRatio(), camera.fov));
    }

    function placeCamera(time) {
      camera.position.copy(restPosition).add(introOffset);
      if (!reducedMotion) {
        camera.position.x += Math.sin(time * 0.21) * 0.25;
        camera.position.y += Math.sin(time * 0.17) * 0.12;
      }
      if (shakeStrength > 0.001) {
        shakeOffset.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shakeStrength);
        camera.position.add(shakeOffset);
      }
      camera.lookAt(CAMERA_TARGET);
    }

    const clock = new THREE.Clock();
    function loop() {
      const dt = Math.min(clock.getDelta(), 0.05);
      const time = clock.elapsedTime;
      frameCallbacks.forEach((callback) => callback(dt, time));
      shakeStrength *= Math.pow(0.02, dt);
      placeCamera(time);
      renderer.render(scene, camera);
    }

    function projectToScreen(point) {
      const projected = point.clone().project(camera);
      return {
        x: (projected.x * 0.5 + 0.5) * container.clientWidth,
        y: (-projected.y * 0.5 + 0.5) * container.clientHeight,
      };
    }

    function shake(strength) {
      if (!reducedMotion) shakeStrength = Math.max(shakeStrength, strength);
    }

    /* Plongée de la caméra vers la table, au moment où le joueur prend place. */
    function flyIn() {
      return tween({
        duration: 2.6,
        ease: 'inOutCubic',
        onUpdate: (k) => introOffset.copy(INTRO_OFFSET).multiplyScalar(1 - k),
      });
    }

    introOffset.copy(INTRO_OFFSET);
    root.addEventListener('resize', resize);
    resize();
    renderer.setAnimationLoop(loop);

    return {
      scene,
      renderer,
      camera,
      onFrame: (callback) => frameCallbacks.push(callback),
      onResize: (callback) => {
        resizeCallbacks.push(callback);
        callback(container.clientHeight * renderer.getPixelRatio(), camera.fov);
      },
      projectToScreen,
      shake,
      flyIn,
      /* Recadre la caméra (par exemple quand la taille du plateau change). */
      frame({ target, visibleHalfWidth }) {
        if (target) CAMERA_TARGET.copy(target);
        if (visibleHalfWidth) VISIBLE_HALF_WIDTH = visibleHalfWidth;
        resize();
      },
      /* Déplace le point visé sans recalculer le cadrage (pour suivre un personnage à chaque image). */
      setTarget(target) {
        CAMERA_TARGET.copy(target);
        restPosition.copy(CAMERA_TARGET).addScaledVector(CAMERA_DIRECTION, distance);
      },
      skipIntro() {
        introOffset.set(0, 0, 0);
      },
    };
  }

  root.DragonJack.createStage = createStage;
})(window);
