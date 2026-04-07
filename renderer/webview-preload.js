// webview-preload.js
// Runs in each webview's page context before any page scripts.
// Intercepts the Fullscreen API so videos go fullscreen within
// the webview's own viewport (the box) instead of taking over the OS window.

(function () {
  let fakeFullscreenEl = null;
  let savedInlineStyle = '';

  function enterFakeFullscreen(el) {
    if (fakeFullscreenEl === el) return;
    if (fakeFullscreenEl) exitFakeFullscreen();

    fakeFullscreenEl = el;
    savedInlineStyle = el.style.cssText;

    el.style.cssText = [
      savedInlineStyle,
      'position:fixed!important',
      'top:0!important',
      'left:0!important',
      'width:100%!important',
      'height:100%!important',
      'z-index:2147483647!important',
      'background:#000!important',
    ].join(';');

    // Spoof fullscreenElement so page UI (YouTube controls) reacts correctly
    for (const prop of ['fullscreenElement', 'webkitFullscreenElement', 'mozFullScreenElement']) {
      Object.defineProperty(document, prop, { get: () => fakeFullscreenEl, configurable: true });
    }

    document.dispatchEvent(new Event('fullscreenchange'));
    document.dispatchEvent(new Event('webkitfullscreenchange'));
    document.dispatchEvent(new Event('mozfullscreenchange'));
  }

  function exitFakeFullscreen() {
    if (!fakeFullscreenEl) return;

    fakeFullscreenEl.style.cssText = savedInlineStyle;
    fakeFullscreenEl = null;
    savedInlineStyle = '';

    for (const prop of ['fullscreenElement', 'webkitFullscreenElement', 'mozFullScreenElement']) {
      Object.defineProperty(document, prop, { get: () => null, configurable: true });
    }

    document.dispatchEvent(new Event('fullscreenchange'));
    document.dispatchEvent(new Event('webkitfullscreenchange'));
    document.dispatchEvent(new Event('mozfullscreenchange'));
  }

  // Override request
  Element.prototype.requestFullscreen = function () {
    enterFakeFullscreen(this);
    return Promise.resolve();
  };
  Element.prototype.webkitRequestFullscreen = function () {
    enterFakeFullscreen(this);
  };
  Element.prototype.mozRequestFullScreen = function () {
    enterFakeFullscreen(this);
  };

  // Override exit
  document.exitFullscreen = function () {
    exitFakeFullscreen();
    return Promise.resolve();
  };
  document.webkitExitFullscreen = function () { exitFakeFullscreen(); };
  document.mozCancelFullScreen  = function () { exitFakeFullscreen(); };

  // Advertise fullscreen as supported and initially inactive
  Object.defineProperty(document, 'fullscreenEnabled',        { get: () => true, configurable: true });
  Object.defineProperty(document, 'webkitFullscreenEnabled',  { get: () => true, configurable: true });
  Object.defineProperty(document, 'fullscreenElement',        { get: () => null, configurable: true });
  Object.defineProperty(document, 'webkitFullscreenElement',  { get: () => null, configurable: true });
  Object.defineProperty(document, 'mozFullScreenElement',     { get: () => null, configurable: true });
})();
