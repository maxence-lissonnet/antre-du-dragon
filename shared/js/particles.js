/*
 * Système de particules : un seul objet THREE.Points recyclé pour le feu, les braseros et les braises.
 * Chaque particule a une couleur qui évolue avec son âge (blanc → or → braise → fumée).
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;

  const VERTEX_SHADER = `
    attribute float size;
    attribute float alpha;
    attribute vec3 color;
    uniform float projectionScale;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * projectionScale / -mvPosition.z;
      gl_Position = projectionMatrix * mvPosition;
      vColor = color;
      vAlpha = alpha;
    }
  `;

  const FRAGMENT_SHADER = `
    uniform sampler2D map;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vec4 sprite = texture2D(map, gl_PointCoord);
      gl_FragColor = vec4(vColor, vAlpha) * sprite;
    }
  `;

  // Dégradé de couleur selon l'âge de la particule (0 = naissance, 1 = mort).
  const FIRE_RAMP = [
    [0, new THREE.Color('#ffd98a')],
    [0.2, new THREE.Color('#f59a2c')],
    [0.5, new THREE.Color('#f2551d')],
    [0.8, new THREE.Color('#7a1e10')],
    [1, new THREE.Color('#2a1210')],
  ];
  const EMBER_RAMP = [
    [0, new THREE.Color('#ffd27a')],
    [1, new THREE.Color('#e04a14')],
  ];
  // Le mélange additif ne peut pas assombrir : la fumée est une brume chaude et pâle.
  const SMOKE_RAMP = [
    [0, new THREE.Color('#8a6a52')],
    [1, new THREE.Color('#1a1210')],
  ];
  // Flammes des braseros : plus sombres que le souffle, pour ne pas saturer en blanc.
  const FLAME_RAMP = [
    [0, new THREE.Color('#d9822b')],
    [0.4, new THREE.Color('#b8401a')],
    [1, new THREE.Color('#2a0e08')],
  ];
  // Souffles des autres dragons.
  const BLAZE_RAMP = [
    [0, new THREE.Color('#fff2a0')],
    [0.15, new THREE.Color('#ffb020')],
    [0.45, new THREE.Color('#ff3a10')],
    [0.8, new THREE.Color('#6a1006')],
    [1, new THREE.Color('#1a0604')],
  ];
  const SHADOW_RAMP = [
    [0, new THREE.Color('#f0c8ff')],
    [0.25, new THREE.Color('#b060ff')],
    [0.6, new THREE.Color('#5a1a9a')],
    [1, new THREE.Color('#12061e')],
  ];
  const FROST_RAMP = [
    [0, new THREE.Color('#ffffff')],
    [0.3, new THREE.Color('#a8e8ff')],
    [0.7, new THREE.Color('#3a7ab0')],
    [1, new THREE.Color('#0a1a2a')],
  ];
  const SPECTRAL_RAMP = [
    [0, new THREE.Color('#f0fff8')],
    [0.3, new THREE.Color('#7affc8')],
    [0.7, new THREE.Color('#1f8a6a')],
    [1, new THREE.Color('#041a12')],
  ];
  // Pluie d'or et étincelles du blackjack.
  const GOLD_RAMP = [
    [0, new THREE.Color('#fff6c8')],
    [0.5, new THREE.Color('#f3c04a')],
    [1, new THREE.Color('#6a4210')],
  ];
  const RAMPS = {
    fire: FIRE_RAMP,
    ember: EMBER_RAMP,
    smoke: SMOKE_RAMP,
    flame: FLAME_RAMP,
    blaze: BLAZE_RAMP,
    shadow: SHADOW_RAMP,
    frost: FROST_RAMP,
    spectral: SPECTRAL_RAMP,
    gold: GOLD_RAMP,
  };

  function sampleRamp(ramp, t, target) {
    for (let i = 1; i < ramp.length; i += 1) {
      if (t <= ramp[i][0]) {
        const [t0, c0] = ramp[i - 1];
        const [t1, c1] = ramp[i];
        return target.copy(c0).lerp(c1, (t - t0) / (t1 - t0));
      }
    }
    return target.copy(ramp[ramp.length - 1][1]);
  }

  /* Petite tache lumineuse ronde, utilisée pour les particules de feu et les braises. */
  function createGlowSprite() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }

  function createParticles(sprite = createGlowSprite(), maxCount = 2400) {
    const positions = new Float32Array(maxCount * 3);
    const colors = new Float32Array(maxCount * 3);
    const sizes = new Float32Array(maxCount);
    const alphas = new Float32Array(maxCount);
    const velocities = new Float32Array(maxCount * 3);
    const ages = new Float32Array(maxCount);
    const lifetimes = new Float32Array(maxCount).fill(-1);
    const startSizes = new Float32Array(maxCount);
    const endSizes = new Float32Array(maxCount);
    const buoyancies = new Float32Array(maxCount);
    const ramps = new Array(maxCount).fill(FIRE_RAMP);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: { map: { value: sprite }, projectionScale: { value: 400 } },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;

    let cursor = 0;
    const scratchColor = new THREE.Color();

    function emit({ position, velocity, life, size, endSize = size, buoyancy = 0, ramp = 'fire' }) {
      const i = cursor;
      cursor = (cursor + 1) % maxCount;
      positions.set([position.x, position.y, position.z], i * 3);
      velocities.set([velocity.x, velocity.y, velocity.z], i * 3);
      ages[i] = 0;
      lifetimes[i] = life;
      startSizes[i] = size;
      endSizes[i] = endSize;
      buoyancies[i] = buoyancy;
      ramps[i] = RAMPS[ramp];
    }

    function update(dt) {
      for (let i = 0; i < maxCount; i += 1) {
        if (lifetimes[i] < 0) continue;
        ages[i] += dt;
        const t = ages[i] / lifetimes[i];
        if (t >= 1) {
          lifetimes[i] = -1;
          alphas[i] = 0;
          sizes[i] = 0;
          continue;
        }
        const p = i * 3;
        velocities[p + 1] += buoyancies[i] * dt;
        // Freinage dans l'air : le souffle s'étale puis ralentit.
        const drag = 1 - Math.min(dt * 1.6, 0.5);
        velocities[p] *= drag;
        velocities[p + 1] *= drag;
        velocities[p + 2] *= drag;
        positions[p] += velocities[p] * dt;
        positions[p + 1] += velocities[p + 1] * dt;
        positions[p + 2] += velocities[p + 2] * dt;

        sampleRamp(ramps[i], t, scratchColor);
        colors[p] = scratchColor.r;
        colors[p + 1] = scratchColor.g;
        colors[p + 2] = scratchColor.b;
        sizes[i] = startSizes[i] + (endSizes[i] - startSizes[i]) * t;
        alphas[i] = t < 0.1 ? t * 10 : 1 - Math.pow(t, 2);
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      geometry.attributes.size.needsUpdate = true;
      geometry.attributes.alpha.needsUpdate = true;
    }

    function setProjectionScale(viewportHeight, fovDegrees) {
      material.uniforms.projectionScale.value = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(fovDegrees) / 2));
    }

    return { points, emit, update, setProjectionScale };
  }

  root.DragonJack.createParticles = createParticles;
})(window);
