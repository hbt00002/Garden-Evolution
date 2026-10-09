import test from "node:test";
import assert from "node:assert/strict";
import { applyMove, boardToGrid, createGame, replayGame } from "../src/game-core.js";
import { hasMoves, isSessionUsable, parseSavedGame, serializeGame } from "../src/game-save.js";

const NOW = Date.UTC(2026, 9, 8, 12, 0, 0);
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const SID = "0b9d6c3e-6a43-4a0e-9d5b-0c1d2e3f4a5b";
const SIG = "ab".repeat(32);

// A real run that is still going: a few dozen moves from a known seed.
function liveRun(seed = 77, count = 40) {
  const game = createGame(seed);
  const order = ["left", "down", "right", "up"];
  for (let i = 0; game.moves.length < count && !game.over; i++) {
    for (let k = 0; k < 4; k++) if (applyMove(game, order[(i + k) % 4])) break;
  }
  return game;
}

const session = (overrides = {}) => ({ sid: SID, iat: NOW - 30 * MINUTE, sig: SIG, seed: 77, ...overrides });
const save = (overrides = {}, at = NOW) => {
  const run = liveRun();
  return serializeGame({ seed: run.seed, moves: run.moves, session: null, ...overrides }, at);
};
const tamper = (mutate, at = NOW) => {
  const data = JSON.parse(save({}, at));
  mutate(data);
  return JSON.stringify(data);
};

test("a saved run restores exactly the game its moves produce", () => {
  const run = liveRun();
  const restored = parseSavedGame(save(), NOW + MINUTE);
  assert.equal(restored.seed, 77);
  assert.equal(restored.moves, run.moves);
  assert.deepEqual(restored.board, boardToGrid(run.board));
  assert.equal(restored.score, run.score);
  assert.equal(restored.maxValueReached, run.maxTile);
  assert.equal(restored.bestCombo, run.bestCombo);
  assert.equal(restored.streak, run.streak);
  assert.equal(restored.completedMoves, run.moves.length);
  assert.equal(restored.goldenAchieved, false);
  assert.equal(restored.rngState, run.rng.s);
  assert.equal(restored.session, null);
});

test("the restored random stream continues where the run left off", () => {
  const run = liveRun();
  const restored = parseSavedGame(save(), NOW);
  const resumed = replayGame(restored.seed, restored.moves);
  applyMove(run, "left") || applyMove(run, "up") || applyMove(run, "right") || applyMove(run, "down");
  const next = run.moves.slice(-1);
  const direction = { L: "left", R: "right", U: "up", D: "down" }[next];
  applyMove(resumed, direction);
  assert.deepEqual(resumed.board, run.board);
});

test("the save stays small: only the seed, the moves and the session", () => {
  assert.deepEqual(Object.keys(JSON.parse(save())).sort(), ["moves", "savedAt", "seed", "session", "version"]);
});

test("anything that is not a valid save is ignored", () => {
  for (const raw of [null, undefined, "", "{", "[]", "null", "42", JSON.stringify({ version: 2 }), "x".repeat(40000)]) {
    assert.equal(parseSavedGame(raw, NOW), null);
  }
});

test("old saves, which cannot be verified, are ignored", () => {
  assert.equal(parseSavedGame(tamper(data => { data.version = 1; }), NOW), null);
  assert.equal(parseSavedGame(tamper(data => { data.version = 3; }), NOW), null);
});

test("a record that is not a legal game is rejected", () => {
  assert.equal(parseSavedGame(tamper(data => { data.moves = "LLXD"; }), NOW), null);
  assert.equal(parseSavedGame(tamper(data => { data.moves = ""; }), NOW), null);
  assert.equal(parseSavedGame(tamper(data => { data.moves = 12; }), NOW), null);
  assert.equal(parseSavedGame(tamper(data => { data.seed = -1; }), NOW), null);
  assert.equal(parseSavedGame(tamper(data => { data.seed = 1.5; }), NOW), null);
  assert.equal(parseSavedGame(tamper(data => { data.seed = 2 ** 32; }), NOW), null);
});

test("a run that has ended is never resumed", () => {
  const game = createGame(5);
  let guard = 0;
  while (!game.over && guard++ < 20000) {
    for (const dir of ["left", "down", "right", "up"]) if (applyMove(game, dir)) break;
  }
  assert.ok(game.over);
  assert.equal(parseSavedGame(serializeGame({ seed: 5, moves: game.moves }, NOW), NOW), null);
});

test("saves expire after two weeks and cannot come from the future", () => {
  assert.ok(parseSavedGame(save({}, NOW - 13 * DAY), NOW));
  assert.equal(parseSavedGame(save({}, NOW - 15 * DAY), NOW), null);
  assert.equal(parseSavedGame(save({}, NOW + 3 * DAY), NOW), null);
  assert.equal(parseSavedGame(tamper(data => { data.savedAt = "yesterday"; }), NOW), null);
});

test("a fresh leaderboard session is restored with the run", () => {
  assert.deepEqual(parseSavedGame(save({ session: session() }), NOW).session, session());
});

test("a session from a day-old run is still restored", () => {
  const old = session({ iat: NOW - DAY });
  assert.deepEqual(parseSavedGame(save({ session: old }, NOW - DAY + MINUTE), NOW).session, old);
});

test("a stale or invalid session is dropped without losing the board", () => {
  const cases = [
    session({ iat: NOW - 14 * DAY }),
    session({ iat: NOW - 14 * DAY + 5 * MINUTE - 1 }),
    session({ iat: NOW + MINUTE }),
    session({ iat: "yesterday" }),
    session({ sig: undefined }),
    session({ sid: 7 }),
    session({ sid: "x".repeat(65) }),
    session({ seed: undefined }),
    session({ seed: -5 }),
    session({ seed: 2 ** 32 }),
    "session",
    []
  ];
  for (const bad of cases) {
    const restored = parseSavedGame(save({ session: bad }), NOW);
    assert.ok(restored, JSON.stringify(bad));
    assert.equal(restored.session, null, JSON.stringify(bad));
    assert.equal(restored.completedMoves, 40);
  }
});

test("isSessionUsable matches what a restore would keep", () => {
  assert.equal(isSessionUsable(session(), NOW), true);
  assert.equal(isSessionUsable(session({ iat: NOW - 14 * DAY }), NOW), false);
  assert.equal(isSessionUsable(null, NOW), false);
});

test("unexpected extra fields in the save are not carried over", () => {
  const restored = parseSavedGame(tamper(data => { data.score = 999999; data.extra = { x: 1 }; }), NOW);
  assert.ok(restored);
  assert.ok(!("extra" in restored));
  assert.notEqual(restored.score, 999999, "the score comes from the replay, not the file");
});

test("hasMoves: a full board that can still merge is resumable", () => {
  const stuck = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
  assert.equal(hasMoves(stuck), false);
  stuck[3][3] = 4;
  assert.equal(hasMoves(stuck), true);
});
