/*
 * Dessin des cartes du Mille Bornes dans un <canvas>, dans l'esprit du jeu d'origine :
 * cadre bleu pour les bornes, rouge pour les attaques, vert pour les parades, doré pour les bottes.
 * Les mêmes dessins servent aux cartes 3D sur la table et aux cartes de la main (images).
 */
(function (root) {
  'use strict';

  const W = 200;
  const H = 300;
  const FRAME = { distance: '#1f5fae', hazard: '#c8251f', remedy: '#2a8f3e', safety: '#d9a21a' };
  const INK = '#1b1b1b';

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function circle(ctx, x, y, r, fill, stroke, width = 4) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.lineWidth = width;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  /* Feu tricolore, avec le feu allumé (`lit` : 'red' ou 'green'). */
  function trafficLight(ctx, lit) {
    roundRect(ctx, 70, 55, 60, 140, 14);
    ctx.fillStyle = '#2b2b2b';
    ctx.fill();
    circle(ctx, 100, 85, 18, lit === 'red' ? '#ff3a2a' : '#5a1a16');
    circle(ctx, 100, 125, 18, '#5a4a16');
    circle(ctx, 100, 165, 18, lit === 'green' ? '#3aff6a' : '#16401f');
  }

  /* Panneau de limitation de vitesse ; `ended` : barré (fin de limitation). */
  function speedSign(ctx, ended) {
    circle(ctx, 100, 125, 62, '#ffffff', ended ? '#7a7a7a' : '#d42a2a', 14);
    ctx.fillStyle = ended ? '#7a7a7a' : INK;
    ctx.font = 'bold 54px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('50', 100, 128);
    if (ended) {
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 6;
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.moveTo(60 + i * 14, 170);
        ctx.lineTo(140 + i * 14, 80);
        ctx.stroke();
      }
    }
  }

  /* Jerrican d'essence : vide (rouge, barré) ou plein (vert, avec une goutte). */
  function jerrycan(ctx, full) {
    roundRect(ctx, 60, 75, 80, 110, 10);
    ctx.fillStyle = full ? '#2a8f3e' : '#c8251f';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillRect(110, 58, 18, 20);
    ctx.strokeRect(72, 90, 56, 80);
    if (full) {
      ctx.beginPath();
      ctx.moveTo(100, 102);
      ctx.quadraticCurveTo(122, 135, 100, 150);
      ctx.quadraticCurveTo(78, 135, 100, 102);
      ctx.fillStyle = '#f0d22a';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(60, 190);
      ctx.lineTo(140, 70);
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
  }

  /* Pneu : crevé (clou et éclat) ou de secours (avec un signe +). */
  function tire(ctx, flat) {
    circle(ctx, 100, 128, 60, '#1b1b1b');
    circle(ctx, 100, 128, 28, '#8a8f98', '#5a5f68', 6);
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 3;
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(100 + Math.cos(angle) * 44, 128 + Math.sin(angle) * 44);
      ctx.lineTo(100 + Math.cos(angle) * 58, 128 + Math.sin(angle) * 58);
      ctx.stroke();
    }
    if (flat) {
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const angle = (i / 10) * Math.PI * 2;
        const r = i % 2 ? 10 : 26;
        ctx.lineTo(150 + Math.cos(angle) * r, 80 + Math.sin(angle) * r);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(140, 60, 36, 10);
      ctx.fillRect(153, 47, 10, 36);
    }
  }

  function car(ctx, x, y, angle, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    roundRect(ctx, -34, -14, 68, 28, 8);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = '#bfe0ff';
    ctx.fillRect(-12, -10, 22, 20);
    circle(ctx, -20, 16, 7, INK);
    circle(ctx, 20, 16, 7, INK);
    ctx.restore();
  }

  function accident(ctx) {
    car(ctx, 72, 140, 0.5, '#3a6ad4');
    car(ctx, 128, 120, -0.6, '#e0c02a');
    ctx.fillStyle = '#ff6a1a';
    ctx.beginPath();
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      const r = i % 2 ? 10 : 24;
      ctx.lineTo(100 + Math.cos(angle) * r, 100 + Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();
  }

  /* Réparations : une clé plate et un marteau croisés. */
  function repairs(ctx) {
    ctx.save();
    ctx.translate(100, 128);
    ctx.rotate(-0.7);
    ctx.fillStyle = '#9aa0a6';
    ctx.fillRect(-8, -70, 16, 120);
    circle(ctx, 0, -72, 20, '#9aa0a6');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-7, -96, 14, 26);
    ctx.restore();
    ctx.save();
    ctx.translate(100, 128);
    ctx.rotate(0.7);
    ctx.fillStyle = '#7a4a24';
    ctx.fillRect(-7, -50, 14, 110);
    ctx.fillStyle = '#5a5f68';
    ctx.fillRect(-28, -66, 56, 24);
    ctx.restore();
  }

  /* Bornes : la borne kilométrique blanche à tête rouge, avec la distance. */
  function milestone(ctx, value) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(58, 205);
    ctx.lineTo(58, 110);
    ctx.quadraticCurveTo(58, 60, 100, 60);
    ctx.quadraticCurveTo(142, 60, 142, 110);
    ctx.lineTo(142, 205);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#d42a2a';
    ctx.fillRect(50, 55, 100, 48);
    ctx.restore();
    ctx.fillStyle = INK;
    ctx.font = `bold ${value >= 100 ? 46 : 54}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), 100, 150);
  }

  function siren(ctx) {
    car(ctx, 100, 150, 0, '#ffffff');
    roundRect(ctx, 84, 108, 32, 22, 6);
    ctx.fillStyle = '#3a8aff';
    ctx.fill();
    ctx.strokeStyle = '#3a8aff';
    ctx.lineWidth = 4;
    [[-1, -0.5], [1, -0.5], [0, -1]].forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(100 + dx * 26, 104 + dy * 18);
      ctx.lineTo(100 + dx * 44, 104 + dy * 38);
      ctx.stroke();
    });
  }

  function tanker(ctx) {
    roundRect(ctx, 30, 105, 110, 50, 24);
    ctx.fillStyle = '#e0e4ea';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.stroke();
    roundRect(ctx, 142, 115, 34, 40, 6);
    ctx.fillStyle = '#d42a2a';
    ctx.fill();
    ctx.stroke();
    [55, 120, 160].forEach((x) => circle(ctx, x, 165, 12, INK));
  }

  function shieldTire(ctx) {
    tire(ctx, false);
    ctx.fillStyle = '#d9a21a';
    ctx.beginPath();
    ctx.moveTo(100, 60);
    ctx.lineTo(132, 72);
    ctx.lineTo(128, 108);
    ctx.lineTo(100, 124);
    ctx.lineTo(72, 108);
    ctx.lineTo(68, 72);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function steeringWheel(ctx) {
    circle(ctx, 100, 128, 58, null, '#2b2b2b', 14);
    circle(ctx, 100, 128, 14, '#2b2b2b');
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 12;
    [[-50, 10], [50, 10], [0, 56]].forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(100, 128);
      ctx.lineTo(100 + dx, 128 + dy);
      ctx.stroke();
    });
    ctx.fillStyle = '#d9a21a';
    ctx.font = 'bold 40px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', 100, 82);
  }

  const ICONS = {
    redLight: (ctx) => trafficLight(ctx, 'red'),
    greenLight: (ctx) => trafficLight(ctx, 'green'),
    speedLimit: (ctx) => speedSign(ctx, false),
    endOfLimit: (ctx) => speedSign(ctx, true),
    outOfGas: (ctx) => jerrycan(ctx, false),
    gas: (ctx) => jerrycan(ctx, true),
    flatTire: (ctx) => tire(ctx, true),
    spareTire: (ctx) => tire(ctx, false),
    accident,
    repairs,
    rightOfWay: siren,
    fuelTank: tanker,
    punctureProof: shieldTire,
    drivingAce: steeringWheel,
  };

  const cache = new Map();

  /* Canvas d'une carte (face visible), mis en cache par type. */
  function drawCard(card, labels) {
    const key = card.type;
    if (cache.has(key)) return cache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    roundRect(ctx, 0, 0, W, H, 16);
    ctx.fillStyle = FRAME[card.kind];
    ctx.fill();
    roundRect(ctx, 10, 10, W - 20, H - 20, 10);
    ctx.fillStyle = '#fbf6ea';
    ctx.fill();
    if (card.kind === 'distance') milestone(ctx, card.value);
    else ICONS[card.type](ctx);
    ctx.fillStyle = FRAME[card.kind];
    ctx.fillRect(10, H - 70, W - 20, 60);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = labels[card.type];
    ctx.font = `bold ${label.length > 16 ? 17 : 21}px Arial, sans-serif`;
    const words = label.split(' ');
    if (label.length > 14 && words.length > 1) {
      const middle = Math.ceil(words.length / 2);
      ctx.fillText(words.slice(0, middle).join(' '), W / 2, H - 52);
      ctx.fillText(words.slice(middle).join(' '), W / 2, H - 28);
    } else {
      ctx.fillText(label, W / 2, H - 40);
    }
    cache.set(key, canvas);
    return canvas;
  }

  /* Dos de carte : bandes bleues et blanches avec « 1000 BORNES » écrit au centre. */
  let backCanvas = null;
  function drawBack() {
    if (backCanvas) return backCanvas;
    backCanvas = document.createElement('canvas');
    backCanvas.width = W;
    backCanvas.height = H;
    const ctx = backCanvas.getContext('2d');
    roundRect(ctx, 0, 0, W, H, 16);
    ctx.fillStyle = '#1f5fae';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 10;
    for (let x = -H; x < W + H; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + H, H);
      ctx.stroke();
    }
    ctx.restore();
    circle(ctx, W / 2, H / 2, 62, '#ffffff', '#d42a2a', 8);
    ctx.fillStyle = '#d42a2a';
    ctx.font = 'bold 40px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1000', W / 2, H / 2 - 12);
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.fillText('BORNES', W / 2, H / 2 + 22);
    return backCanvas;
  }

  const imageCache = new Map();
  /* Image (data URL) d'une carte, pour la main affichée en HTML. */
  function cardImage(card, labels) {
    if (!imageCache.has(card.type)) imageCache.set(card.type, drawCard(card, labels).toDataURL('image/png'));
    return imageCache.get(card.type);
  }

  root.DragonJack = root.DragonJack || {};
  root.DragonJack.milleBornesCards = { drawCard, drawBack, cardImage, WIDTH: W, HEIGHT: H };
})(window);
