// The pictures on the tiles. Every picture is loaded once and kept (a retained
// image keeps its decoded pixels in memory), and a tile's art is copied from
// that, so a merge never waits for a download or a decode. If a picture is
// somehow not ready yet, the tile keeps its old art until the new one arrives
// instead of going blank, and a failed download is retried.

// Every tile picture is small (30-190 KB), so load them all rather than
// waiting for the world that needs them: the first ones straight away, the
// rest as soon as the browser is idle.
export const TILE_PRELOAD_GROUPS = [
  [2, 4, 8, 16, 32, 64], [128, 256], [512], [1024, 2048], [4096, 8192]
];

export const tileArtUrl = value => `/assets/tiles/v3/tile-${value}.png`;

export function createTileArt() {
  const ready = new Map();      // asset value -> loaded <img> (kept on purpose)
  const loading = new Map();    // asset value -> Promise of that <img>
  let preloadStarted = false;

  function load(value, attempt = 0) {
    if (ready.has(value)) return Promise.resolve(ready.get(value));
    if (loading.has(value) && attempt === 0) return loading.get(value);
    const promise = new Promise(resolve => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        const done = () => { ready.set(value, image); loading.delete(value); resolve(image); };
        if (image.decode) image.decode().then(done, done); else done();
      };
      image.onerror = () => {
        loading.delete(value);
        if (attempt >= 3) { resolve(null); return; }
        setTimeout(() => load(value, attempt + 1).then(resolve), 400 * (attempt + 1));
      };
      image.src = tileArtUrl(value);
    });
    loading.set(value, promise);
    return promise;
  }

  function makeArt(value, loaded) {
    const art = loaded ? loaded.cloneNode(false) : new Image();
    if (!loaded) art.src = tileArtUrl(value);
    art.className = "tile-art";
    art.alt = "";
    art.setAttribute("aria-hidden", "true");
    art.draggable = false;
    // Critical containment is repeated inline so a stale stylesheet can never
    // let a newly-rendered sprite escape its tile while caches are refreshing.
    Object.assign(art.style, {
      position: "absolute",
      inset: "4% 4% 9%",
      width: "92%",
      height: "87%",
      objectFit: "contain",
      objectPosition: "center",
      imageRendering: "pixelated",
      display: "block",
      pointerEvents: "none"
    });
    return art;
  }

  // Start fetching every picture (once): the first group now, the rest when idle.
  function preloadAll() {
    if (preloadStarted) return;
    preloadStarted = true;
    TILE_PRELOAD_GROUPS.forEach((group, index) => {
      const run = () => group.forEach(value => load(value));
      if (index === 0) run();
      else if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 1500 });
      else setTimeout(run, 300 * index);
    });
  }

  // Shows the picture for `assetValue` on a tile element.
  function attach(el, assetValue) {
    el.dataset.art = assetValue;
    const current = el.querySelector(".tile-art");
    if (current && current.dataset.assetValue === String(assetValue)) return;
    const swapIn = loaded => {
      if (el.dataset.art !== String(assetValue)) return;   // merged again meanwhile
      const art = makeArt(assetValue, loaded);
      art.dataset.assetValue = assetValue;
      const old = el.querySelector(".tile-art");
      if (old) old.replaceWith(art); else el.insertBefore(art, el.firstChild);
    };
    const loaded = ready.get(assetValue);
    if (loaded) swapIn(loaded);
    else {
      // Nothing to show yet: keep the previous art (if any) until this one is loaded.
      if (!current) swapIn(null);
      load(assetValue).then(image => { if (image) swapIn(image); });
    }
  }

  return { preloadAll, attach, load };
}
