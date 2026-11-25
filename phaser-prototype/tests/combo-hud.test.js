import test from "node:test";
import assert from "node:assert/strict";
import { bloomStage, createComboHud } from "../src/combo-hud.js";

function setup({ quiet = false, reduceMotion = false, flow } = {}) {
  const events = [];
  globalThis.window = { dispatchEvent: event => events.push(event.detail.combo) };
  globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init.detail; } };
  // The flower counts how often its picture is drawn.
  const flower = { draws: 0, drawn: "", set innerHTML(svg) { this.draws++; this.drawn = svg; }, get innerHTML() { return this.drawn; } };
  const hops = [];
  const hud = { hidden: true, animate: (frames, options) => hops.push(options.duration) };
  const value = { textContent: "" };
  const animations = [];
  const keyframes = [];
  const animated = name => ({
    getAnimations: () => [{ cancel: () => animations.push(`cancel ${name}`) }],
    animate: (frames, options) => { keyframes.push([name, frames]); animations.push([name, frames.length, options.duration]); }
  });
  const calls = { merges: [], tiers: 0 };
  const state = { quiet };
  const combo = createComboHud({
    elements: { hud, flower, value, score: animated("score"), board: animated("board") },
    prefs: { reduceMotion },
    quiet: () => state.quiet,
    onMerges: (streak, count) => calls.merges.push([streak, count]),
    onTier: () => { calls.tiers++; },
    ...(flow ? { flow } : {})
  });
  return { combo, events, flower, hud, hops, value, animations, keyframes, calls, state };
}

test("the counter appears from a streak of two merging moves, and a move without a merge ends it", () => {
  const t = setup();
  const first = t.combo.update(1);
  assert.deepEqual(first, { streak: 1, best: 1 });
  assert.equal(t.hud.hidden, true, "one merge is not a combo yet");
  const second = t.combo.update(2);
  assert.deepEqual(second, { streak: 2, best: 2 });
  assert.equal(t.hud.hidden, false);
  assert.equal(t.value.textContent, "×2");
  const broken = t.combo.update(0);
  assert.deepEqual(broken, { streak: 0, best: 2 }, "the best is kept");
  assert.equal(t.hud.hidden, true);
  t.combo.cool();
});

test("every merging move is reported so the piano can play, and a quiet one is not", () => {
  const t = setup();
  t.combo.update(1);
  t.combo.update(0);
  t.combo.update(3);
  assert.deepEqual(t.calls.merges, [[1, 1], [1, 3]]);
  t.combo.cool();
});

test("the energy is published to the page", () => {
  const t = setup();
  t.combo.update(2);
  const last = t.events.at(-1);
  assert.ok(last > 0 && last <= 8);
  t.combo.cool();
  assert.equal(t.events.at(-1), 0);
});

test("the flower opens with the streak's energy: a bud, opening from 3, open from 5, in full bloom at 8", () => {
  assert.equal(bloomStage(0), "bud");
  assert.equal(bloomStage(2.9), "bud");
  assert.equal(bloomStage(3), "budOpen");
  assert.equal(bloomStage(4.9), "budOpen");
  assert.equal(bloomStage(5), "flower");
  assert.equal(bloomStage(7.9), "flower");
  assert.equal(bloomStage(8), "flowerPeak");
});

test("the flower is drawn again only when it changes stage, and closes when the energy is gone", () => {
  let energy = 0;
  const flow = {
    level: () => energy,
    move(merges) { energy = Math.min(8, energy + merges); return { streak: 2, best: 2, flow: energy }; },
    cool() { energy = 0; }, reset() { energy = 0; }, restore() {}
  };
  const t = setup({ flow });
  t.combo.update(1);                // 1: bud
  t.combo.update(1);                // 2: still a bud
  assert.equal(t.flower.draws, 1);
  assert.match(t.flower.drawn, /data-icon="bud"/);
  t.combo.update(1);                // 3: opening
  assert.equal(t.flower.draws, 2);
  assert.match(t.flower.drawn, /data-icon="budOpen"/);
  t.combo.update(5);                // 8: full bloom
  assert.match(t.flower.drawn, /data-icon="flowerPeak"/);
  t.combo.cool();
  assert.match(t.flower.drawn, /data-icon="bud"/);
});

test("the world is told when the energy climbs past 3, 5 and 8", () => {
  // a flow whose energy the test controls
  let energy = 0;
  const flow = {
    level: () => energy,
    move(merges) { energy += merges * 2; return { streak: 1, best: 1, flow: energy }; },
    cool() { energy = 0; }, reset() { energy = 0; }, restore() {}
  };
  const t = setup({ flow });
  t.combo.update(1);                // 0 -> 2
  assert.equal(t.calls.tiers, 0);
  t.combo.update(1);                // 2 -> 4: crosses 3
  assert.equal(t.calls.tiers, 1);
  t.combo.update(1);                // 4 -> 6: crosses 5
  assert.equal(t.calls.tiers, 2);
  t.combo.update(0);                // no change
  assert.equal(t.calls.tiers, 2);
  t.combo.update(2);                // 6 -> 10: crosses 8
  assert.equal(t.calls.tiers, 3);
  t.combo.cool();
});

test("while a dialog is open or the page is hidden the energy settles to nothing", () => {
  const t = setup({ quiet: true });
  t.combo.update(3);
  assert.equal(t.events.at(-1), 0);
});

test("a new game clears the streak and the counter; a restored game keeps its streak", () => {
  const t = setup();
  t.combo.update(1);
  t.combo.update(1);
  t.combo.reset();
  assert.equal(t.hud.hidden, true);
  assert.deepEqual(t.combo.update(1), { streak: 1, best: 1 }, "starting again from nothing");

  t.combo.reset();
  t.combo.restore(4, 9);
  assert.deepEqual(t.combo.update(1), { streak: 5, best: 9 });
  t.combo.cool();
});

test("merging pulses the score and the board, more for a double merge, and not when motion is reduced", () => {
  const t = setup();
  t.combo.pulse(1);
  assert.deepEqual(t.animations, ["cancel score", "cancel board", ["score", 3, 240], ["board", 3, 220]]);
  t.animations.length = 0;
  t.combo.pulse(2);
  assert.deepEqual(t.animations.slice(2), [["score", 3, 240], ["board", 3, 250]]);
  t.animations.length = 0;
  t.combo.pulse(0);
  assert.deepEqual(t.animations, []);
  const calm = setup({ reduceMotion: true });
  calm.combo.pulse(3);
  assert.deepEqual(calm.animations, []);
});

// The bounce only grows and shrinks the board. An animated filter makes a
// phone repaint the whole board every frame of it: on a Galaxy M31 that was
// most of the frames slower than 50 ms while tiles slid.
test("the board's bounce animates only its size, never a filter", () => {
  const t = setup();
  t.combo.pulse(1);
  t.combo.pulse(2);
  const board = t.keyframes.filter(([name]) => name === "board").flatMap(([, frames]) => frames);
  assert.ok(board.length > 0);
  for (const frame of board) assert.deepEqual(Object.keys(frame).filter(key => key !== "offset"), ["transform"]);
});

test("the badge hops when the streak grows, and not when motion is reduced", () => {
  const t = setup();
  t.combo.update(1);
  t.combo.update(1);
  t.combo.update(1);
  assert.equal(t.hops.length, 2, "once per move while it shows");
  const calm = setup({ reduceMotion: true });
  calm.combo.update(1);
  calm.combo.update(1);
  assert.equal(calm.hops.length, 0);
  t.combo.cool();
});
