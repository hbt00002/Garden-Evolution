import test from "node:test";
import assert from "node:assert/strict";
import { setFrameLimit } from "../src/frame-rate.js";

function fakeLoop({ limit = 0, running = true } = {}) {
  const calls = [];
  return {
    calls, running, fpsLimit: limit, hasFpsLimit: limit > 0, _limitRate: limit > 0 ? 1000 / limit : 0,
    sleep() { calls.push("sleep"); this.running = false; },
    wake() { calls.push("wake"); this.running = true; }
  };
}

test("a loop can be released from its limit and limited again", () => {
  const loop = fakeLoop({ limit: 30 });
  setFrameLimit(loop, 0);
  assert.equal(loop.hasFpsLimit, false);
  assert.equal(loop._limitRate, 0);
  assert.equal(loop.fpsLimit, 0);
  setFrameLimit(loop, 30);
  assert.equal(loop.hasFpsLimit, true);
  assert.ok(Math.abs(loop._limitRate - 1000 / 30) < 1e-9);
});

test("a running loop is restarted so Phaser picks the right step function", () => {
  const loop = fakeLoop({ limit: 30 });
  setFrameLimit(loop, 0);
  assert.deepEqual(loop.calls, ["sleep", "wake"]);
  assert.equal(loop.running, true);
});

test("nothing is restarted when the limit does not change, or the loop is asleep", () => {
  const same = fakeLoop({ limit: 30 });
  setFrameLimit(same, 30);
  assert.deepEqual(same.calls, []);
  const asleep = fakeLoop({ limit: 30, running: false });
  setFrameLimit(asleep, 0);
  assert.deepEqual(asleep.calls, [], "it will start with the right step when it wakes");
  assert.equal(asleep.hasFpsLimit, false);
});
