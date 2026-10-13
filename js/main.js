/*
 * Point d'entrée de la salle : affiche le trésor et un encadré qui présente le jeu choisi.
 * On change de jeu en survolant une porte, avec les flèches de l'encadré ou celles du clavier.
 * Sans WebGL, l'encadré reste utilisable : il mène directement aux jeux.
 */
(function (root) {
  'use strict';

  const DJ = root.DragonJack;
  const $ = (id) => document.getElementById(id);
  const numberFormat = new Intl.NumberFormat('fr-FR');

  const TOAST_SECONDS = 3200;
  const LOCKED_MESSAGE = 'Ce jeu arrive bientôt : le dragon garde encore la herse fermée.';

  let toastTimer = null;
  function notify(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    root.clearTimeout(toastTimer);
    toastTimer = root.setTimeout(() => toast.classList.remove('is-visible'), TOAST_SECONDS);
  }

  async function init() {
    $('balance').textContent = numberFormat.format(DJ.profile.loadTreasure());
    const games = DJ.GAMES;
    let current = 0;
    let hall = null;
    let entering = false;

    /* Met un jeu en avant : encadré du bas et, si la 3D est là, porte illuminée et regard du dragon. */
    function show(index) {
      current = (index + games.length) % games.length;
      const game = games[current];
      $('game-count').textContent = `Jeu ${current + 1} sur ${games.length}`;
      $('game-name').textContent = game.name;
      $('game-tagline').textContent = game.tagline;
      $('enter-game').firstChild.textContent = game.available ? 'Entrer ' : 'Bientôt ';
      if (hall) hall.focus(current);
    }

    async function activate(index) {
      const game = games[index];
      if (entering) return;
      if (!game.available) {
        notify(LOCKED_MESSAGE);
        if (hall) await hall.rattle(index);
        return;
      }
      entering = true;
      document.body.classList.add('is-entering');
      if (hall) await hall.enter(index);
      root.location.href = game.href;
    }

    function select(index, { activate: shouldActivate }) {
      show(index);
      if (shouldActivate) activate(index);
    }

    $('prev-game').addEventListener('click', () => show(current - 1));
    $('next-game').addEventListener('click', () => show(current + 1));
    $('enter-game').addEventListener('click', () => activate(current));
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'ArrowLeft') show(current - 1);
      else if (event.key === 'ArrowRight') show(current + 1);
      else if (event.key === 'Enter' && !(event.target instanceof Element && event.target.closest('button, a'))) activate(current);
    });

    // En revenant d'un jeu avec le bouton « précédent », la page est rechargée pour repartir de la vue de la salle.
    root.addEventListener('pageshow', (event) => {
      if (event.persisted) root.location.reload();
    });

    if (!DJ.boot.hasWebGL()) {
      show(0);
      return;
    }
    await DJ.boot.loadFonts();
    hall = DJ.createHall({ container: $('stage'), games, onSelect: select });
    const chosen = DJ.profile.loadDragon();
    hall.setDragonTheme(DJ.DRAGON_THEMES.includes(chosen) ? chosen : DJ.DEFAULT_DRAGON);
    hall.setEyeGlow(0.15);
    show(0);
    hall.awaken();
  }

  init().catch((error) => {
    console.error(error);
    $('fallback-message').textContent = 'La salle n’a pas pu se charger. Recharge la page pour réessayer.';
    $('fallback').hidden = false;
  });
})(window);
