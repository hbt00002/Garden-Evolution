import test from "node:test";
import assert from "node:assert/strict";
import { BOARD_SIZE, hasMoves, linesFor, planMove } from "../src/board.js";

const empty = () => Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
const boardWith = rows => rows.map(row => row.slice());

// The board a plan produces: survivors take the merged value, absorbed tiles vanish.
function applyPlan(board, plan) {
  const next = empty();
  for (const slide of plan.slides) {
    if (!slide.absorbed) next[slide.to.r][slide.to.c] = board[slide.from.r][slide.from.c];
  }
  for (const merge of plan.merges) next[merge.to.r][merge.to.c] = merge.value;
  return next;
}

// Textbook reference: slide a row left, merge equal neighbours once.
function slideRowLeft(row) {
  const tiles = row.filter(Boolean);
  const out = [];
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === tiles[i + 1] && tiles[i] < 8192) { out.push(tiles[i] * 2); i++; }
    else out.push(tiles[i]);
  }
  while (out.length < row.length) out.push(0);
  return out;
}
const rotate = board => board[0].map((_, c) => board.map(row => row[c]).reverse()); // clockwise
function referenceMove(board, dir) {
  // Rotate so the move becomes "left", slide, rotate back.
  const turns = { left: 0, down: 1, right: 2, up: 3 }[dir];
  let b = boardWith(board);
  for (let i = 0; i < turns; i++) b = rotate(b);
  b = b.map(slideRowLeft);
  for (let i = 0; i < (4 - turns) % 4; i++) b = rotate(b);
  return b;
}

test("linesFor starts every line at the edge tiles slide towards", () => {
  assert.deepEqual(linesFor("left")[1].map(({ r, c }) => [r, c]), [[1, 0], [1, 1], [1, 2], [1, 3]]);
  assert.deepEqual(linesFor("right")[1].map(({ r, c }) => [r, c]), [[1, 3], [1, 2], [1, 1], [1, 0]]);
  assert.deepEqual(linesFor("up")[2].map(({ r, c }) => [r, c]), [[0, 2], [1, 2], [2, 2], [3, 2]]);
  assert.deepEqual(linesFor("down")[2].map(({ r, c }) => [r, c]), [[3, 2], [2, 2], [1, 2], [0, 2]]);
});

test("a tile slides to the wall and equal neighbours merge once per move", () => {
  const board = boardWith([[2, 0, 2, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const plan = planMove(board, "left");
  assert.equal(plan.moved, true);
  assert.deepEqual(applyPlan(board, plan)[0], [4, 4, 0, 0]);
  assert.equal(plan.merges.length, 1);
  assert.deepEqual(plan.merges[0].to, { r: 0, c: 0 });
  assert.equal(plan.merges[0].value, 4);
});

test("four equal tiles make two merges, not one chain", () => {
  const board = boardWith([[2, 2, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const plan = planMove(board, "right");
  assert.deepEqual(applyPlan(board, plan)[0], [0, 0, 4, 4]);
  assert.equal(plan.merges.length, 2);
});

test("a move that changes nothing is not a move", () => {
  const board = boardWith([[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  assert.equal(planMove(board, "left").moved, false);
  assert.equal(planMove(empty(), "up").moved, false);
});

test("two 8192 tiles never merge", () => {
  const board = boardWith([[8192, 8192, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const plan = planMove(board, "left");
  assert.equal(plan.moved, false);
  assert.equal(plan.merges.length, 0);
  assert.equal(hasMoves(boardWith([[8192, 8192, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]])), false);
});

test("absorbed tiles slide into the survivor's cell", () => {
  const board = boardWith([[0, 4, 4, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const plan = planMove(board, "left");
  const absorbed = plan.slides.filter(slide => slide.absorbed);
  assert.equal(absorbed.length, 1);
  assert.deepEqual(absorbed[0].to, { r: 0, c: 0 });
  assert.deepEqual(absorbed[0].from, { r: 0, c: 2 });
});

test("hasMoves: empty cells or mergeable neighbours", () => {
  assert.equal(hasMoves(boardWith([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 0]])), true);
  assert.equal(hasMoves(boardWith([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 4]])), true);
  assert.equal(hasMoves(boardWith([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]])), false);
});

test("every direction agrees with a textbook implementation on random boards", () => {
  let seed = 12345;
  const random = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const values = [0, 0, 0, 2, 2, 4, 4, 8, 16, 4096, 8192];
  for (let round = 0; round < 400; round++) {
    const board = empty().map(row => row.map(() => values[Math.floor(random() * values.length)]));
    for (const dir of ["left", "right", "up", "down"]) {
      const plan = planMove(board, dir);
      const expected = referenceMove(board, dir);
      assert.deepEqual(applyPlan(board, plan), expected, `${dir} on ${JSON.stringify(board)}`);
      assert.equal(plan.moved, JSON.stringify(expected) !== JSON.stringify(board), `moved flag: ${dir} ${JSON.stringify(board)}`);
    }
  }
});
