/*
 * Jeu en ligne en pair-à-pair (WebRTC) grâce à PeerJS : parties privées par code d'invitation,
 * ou salles publiques numérotées (salle 1, salle 2…) que chacun rejoint sans code.
 * Le service public de PeerJS sert à mettre les navigateurs en relation ;
 * ensuite, les messages circulent directement entre les joueurs (ou par un relais si besoin).
 * Le navigateur de l'hôte fait autorité : il fait tourner la partie et envoie à chacun sa vue.
 */
(function (root) {
  'use strict';

  // Lettres et chiffres sans ambiguïté (pas de O/0, I/1…), faciles à dicter.
  const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const CODE_LENGTH = 6;
  const CONNECT_TIMEOUT_MS = 12000;

  function createCode() {
    const buffer = new Uint32Array(CODE_LENGTH);
    root.crypto.getRandomValues(buffer);
    return Array.from(buffer, (value) => CODE_ALPHABET[value % CODE_ALPHABET.length]).join('');
  }

  const normalizeCode = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
  const peerIdFor = (game, code) => `antre-du-dragon-${game}-${code}`.toLowerCase();
  const roomIdFor = (game, room) => `antre-du-dragon-${game}-salle-${room}`;

  function available() {
    return typeof root.Peer === 'function' || Boolean(root.peerjs && root.peerjs.Peer);
  }

  function PeerClass() {
    return root.Peer || root.peerjs.Peer;
  }

  /* Messages d'erreur compréhensibles pour les erreurs de PeerJS. */
  function explain(error) {
    const type = error && error.type;
    if (type === 'peer-unavailable') return 'Aucune partie ne correspond à ce code. Vérifie-le auprès de l’hôte.';
    if (type === 'network' || type === 'server-error' || type === 'socket-error') return 'Connexion impossible : vérifie ta connexion internet.';
    if (type === 'browser-incompatible') return 'Ton navigateur ne permet pas le jeu en ligne.';
    return 'La connexion a échoué. Réessaie dans un instant.';
  }

  /* Erreur qui garde le type de PeerJS (« unavailable-id », « peer-unavailable »…) pour décider quoi faire. */
  function failure(error, message) {
    const wrapped = new Error(message || explain(error));
    wrapped.type = (error && error.type) || 'unknown';
    return wrapped;
  }

  /*
   * Écoute sous un identifiant donné. Chaque joueur qui arrive est identifié par l'identifiant de sa connexion.
   * Renvoie { id, send(playerId, message), broadcast(message), kick(playerId), close() }.
   */
  function listen(peerId, { onJoin = () => {}, onLeave = () => {}, onMessage = () => {} }) {
    const Peer = PeerClass();
    const connections = new Map();
    return new Promise((resolve, reject) => {
      const peer = new Peer(peerId);
      let opened = false;
      peer.on('error', (error) => {
        if (!opened) {
          peer.destroy();
          reject(failure(error));
        }
      });
      peer.on('open', () => {
        opened = true;
        peer.on('connection', (connection) => {
          connection.on('open', () => {
            connections.set(connection.peer, connection);
            onJoin({ id: connection.peer, name: (connection.metadata && connection.metadata.name) || 'Invité' });
          });
          connection.on('data', (message) => onMessage(connection.peer, message));
          const gone = () => {
            if (connections.delete(connection.peer)) onLeave(connection.peer);
          };
          connection.on('close', gone);
          connection.on('error', gone);
        });
        resolve({
          id: peerId,
          send(playerId, message) {
            const connection = connections.get(playerId);
            if (connection && connection.open) connection.send(message);
          },
          broadcast(message) {
            connections.forEach((connection) => connection.open && connection.send(message));
          },
          kick(playerId) {
            const connection = connections.get(playerId);
            if (connection) connection.close();
          },
          close() {
            connections.forEach((connection) => connection.close());
            peer.destroy();
          },
        });
      });
    });
  }

  /* Se connecte à un hôte. Renvoie { id, send(message), close() }. */
  function connect(peerId, { name, onMessage = () => {}, onClose = () => {} }) {
    const Peer = PeerClass();
    return new Promise((resolve, reject) => {
      const peer = new Peer();
      let settled = false;
      const fail = (error) => {
        if (settled) return;
        settled = true;
        root.clearTimeout(timer);
        peer.destroy();
        reject(error);
      };
      const timer = root.setTimeout(() => fail(failure({ type: 'timeout' }, 'L’hôte ne répond pas. Vérifie le code ou réessaie.')), CONNECT_TIMEOUT_MS);
      peer.on('error', (error) => fail(failure(error)));
      peer.on('open', (id) => {
        const connection = peer.connect(peerId, { reliable: true, metadata: { name } });
        connection.on('open', () => {
          settled = true;
          root.clearTimeout(timer);
          resolve({
            id,
            send: (message) => connection.open && connection.send(message),
            close: () => peer.destroy(),
          });
        });
        connection.on('data', onMessage);
        // Après l'ouverture, une coupure (hôte parti, réseau perdu) est signalée une seule fois.
        let closed = false;
        const lost = () => {
          if (!settled || closed) return;
          closed = true;
          onClose();
        };
        connection.on('close', lost);
        peer.on('disconnected', () => connection.open || lost());
      });
    });
  }

  /* Ouvre une partie privée avec un code tiré au hasard. Renvoie { code, send, broadcast, kick, close }. */
  async function host({ game, onJoin, onLeave, onMessage }) {
    for (let attempt = 0; ; attempt += 1) {
      const code = createCode();
      try {
        const room = await listen(peerIdFor(game, code), { onJoin, onLeave, onMessage });
        return { ...room, code };
      } catch (error) {
        // Code déjà pris par une autre partie : on en tire un autre.
        if (error.type !== 'unavailable-id' || attempt >= 3) throw error;
      }
    }
  }

  /* Rejoint une partie privée avec son code. */
  function join({ game, code, name, onMessage, onClose }) {
    return connect(peerIdFor(game, normalizeCode(code)), { name, onMessage, onClose });
  }

  /*
   * Salles publiques : ouvrir la salle n (échoue avec le type « unavailable-id » si elle existe déjà),
   * ou la rejoindre (échoue avec « peer-unavailable » si personne ne l'a ouverte).
   */
  function openRoom({ game, room, onJoin, onLeave, onMessage }) {
    return listen(roomIdFor(game, room), { onJoin, onLeave, onMessage });
  }

  function joinRoom({ game, room, name, onMessage, onClose }) {
    return connect(roomIdFor(game, room), { name, onMessage, onClose });
  }

  root.DragonJack = root.DragonJack || {};
  root.DragonJack.net = { available, host, join, openRoom, joinRoom, normalizeCode, CODE_LENGTH };
})(window);
