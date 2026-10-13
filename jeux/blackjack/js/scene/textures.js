/*
 * Textures dessinées à la volée dans des <canvas> : cartes, dos de carte, jetons, tapis.
 * Aucune image externe : tout le décor est généré par le code.
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;

  const palette = {
    obsidian: '#1a1210',
    stone: '#3a302b',
    felt: '#4e1612',
    feltDeep: '#3a0f0c',
    gold: '#e0a63a',
    goldPale: '#f3d48a',
    ember: '#f2551d',
    bone: '#efe4cc',
    ink: '#221a16',
    verdigris: '#3f8c78',
    blood: '#a52a1c',
  };

  const DISPLAY_FONT = '"Grenze Gotisch", "Segoe UI Symbol", Georgia, serif';
  const SUIT_GLYPHS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
  const RED_SUITS = ['hearts', 'diamonds'];

  const CARD_W = 300;
  const CARD_H = 420;

  /*
   * Disposition classique des symboles sur les cartes 2 à 10 :
   * [colonne (-1 gauche, 0 centre, 1 droite), hauteur (0 en haut, 1 en bas)].
   */
  const SIX_PIPS = [[-1, 0], [1, 0], [-1, 0.5], [1, 0.5], [-1, 1], [1, 1]];
  const NINE_COLUMNS = [0, 1 / 3, 2 / 3, 1].flatMap((row) => [[-1, row], [1, row]]);
  const PIP_LAYOUTS = {
    2: [[0, 0], [0, 1]],
    3: [[0, 0], [0, 0.5], [0, 1]],
    4: [[-1, 0], [1, 0], [-1, 1], [1, 1]],
    5: [[-1, 0], [1, 0], [0, 0.5], [-1, 1], [1, 1]],
    6: SIX_PIPS,
    7: [...SIX_PIPS, [0, 0.25]],
    8: [...SIX_PIPS, [0, 0.25], [0, 0.75]],
    9: [...NINE_COLUMNS, [0, 0.5]],
    10: [...NINE_COLUMNS, [0, 1 / 6], [0, 5 / 6]],
  };
  const PIP_AREA = { centerX: CARD_W / 2, columnGap: 54, top: 92, bottom: CARD_H - 92 };
  const PIP_SIZE = 64;

  function createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return { canvas, ctx: canvas.getContext('2d') };
  }

  function toTexture(canvas, renderer) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    if (renderer) texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* Motif d'écailles : rangées d'arcs décalées d'une demi-écaille. */
  function drawScales(ctx, width, height, size, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let row = 0, y = 0; y < height + size; row += 1, y += size * 0.55) {
      const offset = row % 2 === 0 ? 0 : size / 2;
      for (let x = -size + offset; x < width + size; x += size) {
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI);
        ctx.stroke();
      }
    }
  }

  /* Œil de dragon : amande dorée et pupille fendue. */
  function drawDragonEye(ctx, cx, cy, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy);
    ctx.quadraticCurveTo(cx, cy - h, cx + w / 2, cy);
    ctx.quadraticCurveTo(cx, cy + h, cx - w / 2, cy);
    ctx.closePath();
    const iris = ctx.createRadialGradient(cx, cy, 2, cx, cy, w / 2);
    iris.addColorStop(0, '#fff1b0');
    iris.addColorStop(0.45, palette.gold);
    iris.addColorStop(1, '#7a3b0c');
    ctx.fillStyle = iris;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = palette.goldPale;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.06, h * 0.62, 0, 0, Math.PI * 2);
    ctx.fillStyle = palette.ink;
    ctx.fill();
    ctx.restore();
  }

  function createCardBack(renderer) {
    const { canvas, ctx } = createCanvas(CARD_W, CARD_H);
    ctx.fillStyle = palette.feltDeep;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    ctx.save();
    roundRect(ctx, 16, 16, CARD_W - 32, CARD_H - 32, 14);
    ctx.clip();
    ctx.fillStyle = palette.felt;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    drawScales(ctx, CARD_W, CARD_H, 34, 'rgba(224, 166, 58, 0.28)');
    ctx.restore();

    roundRect(ctx, 16, 16, CARD_W - 32, CARD_H - 32, 14);
    ctx.lineWidth = 4;
    ctx.strokeStyle = palette.gold;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(CARD_W / 2, CARD_H / 2, 78, 0, Math.PI * 2);
    ctx.fillStyle = palette.feltDeep;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = palette.gold;
    ctx.stroke();
    drawDragonEye(ctx, CARD_W / 2, CARD_H / 2, 120, 62);
    return toTexture(canvas, renderer);
  }

  function drawCorner(ctx, rank, glyph, color) {
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `56px ${DISPLAY_FONT}`;
    ctx.fillText(rank, 44, 74);
    ctx.font = `42px ${DISPLAY_FONT}`;
    ctx.fillText(glyph, 44, 120);
  }

  function drawFaceCardPanel(ctx, rank, glyph, color) {
    const x = 70;
    const y = 80;
    const w = CARD_W - 140;
    const h = CARD_H - 160;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fillStyle = 'rgba(224, 166, 58, 0.16)';
    ctx.fill();
    ctx.save();
    ctx.clip();
    drawScales(ctx, CARD_W, CARD_H, 26, 'rgba(160, 100, 30, 0.22)');
    ctx.restore();
    roundRect(ctx, x, y, w, h, 10);
    ctx.lineWidth = 3;
    ctx.strokeStyle = palette.gold;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `150px ${DISPLAY_FONT}`;
    ctx.fillText(rank, CARD_W / 2, CARD_H / 2 - 18);
    ctx.font = `54px ${DISPLAY_FONT}`;
    ctx.fillText(glyph, CARD_W / 2, CARD_H / 2 + 82);
  }

  /* Autant de symboles que la valeur de la carte ; ceux du bas sont retournés, comme sur un vrai jeu. */
  function drawPips(ctx, layout, glyph, color) {
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${PIP_SIZE}px ${DISPLAY_FONT}`;
    layout.forEach(([column, row]) => {
      const x = PIP_AREA.centerX + column * PIP_AREA.columnGap;
      const y = PIP_AREA.top + row * (PIP_AREA.bottom - PIP_AREA.top);
      ctx.save();
      ctx.translate(x, y);
      if (row > 0.5) ctx.rotate(Math.PI);
      ctx.fillText(glyph, 0, 0);
      ctx.restore();
    });
  }

  function createCardFace({ rank, suit }, renderer) {
    const { canvas, ctx } = createCanvas(CARD_W, CARD_H);
    const color = RED_SUITS.includes(suit) ? palette.blood : palette.ink;
    const glyph = SUIT_GLYPHS[suit];

    const paper = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    paper.addColorStop(0, '#f6eedb');
    paper.addColorStop(1, '#e4d5b4');
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    roundRect(ctx, 10, 10, CARD_W - 20, CARD_H - 20, 12);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(160, 110, 40, 0.55)';
    ctx.stroke();

    drawCorner(ctx, rank, glyph, color);
    ctx.save();
    ctx.translate(CARD_W, CARD_H);
    ctx.rotate(Math.PI);
    drawCorner(ctx, rank, glyph, color);
    ctx.restore();

    if (['J', 'Q', 'K'].includes(rank)) {
      drawFaceCardPanel(ctx, rank, glyph, color);
    } else if (rank === 'A') {
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `190px ${DISPLAY_FONT}`;
      ctx.fillText(glyph, CARD_W / 2, CARD_H / 2 + 6);
      ctx.beginPath();
      ctx.arc(CARD_W / 2, CARD_H / 2, 112, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = palette.gold;
      ctx.stroke();
    } else {
      drawPips(ctx, PIP_LAYOUTS[rank], glyph, color);
    }
    return toTexture(canvas, renderer);
  }

  const CHIP_STYLES = {
    10: { base: '#e9dcc0', stripe: '#8a2a1c', text: '#5a1a12' },
    25: { base: '#2f6f5f', stripe: '#efe4cc', text: '#efe4cc' },
    100: { base: '#d39a2e', stripe: '#3a0f0c', text: '#3a0f0c' },
    500: { base: '#2b1e2e', stripe: '#e0a63a', text: '#f3d48a' },
  };

  function createChipTop(value, renderer) {
    const size = 256;
    const { canvas, ctx } = createCanvas(size, size);
    const style = CHIP_STYLES[value];
    const c = size / 2;

    ctx.fillStyle = style.base;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = style.stripe;
    for (let i = 0; i < 8; i += 1) {
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate((i / 8) * Math.PI * 2);
      ctx.fillRect(-12, -c, 24, 30);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(c, c, c * 0.62, 0, Math.PI * 2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = style.stripe;
    ctx.setLineDash([10, 8]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = style.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${value >= 100 ? 64 : 76}px ${DISPLAY_FONT}`;
    ctx.fillText(String(value), c, c + 4);
    return toTexture(canvas, renderer);
  }

  function createChipSide(value, renderer) {
    const { canvas, ctx } = createCanvas(256, 16);
    const style = CHIP_STYLES[value];
    ctx.fillStyle = style.base;
    ctx.fillRect(0, 0, 256, 16);
    ctx.fillStyle = style.stripe;
    for (let x = 0; x < 256; x += 32) ctx.fillRect(x, 0, 12, 16);
    return toTexture(canvas, renderer);
  }

  /*
   * Tapis de jeu. `bounds` décrit la zone du monde couverte par la texture
   * pour placer les inscriptions au bon endroit.
   */
  function createFelt(bounds, marks, renderer) {
    const width = 2048;
    const unit = width / (bounds.maxX - bounds.minX);
    const height = Math.round((bounds.maxZ - bounds.minZ) * unit);
    const { canvas, ctx } = createCanvas(width, height);
    const toPx = (x, z) => [(x - bounds.minX) * unit, (z - bounds.minZ) * unit];

    const glow = ctx.createRadialGradient(width / 2, height * 0.6, 50, width / 2, height * 0.6, width * 0.55);
    glow.addColorStop(0, '#5e1c16');
    glow.addColorStop(1, palette.feltDeep);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // Grain du feutre : un semis de points clairs et sombres.
    for (let i = 0; i < 20000; i += 1) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,220,180,0.035)' : 'rgba(0,0,0,0.07)';
      ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
    }

    ctx.strokeStyle = 'rgba(224, 166, 58, 0.55)';
    ctx.fillStyle = 'rgba(224, 166, 58, 0.8)';

    // Texte en arc au-dessus des cartes du joueur.
    const [arcX, arcZ] = toPx(marks.arcCenter.x, marks.arcCenter.z);
    const drawArcText = (text, radius, fontSize) => {
      ctx.save();
      ctx.font = `${fontSize}px ${DISPLAY_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const totalAngle = (ctx.measureText(text).width / (radius * unit)) * 1.08;
      let angle = -Math.PI / 2 - totalAngle / 2;
      for (const char of text) {
        const charAngle = (ctx.measureText(char).width / (radius * unit)) * 1.08;
        angle += charAngle / 2;
        ctx.save();
        ctx.translate(arcX + Math.cos(angle) * radius * unit, arcZ + Math.sin(angle) * radius * unit);
        ctx.rotate(angle + Math.PI / 2);
        ctx.fillText(char, 0, 0);
        ctx.restore();
        angle += charAngle / 2;
      }
      ctx.restore();
    };
    drawArcText('Le blackjack paie 3 pour 2', marks.arcRadius, 74);
    ctx.fillStyle = 'rgba(224, 166, 58, 0.5)';
    drawArcText('Le dragon reste sur tous les 17', marks.arcRadius + 0.55, 46);
    drawArcText('L’assurance paie 2 pour 1', marks.arcRadius + 1.05, 46);

    ctx.beginPath();
    ctx.arc(arcX, arcZ, (marks.arcRadius - 0.45) * unit, Math.PI * 1.2, Math.PI * 1.8);
    ctx.lineWidth = 4;
    ctx.stroke();

    // Emplacement des jetons d'assurance.
    const [insuranceX, insuranceZ] = toPx(marks.insuranceSpot.x, marks.insuranceSpot.z);
    ctx.beginPath();
    ctx.arc(insuranceX, insuranceZ, 0.42 * unit, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.stroke();

    // Cercle de mise du joueur.
    const [betX, betZ] = toPx(marks.betSpot.x, marks.betSpot.z);
    ctx.beginPath();
    ctx.arc(betX, betZ, 0.62 * unit, 0, Math.PI * 2);
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(betX, betZ, 0.52 * unit, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.stroke();

    return toTexture(canvas, renderer);
  }

  /* Tranche d'une pile de cartes : fines lignes crème et ombrées, répétées sur la hauteur. */
  function createCardEdge() {
    const { canvas, ctx } = createCanvas(16, 64);
    for (let y = 0; y < 64; y += 4) {
      ctx.fillStyle = '#ece2c8';
      ctx.fillRect(0, y, 16, 3);
      ctx.fillStyle = '#a8967a';
      ctx.fillRect(0, y + 3, 16, 1);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 10);
    return texture;
  }

  root.DragonJack.textures = {
    palette,
    CHIP_VALUES: Object.keys(CHIP_STYLES).map(Number),
    createCardBack,
    createCardFace,
    createChipTop,
    createChipSide,
    createFelt,
    createCardEdge,
  };
})(window);
