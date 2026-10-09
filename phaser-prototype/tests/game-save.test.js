import test from "node:test";
import assert from "node:assert/strict";
import { hasMoves, parseSavedGame, serializeGame } from "../src/game-save.js";

const NOW = Date.UTC(2026, 9, 8, 12, 0, 0);
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const state = (overrides = {}) => ({
  board: [
    [2, 4, 0, 0],
    [0, 8, 16, 0],
    [0, 0, 0, 32],
    [0, 0, 0, 0]
  ],
  score: 120,
  maxValueReached: 32,
  bestCombo: 3,
  completedMoves: 14,
  goldenAchieved: false,
  session: null,
  ...overrides
});

const save = (overrides, at = NOW) => serializeGame(state(overrides), at);
const tamper = (mutate, at = NOW) => {
  const data = JSON.parse(save({}, at));
  mutate(data);
  return JSON.stringify(data);
};

test("a saved game round-trips unchanged", () => {
  const restored = parseSavedGame(save(), NOW + MINUTE);
  assert.deepEqual(restored, state());
});

test("the golden milestone flag and combo record survive", () => {
  const restored = parseSavedGame(save({ goldenAchieved: true, bestCombo: 17, maxValueReached: 2048, board: [[2048, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] }), NOW);
  assert.equal(restored.goldenAchieved, true);
  assert.equal(restored.bestCombo, 17);
  assert.equal(restored.maxValueReached, 2048);
});

test("the restored board is a copy, not the parsed object", () => {
  const raw = save();
  const a = parseSavedGame(raw, NOW);
  const b = parseSavedGame(raw, NOW);
  a.board[0][0] = 1024;
  assert.equal(b.board[0][0], 2);
});

test("anything that is not a valid save is ignored", () => {
  for (const raw of [null, undefined, "", "{", "[]", "null", "42", '"x"', {}, "x".repeat(5000)]) {
    assert.equal(parseSavedGame(raw, NOW), null, String(raw).slice(0, 20));
  }
});

test("unknown versions are ignored", () => {
  assert.equal(parseSavedGame(tamper(d => { d.version = 2; }), NOW), null);
  assert.equal(parseSavedGame(tamper(d => { delete d.version; }), NOW), null);
});

test("malformed boards are rejected", () => {
  const bad = [
    d => { d.board = null; },
    d => { d.board = d.board.slice(0, 3); },
    d => { d.board[0] = d.board[0].slice(0, 3); },
    d => { d.board[1][1] = 3; },
    d => { d.board[1][1] = -8; },
    d => { d.board[1][1] = 8.5; },
    d => { d.board[1][1] = "8"; },
    d => { d.board[1][1] = 16384; },
    d => { d.board[1][1] = 1; },
    d => { d.board[1][1] = null; },
    d => { d.board = Array.from({ length: 4 }, () => [0, 0, 0, 0]); }
  ];
  bad.forEach((mutate, index) => assert.equal(parseSavedGame(tamper(mutate), NOW), null, `case ${index}`));
});

test("out-of-range or non-integer numbers are rejected", () => {
  const bad = [
    d => { d.score = -1; },
    d => { d.score = 100_000_001; },
    d => { d.score = 1.5; },
    d => { d.score = "120"; },
    d => { d.bestCombo = 1001; },
    d => { d.completedMoves = -1; },
    d => { d.goldenAchieved = "yes"; },
    d => { d.maxValueReached = 16; },
    d => { d.maxValueReached = 33; },
    d => { d.maxValueReached = 0; }
  ];
  bad.forEach((mutate, index) => assert.equal(parseSavedGame(tamper(mutate), NOW), null, `case ${index}`));
});

test("a run with no moves left is never resumed", () => {
  const stuck = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2]
  ];
  assert.equal(hasMoves(stuck), false);
  assert.equal(parseSavedGame(save({ board: stuck, maxValueReached: 4 }), NOW), null);
});

test("a full board that can still merge is resumed", () => {
  const board = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 4]
  ];
  assert.equal(hasMoves(board), true);
  assert.ok(parseSavedGame(save({ board, maxValueReached: 4 }), NOW));
});

test("saves expire after two weeks and cannot come from the future", () => {
  assert.ok(parseSavedGame(save({}, NOW - 13 * 24 * HOUR), NOW));
  assert.equal(parseSavedGame(save({}, NOW - 15 * 24 * HOUR), NOW), null);
  assert.equal(parseSavedGame(save({}, NOW + 3 * 24 * HOUR), NOW), null);
});

test("a fresh leaderboard session is restored with the game", () => {
  const session = { sid: "0b9d6c3e-6a43-4a0e-9d5b-0c1d2e3f4a5b", iat: NOW - 30 * MINUTE, sig: "ab".repeat(32) };
  assert.deepEqual(parseSavedGame(save({ session }), NOW).session, session);
});

test("a stale or invalid session is dropped without losing the board", () => {
  const sid = "0b9d6c3e-6a43-4a0e-9d5b-0c1d2e3f4a5b";
  const sig = "ab".repeat(32);
  const cases = [
    { sid, iat: NOW - 2 * HOUR, sig },
    { sid, iat: NOW - 115 * MINUTE - 1, sig },
    { sid, iat: NOW + MINUTE, sig },
    { sid, iat: "yesterday", sig },
    { sid, iat: NOW - MINUTE },
    { sid: 7, iat: NOW - MINUTE, sig },
    { sid: "x".repeat(65), iat: NOW - MINUTE, sig },
    "session",
    []
  ];
  for (const session of cases) {
    const restored = parseSavedGame(save({ session }), NOW);
    assert.ok(restored, JSON.stringify(session));
    assert.equal(restored.session, null, JSON.stringify(session));
    assert.equal(restored.score, 120);
  }
});

test("unexpected extra fields in the save are not carried over", () => {
  const restored = parseSavedGame(tamper(d => { d.__proto__x = 1; d.evil = "<script>"; d.session = { sid: "a", iat: NOW - 1, sig: "b", extra: 1 }; }), NOW);
  assert.equal("evil" in restored, false);
  assert.deepEqual(Object.keys(restored.session).sort(), ["iat", "sid", "sig"]);
});
