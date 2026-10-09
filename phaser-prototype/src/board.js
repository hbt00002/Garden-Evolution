// Pure 2048 board rules: no DOM, no animation state. script.js turns the plan
// returned here into tile movement, so the rules can be tested on their own.
import { canMergeValues } from "./game-rules.js";

export const BOARD_SIZE = 4;

// Cell coordinates of every row (left/right) or column (up/down), ordered
// from the edge the tiles slide towards.
export function linesFor(dir, size = BOARD_SIZE) {
  const lines = [];
  for (let i = 0; i < size; i++) {
    const order = dir === "left" || dir === "up" ? [...Array(size).keys()] : [...Array(size).keys()].reverse();
    lines.push(order.map(j => (dir === "left" || dir === "right" ? { r: i, c: j } : { r: j, c: i })));
  }
  return lines;
}

// board: size x size array of tile values, 0 for an empty cell.
// Returns { moved, slides, merges }:
//   slides: every tile's journey { from, to, absorbed }; absorbed tiles slide
//           into the tile they merge with and then disappear.
//   merges: { survivor, absorbed, to, value } for each merge.
export function planMove(board, dir) {
  const slides = [];
  const merges = [];
  let moved = false;
  for (const line of linesFor(dir, board.length)) {
    const tiles = line.filter(({ r, c }) => board[r][c] !== 0);
    let write = 0;
    let i = 0;
    while (i < tiles.length) {
      const from = tiles[i];
      const next = tiles[i + 1];
      const to = line[write];
      if (next && canMergeValues(board[from.r][from.c], board[next.r][next.c])) {
        merges.push({ survivor: from, absorbed: next, to, value: board[from.r][from.c] * 2 });
        slides.push({ from, to, absorbed: false }, { from: next, to, absorbed: true });
        moved = true;
        i += 2;
      } else {
        slides.push({ from, to, absorbed: false });
        if (from.r !== to.r || from.c !== to.c) moved = true;
        i += 1;
      }
      write += 1;
    }
  }
  return { moved, slides, merges };
}

// True while any cell is empty or two equal, mergeable neighbours exist.
export function hasMoves(board) {
  const size = board.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!board[r][c]) return true;
      if (c + 1 < size && canMergeValues(board[r][c], board[r][c + 1])) return true;
      if (r + 1 < size && canMergeValues(board[r][c], board[r + 1][c])) return true;
    }
  }
  return false;
}
