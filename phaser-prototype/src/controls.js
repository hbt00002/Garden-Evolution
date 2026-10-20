// Turning the player's keys, swipes and drags into moves. The keyboard works
// anywhere on the page (except while typing); swipes and drags work on the
// board. The board stops the browser from scrolling or zooming under a finger.
import { directionForKey, swipeDirection } from "./input.js";

const SWIPE_THRESHOLD = 24;

const INTERACTIVE = "input, textarea, select, button, form, [contenteditable='true']";
const isInteractiveControl = target => target instanceof Element && Boolean(target.closest(INTERACTIVE));

// board: the board element. onMove(direction): make a move. blocked(): true
// while something else (a dialog, the menu) owns the input. onGesture(): the
// player touched the game (the first one unlocks sound).
export function installControls({ board, onMove, blocked, onGesture }) {
  window.addEventListener("keydown", event => {
    if (event.target instanceof HTMLElement && event.target.matches("input, textarea, select, [contenteditable='true']")) return;
    const dir = directionForKey(event);
    // Leave the key alone while a dialog is open so arrows can still scroll
    // the leaderboard list and browser shortcuts keep working.
    if (!dir || blocked()) return;
    event.preventDefault();
    onGesture();
    onMove(dir);
  }, { passive: false });

  let pointerStart = null;
  board.addEventListener("pointerdown", event => {
    if (isInteractiveControl(event.target)) {
      pointerStart = null;
      return;
    }
    onGesture();
    pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  board.addEventListener("pointermove", event => {
    if (isInteractiveControl(event.target)) return;
    if (!pointerStart || event.pointerId !== pointerStart.id) return;
    const dir = swipeDirection(event.clientX - pointerStart.x, event.clientY - pointerStart.y, SWIPE_THRESHOLD);
    if (!dir) return;
    pointerStart = null;
    onMove(dir);
  });
  const endPointer = event => { if (pointerStart && event.pointerId === pointerStart.id) pointerStart = null; };
  board.addEventListener("pointerup", endPointer);
  board.addEventListener("pointercancel", endPointer);
  board.addEventListener("pointerleave", endPointer);

  const holdStill = event => { if (!isInteractiveControl(event.target)) event.preventDefault(); };
  board.addEventListener("touchstart", holdStill, { passive: false });
  board.addEventListener("touchmove", holdStill, { passive: false });
}
