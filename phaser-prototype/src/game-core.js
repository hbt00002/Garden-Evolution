// The complete, deterministic rules of one run. The browser plays a run with
// the same random stream the Worker later replays from the recorded moves, so
// a finished run can be verified instead of trusted.
//
// Everything here is pure and allocation-light: the Worker replays thousands
// of moves within a request, so a board is a flat row-major array of 16 values
// (0 = empty) rather than the objects the animations use.
import { FINAL_TILE_VALUE } from "./game-rules.js";

export const SIZE = 4;
export const CELLS = SIZE * SIZE;
export const MAX_MOVES = 30000;

export const DIRECTION_CHARS = { left: "L", right: "R", up: "U", down: "D" };
const CHAR_DIRECTIONS = { L: "left", R: "right", U: "up", D: "down" };

/* ---------- Random stream ---------- */

// mulberry32: a 32-bit state, so a run is identified by one number and its
// stream can be resumed from the state alone.
export function createRng(seed) {
  return { s: seed >>> 0 };
}

export function nextRandom(rng) {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Where and what the next tile is: a uniformly random empty cell (row-major
// order), a 2 nine times out of ten, otherwise a 4. Returns null on a full board.
export function drawSpawn(board, rng) {
  let empty = 0;
  for (let i = 0; i < CELLS; i++) if (board[i] === 0) empty++;
  if (!empty) return null;
  let pick = Math.floor(nextRandom(rng) * empty);
  const value = nextRandom(rng) < 0.9 ? 2 : 4;
  for (let i = 0; i < CELLS; i++) {
    if (board[i] === 0 && pick-- === 0) return { index: i, value };
  }
  return null;
}

/* ---------- Moving ---------- */

const START = {
  left: i => i * SIZE, right: i => i * SIZE + SIZE - 1,
  up: i => i, down: i => (SIZE - 1) * SIZE + i
};
const STEP = { left: 1, right: -1, up: SIZE, down: -SIZE };
const lane = [0, 0, 0, 0];

// Slides and merges the board in place. Returns { moved, gain, merges, top }:
// the score earned, the number of merges and the biggest tile a merge made.
export function slide(board, dir) {
  const start = START[dir];
  const step = STEP[dir];
  let moved = false;
  let gain = 0;
  let merges = 0;
  let top = 0;
  for (let line = 0; line < SIZE; line++) {
    const first = start(line);
    let write = 0;
    let previous = 0;
    lane[0] = lane[1] = lane[2] = lane[3] = 0;
    for (let k = 0; k < SIZE; k++) {
      const value = board[first + k * step];
      if (!value) continue;
      if (previous === value && value < FINAL_TILE_VALUE) {
        lane[write - 1] = value * 2;
        gain += value * 2;
        merges++;
        if (value * 2 > top) top = value * 2;
        previous = 0;
      } else {
        lane[write++] = value;
        previous = value;
      }
    }
    for (let k = 0; k < SIZE; k++) {
      const cell = first + k * step;
      if (board[cell] !== lane[k]) {
        board[cell] = lane[k];
        moved = true;
      }
    }
  }
  return { moved, gain, merges, top };
}

export function canMove(board) {
  for (let i = 0; i < CELLS; i++) {
    const value = board[i];
    if (!value) return true;
    if (value >= FINAL_TILE_VALUE) continue;
    if (i % SIZE < SIZE - 1 && board[i + 1] === value) return true;
    if (i + SIZE < CELLS && board[i + SIZE] === value) return true;
  }
  return false;
}

/* ---------- A whole run ---------- */

export function createGame(seed) {
  const game = {
    seed: seed >>> 0,
    rng: createRng(seed),
    board: new Array(CELLS).fill(0),
    score: 0,
    maxTile: 0,
    streak: 0,
    bestCombo: 0,
    moves: "",
    victory: false,
    over: false
  };
  addSpawn(game);
  addSpawn(game);
  return game;
}

function addSpawn(game) {
  const spawn = drawSpawn(game.board, game.rng);
  if (!spawn) return;
  game.board[spawn.index] = spawn.value;
  if (spawn.value > game.maxTile) game.maxTile = spawn.value;
}

// Plays one move. Returns false (and changes nothing) when the run is over,
// the direction is unknown or the move would not change the board.
export function applyMove(game, dir) {
  if (game.over || !STEP[dir]) return false;
  const result = slide(game.board, dir);
  if (!result.moved) return false;
  game.moves += DIRECTION_CHARS[dir];
  game.score += result.gain;
  if (result.top > game.maxTile) game.maxTile = result.top;
  if (result.merges > 0) {
    game.streak += 1;
    if (game.streak > game.bestCombo) game.bestCombo = game.streak;
  } else {
    game.streak = 0;
  }
  // The 8192 merge ends the run on the exact winning board: no extra tile.
  if (result.top === FINAL_TILE_VALUE) game.victory = true;
  else addSpawn(game);
  game.over = game.victory || !canMove(game.board);
  return true;
}

// Replays a recorded move string from a seed. Returns the final game, or null
// when the record is malformed or contains an impossible move.
export function replayGame(seed, moves) {
  if (typeof moves !== "string" || moves.length > MAX_MOVES) return null;
  const game = createGame(seed);
  for (let i = 0; i < moves.length; i++) {
    if (!applyMove(game, CHAR_DIRECTIONS[moves[i]])) return null;
  }
  return game;
}

export function boardToGrid(board) {
  return Array.from({ length: SIZE }, (_, r) => board.slice(r * SIZE, r * SIZE + SIZE));
}
