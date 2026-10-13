/*
 * Cartes de la table à plusieurs : chaque place a son coin de tapis, ses mains côte à côte après une séparation.
 * L'affichage suit un « instantané » de la donne : les nouvelles cartes partent du sabot une à une,
 * celles qui changent de place glissent, et à la fin de la donne tout part à la défausse.
 */
(function (root) {
  'use strict';

  const THREE = root.THREE;
  const { tween } = root.DragonJack.tween;
  const textures = root.DragonJack.textures;
  const LAYOUT = root.DragonJack.LAYOUT;

  const CARD_SIZE = { width: 1, thickness: 0.012, depth: 1.4 };
  const CARD_LIFT = 0.006;
  const DEAL_STAGGER = 0.28;
  // Écart entre les places selon leur nombre, pour rester sur le tapis (plus serré sur un écran étroit).
  const SEAT_SPACING = { 1: 0, 2: 3.4, 3: 3, 4: 2.45 };
  const NARROW_SEAT_SPACING = { 1: 0, 2: 2.4, 3: 1.95, 4: 1.55 };
  const NARROW_SCREEN = 600;
  const HAND_SPACING = 0.95;
  const CARD_SPACING = { single: 0.36, split: 0.24 };
  // Étiquettes devant les cartes, un peu plus près d'elles sur un écran étroit (la barre du bas y prend plus de place).
  const LABEL_Z = { wide: 3.15, narrow: 2.85 };

  // Écran étroit : téléphone, ou tablette tenue en portrait.
  const isNarrow = () => root.innerWidth < NARROW_SCREEN || root.innerWidth < root.innerHeight;

  function createPartyPieces({ scene, renderer, audio }) {
    const backMaterial = new THREE.MeshStandardMaterial({ map: textures.createCardBack(renderer), roughness: 0.55 });
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: '#d8c9a8', roughness: 0.7 });
    const cardGeometry = new THREE.BoxGeometry(CARD_SIZE.width, CARD_SIZE.thickness, CARD_SIZE.depth);
    const faceMaterials = new Map();
    const meshes = new Map();
    let seatCount = 1;
    let round = null;

    const shoePoint = new THREE.Vector3(LAYOUT.shoe.x, 1.2, LAYOUT.shoe.z);
    const discardPoint = new THREE.Vector3(LAYOUT.discard.x, 0.4, LAYOUT.discard.z);

    function faceMaterial(card) {
      const key = card.rank + card.suit;
      if (!faceMaterials.has(key)) {
        faceMaterials.set(key, new THREE.MeshStandardMaterial({ map: textures.createCardFace(card, renderer), roughness: 0.55 }));
      }
      return faceMaterials.get(key);
    }

    function seatX(seatIndex) {
      return (seatIndex - (seatCount - 1) / 2) * (isNarrow() ? NARROW_SEAT_SPACING : SEAT_SPACING)[seatCount];
    }

    function slot(seatIndex, handIndex, handCount, cardIndex, cardCount) {
      if (seatIndex < 0) {
        return new THREE.Vector3((cardIndex - (cardCount - 1) / 2) * LAYOUT.cardSpacing, 0.02 + cardIndex * CARD_LIFT, LAYOUT.dealerCards.z);
      }
      const spacing = handCount > 1 || (isNarrow() && seatCount > 2) ? CARD_SPACING.split : CARD_SPACING.single;
      const handX = seatX(seatIndex) + (handIndex - (handCount - 1) / 2) * HAND_SPACING;
      return new THREE.Vector3(handX + (cardIndex - (cardCount - 1) / 2) * spacing, 0.02 + cardIndex * CARD_LIFT, LAYOUT.playerCards.z + cardIndex * 0.05);
    }

    function moveTo(mesh, to, duration = 0.35) {
      const from = mesh.position.clone();
      return tween({ duration, ease: 'outCubic', onUpdate: (k) => mesh.position.lerpVectors(from, to, k) });
    }

    /* Une carte sort du sabot, se retourne et vient se poser à sa place. */
    function dealIn(card, to, delay) {
      const materials = [edgeMaterial, edgeMaterial, faceMaterial(card), backMaterial, edgeMaterial, edgeMaterial];
      const mesh = new THREE.Mesh(cardGeometry, materials);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.copy(shoePoint);
      mesh.rotation.set(0, LAYOUT.shoe.yaw, Math.PI);
      mesh.visible = false;
      scene.add(mesh);
      const startYaw = mesh.rotation.y;
      const endYaw = (Math.random() - 0.5) * 0.06;
      tween({
        duration: 0.45,
        delay,
        ease: 'outCubic',
        onUpdate: (k) => {
          if (!mesh.visible) {
            mesh.visible = true;
            audio.play('card');
          }
          mesh.position.lerpVectors(shoePoint, to, k);
          mesh.position.y += Math.sin(k * Math.PI) * 0.6;
          mesh.rotation.y = startYaw + (endYaw - startYaw) * k;
          mesh.rotation.z = Math.PI * (1 - k);
        },
      });
      return mesh;
    }

    function sweep() {
      [...meshes.values()].forEach((mesh, index) => {
        const from = mesh.position.clone();
        tween({
          duration: 0.45,
          delay: index * 0.03,
          onUpdate: (k) => {
            mesh.position.lerpVectors(from, discardPoint, k);
            mesh.rotation.z = Math.PI * k;
          },
        }).then(() => scene.remove(mesh));
      });
      meshes.clear();
    }

    /*
     * Met la table en accord avec l'instantané. Chaque carte est repérée par sa place, sa main
     * et son rang dans la main ; une séparation déplace donc la seconde carte vers la nouvelle main.
     */
    function render(snapshot) {
      seatCount = snapshot.seats.length;
      const wanted = new Map();
      snapshot.seats.forEach((seat, seatIndex) => {
        seat.hands.forEach((hand, handIndex) => {
          hand.cards.forEach((card, cardIndex) => {
            wanted.set(`${seatIndex}:${handIndex}:${cardIndex}`, { card, to: slot(seatIndex, handIndex, seat.hands.length, cardIndex, hand.cards.length) });
          });
        });
      });
      snapshot.dealer.forEach((card, cardIndex) => {
        wanted.set(`d:${cardIndex}`, { card, to: slot(-1, 0, 1, cardIndex, snapshot.dealer.length) });
      });

      // Nouvelle donne : les cartes de la précédente partent d'abord à la défausse.
      if (snapshot.round !== round || wanted.size === 0) sweep();
      round = snapshot.round;

      // Après une séparation, la carte qui change de main garde son objet 3D.
      [...meshes.entries()].forEach(([key, mesh]) => {
        const target = wanted.get(key);
        if (target && target.card.rank === mesh.userData.card.rank && target.card.suit === mesh.userData.card.suit) return;
        const match = [...wanted.entries()].find(
          ([otherKey, { card }]) => !meshes.has(otherKey) && card.rank === mesh.userData.card.rank && card.suit === mesh.userData.card.suit,
        );
        meshes.delete(key);
        if (match) meshes.set(match[0], mesh);
        else scene.remove(mesh);
      });

      let order = 0;
      wanted.forEach(({ card, to }, key) => {
        const mesh = meshes.get(key);
        if (mesh) {
          moveTo(mesh, to);
          return;
        }
        const created = dealIn(card, to, order * DEAL_STAGGER);
        created.userData.card = card;
        meshes.set(key, created);
        order += 1;
      });
      return order * DEAL_STAGGER;
    }

    return {
      render,
      clear: sweep,
      seatAnchor: (seatIndex) => new THREE.Vector3(seatX(seatIndex), 0, isNarrow() ? LABEL_Z.narrow : LABEL_Z.wide),
      seatCards: (seatIndex) => new THREE.Vector3(seatX(seatIndex), 0, LAYOUT.playerCards.z),
      dealerAnchor: () => new THREE.Vector3(-2.3, 0, LAYOUT.dealerCards.z),
    };
  }

  root.DragonJack.createPartyPieces = createPartyPieces;
})(window);
