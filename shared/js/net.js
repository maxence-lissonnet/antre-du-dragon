/*
 * Jeu en ligne par code d'invitation, en pair-à-pair (WebRTC) grâce à PeerJS.
 * Le service public de PeerJS sert seulement à mettre les navigateurs en relation ;
 * ensuite, les messages circulent directement entre les joueurs.
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

  /*
   * Ouvre une partie. Chaque joueur qui rejoint est identifié par l'identifiant de sa connexion.
   * Renvoie { code, send(playerId, message), broadcast(message), kick(playerId), close() }.
   */
  function host({ game, onJoin = () => {}, onLeave = () => {}, onMessage = () => {} }) {
    const Peer = PeerClass();
    const connections = new Map();

    function open(attempt) {
      return new Promise((resolve, reject) => {
        const code = createCode();
        const peer = new Peer(peerIdFor(game, code));
        peer.on('open', () => resolve({ peer, code }));
        peer.on('error', (error) => {
          // Code déjà pris par une autre partie : on en tire un autre.
          if (error.type === 'unavailable-id' && attempt < 3) {
            peer.destroy();
            resolve(open(attempt + 1));
          } else {
            reject(new Error(explain(error)));
          }
        });
      });
    }

    return open(0).then(({ peer, code }) => {
      peer.on('connection', (connection) => {
        connection.on('open', () => {
          connections.set(connection.peer, connection);
          onJoin({ id: connection.peer, name: (connection.metadata && connection.metadata.name) || 'Invité' });
        });
        connection.on('data', (message) => onMessage(connection.peer, message));
        connection.on('close', () => {
          if (connections.delete(connection.peer)) onLeave(connection.peer);
        });
        connection.on('error', () => {
          if (connections.delete(connection.peer)) onLeave(connection.peer);
        });
      });
      return {
        code,
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
      };
    });
  }

  /* Rejoint une partie avec son code. Renvoie { id, send(message), close() }. */
  function join({ game, code, name, onMessage = () => {}, onClose = () => {} }) {
    const Peer = PeerClass();
    return new Promise((resolve, reject) => {
      const peer = new Peer();
      const timer = root.setTimeout(() => {
        peer.destroy();
        reject(new Error('L’hôte ne répond pas. Vérifie le code ou réessaie.'));
      }, CONNECT_TIMEOUT_MS);
      peer.on('error', (error) => {
        root.clearTimeout(timer);
        peer.destroy();
        reject(new Error(explain(error)));
      });
      peer.on('open', (id) => {
        const connection = peer.connect(peerIdFor(game, normalizeCode(code)), { reliable: true, metadata: { name } });
        connection.on('open', () => {
          root.clearTimeout(timer);
          resolve({
            id,
            send: (message) => connection.open && connection.send(message),
            close: () => peer.destroy(),
          });
        });
        connection.on('data', onMessage);
        connection.on('close', onClose);
      });
    });
  }

  root.DragonJack = root.DragonJack || {};
  root.DragonJack.net = { available, host, join, normalizeCode, CODE_LENGTH };
})(window);
