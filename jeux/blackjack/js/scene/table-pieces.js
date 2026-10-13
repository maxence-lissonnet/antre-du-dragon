/*
 * Cartes et jetons posés sur la table : distribution, séparation des mains, mises, assurance et paiements.
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;
  const { tween, wait } = root.DragonJack.tween;
  const textures = root.DragonJack.textures;
  const LAYOUT = root.DragonJack.LAYOUT;

  const CARD_SIZE = { width: 1, thickness: 0.012, depth: 1.4 };
  const CARD_LIFT = 0.006;
  const CHIP_HEIGHT = 0.08;
  const CHIP_RADIUS = 0.33;
  const PLAYER_SIDE = new THREE.Vector3(0, 2.2, 7.5);
  const DRAGON_SIDE = new THREE.Vector3(0, 0.6, -3.4);
  const PAYOUT_OFFSET_X = 0.75;
  const HAND_LABEL_OFFSET_X = 2.3;
  // Écart maximal entre la première et la dernière main, pour rester sur le tapis.
  const MAX_HANDS_SPREAD = 7.4;
  const HAND_SPACING = 2.6;
  const SPLIT_CARD_SPACING = 0.4;
  const CHIP_VALUES_DESC = textures.CHIP_VALUES.slice().sort((a, b) => b - a);
  // Épaisseur d'une carte dans une pile : 8 jeux (416 cartes) font un peu plus d'une unité de haut.
  const CARD_STACK_THICKNESS = 0.0026;
  const HOLDER = { width: 1.3, depth: 1.7, wallHeight: 1.25, floor: 0.06 };
  const LOOSE_STACK_BASE = 0.005;
  const SHUFFLE_SPREAD_X = 1.1;
  const RIFFLE_ROUNDS = 3;
  const CARDS_PER_RIFFLE = 14;
  const CUT_CARD_SLIDE = 1.4;
  const BURN_SPARKS = 12;

  function createTablePieces({ scene, renderer, audio, particles }) {
    const backMaterial = new THREE.MeshStandardMaterial({ map: textures.createCardBack(renderer), roughness: 0.55 });
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: '#d8c9a8', roughness: 0.7 });
    const cardGeometry = new THREE.BoxGeometry(CARD_SIZE.width, CARD_SIZE.thickness, CARD_SIZE.depth);
    const faceMaterials = new Map();

    const chipGeometry = new THREE.CylinderGeometry(CHIP_RADIUS, CHIP_RADIUS, CHIP_HEIGHT, 36);
    const chipMaterials = new Map(
      textures.CHIP_VALUES.map((value) => [
        value,
        [
          new THREE.MeshStandardMaterial({ map: textures.createChipSide(value, renderer), roughness: 0.5 }),
          new THREE.MeshStandardMaterial({ map: textures.createChipTop(value, renderer), roughness: 0.45 }),
          new THREE.MeshStandardMaterial({ map: textures.createChipTop(value, renderer), roughness: 0.45 }),
        ],
      ]),
    );

    // Une liste de cartes par main du joueur, et une liste de jetons par main.
    let playerHands = [[]];
    let handChips = [[]];
    let dealerCards = [];
    let payoutChips = [];
    let insuranceChips = [];

    // Sabot et défausse : un support en bois et une pile de cartes dont la hauteur suit le nombre de cartes.
    const edgeTexture = textures.createCardEdge();
    const edgeStackMaterial = new THREE.MeshStandardMaterial({ map: edgeTexture, roughness: 0.8 });
    const stackMaterials = [edgeStackMaterial, edgeStackMaterial, backMaterial, backMaterial, edgeStackMaterial, edgeStackMaterial];
    const stackGeometry = new THREE.BoxGeometry(CARD_SIZE.width, 1, CARD_SIZE.depth);

    function createStack() {
      const stack = new THREE.Mesh(stackGeometry, stackMaterials);
      stack.castShadow = true;
      stack.receiveShadow = true;
      return stack;
    }

    function setStackCount(stack, count, baseY) {
      const height = Math.max(count * CARD_STACK_THICKNESS, 0.001);
      stack.visible = count > 0;
      stack.scale.y = height;
      stack.position.y = baseY + height / 2;
      stack.userData.count = count;
    }

    function buildHolder({ x, z, yaw }) {
      const holder = new THREE.Group();
      holder.position.set(x, 0, z);
      holder.rotation.y = yaw;
      const wood = new THREE.MeshStandardMaterial({ color: '#2a1c16', roughness: 0.6, metalness: 0.15 });
      const gold = new THREE.MeshStandardMaterial({ color: '#c8932e', roughness: 0.35, metalness: 0.85 });
      const { width, depth, wallHeight, floor } = HOLDER;
      // [largeur, hauteur, profondeur, x, y, z, matière]
      const parts = [
        [width, floor, depth, 0, floor / 2, 0, wood],
        [0.06, wallHeight, depth, -width / 2, wallHeight / 2, 0, wood],
        [0.06, wallHeight, depth, width / 2, wallHeight / 2, 0, wood],
        [width, wallHeight, 0.06, 0, wallHeight / 2, -depth / 2, wood],
        [0.1, 0.04, depth + 0.06, -width / 2, wallHeight, 0, gold],
        [0.1, 0.04, depth + 0.06, width / 2, wallHeight, 0, gold],
      ];
      parts.forEach(([w, h, d, px, py, pz, material]) => {
        const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        part.position.set(px, py, pz);
        part.castShadow = true;
        part.receiveShadow = true;
        holder.add(part);
      });
      const stack = createStack();
      holder.add(stack);
      setStackCount(stack, 0, floor);
      scene.add(holder);
      return { holder, stack };
    }

    const shoe = buildHolder(LAYOUT.shoe);
    const discard = buildHolder(LAYOUT.discard);
    const cutCard = new THREE.Mesh(
      new THREE.BoxGeometry(CARD_SIZE.width + 0.1, 0.012, CARD_SIZE.depth + 0.08),
      new THREE.MeshStandardMaterial({ color: '#c42a1e', roughness: 0.4 }),
    );
    cutCard.visible = false;
    shoe.holder.add(cutCard);

    /* Point du monde juste au-dessus d'une pile (pour y prendre ou y poser une carte). */
    function stackTop({ holder, stack }, extra = 0) {
      const top = new THREE.Vector3(0, HOLDER.floor + stack.userData.count * CARD_STACK_THICKNESS + 0.02 + extra, 0);
      return holder.localToWorld(top);
    }

    function faceMaterial(card) {
      const key = card.rank + card.suit;
      if (!faceMaterials.has(key)) {
        faceMaterials.set(key, new THREE.MeshStandardMaterial({ map: textures.createCardFace(card, renderer), roughness: 0.55 }));
      }
      return faceMaterials.get(key);
    }

    function createCardMesh(card) {
      // Ordre des faces d'une boîte : +x, -x, dessus, dessous, +z, -z.
      const materials = [edgeMaterial, edgeMaterial, faceMaterial(card), backMaterial, edgeMaterial, edgeMaterial];
      const mesh = new THREE.Mesh(cardGeometry, materials);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }

    function createChip(value) {
      const chip = new THREE.Mesh(chipGeometry, chipMaterials.get(value));
      chip.userData.value = value;
      chip.castShadow = true;
      chip.receiveShadow = true;
      return chip;
    }

    function handCenterX(handIndex) {
      const count = playerHands.length;
      if (count === 1) return 0;
      const spacing = Math.min(HAND_SPACING, MAX_HANDS_SPREAD / (count - 1));
      return (handIndex - (count - 1) / 2) * spacing;
    }

    function cardSlot(owner, handIndex, index, count) {
      const isPlayer = owner === 'player';
      const spacing = isPlayer && playerHands.length > 1 ? SPLIT_CARD_SPACING : LAYOUT.cardSpacing;
      const centerX = isPlayer ? handCenterX(handIndex) : 0;
      const z = isPlayer ? LAYOUT.playerCards.z : LAYOUT.dealerCards.z;
      return new THREE.Vector3(centerX + (index - (count - 1) / 2) * spacing, 0.02 + index * CARD_LIFT, z);
    }

    function stackPosition(handIndex, index, offsetX = 0) {
      return new THREE.Vector3(
        handCenterX(handIndex) + offsetX,
        CHIP_HEIGHT / 2 + 0.005 + index * CHIP_HEIGHT,
        LAYOUT.betSpot.z,
      );
    }

    function moveTo(object, to, { duration = 0.35, delay = 0, hop = 0 } = {}) {
      const from = object.position.clone();
      return tween({
        duration,
        delay,
        ease: 'outCubic',
        onUpdate: (k) => {
          object.position.lerpVectors(from, to, k);
          object.position.y += Math.sin(k * Math.PI) * hop;
        },
      });
    }

    /* Replace toutes les cartes et tous les jetons du joueur (après une séparation ou une nouvelle carte). */
    function relayoutPlayer(except) {
      const moves = [];
      playerHands.forEach((cards, handIndex) => {
        cards.forEach((mesh, index) => {
          if (mesh !== except) moves.push(moveTo(mesh, cardSlot('player', handIndex, index, cards.length), { duration: 0.35 }));
        });
      });
      handChips.forEach((chips, handIndex) => {
        chips.forEach((chip, index) => moves.push(moveTo(chip, stackPosition(handIndex, index), { duration: 0.35 })));
      });
      return Promise.all(moves);
    }

    async function dealCard(card, owner, handIndex) {
      const mesh = createCardMesh(card);
      mesh.position.copy(stackTop(shoe, 0.05));
      mesh.rotation.set(0, LAYOUT.shoe.yaw, Math.PI);
      scene.add(mesh);

      const cards = owner === 'player' ? playerHands[handIndex] : dealerCards;
      cards.push(mesh);
      if (owner === 'player') {
        relayoutPlayer(mesh);
      } else {
        cards.forEach((other, index) => {
          if (other !== mesh) moveTo(other, cardSlot('dealer', 0, index, cards.length), { duration: 0.3 });
        });
      }

      const from = mesh.position.clone();
      const to = cardSlot(owner, handIndex, cards.length - 1, cards.length);
      const startYaw = mesh.rotation.y;
      const endYaw = (Math.random() - 0.5) * 0.06;
      audio.play('card');
      await tween({
        duration: 0.5,
        ease: 'outCubic',
        onUpdate: (k) => {
          mesh.position.lerpVectors(from, to, k);
          mesh.position.y += Math.sin(k * Math.PI) * 0.6;
          mesh.rotation.y = startYaw + (endYaw - startYaw) * k;
          mesh.rotation.z = Math.PI * (1 - k);
        },
      });
    }

    /* Sépare une paire : la seconde carte part former une nouvelle main, avec une mise identique. */
    async function splitHand(handIndex, chipValues) {
      const moved = playerHands[handIndex].pop();
      playerHands.splice(handIndex + 1, 0, [moved]);
      const newChips = chipValues.map((value) => {
        const chip = createChip(value);
        chip.position.copy(PLAYER_SIDE);
        scene.add(chip);
        return chip;
      });
      handChips.splice(handIndex + 1, 0, newChips);
      audio.play('chip');
      await relayoutPlayer();
    }

    async function collectCards() {
      const all = [...playerHands.flat(), ...dealerCards];
      await Promise.all(all.map((mesh, index) => sendToDiscard(mesh, index * 0.05)));
      playerHands = [[]];
      handChips = [[]];
      dealerCards = [];
    }

    /* Une carte rejoint la défausse, face cachée, et la pile grandit d'une carte. */
    function sendToDiscard(mesh, delay = 0) {
      const from = mesh.position.clone();
      const startFlip = mesh.rotation.z;
      const startYaw = mesh.rotation.y;
      return tween({
        duration: 0.45,
        delay,
        onUpdate: (k) => {
          mesh.position.lerpVectors(from, stackTop(discard), k);
          mesh.position.y += Math.sin(k * Math.PI) * 0.5;
          mesh.rotation.z = startFlip + (Math.PI - startFlip) * k;
          mesh.rotation.y = startYaw + (LAYOUT.discard.yaw - startYaw) * k;
        },
      }).then(() => {
        scene.remove(mesh);
        setStackCount(discard.stack, discard.stack.userData.count + 1, HOLDER.floor);
      });
    }

    function shoeChanged(count) {
      setStackCount(shoe.stack, count, HOLDER.floor);
    }

    /* La carte de coupe sort du sabot et se pose à côté. */
    function cutCardOut() {
      const from = cutCard.position.clone();
      const to = new THREE.Vector3(0, 0.01, HOLDER.depth / 2 + 0.9);
      tween({
        duration: 0.6,
        onUpdate: (k) => {
          cutCard.position.lerpVectors(from, to, k);
          cutCard.position.y += Math.sin(k * Math.PI) * 0.4;
        },
      });
    }

    /* Pile temporaire posée sur le tapis, utilisée pendant le mélange. */
    function createLooseStack(count, position, yaw) {
      const stack = createStack();
      stack.position.copy(position);
      stack.rotation.y = yaw;
      setStackCount(stack, count, LOOSE_STACK_BASE);
      scene.add(stack);
      return stack;
    }

    function animateStack(stack, { to, yaw, count, duration, hop = 0 }) {
      const fromX = stack.position.x;
      const fromZ = stack.position.z;
      const fromYaw = stack.rotation.y;
      const fromCount = stack.userData.count;
      return tween({
        duration,
        onUpdate: (k) => {
          setStackCount(stack, Math.round(fromCount + (count - fromCount) * k), LOOSE_STACK_BASE);
          stack.position.x = fromX + (to.x - fromX) * k;
          stack.position.z = fromZ + (to.z - fromZ) * k;
          stack.position.y += Math.sin(k * Math.PI) * hop;
          if (yaw !== undefined) stack.rotation.y = fromYaw + (yaw - fromYaw) * k;
        },
      });
    }

    function createLooseCard() {
      const card = new THREE.Mesh(cardGeometry, [edgeMaterial, edgeMaterial, backMaterial, backMaterial, edgeMaterial, edgeMaterial]);
      card.castShadow = true;
      scene.add(card);
      return card;
    }

    /* Une carte vole du dessus d'une demi-pile vers la pile mélangée (effet de « riffle »). */
    function riffleCard(from, to, delay) {
      const card = createLooseCard();
      card.position.copy(from);
      return tween({
        duration: 0.22,
        delay,
        onUpdate: (k) => {
          card.position.lerpVectors(from, to, k);
          card.position.y += Math.sin(k * Math.PI) * 0.35;
          card.rotation.x = Math.sin(k * Math.PI) * 0.5;
        },
      }).then(() => scene.remove(card));
    }

    const topOf = (stack) => stack.position.clone().setY(stack.position.y + stack.scale.y / 2 + 0.02);

    /*
     * Mélange : la défausse et le reste du sabot reviennent sur le tapis en deux demi-piles,
     * le dragon les entrelace trois fois, puis la pile retourne dans le sabot avec la carte de coupe.
     */
    async function shuffleShoe(total, cutRemaining) {
      const half = Math.round(total / 2);
      const left = new THREE.Vector3(-SHUFFLE_SPREAD_X, 0, LAYOUT.shuffleZ);
      const right = new THREE.Vector3(SHUFFLE_SPREAD_X, 0, LAYOUT.shuffleZ);
      const center = new THREE.Vector3(0, 0, LAYOUT.shuffleZ);
      const sources = [discard, shoe].map(({ holder, stack }) => ({
        count: stack.userData.count,
        position: holder.position.clone(),
        yaw: holder.rotation.y,
      }));
      setStackCount(discard.stack, 0, HOLDER.floor);
      setStackCount(shoe.stack, 0, HOLDER.floor);
      cutCard.visible = false;

      // Au premier mélange, sabot et défausse sont vides : les 8 jeux neufs apparaissent sur le tapis.
      const fresh = sources.every((source) => source.count === 0);
      const targets = [left, right];
      const halves = sources.map((source, index) =>
        createLooseStack(fresh ? 0 : source.count, fresh ? targets[index] : source.position, fresh ? 0 : source.yaw),
      );
      await Promise.all([
        animateStack(halves[0], { to: left, yaw: 0, count: half, duration: 0.7, hop: fresh ? 0 : 0.6 }),
        animateStack(halves[1], { to: right, yaw: 0, count: total - half, duration: 0.7, hop: fresh ? 0 : 0.6 }),
      ]);

      const merged = createLooseStack(0, center, 0);
      for (let round = 1; round <= RIFFLE_ROUNDS; round += 1) {
        audio.play('riffle');
        const moves = [];
        for (let i = 0; i < CARDS_PER_RIFFLE; i += 1) {
          moves.push(riffleCard(topOf(halves[i % 2]), topOf(merged), i * 0.04));
        }
        const remaining = 1 - round / RIFFLE_ROUNDS;
        moves.push(animateStack(halves[0], { to: left, count: Math.round(half * remaining), duration: 0.75 }));
        moves.push(animateStack(halves[1], { to: right, count: Math.round((total - half) * remaining), duration: 0.75 }));
        moves.push(animateStack(merged, { to: center, count: Math.round((total * round) / RIFFLE_ROUNDS), duration: 0.75 }));
        await Promise.all(moves);
      }
      halves.forEach((stack) => scene.remove(stack));

      await animateStack(merged, { to: shoe.holder.position, yaw: LAYOUT.shoe.yaw, count: total, duration: 0.8, hop: 1.2 });
      scene.remove(merged);
      setStackCount(shoe.stack, total, HOLDER.floor);

      // La carte de coupe glisse dans la pile, à sa place.
      const cutY = HOLDER.floor + cutRemaining * CARD_STACK_THICKNESS;
      cutCard.position.set(CUT_CARD_SLIDE, cutY, 0);
      cutCard.visible = true;
      await tween({
        duration: 0.5,
        ease: 'outCubic',
        onUpdate: (k) => {
          cutCard.position.x = CUT_CARD_SLIDE * (1 - k);
        },
      });
    }

    /* Les 5 premières cartes du sabot partent à la défausse, dans une petite gerbe d'étincelles. */
    async function burnCards(count) {
      for (let i = 0; i < count; i += 1) {
        const card = createLooseCard();
        card.position.copy(stackTop(shoe, 0.05));
        card.rotation.y = LAYOUT.shoe.yaw;
        setStackCount(shoe.stack, shoe.stack.userData.count - 1, HOLDER.floor);
        audio.play('card');
        await sendToDiscard(card);
        const spot = stackTop(discard);
        for (let p = 0; p < BURN_SPARKS; p += 1) {
          particles.emit({
            position: spot,
            velocity: { x: (Math.random() - 0.5) * 1.5, y: 1 + Math.random() * 1.5, z: (Math.random() - 0.5) * 1.5 },
            life: 0.5 + Math.random() * 0.4,
            size: 0.35,
            endSize: 0.1,
            buoyancy: 1,
          });
        }
      }
    }

    function placeChip(value, handIndex, index) {
      const chip = createChip(value);
      chip.position.copy(PLAYER_SIDE);
      scene.add(chip);
      handChips[handIndex].push(chip);
      moveTo(chip, stackPosition(handIndex, index), { duration: 0.4, hop: 0.5 }).then(() => audio.play('chip'));
    }

    function sweepAway(chips, destination) {
      return Promise.all(
        chips.map((chip, index) =>
          moveTo(chip, destination.clone().add(new THREE.Vector3(0, index * 0.02, 0)), {
            duration: 0.5,
            delay: index * 0.03,
            hop: 0.5,
          }).then(() => scene.remove(chip)),
        ),
      );
    }

    function clearChips() {
      sweepAway(handChips[0], PLAYER_SIDE);
      handChips = [[]];
    }

    /* Décompose une somme en jetons, du plus gros au plus petit (au moins un jeton pour rester visible). */
    function toChipValues(amount) {
      const values = [];
      let rest = amount;
      CHIP_VALUES_DESC.forEach((value) => {
        while (rest >= value) {
          values.push(value);
          rest -= value;
        }
      });
      if (values.length === 0 && amount > 0) values.push(CHIP_VALUES_DESC[CHIP_VALUES_DESC.length - 1]);
      return values;
    }

    function flyFromDragon(values, positionOf) {
      return Promise.all(
        values.map((value, index) => {
          const chip = createChip(value);
          chip.position.copy(DRAGON_SIDE);
          scene.add(chip);
          payoutChips.push(chip);
          return moveTo(chip, positionOf(index), { duration: 0.45, delay: index * 0.06, hop: 0.5 });
        }),
      );
    }

    function insurancePosition(index) {
      return new THREE.Vector3(LAYOUT.insuranceSpot.x, CHIP_HEIGHT / 2 + 0.005 + index * CHIP_HEIGHT, LAYOUT.insuranceSpot.z);
    }

    function placeInsurance(amount) {
      toChipValues(amount).forEach((value, index) => {
        const chip = createChip(value);
        chip.position.copy(PLAYER_SIDE);
        scene.add(chip);
        insuranceChips.push(chip);
        moveTo(chip, insurancePosition(index), { duration: 0.45, delay: index * 0.05, hop: 0.6 }).then(() => audio.play('chip'));
      });
    }

    async function settleInsurance(won) {
      if (won) {
        const stacked = insuranceChips.length;
        // L'assurance paie 2 pour 1 : deux jetons du dragon pour chaque jeton misé.
        const values = insuranceChips.flatMap((chip) => [chip.userData.value, chip.userData.value]);
        await flyFromDragon(values, (index) => insurancePosition(stacked + index));
        audio.play('chip');
        await wait(0.3);
      }
      const winnings = payoutChips.splice(0);
      await sweepAway([...insuranceChips, ...winnings], won ? PLAYER_SIDE : DRAGON_SIDE);
      insuranceChips = [];
    }

    /* Paie ou ramasse chaque main : les gains arrivent à côté de la mise, puis tout repart. */
    async function settleHands(results) {
      const winningHands = results
        .map((result, handIndex) => ({ ...result, handIndex }))
        .filter(({ outcome }) => ['win', 'dealerBust', 'blackjack'].includes(outcome));
      if (winningHands.length > 0) {
        await Promise.all(
          winningHands.map(({ winnings, handIndex }) =>
            flyFromDragon(toChipValues(winnings), (index) => stackPosition(handIndex, index, PAYOUT_OFFSET_X)),
          ),
        );
        audio.play('chip');
        await wait(0.5);
      }
      const sweeps = results.map(({ outcome }, handIndex) => {
        const toPlayer = outcome !== 'lose' && outcome !== 'bust';
        return sweepAway(handChips[handIndex] || [], toPlayer ? PLAYER_SIDE : DRAGON_SIDE);
      });
      sweeps.push(sweepAway(payoutChips, PLAYER_SIDE));
      await Promise.all(sweeps);
      handChips = [[]];
      payoutChips = [];
    }

    // Réserve de jetons du dragon, au bord de la table.
    function buildDealerTray() {
      CHIP_VALUES_DESC.forEach((value, column) => {
        const height = 5 + ((column * 3) % 4);
        for (let i = 0; i < height; i += 1) {
          const chip = createChip(value);
          chip.castShadow = false;
          chip.position.set(-1.2 + column * 0.8, CHIP_HEIGHT / 2 + i * CHIP_HEIGHT, LAYOUT.dealerTrayZ);
          scene.add(chip);
        }
      });
    }
    buildDealerTray();

    /*
     * Point d'ancrage du total d'une main : à gauche quand il n'y a qu'une main,
     * au-dessus de chaque main après une séparation.
     */
    function handAnchor(owner, handIndex = 0) {
      if (owner === 'dealer') return new THREE.Vector3(-HAND_LABEL_OFFSET_X, 0, LAYOUT.dealerCards.z);
      if (playerHands.length === 1) return new THREE.Vector3(-HAND_LABEL_OFFSET_X, 0, LAYOUT.playerCards.z);
      return new THREE.Vector3(handCenterX(handIndex), 0, LAYOUT.playerCards.z - CARD_SIZE.depth / 2 - 0.3);
    }

    return {
      dealCard,
      splitHand,
      collectCards,
      placeChip,
      clearChips,
      placeInsurance,
      settleInsurance,
      settleHands,
      handAnchor,
      shoeChanged,
      cutCardOut,
      shuffleShoe,
      burnCards,
      shuffleCenter: () => new THREE.Vector3(0, 0, LAYOUT.shuffleZ),
      handCenter: (handIndex) => new THREE.Vector3(handCenterX(handIndex), 0, LAYOUT.playerCards.z),
      dealerCenter: () => new THREE.Vector3(0, 0, LAYOUT.dealerCards.z),
      betTarget: (handIndex) => new THREE.Vector3(handCenterX(handIndex), 0, LAYOUT.betSpot.z),
    };
  }

  root.DragonJack.createTablePieces = createTablePieces;
})(window);
