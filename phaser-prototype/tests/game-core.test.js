import test from "node:test";
import assert from "node:assert/strict";
import { BOARD_SIZE, hasMoves, planMove } from "../src/board.js";
import { createBloomFlow } from "../src/bloom-flow.js";
import {
  DIRECTION_CHARS, applyMove, boardToGrid, createGame, createRng, drawSpawn, nextRandom, replayGame, slide
} from "../src/game-core.js";

const DIRS = ["left", "right", "up", "down"];

// Plays a run to its end with a seeded "player"; the strategy only has to
// produce varied, legal moves.
function playToEnd(seed, strategySeed = seed) {
  const game = createGame(seed);
  const choice = createRng(strategySeed ^ 0x9e3779b9);
  let guard = 0;
  while (!game.over && guard++ < 20000) {
    const first = Math.floor(nextRandom(choice) * 4);
    for (let i = 0; i < 4; i++) {
      if (applyMove(game, DIRS[(first + i) % 4])) break;
    }
  }
  return game;
}

test("the random stream is deterministic and resumable", () => {
  const a = createRng(42), b = createRng(42);
  const first = Array.from({ length: 5 }, () => nextRandom(a));
  assert.deepEqual(first, Array.from({ length: 5 }, () => nextRandom(b)));
  assert.ok(first.every(x => x >= 0 && x < 1));
  const resumed = { s: a.s };
  assert.equal(nextRandom(resumed), nextRandom(a));
  const other = createRng(43);
  assert.notDeepEqual(first, Array.from({ length: 5 }, () => nextRandom(other)));
});

test("a spawn lands on an empty cell and is a 2 about nine times in ten", () => {
  const rng = createRng(7);
  let twos = 0;
  const board = new Array(16).fill(0);
  board[5] = 2;
  for (let i = 0; i < 2000; i++) {
    const spawn = drawSpawn(board, rng);
    assert.equal(board[spawn.index], 0);
    assert.ok(spawn.value === 2 || spawn.value === 4);
    if (spawn.value === 2) twos++;
  }
  assert.ok(twos > 1700 && twos < 1900, `twos=${twos}`);
  assert.equal(drawSpawn(new Array(16).fill(2), rng), null);
});

test("slide agrees with the animation planner on random boards", () => {
  let seed = 99;
  const random = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const values = [0, 0, 0, 2, 2, 4, 4, 8, 16, 4096, 8192];
  for (let round = 0; round < 500; round++) {
    const flat = Array.from({ length: 16 }, () => values[Math.floor(random() * values.length)]);
    for (const dir of DIRS) {
      const grid = boardToGrid(flat);
      const plan = planMove(grid, dir);
      const expected = grid.map(row => row.map(() => 0));
      for (const s of plan.slides) if (!s.absorbed) expected[s.to.r][s.to.c] = grid[s.from.r][s.from.c];
      for (const m of plan.merges) expected[m.to.r][m.to.c] = m.value;
      const board = flat.slice();
      const result = slide(board, dir);
      assert.deepEqual(boardToGrid(board), expected, `${dir} ${JSON.stringify(flat)}`);
      assert.equal(result.moved, plan.moved);
      assert.equal(result.merges, plan.merges.length);
      assert.equal(result.gain, plan.merges.reduce((sum, m) => sum + m.value, 0));
    }
  }
});

test("a run replays to exactly the same game", () => {
  for (const seed of [1, 2, 3, 12345, 4000000000]) {
    const played = playToEnd(seed);
    const replayed = replayGame(seed, played.moves);
    assert.ok(replayed, `seed ${seed}`);
    for (const key of ["score", "maxTile", "bestCombo", "streak", "victory", "over"]) {
      assert.equal(replayed[key], played[key], `${key} (seed ${seed})`);
    }
    assert.deepEqual(replayed.board, played.board);
    assert.equal(replayed.rng.s, played.rng.s);
    assert.ok(replayed.over, "a random run always ends");
  }
});

