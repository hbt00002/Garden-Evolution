// Maps a keyboard event to a move direction, or null when the key is not a
// move. Physical key positions (event.code) come first so WASD works on
// layouts whose letters are not Latin (Russian, Japanese, Korean); the
// character (event.key) is a fallback for synthetic events without a code.
// Shortcuts with Ctrl/Cmd/Alt (Ctrl+S, Ctrl+D, Ctrl+A ...) are never moves.

const BY_CODE = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
  KeyA: "left", KeyD: "right", KeyW: "up", KeyS: "down"
};

const BY_KEY = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
  a: "left", d: "right", w: "up", s: "down",
  A: "left", D: "right", W: "up", S: "down"
};

export function directionForKey(event) {
  if (!event || event.ctrlKey || event.metaKey || event.altKey) return null;
  return BY_CODE[event.code] ?? BY_KEY[event.key] ?? null;
}

// The direction of a swipe from its horizontal and vertical travel, or null
// while the finger has not moved far enough (in either direction) to count.
export function swipeDirection(dx, dy, threshold) {
  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}
