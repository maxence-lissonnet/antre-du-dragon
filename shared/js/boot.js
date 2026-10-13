/*
 * Démarrage commun aux pages de l'antre : vérifier la 3D, attendre les polices, afficher une erreur.
 */
(function (root) {
  'use strict';

  const FONT_TIMEOUT_MS = 2500;

  function hasWebGL() {
    try {
      const canvas = document.createElement('canvas');
      return Boolean(root.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
    } catch (error) {
      return false;
    }
  }

  /* Les textures dessinées (cartes, plaques, symboles) utilisent la police d'affichage : on l'attend un peu. */
  function loadFonts() {
    if (!document.fonts) return Promise.resolve();
    const timeout = new Promise((resolve) => root.setTimeout(resolve, FONT_TIMEOUT_MS));
    const fonts = Promise.all([document.fonts.load('500 56px "Grenze Gotisch"'), document.fonts.load('16px "Alegreya Sans"')]).catch(() => {});
    return Promise.race([fonts, timeout]);
  }

  /* Remplace la page par un message clair (éléments #fallback et #fallback-message requis). */
  function showFallback(message) {
    document.body.classList.remove('is-intro');
    const intro = document.getElementById('intro');
    if (intro) intro.hidden = true;
    document.getElementById('fallback-message').textContent = message;
    document.getElementById('fallback').hidden = false;
  }

  const MESSAGES = {
    noWebGL: 'Ton navigateur ne peut pas afficher la 3D (WebGL désactivé). Active l’accélération matérielle ou essaie un autre navigateur.',
    loadError: 'Le jeu n’a pas pu se charger. Recharge la page pour réessayer.',
  };

  root.DragonJack = root.DragonJack || {};
  root.DragonJack.boot = { hasWebGL, loadFonts, showFallback, MESSAGES };
})(window);