test("the browser's animation engine and the replay agree move for move", () => {
  // A stand-in for script.js: planMove for the movement, drawSpawn for tiles,
  // bloom-flow for the streak. If this and replayGame ever diverge, honest
  // players' scores would be rejected.
  for (const seed of [11, 22, 33]) {
    const rng = createRng(seed);
    let grid = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
    const spawn = () => {
      const s = drawSpawn(grid.flat(), rng);
      grid[Math.floor(s.index / 4)][s.index % 4] = s.value;
      return s.value;
    };
    let maxTile = Math.max(spawn(), spawn());
    let score = 0;
    const flow = createBloomFlow();
    const choice = createRng(seed + 1);
    let moves = "";
    let state = { streak: 0, best: 0 };
    for (let step = 0; step < 4000 && hasMoves(grid); step++) {
      const first = Math.floor(nextRandom(choice) * 4);
      let plan = null, dir = null;
      for (let i = 0; i < 4 && !plan?.moved; i++) {
        dir = DIRS[(first + i) % 4];
        plan = planMove(grid, dir);
      }
      const next = Array.from({ length: 4 }, () => Array(4).fill(0));
      for (const s of plan.slides) if (!s.absorbed) next[s.to.r][s.to.c] = grid[s.from.r][s.from.c];
      let top = 0;
      for (const m of plan.merges) {
        next[m.to.r][m.to.c] = m.value;
        score += m.value;
        top = Math.max(top, m.value);
        maxTile = Math.max(maxTile, m.value);
      }
      grid = next;
      moves += DIRECTION_CHARS[dir];
      state = flow.move(plan.merges.length, step * 100);
      if (top === 8192) break;
      maxTile = Math.max(maxTile, spawn());
    }
    const replayed = replayGame(seed, moves);
    assert.ok(replayed, `seed ${seed}`);
    assert.equal(replayed.score, score, `score seed ${seed}`);
    assert.equal(replayed.maxTile, maxTile, `maxTile seed ${seed}`);
    assert.equal(replayed.bestCombo, state.best, `bestCombo seed ${seed}`);
    assert.equal(replayed.streak, state.streak, `streak seed ${seed}`);
    assert.deepEqual(boardToGrid(replayed.board), grid);
  }
});

test("impossible or malformed records are rejected", () => {
  const played = playToEnd(5);
  assert.equal(replayGame(5, played.moves + "L"), null, "a move after the end");
  assert.equal(replayGame(5, "X"), null);
  assert.equal(replayGame(5, 12), null);
  assert.equal(replayGame(5, "L".repeat(30001)), null);
  // Another seed deals different tiles, so the same moves hit an illegal one.
  assert.equal(replayGame(6, played.moves), null);
});

test("a move that changes nothing cannot be recorded", () => {
  const game = createGame(8);
  const blocked = ["left", "right", "up", "down"].find(dir => {
    const copy = game.board.slice();
    return !slide(copy, dir).moved;
  });
  if (blocked) assert.equal(replayGame(8, DIRECTION_CHARS[blocked]), null);
  assert.equal(game.board.filter(Boolean).length, 2);
});

test("the 8192 merge ends the run on the winning board", () => {
  const game = createGame(1);
  game.board.fill(0);
  game.board[0] = 4096;
  game.board[1] = 4096;
  assert.equal(applyMove(game, "left"), true);
  assert.equal(game.victory, true);
  assert.equal(game.over, true);
  assert.equal(game.board.filter(Boolean).length, 1, "no tile is added after the win");
  assert.equal(game.score, 8192);
  assert.equal(applyMove(game, "right"), false);
});

test("replaying a long run is fast enough for a Worker request", () => {
  // A long, legal record: keep sliding left/down/right/up, which survives for
  // many moves. 4000 moves is more than a full 8192 run needs.
  const game = createGame(2024);
  const order = ["left", "down", "right", "up"];
  let i = 0;
  while (!game.over && game.moves.length < 4000) {
    for (let k = 0; k < 4; k++) if (applyMove(game, order[(i + k) % 4])) break;
    i++;
  }
  const moves = game.moves;
  replayGame(2024, moves); // warm up the JIT
  const started = performance.now();
  replayGame(2024, moves);
  const elapsed = performance.now() - started;
  console.log(`replayed ${moves.length} moves in ${elapsed.toFixed(2)} ms`);
  assert.ok(elapsed < 50, `${elapsed} ms`);
});
