import test from "node:test";
import assert from "node:assert/strict";
import { isPendingExpired, makePendingRun, shouldClearOnDismiss } from "../src/pending-run.js";
import { dayEnd } from "../src/daily.js";

// A finished run that could not be sent, kept to offer on the menu next time.

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-11-27T12:00:00.000Z");
const session = (iat = NOW - 60_000, daily = null) => ({ sid: "s-1", iat, sig: "x", ...(daily ? { daily } : {}) });
const run = (overrides = {}) => makePendingRun({
  mode: "classic", day: null, session: session(), score: 12480, maxTile: 512, bestCombo: 4, reachedStage: 3, moves: "LRUD", now: NOW, ...overrides
});

test("a ranked run is kept with everything needed to send it", () => {
  assert.deepEqual(run(), {
    mode: "classic", day: null, session: session(), score: 12480, maxTile: 512, bestCombo: 4, reachedStage: 3, moves: "LRUD", finishedAt: NOW
  });
});

test("an unranked run (no session) is not kept", () => {
  assert.equal(run({ session: null }), null);
});

test("a normal game can be sent for 14 days after its session began", () => {
  const kept = run({ session: session(NOW) });
  assert.equal(isPendingExpired(kept, NOW + 14 * DAY - 60_000), false);
  assert.equal(isPendingExpired(kept, NOW + 14 * DAY + 1), true);
});

test("today's garden can be sent until 12 hours after its day ends", () => {
  const kept = run({ mode: "daily", day: "2026-11-27", session: session(NOW, "2026-11-27") });
  const end = dayEnd("2026-11-27");
  assert.equal(isPendingExpired(kept, end + 12 * 60 * 60 * 1000 - 1), false);
  assert.equal(isPendingExpired(kept, end + 12 * 60 * 60 * 1000 + 1), true);
});

test("nonsense is treated as expired", () => {
  for (const bad of [null, {}, { session: {} }, { mode: "daily", session: { iat: NOW } }]) assert.equal(isPendingExpired(bad, NOW), true);
});

test("closing the end card forgets this run, unless sending it failed", () => {
  const kept = run();
  assert.equal(shouldClearOnDismiss(kept, { finishedSid: "s-1", sendFailed: false }), true);
  assert.equal(shouldClearOnDismiss(kept, { finishedSid: "s-1", sendFailed: true }), false);
});

test("a run kept from an earlier visit is not forgotten when this visit starts a game", () => {
  assert.equal(shouldClearOnDismiss(run(), { finishedSid: null, sendFailed: false }), false);
  assert.equal(shouldClearOnDismiss(run(), { finishedSid: "another", sendFailed: false }), false);
  assert.equal(shouldClearOnDismiss(null, { finishedSid: "s-1", sendFailed: false }), false);
});
