/*
 * Le vol du trésor : relie les règles (heist.js), le dragon endormi, les trésors 3D et l'interface.
 */
(function (root) {
  'use strict';

  const DJ = root.DragonJack;
  const THREE = root.THREE;
  const heist = DJ.heist;
  const kit = DJ.hudKit;
  const $ = (id) => document.getElementById(id);

  // Un vol réussi de justesse fait remuer le dragon (pure mise en scène, sans effet sur les chances).
  const NEAR_MISS_MARGIN = 0.12;
  const MOUNDS = [
    { x: 0, z: -9, radius: 6, height: 3 },
    { x: -8, z: -8, radius: 4.6, height: 2.4 },
    { x: 8, z: -8.5, radius: 4.8, height: 2.6 },
    { x: -10.5, z: 0, radius: 3.6, height: 1.4 },
    { x: 10.5, z: 0, radius: 3.6, height: 1.3 },
    ...DJ.LOOT_PILES,
  ];
  const CAMERA = {
    target: new THREE.Vector3(0, -0.2, -1.6),
    direction: new THREE.Vector3(0, 5.5, 9),
    baseDistance: 14,
    visibleHalfWidth: { landscape: 6.6, portrait: 5.2 },
    introOffset: new THREE.Vector3(0, 2, 8),
  };
  // Pendant le vol, la caméra s'approche à pas de loup.
  // Visée un peu en avant : la rangée de trésors du devant reste au-dessus de la barre de commandes.
  const SNEAK_FRAMING = { target: new THREE.Vector3(0, -0.5, -0.6), visibleHalfWidth: { landscape: 6.2, portrait: 5 } };
  const REST_FRAMING = { target: CAMERA.target, visibleHalfWidth: CAMERA.visibleHalfWidth };

  function randomRoll() {
    const buffer = new Uint32Array(1);
    root.crypto.getRandomValues(buffer);
    return buffer[0] / 2 ** 32;
  }

  async function init() {
    if (!DJ.boot.hasWebGL()) {
      DJ.boot.showFallback(DJ.boot.MESSAGES.noWebGL);
      return;
    }
    await DJ.boot.loadFonts();

    const audio = DJ.createAudio();
    const notify = kit.createNotifier($('toast'));
    const result = kit.createResultPanel($('result'));
    const { stage, scene, particles, dragon } = DJ.createLairScene({
      container: $('stage'),
      camera: CAMERA,
      mounds: MOUNDS,
      // Le dragon dort au ras du trésor, la tête posée juste derrière les objets.
      dragonPosition: new THREE.Vector3(0, -1.2, -1.5),
      dragonScale: 1.15,
      keyLightTarget: new THREE.Vector3(0, -1, 0.5),
    });
    const loot = DJ.createLoot({ scene, particles });
    stage.onFrame((dt, time) => loot.update(dt, time));
    dragon.sleep();

    const state = { phase: 'bet', bet: 0, stolen: 0, busy: false };
    let picker = null;
    const wallet = kit.createWallet({
      balanceElement: $('balance'),
      restoreButton: $('restore'),
      minBet: heist.BETS[0],
      notify,
      onChange: (balance) => {
        if (picker) picker.update(balance, state.phase !== 'bet');
        $('sneak').disabled = balance < heist.BETS[0];
      },
    });
    picker = kit.createBetPicker({ container: $('bet-picker'), values: heist.BETS });
    picker.update(wallet.balance());

    function renderHeist() {
      const betting = state.phase === 'bet';
      $('bet-panel').hidden = !betting;
      $('heist-panel').hidden = state.phase !== 'heist';
      $('loot-amount').textContent = kit.formatCoins(heist.payout(state.bet, state.stolen));
      $('loot-multiplier').textContent = `×${kit.numberFormat.format(heist.multiplier(state.stolen))}`;
      const risk = heist.wakeRisk(state.stolen);
      $('risk-value').textContent = `${risk} %`;
      $('risk-fill').style.width = `${risk}%`;
      $('steal').disabled = state.busy;
      $('flee').disabled = state.busy;
      $('flee').firstChild.textContent = state.stolen === 0 ? 'Renoncer ' : 'S’enfuir ';
      picker.update(wallet.balance(), !betting);
    }

    /* Point juste devant la caméra, en bas de l'écran : c'est là que filent les trésors volés. */
    function pocketPosition() {
      const forward = new THREE.Vector3();
      stage.camera.getWorldDirection(forward);
      return stage.camera.position.clone().addScaledVector(forward, 3).add(new THREE.Vector3(0, -1.4, 0));
    }

    function sneak() {
      if (state.phase !== 'bet') return;
      audio.start();
      const bet = picker.value();
      if (!wallet.canAfford(bet)) {
        notify('Ton trésor est trop maigre pour cette mise.');
        return;
      }
      wallet.spend(bet);
      Object.assign(state, { phase: 'heist', bet, stolen: 0 });
      result.hide();
      stage.frame(SNEAK_FRAMING);
      notify('Chut… Le dragon dort. Clique sur un trésor qui brille.');
      renderHeist();
    }

    async function endRound() {
      await DJ.tween.wait(1.2);
      stage.frame(REST_FRAMING);
      loot.restore();
      Object.assign(state, { phase: 'bet', bet: 0, stolen: 0, busy: false });
      renderHeist();
    }

    async function caught() {
      state.phase = 'caught';
      renderHeist();
      audio.play('roar');
      await dragon.wake();
      dragon.lookAt(stage.camera.position.clone().add(new THREE.Vector3(0, -1.5, 0)));
      await dragon.breatheFire(() => stage.shake(0.45));
      result.show({ heading: 'Le dragon t’a surpris !', detail: `Il garde ta mise de ${kit.formatCoins(state.bet)}`, tone: 'lose' });
      await dragon.rest();
      await dragon.sleep();
      await endRound();
    }

    async function flee() {
      if (state.phase !== 'heist' || state.busy) return;
      state.busy = true;
      state.phase = 'fled';
      const winnings = heist.payout(state.bet, state.stolen);
      wallet.earn(winnings);
      renderHeist();
      if (state.stolen === 0) {
        result.show({ heading: 'Tu renonces', detail: 'Ta mise te revient', tone: 'push' });
      } else {
        audio.play('treasure');
        result.show({ heading: 'Tu t’enfuis avec le butin', detail: `+ ${kit.formatCoins(winnings - state.bet)}`, tone: 'win' });
      }
      await endRound();
    }

    async function steal(item) {
      if (state.phase !== 'heist' || state.busy) return;
      const target = item || loot.items.find((candidate) => !candidate.taken);
      if (!target || target.taken) return;
      audio.start();
      state.busy = true;
      renderHeist();

      const roll = randomRoll();
      const survival = 1 - heist.wakeRisk(state.stolen) / 100;
      const success = heist.attemptSteal(state.stolen, roll);
      audio.play('coins');
      await loot.take(target, pocketPosition());
      if (!success) {
        await caught();
        return;
      }
      state.stolen += 1;
      if (survival - roll < NEAR_MISS_MARGIN) {
        audio.play('grumble');
        notify('Le dragon remue dans son sommeil…');
        await dragon.stir();
      }
      state.busy = false;
      renderHeist();
      if (state.stolen >= heist.MAX_STEALS) {
        notify('Plus rien à voler : file avant qu’il ne s’éveille !');
        await flee();
      }
    }

    // Choisir un trésor directement dans la scène.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    stage.renderer.domElement.addEventListener('click', (event) => {
      if (state.phase !== 'heist') return;
      const rect = stage.renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, stage.camera);
      const hit = raycaster.intersectObjects(loot.hitboxes, false)[0];
      if (hit) steal(loot.items[loot.hitboxes.indexOf(hit.object)]);
    });
    stage.renderer.domElement.addEventListener('pointermove', (event) => {
      if (state.phase !== 'heist') return;
      const rect = stage.renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, stage.camera);
      const hit = raycaster.intersectObjects(loot.hitboxes, false)[0];
      const available = hit && !loot.items[loot.hitboxes.indexOf(hit.object)].taken;
      stage.renderer.domElement.style.cursor = available ? 'pointer' : '';
    });

    $('sneak').addEventListener('click', sneak);
    $('steal').addEventListener('click', () => steal());
    $('flee').addEventListener('click', flee);
    kit.bindSoundToggle($('sound-toggle'), audio);
    kit.bindDialog($('rules'), $('rules-open'), $('rules-close'));
    kit.bindShortcuts({ enter: sneak, v: () => steal(), f: flee });

    renderHeist();
    stage.flyIn();
  }

  init().catch((error) => {
    console.error(error);
    DJ.boot.showFallback(DJ.boot.MESSAGES.loadError);
  });
})(window);
