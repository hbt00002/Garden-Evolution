import test from "node:test";
import assert from "node:assert/strict";
import { createBoardView } from "../src/board-view.js";
import { createToast } from "../src/toast.js";

class FakeElement {
  constructor(tag = "div") {
    this.tag = tag; this.className = ""; this.textContent = ""; this._html = ""; this.hidden = false;
    this.children = []; this.attributes = {}; this.listeners = {}; this.removed = false; this.parent = null;
    this.classes = new Set(); this.clientWidth = 340; this.clientHeight = 340; this.offsetWidth = 340;
    const props = {};
    this.style = {
      props,
      setProperty: (name, value) => { props[name] = value; },
      removeProperty: name => { delete props[name]; }
    };
    this.dataset = new Proxy({}, { set: (target, key, value) => { target[key] = String(value); return true; } });
  }
  get innerHTML() { return this._html; }
  set innerHTML(value) { this._html = value; if (value === "") this.children = []; }
  get classList() {
    return {
      add: n => this.classes.add(n), remove: n => this.classes.delete(n), contains: n => this.classes.has(n),
      toggle: (n, on) => (on ? this.classes.add(n) : this.classes.delete(n))
    };
  }
  appendChild(child) { this.children.push(child); child.parent = this; return child; }
  insertBefore(child) { this.children.unshift(child); child.parent = this; }
  remove() { this.removed = true; if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  querySelector(selector) { return this.children.find(c => c.className === selector.slice(1)) ?? null; }
  querySelectorAll(selector) { return this.children.filter(c => c.className.split(" ").includes(selector.slice(1))); }
  replaceWith() {}
}

function setup({ reduceMotion = false, particlesOn = true, language = "en", stage = 1, dpr = 1 } = {}) {
  globalThis.window = { devicePixelRatio: dpr, addEventListener() {} };
  globalThis.document = { createElement: tag => new FakeElement(tag) };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => "10px" });
  const board = new FakeElement();
  const grid = new FakeElement();
  const tilesLayer = new FakeElement();
  const attached = [];
  const tileArt = { attach: (el, assetValue) => attached.push([el.dataset.value, assetValue]) };
  const state = { language, stage };
  const view = createBoardView({
    board, grid, tiles: tilesLayer, prefs: { reduceMotion, particlesOn }, tileArt,
    language: () => state.language, getStage: () => state.stage
  });
  view.measure();
  return { view, board, grid, tilesLayer, attached, state };
}

const origin = el => el.style.props["--tx"];

test("the grid is sixteen cells", () => {
  const t = setup();
  t.view.buildGrid();
  assert.equal(t.grid.children.length, 16);
  assert.ok(t.grid.children.every(cell => cell.className === "cell"));
  t.view.buildGrid();
  assert.equal(t.grid.children.length, 16, "building again does not add more");
});

test("a tile sits on its cell: a 340 px board with a 10 px gap has 72.5 px cells", () => {
  const t = setup();
  const id = t.view.create(1, 2, 8, false);
  const el = t.tilesLayer.children[0];
  assert.equal(el.style.width, "72.5px");
  // cell = (340 - 2*10 - 3*10) / 4 = 72.5; pitch = 82.5
  assert.equal(origin(el), "translate(165px, 83px)", "82.5 is snapped to a whole device pixel");
  assert.equal(t.view.valueOf(id), 8);
  assert.equal(el.dataset.value, "8");
  assert.equal(el.dataset.tier, "3");
});

test("on a high-density screen a tile is kept on whole device pixels", () => {
  const t = setup({ dpr: 3 });
  t.view.create(0, 1, 2, false);
  const [, x, y] = origin(t.tilesLayer.children[0]).match(/translate\(([\d.]+)px, ([\d.]+)px\)/).slice(0, 3).map(Number);
  assert.equal(Math.round(x * 3), x * 3);
  assert.equal(Math.round(y * 3), y * 3);
});

test("a new tile pops in unless motion is reduced", () => {
  const normal = setup();
  normal.view.create(0, 0, 2, true);
  assert.ok(normal.tilesLayer.children[0].classes.has("spawn"));
  normal.tilesLayer.children[0].listeners.animationend[0]();
  assert.equal(normal.tilesLayer.children[0].classes.has("spawn"), false);

  const calm = setup({ reduceMotion: true });
  calm.view.create(0, 0, 2, true);
  assert.equal(calm.tilesLayer.children[0].classes.has("spawn"), false);
  const settled = setup();
  settled.view.create(0, 0, 2, false);
  assert.equal(settled.tilesLayer.children[0].classes.has("spawn"), false, "a restored tile does not pop in");
});

