/*
 * Le dragon croupier : assemblé à partir de formes simples (facettes « low poly »).
 * Il respire, suit les cartes du regard et réagit à chaque fin de main.
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;
  const { tween, wait, reducedMotion } = root.DragonJack.tween;

  const UP = new THREE.Vector3(0, 1, 0);
  const HEAD_REST = new THREE.Vector3(0, 3.3, -4.3);
  const NECK_SEGMENTS = 11;
  const TAIL_SEGMENTS = 16;
  const FIRE_RATE = reducedMotion ? 70 : 170;
  const FIRE_SPREAD = 4;

  /*
   * Les espèces de dragon : seules l'apparence et le souffle changent, jamais les règles.
   * `breath` est le nom du dégradé de couleur utilisé par le système de particules.
   */
  const THEMES = {
    emerald: {
      scale: '#2f4a3f', belly: '#9a7444', bone: '#e8dcc0', membrane: '#5a1d16', membraneGlow: '#2a0a06',
      eye: '#ffb52e', nostril: '#ff6a2a', breath: 'fire', light: '#ff7a2a',
    },
    crimson: {
      scale: '#7a1c12', belly: '#d9a441', bone: '#2e1d16', membrane: '#3a0c08', membraneGlow: '#4a0e06',
      eye: '#ffe14a', nostril: '#ffb02a', breath: 'blaze', light: '#ff5a1a',
    },
    shadow: {
      scale: '#221a2c', belly: '#3d2c4e', bone: '#9a88b4', membrane: '#140c1c', membraneGlow: '#1e0a2e',
      eye: '#c27bff', nostril: '#a050ff', breath: 'shadow', light: '#a050ff',
    },
    frost: {
      scale: '#8fb8cf', belly: '#e6f1f7', bone: '#f4fbff', membrane: '#4f7b9c', membraneGlow: '#10283a',
      eye: '#6fd4ff', nostril: '#bdeeff', breath: 'frost', light: '#8fd8ff',
    },
    spectral: {
      scale: '#6fd6b4', belly: '#b8f5df', bone: '#e2fff4', membrane: '#3fb894', membraneGlow: '#1f8a6a',
      eye: '#eafff6', nostril: '#9effd8', breath: 'spectral', light: '#6affc8', ghostly: true,
    },
  };
  const DEFAULT_THEME = 'emerald';
  const GHOST_OPACITY = { body: 0.5, membrane: 0.3 };

  const materials = {
    scale: new THREE.MeshStandardMaterial({ color: '#2f4a3f', roughness: 0.5, metalness: 0.4, flatShading: true }),
    belly: new THREE.MeshStandardMaterial({ color: '#9a7444', roughness: 0.7, metalness: 0.15, flatShading: true }),
    bone: new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.45, flatShading: true }),
    membrane: new THREE.MeshStandardMaterial({
      color: '#5a1d16',
      roughness: 0.8,
      side: THREE.DoubleSide,
      flatShading: true,
      emissive: '#2a0a06',
    }),
    eye: new THREE.MeshBasicMaterial({ color: '#ffb52e' }),
    pupil: new THREE.MeshBasicMaterial({ color: '#120a08' }),
    nostril: new THREE.MeshBasicMaterial({ color: '#ff6a2a' }),
  };

  function mesh(geometry, material) {
    const result = new THREE.Mesh(geometry, material);
    result.castShadow = true;
    return result;
  }

  /* Cylindre tendu entre deux points (os, membres). */
  function limbBetween(from, to, radiusFrom, radiusTo, material) {
    const direction = new THREE.Vector3().subVectors(to, from);
    const limb = mesh(new THREE.CylinderGeometry(radiusTo, radiusFrom, direction.length(), 7), material);
    limb.position.copy(from).addScaledVector(direction, 0.5);
    limb.quaternion.setFromUnitVectors(UP, direction.normalize());
    return limb;
  }

  function spike(height, radius) {
    return mesh(new THREE.ConeGeometry(radius, height, 5), materials.bone);
  }

  function buildHead() {
    const head = new THREE.Group();

    const skull = mesh(new THREE.IcosahedronGeometry(0.72, 1), materials.scale);
    skull.scale.set(1, 0.78, 1.15);
    head.add(skull);

    const snout = mesh(new THREE.CylinderGeometry(0.3, 0.56, 1.5, 6), materials.scale);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 0.02, 1.0);
    snout.scale.set(1, 1, 0.72);
    head.add(snout);

    const jaw = new THREE.Group();
    jaw.position.set(0, -0.28, 0.15);
    const jawBone = mesh(new THREE.CylinderGeometry(0.24, 0.46, 1.4, 6), materials.belly);
    jawBone.rotation.x = Math.PI / 2;
    jawBone.position.set(0, -0.06, 0.78);
    jawBone.scale.set(1, 1, 0.45);
    jaw.add(jawBone);
    head.add(jaw);

    // Crocs du haut et du bas, le long des mâchoires.
    for (let i = 0; i < 4; i += 1) {
      const z = 0.6 + i * 0.28;
      const halfWidth = 0.4 - i * 0.06;
      [-1, 1].forEach((side) => {
        const upperFang = spike(0.22, 0.05);
        upperFang.rotation.x = Math.PI;
        upperFang.position.set(side * halfWidth, -0.24, z);
        head.add(upperFang);
        const lowerFang = spike(0.16, 0.04);
        lowerFang.position.set(side * (halfWidth - 0.04), 0.06, z + 0.06);
        jaw.add(lowerFang);
      });
    }

    [-1, 1].forEach((side) => {
      const horn = spike(1.6, 0.17);
      horn.position.set(side * 0.42, 0.5, -0.45);
      horn.rotation.set(-2.1, 0, side * -0.35);
      head.add(horn);

      const cheekHorn = spike(0.8, 0.1);
      cheekHorn.position.set(side * 0.7, -0.05, -0.2);
      cheekHorn.rotation.set(-1.9, 0, side * -1.1);
      head.add(cheekHorn);

      const brow = mesh(new THREE.BoxGeometry(0.42, 0.12, 0.3), materials.scale);
      brow.position.set(side * 0.36, 0.4, 0.42);
      brow.rotation.set(0.25, side * -0.3, side * -0.35);
      head.add(brow);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), materials.eye);
      eye.position.set(side * 0.4, 0.24, 0.5);
      eye.name = 'eye';
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.17, 0.02), materials.pupil);
      pupil.position.z = 0.11;
      eye.add(pupil);
      head.add(eye);

      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), materials.nostril);
      nostril.position.set(side * 0.16, 0.18, 1.7);
      head.add(nostril);
    });

    const mouth = new THREE.Object3D();
    mouth.position.set(0, -0.2, 1.8);
    head.add(mouth);

    return { head, jaw, mouth, eyes: head.children.filter((child) => child.name === 'eye') };
  }

  function buildWing(side) {
    const wing = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(2.2, 2.6);
    shape.lineTo(4.8, 2.0);
    shape.lineTo(6.2, -0.5);
    shape.quadraticCurveTo(5.1, -0.3, 4.5, -1.7);
    shape.quadraticCurveTo(3.8, -0.6, 3.0, -1.6);
    shape.quadraticCurveTo(2.2, -0.4, 1.3, -1.1);
    shape.quadraticCurveTo(0.7, -0.3, 0, 0);
    const membrane = mesh(new THREE.ShapeGeometry(shape, 8), materials.membrane);
    wing.add(membrane);

    const joint = new THREE.Vector3(2.2, 2.6, 0.02);
    const wrist = new THREE.Vector3(4.8, 2.0, 0.02);
    wing.add(limbBetween(new THREE.Vector3(0, 0, 0.02), joint, 0.16, 0.12, materials.scale));
    wing.add(limbBetween(joint, wrist, 0.12, 0.08, materials.scale));
    [[6.2, -0.5], [4.5, -1.7], [3.0, -1.6]].forEach(([x, y]) => {
      wing.add(limbBetween(wrist, new THREE.Vector3(x, y, 0.02), 0.06, 0.025, materials.scale));
    });
    const claw = spike(0.4, 0.07);
    claw.position.copy(wrist).add(new THREE.Vector3(0.1, 0.25, 0));
    wing.add(claw);

    wing.scale.x = side;
    return wing;
  }

  function buildForeleg(side) {
    const leg = new THREE.Group();
    const shoulder = new THREE.Vector3(side * 2.0, 0.6, -6.3);
    const elbow = new THREE.Vector3(side * 3.3, 0.9, -4.6);
    const wrist = new THREE.Vector3(side * 2.7, 0.22, -3.0);
    leg.add(limbBetween(shoulder, elbow, 0.62, 0.42, materials.scale));
    leg.add(limbBetween(elbow, wrist, 0.42, 0.3, materials.scale));
    const paw = mesh(new THREE.IcosahedronGeometry(0.42, 0), materials.scale);
    paw.position.copy(wrist);
    paw.scale.set(1.1, 0.55, 1);
    leg.add(paw);

    // Les griffes s'agrippent au rebord de la table.
    [-0.3, 0, 0.3].forEach((offset) => {
      const talon = spike(0.55, 0.09);
      talon.position.set(wrist.x + offset, 0.16, wrist.z + 0.45);
      talon.rotation.set(Math.PI / 2 + 0.35, 0, offset * -0.6);
      leg.add(talon);
    });
    return leg;
  }

  /* Repeint le dragon. Le dragon spectral est translucide et luit de l'intérieur. */
  function applyTheme(theme) {
    const ghostly = Boolean(theme.ghostly);
    [['scale', GHOST_OPACITY.body], ['belly', GHOST_OPACITY.body], ['bone', GHOST_OPACITY.body], ['membrane', GHOST_OPACITY.membrane]].forEach(
      ([key, opacity]) => {
        const material = materials[key];
        material.color.set(theme[key]);
        material.transparent = ghostly;
        material.opacity = ghostly ? opacity : 1;
        material.depthWrite = !ghostly;
        const glows = key === 'membrane' || ghostly;
        material.emissive.set(glows ? theme.membraneGlow : '#000000');
        material.needsUpdate = true;
      },
    );
    materials.nostril.color.set(theme.nostril);
  }

  function createDragon({ particles }) {
    const group = new THREE.Group();
    let theme = THEMES[DEFAULT_THEME];
    const eyeColor = new THREE.Color();

    const body = mesh(new THREE.IcosahedronGeometry(1, 2), materials.scale);
    body.scale.set(2.5, 1.9, 2.8);
    body.position.set(0, 0.1, -8.2);
    group.add(body);

    const chest = mesh(new THREE.IcosahedronGeometry(1, 1), materials.belly);
    chest.scale.set(1.7, 1.5, 1.2);
    chest.position.set(0, 0.7, -6.6);
    group.add(chest);

    for (let i = 0; i < 6; i += 1) {
      const dorsal = spike(0.9 - i * 0.08, 0.22);
      dorsal.position.set(0, 1.9 - i * 0.12, -7.0 - i * 0.55);
      dorsal.rotation.x = -0.5;
      group.add(dorsal);
    }

    group.add(buildForeleg(-1), buildForeleg(1));

    const wings = [-1, 1].map((side) => {
      const wing = buildWing(side);
      wing.position.set(side * 1.6, 1.8, -7.8);
      wing.userData.side = side;
      group.add(wing);
      return wing;
    });

    const neck = [];
    for (let i = 0; i < NECK_SEGMENTS; i += 1) {
      const t = i / (NECK_SEGMENTS - 1);
      const segment = mesh(new THREE.IcosahedronGeometry(0.95 - t * 0.42, 1), materials.scale);
      const neckSpike = spike(0.5 - t * 0.2, 0.12);
      neckSpike.position.y = 0.95 - t * 0.42;
      neckSpike.rotation.x = -0.6;
      segment.add(neckSpike);
      neck.push(segment);
      group.add(segment);
    }

    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.8, -0.8, -9.8),
      new THREE.Vector3(4.6, -1.3, -9.2),
      new THREE.Vector3(6.8, -1.6, -7.0),
      new THREE.Vector3(7.6, -1.8, -4.2),
      new THREE.Vector3(6.8, -1.9, -2.0),
    ]);
    for (let i = 0; i < TAIL_SEGMENTS; i += 1) {
      const t = i / (TAIL_SEGMENTS - 1);
      const radius = 0.85 - t * 0.7;
      const segment = mesh(new THREE.IcosahedronGeometry(radius, 1), materials.scale);
      segment.position.copy(tailCurve.getPoint(t));
      group.add(segment);
    }
    const tailTip = spike(0.7, 0.2);
    tailTip.position.copy(tailCurve.getPoint(1)).add(new THREE.Vector3(-0.2, 0, 0.4));
    tailTip.rotation.set(Math.PI / 2, 0, 0.4);
    group.add(tailTip);

    const { head, jaw, mouth, eyes } = buildHead();
    group.add(head);

    const mouthLight = new THREE.PointLight(theme.light, 0, 14, 2);
    group.add(mouthLight);

    // État animé : décalage de la tête, ouverture de la mâchoire, éclat des yeux…
    const pose = {
      offset: new THREE.Vector3(),
      pitch: 0,
      jawOpen: 0,
      eyeGlow: 1,
      wingSpread: 0,
      breathing: 0,
      fireTimer: 0,
      // Endormi : yeux fermés, tête posée sur le trésor, ronflements de fumée.
      sleeping: false,
    };
    const lookTarget = new THREE.Vector3(0, 0, 0.5);
    const smoothedTarget = lookTarget.clone();
    const neckPoints = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const neckCurve = new THREE.CatmullRomCurve3(neckPoints);
    const scratch = new THREE.Vector3();
    const fireDirection = new THREE.Vector3();
    let blinkTimer = 3;
    let emberTimer = 1.5;

    function updateNeck() {
      neckPoints[0].set(0, 1.2, -6.9);
      neckPoints[1].set(0, 2.6, -6.4);
      neckPoints[2].copy(head.position).add(scratch.set(0, -0.5, -1.3));
      neckPoints[3].copy(head.position).add(scratch.set(0, -0.15, -0.55));
      neck.forEach((segment, i) => {
        segment.position.copy(neckCurve.getPoint(i / (NECK_SEGMENTS - 1)));
      });
    }

    function emitFromMouth(dt) {
      const count = Math.ceil(FIRE_RATE * dt);
      const origin = mouth.getWorldPosition(scratch);
      head.getWorldDirection(fireDirection);
      for (let i = 0; i < count; i += 1) {
        const speed = 13 + Math.random() * 5;
        particles.emit({
          position: origin,
          velocity: {
            x: fireDirection.x * speed + (Math.random() - 0.5) * FIRE_SPREAD,
            y: fireDirection.y * speed + (Math.random() - 0.5) * FIRE_SPREAD,
            z: fireDirection.z * speed + (Math.random() - 0.5) * FIRE_SPREAD,
          },
          life: 0.7 + Math.random() * 0.4,
          size: 0.3,
          endSize: 1.6 + Math.random() * 0.8,
          buoyancy: 1.2,
          ramp: theme.breath,
        });
      }
    }

    function puffSmoke(amount) {
      head.children.filter((child) => child.material === materials.nostril).forEach((nostril) => {
        const origin = nostril.getWorldPosition(new THREE.Vector3());
        for (let i = 0; i < amount; i += 1) {
          particles.emit({
            position: origin,
            velocity: { x: (Math.random() - 0.5) * 0.4, y: 0.6 + Math.random() * 0.5, z: 0.4 + Math.random() * 0.4 },
            life: 1.6 + Math.random(),
            size: 0.25,
            endSize: 1.2,
            buoyancy: 0.4,
            ramp: 'smoke',
          });
        }
      });
    }

    function update(dt, time) {
      pose.breathing = Math.sin(time * 1.3);
      chest.scale.y = 1.5 + pose.breathing * 0.05;
      body.scale.y = 1.9 + pose.breathing * 0.04;

      head.position.copy(HEAD_REST).add(pose.offset);
      head.position.y += pose.breathing * 0.06;
      head.position.x += Math.sin(time * 0.5) * 0.12;

      smoothedTarget.lerp(lookTarget, Math.min(dt * 3, 1));
      head.lookAt(smoothedTarget);
      head.rotateX(pose.pitch);
      jaw.rotation.x = pose.jawOpen;
      updateNeck();

      wings.forEach((wing) => {
        const side = wing.userData.side;
        const flap = Math.sin(time * 0.9 + side) * 0.05;
        wing.rotation.y = side * THREE.MathUtils.lerp(0.75, 0.15, pose.wingSpread);
        wing.rotation.z = side * (THREE.MathUtils.lerp(0.45, 0.15, pose.wingSpread) + flap);
      });

      blinkTimer -= dt;
      const blinking = blinkTimer < 0.12;
      if (blinkTimer < 0) blinkTimer = 2.5 + Math.random() * 4;
      eyes.forEach((eye) => {
        eye.scale.y = blinking || pose.sleeping ? 0.12 : 1;
      });
      materials.eye.color.copy(eyeColor.set(theme.eye)).multiplyScalar(pose.eyeGlow);

      // Une braise s'échappe parfois des naseaux.
      emberTimer -= dt;
      if (emberTimer < 0) {
        emberTimer = pose.sleeping ? 1.6 + Math.random() * 0.6 : 1.2 + Math.random() * 2.5;
        puffSmoke(pose.sleeping ? 4 : 1);
      }

      mouth.getWorldPosition(mouthLight.position);
      if (pose.fireTimer > 0) {
        pose.fireTimer -= dt;
        emitFromMouth(dt);
        mouthLight.intensity = 5 + Math.random() * 3;
      } else {
        mouthLight.intensity = Math.max(0, mouthLight.intensity - dt * 12);
      }
    }

    function animatePose(changes, duration, ease = 'inOutCubic') {
      const start = {
        offset: pose.offset.clone(),
        pitch: pose.pitch,
        jawOpen: pose.jawOpen,
        eyeGlow: pose.eyeGlow,
        wingSpread: pose.wingSpread,
      };
      return tween({
        duration,
        ease,
        onUpdate: (k) => {
          if (changes.offset) pose.offset.lerpVectors(start.offset, changes.offset, k);
          ['pitch', 'jawOpen', 'eyeGlow', 'wingSpread'].forEach((key) => {
            if (key in changes) pose[key] = start[key] + (changes[key] - start[key]) * k;
          });
        },
      });
    }

    const restPose = { offset: new THREE.Vector3(), pitch: 0, jawOpen: 0, eyeGlow: 1, wingSpread: 0 };

    async function breatheFire(onBlast) {
      await animatePose({ offset: new THREE.Vector3(0, 1.0, -0.9), pitch: -0.5, jawOpen: 0.35, wingSpread: 0.5 }, 0.55);
      if (onBlast) onBlast();
      animatePose({ offset: new THREE.Vector3(0, 0.6, 0.6), pitch: -0.15, jawOpen: 0.7, eyeGlow: 1.6 }, 0.25, 'outCubic');
      pose.fireTimer = 1.2;
      await wait(1.3);
      await animatePose(restPose, 0.8);
    }

    async function sulk() {
      await animatePose({ offset: new THREE.Vector3(0, -0.6, 0.2), pitch: 0.35, eyeGlow: 0.45 }, 0.6);
      puffSmoke(10);
      for (let i = 0; i < 2; i += 1) {
        await animatePose({ offset: new THREE.Vector3(0.35, -0.6, 0.2) }, 0.18);
        await animatePose({ offset: new THREE.Vector3(-0.35, -0.6, 0.2) }, 0.18);
      }
      await wait(0.4);
      await animatePose(restPose, 0.7);
    }

    /* Blackjack du joueur : rugissement vers la voûte, ailes grandes ouvertes, puis révérence. */
    async function bow(holdSeconds = 1.3) {
      await animatePose({ offset: new THREE.Vector3(0, 1.4, -1.0), pitch: -0.9, jawOpen: 0.6, wingSpread: 1, eyeGlow: 1.7 }, 0.6, 'outBack');
      puffSmoke(10);
      await wait(1.0);
      await animatePose({ offset: new THREE.Vector3(0, -1.3, 0.9), pitch: 0.75, jawOpen: 0, wingSpread: 0.55, eyeGlow: 0.55 }, 0.9);
      await wait(holdSeconds);
      await animatePose(restPose, 0.9);
    }

    const sleepPose = { offset: new THREE.Vector3(0, -1.7, 0.4), pitch: 0.55, jawOpen: 0, eyeGlow: 0.2, wingSpread: 0 };

    function sleep() {
      pose.sleeping = true;
      return animatePose(sleepPose, 1.2);
    }

    /* Le dragon remue dans son sommeil : il entrouvre un œil, puis se rendort. */
    async function stir() {
      pose.sleeping = false;
      await animatePose({ offset: new THREE.Vector3(0, -1.3, 0.4), pitch: 0.35, eyeGlow: 0.8 }, 0.35);
      await wait(0.5);
      pose.sleeping = true;
      await animatePose(sleepPose, 0.6);
    }

    function wake() {
      pose.sleeping = false;
      return animatePose({ offset: new THREE.Vector3(0, 0.6, -0.4), pitch: -0.2, jawOpen: 0.3, eyeGlow: 1.8, wingSpread: 0.8 }, 0.45, 'outBack');
    }

    async function huff() {
      await animatePose({ offset: new THREE.Vector3(0, -0.2, 0.3), pitch: 0.2 }, 0.35);
      puffSmoke(6);
      await animatePose(restPose, 0.5);
    }

    return {
      group,
      update,
      lookAt: (target) => lookTarget.copy(target),
      breatheFire,
      breathRamp: () => theme.breath,
      sulk,
      bow,
      huff,
      sleep,
      stir,
      wake,
      rest: () => animatePose(restPose, 0.8),
      awaken: () => animatePose({ eyeGlow: 1.5 }, 0.6).then(() => animatePose({ eyeGlow: 1 }, 0.8)),
      setTheme: (name) => {
        theme = THEMES[name] || THEMES[DEFAULT_THEME];
        applyTheme(theme);
        mouthLight.color.set(theme.light);
      },
      setEyeGlow: (value) => {
        pose.eyeGlow = value;
      },
    };
  }

  root.DragonJack.createDragon = createDragon;
  root.DragonJack.DRAGON_THEMES = Object.keys(THEMES);
  root.DragonJack.DEFAULT_DRAGON = DEFAULT_THEME;
})(window);
