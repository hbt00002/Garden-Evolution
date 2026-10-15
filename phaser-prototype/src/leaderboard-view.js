// What the leaderboard modal shows, as plain data: which rows, which one is
// the player's own, and whether the player's row is appended below the top
// list. The DOM code in script.js only turns these rows into elements.

export const PERIODS = ["all", "week", "day"];

// entries: the board's top rows, best first. me: { rank, entry, total } for
// this device (rank null when the device has no entry on the board).
export function buildRows(entries, me) {
  const rows = entries.map((entry, index) => ({
    type: "entry",
    rank: index + 1,
    entry,
    own: Boolean(me?.rank) && me.rank === index + 1
  }));
  // A player ranked below the visible list still sees their own row, set off
  // by a gap so it is clear the rows in between are not shown.
  if (me?.rank && me.entry && me.rank > entries.length) {
    if (me.rank > entries.length + 1) rows.push({ type: "gap" });
    rows.push({ type: "entry", rank: me.rank, entry: me.entry, own: true });
  }
  return rows;
}

// Index of a plant's name and art in the 2..8192 progression, or -1.
export function plantIndex(maxTile) {
  const level = Math.log2(Number(maxTile));
  return Number.isInteger(level) && level >= 1 && level <= 13 ? level - 1 : -1;
}

// "Top 5%": the share of ranked players at or above this rank, rounded up so
// nobody is told they are in a better slice than they are. Null when unknown.
export function topPercent(rank, total) {
  if (!Number.isInteger(rank) || !Number.isInteger(total) || rank < 1 || total < 1 || rank > total) return null;
  return Math.max(1, Math.ceil((rank / total) * 100));
}
