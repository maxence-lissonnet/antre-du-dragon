/*
 * Sons synthétisés avec la Web Audio API : aucun fichier audio à charger.
 * Le contexte audio ne démarre qu'après un premier clic (règle des navigateurs).
 */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'antre-du-dragon.muted';
  const MASTER_VOLUME = 0.55;

  function readMuted() {
    try {
      return root.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch (error) {
      return false;
    }
  }

  function createAudio() {
    let context = null;
    let master = null;
    let noiseBuffer = null;
    let muted = readMuted();

    function start() {
      if (context) return;
      const AudioContextClass = root.AudioContext || root.webkitAudioContext;
      if (!AudioContextClass) return;
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = muted ? 0 : MASTER_VOLUME;
      master.connect(context.destination);

      noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      startCrackle();
    }

    function noiseSource() {
      const source = context.createBufferSource();
      source.buffer = noiseBuffer;
      return source;
    }

    function envelope(gainNode, peak, attack, release, at = context.currentTime) {
      gainNode.gain.setValueAtTime(0.0001, at);
      gainNode.gain.exponentialRampToValueAtTime(peak, at + attack);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, at + attack + release);
    }

    /* Fond sonore : un grondement doux et des crépitements de braises. */
    function startCrackle() {
      const rumble = noiseSource();
      rumble.loop = true;
      const low = context.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = 180;
      const rumbleGain = context.createGain();
      rumbleGain.gain.value = 0.12;
      rumble.connect(low).connect(rumbleGain).connect(master);
      rumble.start();

      const pop = () => {
        if (!context) return;
        const click = noiseSource();
        const band = context.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = 1500 + Math.random() * 2500;
        const gain = context.createGain();
        envelope(gain, 0.05 + Math.random() * 0.06, 0.002, 0.04);
        click.connect(band).connect(gain).connect(master);
        click.start(context.currentTime, Math.random());
        click.stop(context.currentTime + 0.08);
        root.setTimeout(pop, 120 + Math.random() * 600);
      };
      pop();
    }

    const sounds = {
      card() {
        const source = noiseSource();
        const band = context.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = 3200;
        band.Q.value = 0.8;
        const gain = context.createGain();
        envelope(gain, 0.35, 0.005, 0.09);
        source.connect(band).connect(gain).connect(master);
        source.start(context.currentTime, Math.random());
        source.stop(context.currentTime + 0.12);
      },
      chip() {
        [2900, 4300].forEach((frequency, index) => {
          const osc = context.createOscillator();
          osc.frequency.value = frequency + Math.random() * 120;
          const gain = context.createGain();
          envelope(gain, 0.12, 0.002, 0.12, context.currentTime + index * 0.035);
          osc.connect(gain).connect(master);
          osc.start(context.currentTime + index * 0.035);
          osc.stop(context.currentTime + 0.25);
        });
      },
      roar() {
        const now = context.currentTime;
        const breath = noiseSource();
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(250, now);
        filter.frequency.exponentialRampToValueAtTime(1800, now + 0.4);
        filter.frequency.exponentialRampToValueAtTime(300, now + 1.7);
        const breathGain = context.createGain();
        envelope(breathGain, 0.9, 0.15, 1.6);
        breath.connect(filter).connect(breathGain).connect(master);
        breath.start(now);
        breath.stop(now + 2);

        const growl = context.createOscillator();
        growl.type = 'sawtooth';
        growl.frequency.setValueAtTime(60, now);
        growl.frequency.linearRampToValueAtTime(95, now + 0.4);
        growl.frequency.linearRampToValueAtTime(45, now + 1.4);
        const growlFilter = context.createBiquadFilter();
        growlFilter.type = 'lowpass';
        growlFilter.frequency.value = 500;
        const growlGain = context.createGain();
        envelope(growlGain, 0.35, 0.1, 1.3);
        growl.connect(growlFilter).connect(growlGain).connect(master);
        growl.start(now);
        growl.stop(now + 1.6);
      },
      grumble() {
        const now = context.currentTime;
        const growl = context.createOscillator();
        growl.type = 'sawtooth';
        growl.frequency.setValueAtTime(55, now);
        growl.frequency.linearRampToValueAtTime(40, now + 0.8);
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 320;
        const gain = context.createGain();
        envelope(gain, 0.3, 0.08, 0.8);
        growl.connect(filter).connect(gain).connect(master);
        growl.start(now);
        growl.stop(now + 1);
      },
      // Bruissement rapide des cartes qui s'entrelacent pendant le mélange.
      riffle() {
        for (let i = 0; i < 18; i += 1) {
          const at = context.currentTime + i * 0.035;
          const source = noiseSource();
          const band = context.createBiquadFilter();
          band.type = 'bandpass';
          band.frequency.value = 2600 + Math.random() * 1400;
          const gain = context.createGain();
          envelope(gain, 0.12, 0.002, 0.03, at);
          source.connect(band).connect(gain).connect(master);
          source.start(at, Math.random());
          source.stop(at + 0.06);
        }
      },
      // Cascade de pièces de la pluie d'or.
      coins() {
        for (let i = 0; i < 40; i += 1) {
          const at = context.currentTime + 0.4 + Math.random() * 2.2;
          const osc = context.createOscillator();
          osc.frequency.value = 2400 + Math.random() * 2600;
          const gain = context.createGain();
          envelope(gain, 0.05 + Math.random() * 0.05, 0.002, 0.15, at);
          osc.connect(gain).connect(master);
          osc.start(at);
          osc.stop(at + 0.2);
        }
      },
      // Explosion : souffle grave et bref.
      boom() {
        const now = context.currentTime;
        const blast = noiseSource();
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(900, now);
        filter.frequency.exponentialRampToValueAtTime(120, now + 0.6);
        const gain = context.createGain();
        envelope(gain, 0.7, 0.01, 0.7);
        blast.connect(filter).connect(gain).connect(master);
        blast.start(now, Math.random());
        blast.stop(now + 0.8);
      },
      // Fanfare du sacre : deux arpèges dorés qui montent.
      fanfare() {
        [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5, 1568].forEach((frequency, index) => {
          const at = context.currentTime + index * 0.14;
          const osc = context.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = frequency;
          const gain = context.createGain();
          envelope(gain, 0.2, 0.01, index === 7 ? 1.4 : 0.5, at);
          osc.connect(gain).connect(master);
          osc.start(at);
          osc.stop(at + 1.6);
        });
      },
      treasure() {
        [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
          const at = context.currentTime + index * 0.09;
          const osc = context.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = frequency;
          const gain = context.createGain();
          envelope(gain, 0.18, 0.01, 0.6, at);
          osc.connect(gain).connect(master);
          osc.start(at);
          osc.stop(at + 0.7);
        });
      },
    };

    function play(name) {
      if (!context || muted || !sounds[name]) return;
      sounds[name]();
    }

    function toggleMute() {
      muted = !muted;
      if (master) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, context.currentTime, 0.05);
      try {
        root.localStorage.setItem(STORAGE_KEY, String(muted));
      } catch (error) {
        // Préférence non retenue en navigation privée.
      }
      return muted;
    }

    return { start, play, toggleMute, isMuted: () => muted };
  }

  root.DragonJack.createAudio = createAudio;
})(window);
