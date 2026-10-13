/*
 * Les six symboles des rouleaux, dessinés au trait dans un <canvas> (aucune image externe).
 * Chaque fonction dessine son symbole centré sur (0, 0), dans un carré de côté `size`.
 */
(function (root) {
  'use strict';

  const GOLD = '#e0a63a';
  const GOLD_LIGHT = '#f8dc8c';
  const GOLD_DARK = '#8a5a14';
  const INK = '#221a16';

  function goldGradient(ctx, radius) {
    const gradient = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, radius * 0.1, 0, 0, radius);
    gradient.addColorStop(0, GOLD_LIGHT);
    gradient.addColorStop(0.6, GOLD);
    gradient.addColorStop(1, GOLD_DARK);
    return gradient;
  }

  function outline(ctx, width = 4) {
    ctx.lineWidth = width;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  const DRAWINGS = {
    // Pièce d'or frappée d'un œil de dragon.
    coin(ctx, size) {
      const r = size * 0.36;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = goldGradient(ctx, r);
      ctx.fill();
      outline(ctx);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = GOLD_DARK;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, 0);
      ctx.quadraticCurveTo(0, -r * 0.42, r * 0.5, 0);
      ctx.quadraticCurveTo(0, r * 0.42, -r * 0.5, 0);
      ctx.fillStyle = GOLD_DARK;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.06, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
    },
    // Œuf de dragon couvert d'écailles.
    egg(ctx, size) {
      const w = size * 0.27;
      const h = size * 0.38;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, size * 0.03, w, h, 0, 0, Math.PI * 2);
      const gradient = ctx.createLinearGradient(-w, -h, w, h);
      gradient.addColorStop(0, '#7fd1b4');
      gradient.addColorStop(1, '#1f5a48');
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = 'rgba(10, 40, 30, 0.55)';
      ctx.lineWidth = 3;
      for (let row = 0; row < 7; row += 1) {
        for (let col = -3; col <= 3; col += 1) {
          ctx.beginPath();
          ctx.arc(col * 20 + (row % 2) * 10, -h + row * 18, 10, 0, Math.PI);
          ctx.stroke();
        }
      }
      ctx.restore();
      ctx.beginPath();
      ctx.ellipse(0, size * 0.03, w, h, 0, 0, Math.PI * 2);
      outline(ctx);
    },
    // Épée à garde dorée.
    sword(ctx, size) {
      ctx.save();
      ctx.rotate(-Math.PI / 4);
      const blade = size * 0.34;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-8, -blade);
      ctx.lineTo(0, -blade - 16);
      ctx.lineTo(8, -blade);
      ctx.lineTo(8, 0);
      ctx.closePath();
      const steel = ctx.createLinearGradient(-8, 0, 8, 0);
      steel.addColorStop(0, '#9aa4ae');
      steel.addColorStop(0.5, '#f2f6f8');
      steel.addColorStop(1, '#7a848e');
      ctx.fillStyle = steel;
      ctx.fill();
      outline(ctx, 3);
      ctx.fillStyle = GOLD;
      ctx.fillRect(-26, 0, 52, 10);
      ctx.strokeRect(-26, 0, 52, 10);
      ctx.fillStyle = '#5a3420';
      ctx.fillRect(-6, 10, 12, 30);
      ctx.strokeRect(-6, 10, 12, 30);
      ctx.beginPath();
      ctx.arc(0, 46, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#c0262d';
      ctx.fill();
      outline(ctx, 3);
      ctx.restore();
    },
    // Calice orné d'un rubis.
    chalice(ctx, size) {
      const s = size * 0.36;
      ctx.beginPath();
      ctx.moveTo(-s * 0.8, -s * 0.8);
      ctx.lineTo(s * 0.8, -s * 0.8);
      ctx.quadraticCurveTo(s * 0.75, s * 0.05, s * 0.12, s * 0.15);
      ctx.lineTo(s * 0.12, s * 0.6);
      ctx.lineTo(s * 0.5, s * 0.75);
      ctx.lineTo(s * 0.5, s * 0.9);
      ctx.lineTo(-s * 0.5, s * 0.9);
      ctx.lineTo(-s * 0.5, s * 0.75);
      ctx.lineTo(-s * 0.12, s * 0.6);
      ctx.lineTo(-s * 0.12, s * 0.15);
      ctx.quadraticCurveTo(-s * 0.75, s * 0.05, -s * 0.8, -s * 0.8);
      ctx.closePath();
      ctx.fillStyle = goldGradient(ctx, s);
      ctx.fill();
      outline(ctx);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.55);
      ctx.lineTo(s * 0.18, -s * 0.35);
      ctx.lineTo(0, -s * 0.15);
      ctx.lineTo(-s * 0.18, -s * 0.35);
      ctx.closePath();
      ctx.fillStyle = '#c0262d';
      ctx.fill();
      outline(ctx, 2);
    },
    // Couronne à trois pointes et pierres précieuses.
    crown(ctx, size) {
      const s = size * 0.38;
      ctx.beginPath();
      ctx.moveTo(-s, s * 0.5);
      ctx.lineTo(-s, -s * 0.35);
      ctx.lineTo(-s * 0.5, s * 0.05);
      ctx.lineTo(0, -s * 0.6);
      ctx.lineTo(s * 0.5, s * 0.05);
      ctx.lineTo(s, -s * 0.35);
      ctx.lineTo(s, s * 0.5);
      ctx.closePath();
      ctx.fillStyle = goldGradient(ctx, s);
      ctx.fill();
      outline(ctx);
      [[-s * 0.55, s * 0.28, '#2f8f6a'], [0, s * 0.28, '#c0262d'], [s * 0.55, s * 0.28, '#3a5fc4']].forEach(([x, y, color]) => {
        ctx.beginPath();
        ctx.arc(x, y, s * 0.13, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        outline(ctx, 2);
      });
      [[-s, -s * 0.35], [0, -s * 0.6], [s, -s * 0.35]].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, s * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = GOLD_LIGHT;
        ctx.fill();
        outline(ctx, 2);
      });
    },
    // Tête de dragon rouge, de profil, l'œil allumé : le symbole du jackpot.
    dragon(ctx, size) {
      const s = size * 0.4;
      ctx.beginPath();
      ctx.moveTo(-s * 0.85, s * 0.75);
      ctx.lineTo(-s * 0.7, -s * 0.15);
      ctx.lineTo(-s * 0.95, -s * 0.85);
      ctx.lineTo(-s * 0.35, -s * 0.4);
      ctx.lineTo(-s * 0.1, -s * 0.55);
      ctx.lineTo(s * 0.55, -s * 0.25);
      ctx.lineTo(s * 0.95, -s * 0.05);
      ctx.lineTo(s * 0.9, s * 0.12);
      ctx.lineTo(s * 0.35, s * 0.12);
      ctx.lineTo(s * 0.85, s * 0.35);
      ctx.lineTo(s * 0.3, s * 0.42);
      ctx.lineTo(-s * 0.1, s * 0.3);
      ctx.lineTo(-s * 0.25, s * 0.75);
      ctx.closePath();
      const scales = ctx.createLinearGradient(-s, -s, s, s);
      scales.addColorStop(0, '#d8402a');
      scales.addColorStop(1, '#6a120a');
      ctx.fillStyle = scales;
      ctx.fill();
      outline(ctx);
      ctx.beginPath();
      ctx.ellipse(s * 0.05, -s * 0.22, s * 0.13, s * 0.07, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd24a';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(s * 0.05, -s * 0.22, s * 0.025, s * 0.065, 0, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s * 0.4, s * 0.12);
      ctx.lineTo(s * 0.45, s * 0.24);
      ctx.lineTo(s * 0.5, s * 0.12);
      ctx.fillStyle = '#f4ecd8';
      ctx.fill();
    },
  };

  /*
   * Bande d'un rouleau : les symboles se suivent le long de la circonférence du cylindre.
   * Sur le cylindre couché, l'axe horizontal de la texture devient vertical à l'écran :
   * chaque symbole est donc dessiné tourné d'un quart de tour pour apparaître droit.
   */
  function createReelTexture(strip, renderer, cellAspect = 1) {
    const cell = 160;
    const canvas = document.createElement('canvas');
    canvas.width = cell * strip.length;
    canvas.height = cell;
    const ctx = canvas.getContext('2d');
    strip.forEach((symbol, index) => {
      const x = index * cell;
      ctx.fillStyle = index % 2 === 0 ? '#f1e6cc' : '#e8dabb';
      ctx.fillRect(x, 0, cell, cell);
      ctx.fillStyle = 'rgba(138, 90, 20, 0.35)';
      ctx.fillRect(x, 0, 3, cell);
      ctx.save();
      ctx.translate(x + cell / 2, cell / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.scale(cellAspect, 1);
      DRAWINGS[symbol](ctx, cell * 1.1);
      ctx.restore();
    });
    const texture = new root.THREE.CanvasTexture(canvas);
    texture.encoding = root.THREE.sRGBEncoding;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  /* Petite image d'un symbole, pour la table des gains (fenêtre des règles). */
  function drawIcon(canvas, symbol) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(canvas.width / 160, canvas.height / 160);
    DRAWINGS[symbol](ctx, 160);
    ctx.restore();
  }

  root.DragonJack = root.DragonJack || {};
  root.DragonJack.slotSymbols = { createReelTexture, drawIcon };
})(window);
