/*
 * Mini moteur d'animation : chaque tween fait varier une progression de 0 à 1
 * pendant une durée donnée et se résout en promesse à la fin.
 */
(function (root) {
  'use strict';

  root.DragonJack = root.DragonJack || {};
  const reducedMotion = root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Avec « animations réduites », tout va beaucoup plus vite sans disparaître.
  const SPEED_FACTOR = reducedMotion ? 0.35 : 1;

  const active = new Set();

  const easings = {
    linear: (t) => t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: (t) => {
      const c = 1.4;
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    },
  };

  function tween({ duration, ease = 'inOutCubic', onUpdate, delay = 0 }) {
    return new Promise((resolve) => {
      active.add({
        elapsed: -delay * SPEED_FACTOR,
        duration: Math.max(duration * SPEED_FACTOR, 0.001),
        ease: easings[ease],
        onUpdate,
        resolve,
      });
    });
  }

  function wait(seconds) {
    return tween({ duration: seconds, onUpdate: () => {} });
  }

  function update(deltaSeconds) {
    active.forEach((item) => {
      item.elapsed += deltaSeconds;
      if (item.elapsed < 0) return;
      const progress = Math.min(item.elapsed / item.duration, 1);
      item.onUpdate(item.ease(progress));
      if (progress === 1) {
        active.delete(item);
        item.resolve();
      }
    });
  }

  root.DragonJack.tween = { tween, wait, update, reducedMotion };
})(window);
