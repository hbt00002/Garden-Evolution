// Which dialogs are open, and what that means for everything else: the game
// behind a modal is inert (screen readers and Tab cannot reach it), moves are
// ignored, and Tab stays inside the open dialog. It also owns the polite
// screen-reader announcement line.
import { nextFocus } from "./focus-trap.js";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// elements: main (the game), startScreen, restart (the new-game prompt),
// settings, leaderboard, scoreConfirm (the lower-score question), endCard and
// announcer (a status region).
// viewActive(): the garden view or a world showcase has the screen.
export function createDialogs({ elements, viewActive }) {
  const { main, startScreen, restart, settings, leaderboard, scoreConfirm, endCard, announcer } = elements;

  // A modal dialog is open (the restart prompt and the end card are not modal in this sense).
  const modalOpen = () => !settings.hidden || !leaderboard.hidden || !scoreConfirm.hidden;

  // The menus the player opens on purpose, which pause the combo's energy.
  const menusOpen = () => !restart.hidden || !settings.hidden || !leaderboard.hidden;

  // Anything that should stop moves (the start menu and a run still being set up are the game's to add).
  const blocking = () => Boolean(viewActive()) || menusOpen() || !endCard.hidden;

  // Screen readers and Tab must not reach the game behind the start menu or a
  // modal dialog.
  function sync() {
    const open = modalOpen();
    main.inert = !startScreen.hidden || open || Boolean(viewActive());
    startScreen.inert = open;
  }
  new MutationObserver(sync).observe(document.body, {
    subtree: true, attributes: true, attributeFilter: ["hidden"]
  });

  function announce(message) {
    announcer.textContent = "";
    requestAnimationFrame(() => { announcer.textContent = message; });
  }

  // The topmost open dialog, whose controls Tab cycles through.
  function topDialog() {
    if (!scoreConfirm.hidden) return scoreConfirm;
    if (!leaderboard.hidden) return leaderboard;
    if (!settings.hidden) return settings;
    if (!endCard.hidden) return endCard;
    return null;
  }

  document.addEventListener("keydown", event => {
    // The restart confirmation has its own two-button trap.
    if (event.key !== "Tab" || !restart.hidden) return;
    const dialog = topDialog();
    if (!dialog) return;
    const focusables = [...dialog.querySelectorAll(FOCUSABLE)].filter(el => el.getClientRects().length > 0);
    const target = nextFocus(focusables, document.activeElement, event.shiftKey);
    if (target) {
      event.preventDefault();
      target.focus();
    }
  });

  return { sync, announce, blocking, menusOpen, topDialog };
}
