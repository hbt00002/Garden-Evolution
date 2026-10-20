import test from "node:test";
import assert from "node:assert/strict";

class FakeElement {
  constructor({ interactive = false } = {}) { this.interactive = interactive; this.listeners = {}; }
  addEventListener(type, fn, options) { (this.listeners[type] ||= []).push({ fn, options }); }
  closest() { return this.interactive ? this : null; }
  fire(type, event = {}) {
    const prevented = { value: false };
    (this.listeners[type] || []).forEach(({ fn }) => fn({ target: this, preventDefault: () => { prevented.value = true; }, ...event }));
    return prevented.value;
  }
}

async function setup({ blocked = false } = {}) {
  globalThis.Element = FakeElement;
  globalThis.HTMLElement = class {};
  const win = new FakeElement();
  globalThis.window = win;
  const board = new FakeElement();
  const moves = [];
  const state = { blocked, gestures: 0 };
  const { installControls } = await import(`../src/controls.js?${Math.random()}`);
  installControls({ board, onMove: dir => moves.push(dir), blocked: () => state.blocked, onGesture: () => state.gestures++ });
  return { win, board, moves, state };
}

const key = (win, code, extra = {}) => win.fire("keydown", { code, key: code, target: {}, ...extra });

test("arrow keys and WASD make moves, and stop the page from scrolling", async () => {
  const t = await setup();
  assert.equal(key(t.win, "ArrowLeft"), true);
  assert.equal(key(t.win, "KeyW"), true);
  assert.deepEqual(t.moves, ["left", "up"]);
  assert.equal(t.state.gestures, 2);
});

test("other keys, shortcuts and a blocked game are left alone", async () => {
  const t = await setup();
  assert.equal(key(t.win, "KeyQ"), false);
  assert.equal(key(t.win, "KeyA", { ctrlKey: true }), false);
  t.state.blocked = true;
  assert.equal(key(t.win, "ArrowUp"), false, "the key still scrolls a dialog's list");
  assert.deepEqual(t.moves, []);
});

test("a swipe on the board makes one move, then waits for the next touch", async () => {
  const t = await setup();
  t.board.fire("pointerdown", { clientX: 100, clientY: 100, pointerId: 1 });
  t.board.fire("pointermove", { clientX: 110, clientY: 105, pointerId: 1 });   // too short
  t.board.fire("pointermove", { clientX: 160, clientY: 110, pointerId: 1 });   // far enough
  t.board.fire("pointermove", { clientX: 220, clientY: 110, pointerId: 1 });   // already used
  assert.deepEqual(t.moves, ["right"]);
  assert.equal(t.state.gestures, 1);
});

test("another finger, a cancelled touch or a control on the board does not swipe", async () => {
  const t = await setup();
  t.board.fire("pointerdown", { clientX: 100, clientY: 100, pointerId: 1 });
  t.board.fire("pointermove", { clientX: 200, clientY: 100, pointerId: 2 });
  assert.deepEqual(t.moves, []);
  t.board.fire("pointercancel", { pointerId: 1 });
  t.board.fire("pointermove", { clientX: 200, clientY: 100, pointerId: 1 });
  assert.deepEqual(t.moves, []);

  const button = new FakeElement({ interactive: true });
  t.board.fire("pointerdown", { target: button, clientX: 1, clientY: 1, pointerId: 3 });
  t.board.fire("pointermove", { target: button, clientX: 90, clientY: 1, pointerId: 3 });
  assert.deepEqual(t.moves, []);
});

test("the board keeps the browser from scrolling under a finger, except on its controls", async () => {
  const t = await setup();
  assert.equal(t.board.fire("touchstart"), true);
  assert.equal(t.board.fire("touchmove"), true);
  assert.equal(t.board.fire("touchstart", { target: new FakeElement({ interactive: true }) }), false);
  assert.equal(t.board.listeners.touchstart[0].options.passive, false);
});
