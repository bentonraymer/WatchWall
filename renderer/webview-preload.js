// webview-preload.js
// Runs in each webview's MAIN world (the webview sets contextIsolation=no) BEFORE
// any page script. This timing + world is essential: DRM streaming sites such as
// Prime Video run a browser-support check during initial page load, so the patch
// must be in place before their scripts execute, and it must live in the main
// world the page reads — a contextIsolation preload runs in an isolated world the
// page never sees.
//
// Electron presents an otherwise-genuine Chromium identity (correct version,
// platform, platformVersion, webdriver=false, window.chrome present) but its
// User-Agent Client Hints advertise the brand as bare "Chromium" rather than
// "Google Chrome". DRM sites whitelist the "Google Chrome" brand and reject plain
// Chromium as unsupported. We make ONE minimal, fully-consistent change: add a
// "Google Chrome" brand entry mirroring the REAL Chromium version, passing every
// other value through untouched. We deliberately do NOT spoof webdriver,
// window.chrome, or the OS version — those are already correct, and faking them
// creates inconsistencies detection scripts flag.

(function () {
  try {
    const uad = navigator.userAgentData;
    if (!uad || !Array.isArray(uad.brands)) return;
    if (uad.brands.some((b) => b.brand === 'Google Chrome')) return; // already present

    const chromium = uad.brands.find((b) => b.brand === 'Chromium');
    if (!chromium) return;
    const ver = chromium.version;

    const addChrome = (list, fullVersion) =>
      list.concat([{ brand: 'Google Chrome', version: fullVersion || ver }]);

    const realGHEV = uad.getHighEntropyValues.bind(uad);
    const shim = {
      brands:   addChrome(uad.brands),
      mobile:   uad.mobile,
      platform: uad.platform,
      getHighEntropyValues(hints) {
        return realGHEV(hints).then((v) => {
          if (Array.isArray(v.brands)) v.brands = addChrome(v.brands);
          if (Array.isArray(v.fullVersionList)) {
            const cf = v.fullVersionList.find((b) => b.brand === 'Chromium');
            v.fullVersionList = addChrome(v.fullVersionList, cf ? cf.version : undefined);
          }
          return v;
        });
      },
      toJSON() { return { brands: addChrome(uad.brands), mobile: uad.mobile, platform: uad.platform }; },
    };

    Object.defineProperty(Navigator.prototype, 'userAgentData', {
      get() { return shim; },
      configurable: true,
    });
  } catch (_) {}
})();
