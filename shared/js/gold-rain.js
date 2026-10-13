/*
 * Pluie d'or du blackjack : des centaines de pièces tombent de la voûte, rebondissent
 * sur la table et le sol, puis disparaissent. Un seul InstancedMesh pour toutes les pièces.
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;
  const { tween, reducedMotion } = root.DragonJack.tween;

  const COIN_COUNT = reducedMotion ? 90 : 280;
  const GRAVITY = 14;
  const BOUNCE = 0.32;
  const DEFAULT_AREA = { minX: -6, maxX: 6, minZ: -3, maxZ: 4.5 };
  const DROP_HEIGHT = { min: 8, max: 18 };
  const SETTLE_SECONDS = 3.2;
  const VANISH_SECONDS = 0.6;
  const FLASH_INTENSITY = 4;

  /*
   * `groundHeight(x, z)` donne la hauteur sur laquelle une pièce retombe à cet endroit
   * (une table, le sol…) ; `area` est la zone où tombe la pluie.
   */
  function createGoldRain({ scene, particles, groundHeight = () => 0, area = DEFAULT_AREA }) {
    const material = new THREE.MeshStandardMaterial({ color: '#f0bd4a', metalness: 0.95, roughness: 0.25, emissive: '#5a3a08' });
    const coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 12), material, COIN_COUNT);
    coins.visible = false;
    coins.castShadow = true;
    coins.frustumCulled = false;
    scene.add(coins);

    const flash = new THREE.PointLight('#ffd27a', 0, 30, 1.5);
    flash.position.set(0, 7, 1);
    scene.add(flash);

    const pieces = Array.from({ length: COIN_COUNT }, () => ({
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      rotation: new THREE.Euler(),
      spin: new THREE.Vector3(),
      landed: false,
    }));
    const dummy = new THREE.Object3D();
    let scale = 0;
    let running = false;

    function reset(piece) {
      piece.position.set(
        THREE.MathUtils.randFloat(area.minX, area.maxX),
        THREE.MathUtils.randFloat(DROP_HEIGHT.min, DROP_HEIGHT.max),
        THREE.MathUtils.randFloat(area.minZ, area.maxZ),
      );
      piece.velocity.set((Math.random() - 0.5) * 1.5, -Math.random() * 3, (Math.random() - 0.5) * 1.5);
      piece.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      piece.spin.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 14);
      piece.landed = false;
    }

    function sparkle(position) {
      for (let i = 0; i < 2; i += 1) {
        particles.emit({
          position,
          velocity: { x: (Math.random() - 0.5) * 2, y: 1 + Math.random() * 2, z: (Math.random() - 0.5) * 2 },
          life: 0.4 + Math.random() * 0.3,
          size: 0.25,
          endSize: 0.05,
          ramp: 'gold',
        });
      }
    }

    function stepPiece(piece, dt) {
      if (piece.landed) return;
      piece.velocity.y -= GRAVITY * dt;
      piece.position.addScaledVector(piece.velocity, dt);
      piece.rotation.x += piece.spin.x * dt;
      piece.rotation.y += piece.spin.y * dt;
      piece.rotation.z += piece.spin.z * dt;

      const ground = groundHeight(piece.position.x, piece.position.z);
      if (piece.position.y > ground || piece.velocity.y > 0) return;
      piece.position.y = ground;
      if (Math.abs(piece.velocity.y) > 2.5) {
        if (Math.random() < 0.25) sparkle(piece.position);
        piece.velocity.y = -piece.velocity.y * BOUNCE;
        piece.velocity.x *= 0.6;
        piece.velocity.z *= 0.6;
        piece.spin.multiplyScalar(0.5);
        return;
      }
      // Posée à plat, avec une orientation au hasard.
      piece.landed = true;
      piece.rotation.set((Math.random() - 0.5) * 0.15, piece.rotation.y, (Math.random() - 0.5) * 0.15);
    }

    function update(dt) {
      if (!running) return;
      pieces.forEach((piece, index) => {
        stepPiece(piece, dt);
        dummy.position.copy(piece.position);
        dummy.rotation.copy(piece.rotation);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        coins.setMatrixAt(index, dummy.matrix);
      });
      coins.instanceMatrix.needsUpdate = true;
    }

    async function trigger() {
      pieces.forEach(reset);
      scale = 1;
      running = true;
      coins.visible = true;
      tween({ duration: 1.2, ease: 'outCubic', onUpdate: (k) => (flash.intensity = FLASH_INTENSITY * Math.sin(k * Math.PI)) });
      await tween({ duration: SETTLE_SECONDS, onUpdate: () => {} });
      await tween({ duration: VANISH_SECONDS, onUpdate: (k) => (scale = 1 - k) });
      running = false;
      coins.visible = false;
    }

    return { update, trigger };
  }

  root.DragonJack.createGoldRain = createGoldRain;
})(window);