test("a tile slides to another cell and is merged into a bigger plant", () => {
  const t = setup();
  const id = t.view.create(0, 0, 4, false);
  t.view.place(id, 3, 3);
  const el = t.tilesLayer.children[0];
  assert.equal(origin(el), "translate(248px, 248px)");
  assert.equal(t.view.merge(id, 8), true);
  assert.equal(t.view.valueOf(id), 8);
  assert.equal(el.dataset.value, "8");
  assert.ok(el.classes.has("merge"));
  assert.deepEqual(t.attached.at(-1), ["8", 8], "the new picture is attached");
  assert.equal(t.view.merge(999, 8), false, "a tile that is gone cannot merge");
});

test("big plants glow and the golden tree glows gold", () => {
  const t = setup();
  const small = t.view.create(0, 0, 256, false);
  const mid = t.view.create(0, 1, 512, false);
  const gold = t.view.create(0, 2, 2048, false);
  const [a, b, c] = t.tilesLayer.children;
  assert.deepEqual([a.classes.has("glow"), b.classes.has("glow"), c.classes.has("glow")], [false, true, true]);
  assert.deepEqual([a.classes.has("golden"), b.classes.has("golden"), c.classes.has("golden")], [false, false, true]);
  assert.ok(small && mid && gold);
});

test("a removed tile disappears and is forgotten", () => {
  const t = setup();
  const id = t.view.create(0, 0, 2, false);
  t.view.remove(id);
  assert.equal(t.tilesLayer.children.length, 0);
  assert.throws(() => t.view.valueOf(id));
  assert.doesNotThrow(() => t.view.remove(id));
  assert.doesNotThrow(() => t.view.place(id, 1, 1));
});

test("tiles are named in the language, and renamed when it changes", () => {
  const t = setup();
  t.view.create(0, 0, 128, false);
  const el = t.tilesLayer.children[0];
  assert.equal(el.attributes["aria-label"], "Young Tree, 128");
  t.state.language = "tr";
  t.view.relabel();
  assert.notEqual(el.attributes["aria-label"], "Young Tree, 128");
  assert.match(el.attributes["aria-label"], /, 128$/);
});

test("laying out again resizes every tile for a new board size", () => {
  const t = setup();
  t.view.create(1, 1, 2, false);
  t.board.clientWidth = 240;
  t.view.relayout();
  const el = t.tilesLayer.children[0];
  // cell = (240 - 20 - 30) / 4 = 47.5, pitch 57.5
  assert.equal(el.style.width, "47.5px");
  assert.equal(el.style.transform, "translate(58px, 58px)");
  assert.equal(el.style.transition, "", "animation is switched back on");
});

test("a new game clears every tile and particle and starts numbering again", () => {
  const t = setup();
  t.view.create(0, 0, 2, false);
  t.tilesLayer.children.push(Object.assign(new FakeElement(), { className: "particle" }));
  t.view.reset();
  assert.equal(t.tilesLayer.innerHTML, "");
  const fresh = t.view.create(0, 0, 2, false);
  assert.equal(fresh, 1);
});

test("a merge puffs particles of its world, gold for the golden tree, and none when calm", () => {
  const t = setup({ stage: 4 });
  t.view.puff(0, 0, 2048);
  const dots = t.tilesLayer.children;
  assert.equal(dots.length, 10);
  assert.ok(dots.every(dot => dot.className === "particle stage-petal gold"));
  dots[0].listeners.animationend[0]();
  assert.equal(dots[0].removed, true);

  for (const options of [{ reduceMotion: true }, { particlesOn: false }]) {
    const quiet = setup(options);
    quiet.view.puff(0, 0, 8);
    assert.equal(quiet.tilesLayer.children.length, 0, JSON.stringify(options));
  }
  assert.equal((() => { const q = setup(); q.view.puff(0, 0, 8); return q.tilesLayer.children.length; })(), 5);
  assert.equal((() => { const q = setup(); q.view.puff(0, 0, 256); return q.tilesLayer.children.length; })(), 7);
});

test("the golden tree makes the board glow and bursts twenty-two gold particles", () => {
  const t = setup();
  t.view.celebrate();
  assert.ok(t.board.classes.has("celebrate"));
  assert.equal(t.tilesLayer.children.length, 22);
  assert.ok(t.tilesLayer.children.every(dot => dot.className === "particle gold big"));
});

/* ---------- The toast ---------- */

test("a toast shows its message, then fades and hides", async () => {
  globalThis.requestAnimationFrame = fn => fn();
  const el = new FakeElement();
  el.hidden = true;
  const toast = createToast(el, { showMs: 20, fadeMs: 10 });
  toast.show("The crown bloomed");
  assert.equal(el.textContent, "The crown bloomed");
  assert.equal(el.hidden, false);
  assert.ok(el.classes.has("show"));
  await new Promise(resolve => setTimeout(resolve, 15));
  toast.show("Another");                 // restarts the timer
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.ok(el.classes.has("show"), "still showing the newer message");
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(el.classes.has("show"), false);
  assert.equal(el.hidden, true);
});
