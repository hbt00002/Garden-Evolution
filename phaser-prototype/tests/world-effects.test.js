import test from "node:test";
import assert from "node:assert/strict";
import { createWorldEffects } from "../src/world-effects.js";

function setup({ calm = false, particlesOn = true, reduceMotion = false, hidden = false, perfLow = false } = {}) {
  const classes = new Set();
  const env = { classList: { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)) } };
  const motes = [];
  const layer = { appendChild: mote => motes.push(mote) };
  globalThis.document = {
    hidden,
    body: { classList: { contains: name => name === "perf-low" && perfLow } },
    createElement: () => ({
      className: "", textContent: "", props: {}, style: { setProperty(k, v) { this.props = this.props || {}; (this.owner ||= {})[k] = v; } },
      listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; }, remove() { this.removed = true; }
    })
  };
  globalThis.requestAnimationFrame = fn => fn();
  const prefs = { calm, particlesOn, reduceMotion };
  const fx = createWorldEffects({ env, layer, prefs, getStage: () => 2 });
  return { fx, classes, motes, prefs };
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test("a world's flourish adds its glyphs and its stage class, then clears the class", async () => {
  const t = setup();
  t.fx.event(3, false);
  assert.equal(t.motes.length, 5);
  assert.ok(t.classes.has("event-stage-3"));
  assert.ok(t.classes.has("gust"), "worlds 1-3 get a light gust");
  assert.equal(t.motes[0].textContent, "✿");
  t.motes[0].listeners.animationend();
  assert.equal(t.motes[0].removed, true, "each glyph removes itself when done");
});

test("a strong flourish has more glyphs, a weak device fewer", () => {
  assert.equal((() => { const t = setup(); t.fx.event(1, true); return t.motes.length; })(), 8);
  assert.equal((() => { const t = setup({ perfLow: true }); t.fx.event(1, true); return t.motes.length; })(), 3);
  const late = setup();
  late.fx.event(4, false);
  assert.ok(late.classes.has("gust-strong"), "the later worlds have a stronger breeze");
});

test("nothing moves when the player wants calm, has particles off, or the page is hidden", () => {
  for (const options of [{ calm: true }, { particlesOn: false }, { hidden: true }]) {
    const t = setup(options);
    t.fx.event(2, true);
    assert.equal(t.motes.length, 0, JSON.stringify(options));
    assert.equal([...t.classes].length, 0, JSON.stringify(options));
  }
});

test("a gust is skipped when the system asks for reduced motion", () => {
  const t = setup({ reduceMotion: true });
  t.fx.gust(true);
  assert.equal(t.classes.size, 0);
  const normal = setup();
  normal.fx.gust(false);
  assert.ok(normal.classes.has("gust"));
  normal.fx.gust(true);
  assert.ok(normal.classes.has("gust-strong"));
});

test("the veil for a new world is brief, and shorter still when calm", async () => {
  const quick = setup({ calm: true });
  quick.fx.transition();
  assert.ok(quick.classes.has("stage-soft-transition"));
  await wait(160);
  assert.equal(quick.classes.has("stage-soft-transition"), false);
});
