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
