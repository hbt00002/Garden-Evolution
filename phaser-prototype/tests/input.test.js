import test from "node:test";
import assert from "node:assert/strict";
import { directionForKey } from "../src/input.js";

test("arrow keys and WASD move", () => {
  assert.equal(directionForKey({ key: "ArrowLeft", code: "ArrowLeft" }), "left");
  assert.equal(directionForKey({ key: "ArrowDown", code: "ArrowDown" }), "down");
  assert.equal(directionForKey({ key: "w", code: "KeyW" }), "up");
  assert.equal(directionForKey({ key: "D", code: "KeyD" }), "right");
});

test("WASD works on layouts whose letters are not Latin", () => {
  assert.equal(directionForKey({ key: "ц", code: "KeyW" }), "up");
  assert.equal(directionForKey({ key: "ф", code: "KeyA" }), "left");
  assert.equal(directionForKey({ key: "ы", code: "KeyS" }), "down");
  assert.equal(directionForKey({ key: "в", code: "KeyD" }), "right");
});

test("a character without a key code still works", () => {
  assert.equal(directionForKey({ key: "a" }), "left");
});

test("browser shortcuts are never moves", () => {
  for (const code of ["KeyA", "KeyD", "KeyS", "KeyW", "ArrowLeft"]) {
    assert.equal(directionForKey({ key: "x", code, ctrlKey: true }), null, `ctrl+${code}`);
    assert.equal(directionForKey({ key: "x", code, metaKey: true }), null, `meta+${code}`);
    assert.equal(directionForKey({ key: "x", code, altKey: true }), null, `alt+${code}`);
  }
});

test("other keys are ignored", () => {
  assert.equal(directionForKey({ key: "Enter", code: "Enter" }), null);
  assert.equal(directionForKey({ key: "x", code: "KeyX" }), null);
  assert.equal(directionForKey(null), null);
});

import { swipeDirection } from "../src/input.js";

test("a swipe goes the way the finger travelled furthest", () => {
  assert.equal(swipeDirection(60, 10, 24), "right");
  assert.equal(swipeDirection(-60, 10, 24), "left");
  assert.equal(swipeDirection(5, 60, 24), "down");
  assert.equal(swipeDirection(-5, -60, 24), "up");
});

test("a small movement is not a swipe yet, but one long enough in either direction is", () => {
  assert.equal(swipeDirection(10, -10, 24), null);
  assert.equal(swipeDirection(23, 23, 24), null);
  assert.equal(swipeDirection(0, 24, 24), "down");
  assert.equal(swipeDirection(24, 0, 24), "right");
});

test("a perfectly diagonal swipe goes vertical", () => {
  assert.equal(swipeDirection(40, 40, 24), "down");
  assert.equal(swipeDirection(40, -40, 24), "up");
});
