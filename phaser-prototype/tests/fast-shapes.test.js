import test from "node:test";
import assert from "node:assert/strict";
import { FAN_MAX, FAN_MIN, withFastShapes } from "../src/scenes/fast-shapes.js";

function fakeGraphics() {
  const triangles = [];
  return { triangles, fillTriangle: (...p) => triangles.push(p) };
}

const area = ([x1, y1, x2, y2, x3, y3]) => Math.abs((x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1)) / 2;
const total = triangles => triangles.reduce((sum, t) => sum + area(t), 0);

test("a disc is a fan of triangles around its centre and covers nearly the whole circle", () => {
  const g = withFastShapes(fakeGraphics());
  const result = g.fillDisc(100, 50, 20);
  assert.equal(result, g, "chainable like the Phaser methods it replaces");
  assert.ok(g.triangles.every(t => t[0] === 100 && t[1] === 50), "every triangle starts at the centre");
  const circle = Math.PI * 20 * 20;
  assert.ok(total(g.triangles) / circle > 0.97 && total(g.triangles) <= circle, `area ${total(g.triangles) / circle}`);
});

test("an oval takes its full width and height, like fillEllipse", () => {
  const g = withFastShapes(fakeGraphics());
  g.fillOval(0, 0, 40, 10);
  const xs = g.triangles.flatMap(t => [t[2], t[4]]);
  const ys = g.triangles.flatMap(t => [t[3], t[5]]);
  assert.ok(Math.abs(Math.max(...xs) - 20) < 1e-9 && Math.abs(Math.min(...xs) + 20) < 1e-9);
  assert.ok(Math.max(...ys) <= 5 + 1e-9 && Math.min(...ys) >= -5 - 1e-9);
  const ellipse = Math.PI * 20 * 5;
  assert.ok(total(g.triangles) / ellipse > 0.95);
});

test("the number of triangles follows the size, within limits", () => {
  const count = (r) => { const g = withFastShapes(fakeGraphics()); g.fillDisc(0, 0, r); return g.triangles.length; };
  assert.equal(count(0.5), FAN_MIN, "a speck is never below the minimum");
  assert.equal(count(500), FAN_MAX, "a huge glow is capped");
  assert.ok(count(10) > count(3));
});

test("a fan closes on itself", () => {
  const g = withFastShapes(fakeGraphics());
  g.fillDisc(0, 0, 10);
  const first = g.triangles[0], last = g.triangles.at(-1);
  assert.ok(Math.abs(first[2] - last[4]) < 1e-9 && Math.abs(first[3] - last[5]) < 1e-9);
});
