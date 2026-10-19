import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, parseOverrides, resolveFeatures } from "../src/features.js";
import {
  ART_ASPECT, clampOffset, dragOffset, easeInOutCubic, fractionForOffset, normalFocus, offsetForFraction,
  panExtent, positionAt, revealPath
} from "../src/pan.js";

/* ---------- Feature switches ---------- */

test("every feature is on by default", () => {
  assert.deepEqual({ ...DEFAULTS }, { gardenView: true, worldReveal: true });
  assert.deepEqual(resolveFeatures(), { gardenView: true, worldReveal: true });
});

test("the address can switch a feature off or on", () => {
  assert.deepEqual(resolveFeatures({ search: "?features=-gardenView" }), { gardenView: false, worldReveal: true });
  assert.deepEqual(resolveFeatures({ search: "?features=-gardenView,-worldReveal" }), { gardenView: false, worldReveal: false });
  assert.deepEqual(resolveFeatures({ search: "?x=1&features=gardenView=off" }), { gardenView: false, worldReveal: true });
  assert.deepEqual(resolveFeatures({ search: "?features=worldReveal=0,gardenView=on" }), { gardenView: true, worldReveal: false });
});

test("a saved setting applies, and the address wins over it", () => {
  assert.deepEqual(resolveFeatures({ stored: "-worldReveal" }), { gardenView: true, worldReveal: false });
  assert.deepEqual(resolveFeatures({ stored: "-worldReveal", search: "?features=+worldReveal" }), { gardenView: true, worldReveal: true });
});

test("unknown or malformed switches are ignored", () => {
  assert.deepEqual(parseOverrides("-nothing,+alsoNothing,,  ,gardenView=maybe"), { gardenView: true });
  assert.deepEqual(parseOverrides(null), {});
  assert.deepEqual(parseOverrides("__proto__,-constructor,-toString"), {});
  assert.deepEqual(resolveFeatures({ search: "?features=" }), { gardenView: true, worldReveal: true });
});

/* ---------- Panning ---------- */

test("a portrait phone can slide across most of the painting", () => {
  const { canvasWidth, maxOffset } = panExtent(390, 844);
  assert.equal(canvasWidth, Math.round(844 * ART_ASPECT));
  assert.equal(maxOffset, canvasWidth - 390);
  assert.ok(maxOffset > 1000, "there is a lot to look at");
  // Only about a quarter of the painting is visible at rest.
  assert.ok(390 / canvasWidth < 0.3);
});

test("a screen as wide as the painting has nothing to slide", () => {
  for (const [w, h] of [[1280, 720], [844, 390], [1920, 1080], [2560, 1080], [915, 412]]) {
    assert.deepEqual(panExtent(w, h), { canvasWidth: w, maxOffset: 0 }, `${w}x${h}`);
  }
});

test("the moonlit world rests off-centre on narrow screens, the others in the middle", () => {
  assert.equal(normalFocus(1, 390, 844), 0.5);
  assert.equal(normalFocus(4, 390, 844), 0.5);
  assert.equal(normalFocus(5, 390, 844), 0.72);  // 0.46
  assert.equal(normalFocus(5, 600, 900), 0.68);  // 0.67
  assert.equal(normalFocus(5, 800, 900), 0.62);  // 0.89
  assert.equal(normalFocus(5, 1280, 720), 0.5);
});

test("offsets stay inside the painting", () => {
  assert.equal(clampOffset(-20, 500), 0);
  assert.equal(clampOffset(700, 500), 500);
  assert.equal(clampOffset(250, 500), 250);
  assert.equal(clampOffset(250, 0), 0);
  assert.equal(clampOffset(250, -5), 0);
  assert.equal(offsetForFraction(0.5, 800), 400);
  assert.equal(offsetForFraction(2, 800), 800);
  assert.equal(fractionForOffset(400, 800), 0.5);
  assert.equal(fractionForOffset(0, 0), 0.5, "nothing to slide: the middle");
});

test("dragging moves the painting with the finger", () => {
  assert.equal(dragOffset(300, 200, 150, 1000), 350, "finger moved left: reveal more on the right");
  assert.equal(dragOffset(300, 200, 260, 1000), 240);
  assert.equal(dragOffset(30, 200, 400, 1000), 0, "cannot go past the left edge");
  assert.equal(dragOffset(950, 200, 100, 1000), 1000, "cannot go past the right edge");
});

test("easing starts and ends gently", () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.equal(easeInOutCubic(0.5), 0.5);
  assert.ok(easeInOutCubic(0.1) < 0.1, "slow start");
  assert.ok(easeInOutCubic(0.9) > 0.9, "slow finish");
  assert.equal(easeInOutCubic(-3), 0);
  assert.equal(easeInOutCubic(7), 1);
});

test("the guided look starts and ends exactly where the background rests", () => {
  for (const focus of [0.5, 0.72, 0.62]) {
    const path = revealPath(focus, { pannable: true });
    assert.equal(positionAt(path, 0), focus);
    assert.equal(positionAt(path, path.duration), focus);
    assert.equal(positionAt(path, path.duration + 5000), focus, "stays put after the end");
    assert.ok(path.duration >= 3500 && path.duration <= 5000, `${path.duration} ms is a short look`);
  }
});

test("the guided look reaches both edges and never leaves the painting", () => {
  const path = revealPath(0.5, { pannable: true });
  let low = 1, high = 0;
  for (let t = 0; t <= path.duration; t += 20) {
    const position = positionAt(path, t);
    assert.ok(position >= 0 && position <= 1, `${position} at ${t} ms`);
    low = Math.min(low, position);
    high = Math.max(high, position);
  }
  assert.ok(low <= 0.05 && high >= 0.95);
});

test("a screen with nothing to slide just holds still", () => {
  const path = revealPath(0.5, { pannable: false });
  assert.equal(positionAt(path, 0), 0.5);
  assert.equal(positionAt(path, 1500), 0.5);
  assert.equal(positionAt(path, 99999), 0.5);
  assert.ok(path.duration > 2000);
});
