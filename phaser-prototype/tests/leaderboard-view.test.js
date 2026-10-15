import test from "node:test";
import assert from "node:assert/strict";
import { PERIODS, buildRows, plantIndex, topPercent } from "../src/leaderboard-view.js";

const entry = name => ({ player_name: name, score: 1000, max_tile: 128, best_combo: 3, reached_stage: 2 });
const board = count => Array.from({ length: count }, (_, i) => entry(`P${i + 1}`));

test("rows are numbered from 1 in board order", () => {
  const rows = buildRows(board(3), null);
  assert.deepEqual(rows.map(r => [r.type, r.rank, r.own]), [["entry", 1, false], ["entry", 2, false], ["entry", 3, false]]);
});

test("the player's own row is marked inside the top list", () => {
  const rows = buildRows(board(5), { rank: 3, entry: entry("Me"), total: 40 });
  assert.deepEqual(rows.map(r => r.own), [false, false, true, false, false]);
  assert.equal(rows.length, 5, "no extra row when already visible");
});

test("a player below the list gets their row after a gap", () => {
  const rows = buildRows(board(20), { rank: 87, entry: entry("Me"), total: 120 });
  assert.equal(rows.length, 22);
  assert.equal(rows[20].type, "gap");
  assert.deepEqual([rows[21].type, rows[21].rank, rows[21].own, rows[21].entry.player_name], ["entry", 87, true, "Me"]);
});

test("the row right after the list needs no gap", () => {
  const rows = buildRows(board(20), { rank: 21, entry: entry("Me"), total: 30 });
  assert.deepEqual(rows.slice(20).map(r => r.type), ["entry"]);
  assert.equal(rows[20].rank, 21);
});

test("a device without an entry adds nothing", () => {
  assert.equal(buildRows(board(4), { rank: null, entry: null, total: 4 }).length, 4);
  assert.equal(buildRows([], { rank: null, entry: null, total: 0 }).length, 0);
  assert.equal(buildRows(board(2), undefined).every(r => !r.own), true);
});

test("plantIndex follows the 2..8192 progression", () => {
  assert.equal(plantIndex(2), 0);
  assert.equal(plantIndex(2048), 10);
  assert.equal(plantIndex(8192), 12);
  assert.equal(plantIndex(100), -1);
  assert.equal(plantIndex(16384), -1);
  assert.equal(plantIndex(undefined), -1);
});

test("topPercent rounds up and ignores nonsense", () => {
  assert.equal(topPercent(1, 100), 1);
  assert.equal(topPercent(5, 100), 5);
  assert.equal(topPercent(7, 120), 6);
  assert.equal(topPercent(120, 120), 100);
  assert.equal(topPercent(1, 1000000), 1);
  assert.equal(topPercent(0, 10), null);
  assert.equal(topPercent(11, 10), null);
  assert.equal(topPercent(null, 10), null);
});

test("there are three boards, all time first", () => {
  assert.deepEqual(PERIODS, ["all", "week", "day"]);
});
