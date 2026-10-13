/*
 * Salon de jeu commun : jouer contre des bots, créer une partie en ligne (code d'invitation)
 * ou rejoindre une partie. Quand la partie démarre, le jeu reçoit une « session » qui cache le réseau :
 *   session.mode        'local' | 'host' | 'client'
 *   session.seats       [{ name, isBot, isLocal }] dans l'ordre de jeu
 *   session.localIndex  place du joueur sur cet appareil
 *   session.sendTo(index, message) / session.broadcast(message)   (hôte)
 *   session.sendToHost(message)                                    (invité)
 *   session.onMessage(handler)   hôte : handler(index, message) ; invité : handler(message)
 *   session.onLeave(handler)     hôte : handler(index) quand un invité part
 */
(function (root) {
  'use strict';

  const DJ = root.DragonJack;
  const NAME_KEY = 'antre-du-dragon.nom';

  function loadName() {
    try {
      return root.localStorage.getItem(NAME_KEY) || '';
    } catch (error) {
      return '';
    }
  }

  function saveName(name) {
    try {
      root.localStorage.setItem(NAME_KEY, name);
    } catch (error) {
      // Navigation privée : le nom sera simplement redemandé.
    }
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(label, className = 'button') {
    const node = element('button', className, label);
    node.type = 'button';
    return node;
  }

  function createLobby({ container, game, minPlayers = 2, maxPlayers = 4, botNames, notify, onStart }) {
    const state = { step: 'home', seats: [], room: null, connection: null, code: '' };
    const handlers = { message: () => {}, leave: () => {} };
    let botCount = 1;

    const playerName = () => {
      const input = container.querySelector('#lobby-name');
      const name = (input ? input.value : loadName()).trim().slice(0, 16) || 'Joueur';
      saveName(name);
      return name;
    };

    const nextBotName = () => botNames.find((name) => !state.seats.some((seat) => seat.name === name)) || `Bot ${state.seats.length}`;

    function seatList() {
      const list = element('ul', 'lobby-seats');
      state.seats.forEach((seat, index) => {
        const item = element('li', 'lobby-seat');
        item.append(element('span', 'lobby-seat-name', seat.name));
        const tag = seat.isBot ? 'bot' : seat.isLocal ? 'toi' : 'en ligne';
        item.append(element('span', 'lobby-seat-tag', tag));
        if (state.step === 'host' && seat.isBot) {
          const remove = button('Retirer', 'button button-quiet lobby-small');
          remove.addEventListener('click', () => {
            state.seats.splice(index, 1);
            broadcastLobby();
            render();
          });
          item.append(remove);
        }
        list.append(item);
      });
      return list;
    }

    function broadcastLobby() {
      if (state.room) state.room.broadcast({ t: 'lobby', seats: state.seats.map(({ name, isBot }) => ({ name, isBot })) });
    }

    function render() {
      container.replaceChildren();
      const panel = element('div', 'lobby');
      if (state.step === 'home') {
        const label = element('label', 'lobby-label', 'Ton nom');
        const input = element('input', 'lobby-input');
        input.id = 'lobby-name';
        input.maxLength = 16;
        input.autocomplete = 'nickname';
        input.value = loadName();
        label.append(input);
        const choices = element('div', 'lobby-choices');
        const bots = button('Contre des bots', 'button button-primary');
        const create = button('Créer une partie en ligne');
        const joinButton = button('Rejoindre avec un code');
        bots.addEventListener('click', () => go('bots'));
        create.addEventListener('click', createRoom);
        joinButton.addEventListener('click', () => go('join'));
        choices.append(bots, create, joinButton);
        panel.append(label, choices);
      }
      if (state.step === 'bots') {
        panel.append(element('p', 'lobby-text', 'Combien d’adversaires ?'));
        const picker = element('div', 'bet-picker');
        for (let count = 1; count <= maxPlayers - 1; count += 1) {
          const option = button(String(count), 'bet-option');
          option.setAttribute('aria-pressed', String(count === botCount));
          option.addEventListener('click', () => {
            botCount = count;
            render();
          });
          picker.append(option);
        }
        const start = button('Lancer la partie', 'button button-primary');
        start.addEventListener('click', startLocal);
        const back = button('Retour', 'button button-quiet');
        back.addEventListener('click', () => go('home'));
        panel.append(picker, element('div', 'action-row'));
        panel.lastChild.append(back, start);
      }
      if (state.step === 'host') {
        panel.append(element('p', 'lobby-text', 'Donne ce code à tes amis pour qu’ils te rejoignent :'));
        const code = element('p', 'lobby-code', state.code);
        code.setAttribute('aria-label', `Code d’invitation : ${state.code.split('').join(' ')}`);
        const copy = button('Copier le code', 'button button-quiet lobby-small');
        copy.addEventListener('click', () => {
          if (root.navigator.clipboard) root.navigator.clipboard.writeText(state.code).then(() => notify('Code copié.'), () => {});
        });
        panel.append(code, copy, seatList());
        const actions = element('div', 'action-row');
        const addBot = button('Ajouter un bot');
        addBot.disabled = state.seats.length >= maxPlayers;
        addBot.addEventListener('click', () => {
          state.seats.push({ id: `bot-${Date.now()}`, name: nextBotName(), isBot: true });
          broadcastLobby();
          render();
        });
        const start = button('Lancer la partie', 'button button-primary');
        start.disabled = state.seats.length < minPlayers;
        start.addEventListener('click', startHosted);
        const cancel = button('Annuler', 'button button-quiet');
        cancel.addEventListener('click', leaveOnline);
        actions.append(cancel, addBot, start);
        panel.append(actions);
      }
      if (state.step === 'join') {
        const label = element('label', 'lobby-label', 'Code d’invitation');
        const input = element('input', 'lobby-input lobby-code-input');
        input.id = 'lobby-code';
        input.maxLength = DJ.net.CODE_LENGTH;
        input.autocapitalize = 'characters';
        input.autocomplete = 'off';
        input.spellcheck = false;
        label.append(input);
        const actions = element('div', 'action-row');
        const back = button('Retour', 'button button-quiet');
        back.addEventListener('click', () => go('home'));
        const joinButton = button('Rejoindre', 'button button-primary');
        joinButton.addEventListener('click', () => joinRoom(input.value));
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') joinRoom(input.value);
        });
        actions.append(back, joinButton);
        panel.append(label, actions);
      }
      if (state.step === 'waiting') {
        panel.append(element('p', 'lobby-text', `Partie ${state.code} : en attente que l’hôte la lance…`), seatList());
        const leave = button('Quitter', 'button button-quiet');
        leave.addEventListener('click', leaveOnline);
        panel.append(leave);
      }
      if (state.step === 'connecting') panel.append(element('p', 'lobby-text', 'Connexion en cours…'));
      container.append(panel);
    }

    function go(step) {
      if (step !== 'home' && state.step === 'home') playerName();
      state.step = step;
      render();
    }

    function startLocal() {
      const seats = [{ name: playerName(), isBot: false, isLocal: true }];
      const pool = botNames.slice();
      for (let i = 0; i < botCount; i += 1) seats.push({ name: pool[i] || `Bot ${i + 1}`, isBot: true, isLocal: false });
      container.replaceChildren();
      onStart({ mode: 'local', seats, localIndex: 0, sendTo() {}, broadcast() {}, sendToHost() {}, onMessage() {}, onLeave() {} });
    }

    function requireOnline() {
      if (DJ.net.available()) return true;
      notify('Le jeu en ligne n’est pas disponible (bibliothèque réseau absente).');
      return false;
    }

    async function createRoom() {
      if (!requireOnline()) return;
      const name = playerName();
      state.step = 'connecting';
      render();
      try {
        state.room = await DJ.net.host({
          game,
          onJoin: ({ id, name: guestName }) => {
            if (state.step !== 'host' || state.seats.length >= maxPlayers) {
              state.room.send(id, { t: 'refused', reason: 'La partie est complète ou déjà lancée.' });
              state.room.kick(id);
              return;
            }
            state.seats.push({ id, name: guestName.slice(0, 16), isBot: false, isLocal: false, remote: true });
            notify(`${guestName} a rejoint la partie.`);
            broadcastLobby();
            render();
          },
          onLeave: (id) => {
            const index = state.seats.findIndex((seat) => seat.id === id);
            if (index < 0) return;
            if (state.step === 'host') {
              notify(`${state.seats[index].name} a quitté la partie.`);
              state.seats.splice(index, 1);
              broadcastLobby();
              render();
            } else {
              handlers.leave(index);
            }
          },
          onMessage: (id, message) => {
            const index = state.seats.findIndex((seat) => seat.id === id);
            if (index >= 0) handlers.message(index, message);
          },
        });
        state.code = state.room.code;
        state.seats = [{ id: 'host', name, isBot: false, isLocal: true }];
        go('host');
      } catch (error) {
        notify(error.message);
        go('home');
      }
    }

    function startHosted() {
      const { seats, room } = state;
      state.step = 'playing';
      seats.forEach((seat, index) => {
        if (seat.remote) room.send(seat.id, { t: 'start', seats: seats.map(({ name, isBot }) => ({ name, isBot })), yourIndex: index });
      });
      container.replaceChildren();
      onStart({
        mode: 'host',
        seats: seats.map(({ name, isBot, isLocal }) => ({ name, isBot, isLocal })),
        localIndex: 0,
        sendTo: (index, message) => seats[index] && seats[index].remote && room.send(seats[index].id, { t: 'game', message }),
        broadcast: (message) => room.broadcast({ t: 'game', message }),
        sendToHost() {},
        onMessage: (handler) => {
          handlers.message = (index, envelope) => envelope && envelope.t === 'game' && handler(index, envelope.message);
        },
        onLeave: (handler) => {
          handlers.leave = handler;
        },
      });
    }

    async function joinRoom(rawCode) {
      if (!requireOnline()) return;
      const code = DJ.net.normalizeCode(rawCode);
      if (code.length !== DJ.net.CODE_LENGTH) {
        notify(`Le code compte ${DJ.net.CODE_LENGTH} caractères.`);
        return;
      }
      state.code = code;
      state.step = 'connecting';
      render();
      let gameHandler = () => {};
      try {
        state.connection = await DJ.net.join({
          game,
          code,
          name: playerName(),
          onMessage: (envelope) => {
            if (!envelope) return;
            if (envelope.t === 'lobby') {
              state.seats = envelope.seats;
              render();
            } else if (envelope.t === 'refused') {
              notify(envelope.reason);
              leaveOnline();
            } else if (envelope.t === 'start') {
              state.step = 'playing';
              container.replaceChildren();
              const seats = envelope.seats.map((seat, index) => ({ ...seat, isLocal: index === envelope.yourIndex }));
              onStart({
                mode: 'client',
                seats,
                localIndex: envelope.yourIndex,
                sendTo() {},
                broadcast() {},
                sendToHost: (message) => state.connection.send({ t: 'game', message }),
                onMessage: (handler) => {
                  gameHandler = handler;
                },
                onLeave() {},
              });
            } else if (envelope.t === 'game') {
              gameHandler(envelope.message);
            }
          },
          onClose: () => {
            notify('La connexion avec l’hôte est coupée.');
            if (state.step !== 'playing') go('home');
          },
        });
        go('waiting');
      } catch (error) {
        notify(error.message);
        go('join');
      }
    }

    function leaveOnline() {
      if (state.room) state.room.close();
      if (state.connection) state.connection.close();
      state.room = null;
      state.connection = null;
      state.seats = [];
      go('home');
    }

    render();
    return {
      reset() {
        leaveOnline();
      },
    };
  }

  DJ.createLobby = createLobby;
})(window);
