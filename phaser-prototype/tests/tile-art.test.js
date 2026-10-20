import test from "node:test";
import assert from "node:assert/strict";
import { TILE_PRELOAD_GROUPS, createTileArt, tileArtUrl } from "../src/tile-art.js";

// A tiny stand-in for the DOM and for pictures that load when the test says so.
function setup() {
  const images = [];
  class FakeImage {
    constructor() {
      this.style = {};
      this.dataset = dataset();
      this.attributes = {};
      this.className = "";
      images.push(this);
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    cloneNode() { const copy = new FakeImage(); copy.cloned = true; copy.src = this.src; return copy; }
    decode() { return Promise.resolve(); }
    replaceWith(next) { this.parent.children[this.parent.children.indexOf(this)] = next; next.parent = this.parent; }
    set src(value) { this._src = value; }
    get src() { return this._src; }
  }
  globalThis.Image = FakeImage;
  globalThis.window = {};
  const tile = () => {
    const el = { dataset: dataset(), children: [] };
    el.querySelector = selector => (selector === ".tile-art" ? el.children.find(child => child.className === "tile-art") ?? null : null);
    el.insertBefore = child => { child.parent = el; el.children.unshift(child); };
    return el;
  };
  const loaded = value => {
    const image = images.find(candidate => candidate._src === tileArtUrl(value) && typeof candidate.onload === "function" && !candidate.done);
    image.done = true;
    return image;
  };
  return { images, tile, finish: value => loaded(value).onload(), fail: value => loaded(value).onerror() };
}
// Like the real dataset, every value is stored as a string.
const dataset = () => new Proxy({}, { set: (target, key, value) => { target[key] = String(value); return true; } });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test("every tile value has a picture to preload, in the order it is needed", () => {
  assert.deepEqual(TILE_PRELOAD_GROUPS.flat(), [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192]);
  assert.equal(tileArtUrl(128), "/assets/tiles/v3/tile-128.png");
});

test("a picture that is ready is copied onto the tile at once", async () => {
  const { tile, finish, images } = setup();
  const art = createTileArt();
  art.load(8);
  finish(8);
  await tick();
  const el = tile();
  art.attach(el, 8);
  const shown = el.querySelector(".tile-art");
  assert.ok(shown.cloned, "a copy of the kept picture, not a new download");
  assert.equal(shown.dataset.assetValue, "8");
  assert.equal(shown.style.objectFit, "contain");
  assert.equal(images.filter(image => image._src === tileArtUrl(8) && !image.cloned).length, 1, "loaded once");
});

test("attaching the same picture again changes nothing", async () => {
  const { tile, finish } = setup();
  const art = createTileArt();
  art.load(2);
  finish(2);
  await tick();
  const el = tile();
  art.attach(el, 2);
  const first = el.querySelector(".tile-art");
  art.attach(el, 2);
  assert.equal(el.querySelector(".tile-art"), first);
});

test("a tile keeps its old picture until the new one has loaded", async () => {
  const { tile, finish } = setup();
  const art = createTileArt();
  art.load(2);
  finish(2);
  await tick();
  const el = tile();
  art.attach(el, 2);
  const old = el.querySelector(".tile-art");
  art.attach(el, 4);                       // 4 is not loaded yet
  assert.equal(el.querySelector(".tile-art"), old, "still showing the 2");
  finish(4);
  await tick();
  assert.equal(el.querySelector(".tile-art").dataset.assetValue, "4");
});

test("a tile that merged again meanwhile is not given the stale picture", async () => {
  const { tile, finish } = setup();
  const art = createTileArt();
  art.load(2);
  finish(2);
  await tick();
  const el = tile();
  art.attach(el, 2);
  art.attach(el, 4);                       // waiting for 4...
  art.attach(el, 8);                       // ...but it is already an 8
  finish(4);
  await tick();
  assert.equal(el.querySelector(".tile-art").dataset.assetValue, "2", "the late 4 was ignored");
  finish(8);
  await tick();
  assert.equal(el.querySelector(".tile-art").dataset.assetValue, "8");
});

test("a failed download is retried and then gives up quietly", async () => {
  const { tile, fail, finish, images } = setup();
  const art = createTileArt();
  const el = tile();
  art.attach(el, 16);                      // not ready: shows an image element that is still loading
  assert.ok(el.querySelector(".tile-art"));
  fail(16);
  await new Promise(resolve => setTimeout(resolve, 450));
  const attempts = images.filter(image => image._src === tileArtUrl(16) && typeof image.onload === "function").length;
  assert.ok(attempts >= 2, "tried again");
  finish(16);
  await tick();
});
