// Putting the game on the phone's home screen, where it opens full screen,
// without the browser's bars (which also means the sideways layout gets the
// whole height back). The Settings panel gets a row only where it can help:
//
//   Android (Chrome) - the browser offers an install prompt; the row has a button.
//   iPhone / iPad    - nothing can be triggered from a page, so the row says how
//                      (Share, then Add to Home Screen).
//   already added, or a browser that cannot - no row.

// Where is the page running? "installed", "ios" or "other".
export function installContext({ userAgent = "", maxTouchPoints = 0, standalone = false, displayStandalone = false } = {}) {
  if (standalone || displayStandalone) return "installed";
  // iPadOS asks for the desktop site by default and reports itself as a Mac with a touch screen.
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  return ios ? "ios" : "other";
}

// row, button, steps: the elements in Settings (see index.html).
export function createInstallHint({ row, button, steps, win = window, nav = navigator }) {
  let deferredPrompt = null;
  const context = () => installContext({
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints,
    standalone: nav.standalone === true,
    displayStandalone: Boolean(win.matchMedia?.("(display-mode: standalone)").matches)
  });

  function show() {
    const where = context();
    const offer = where !== "installed" && (where === "ios" || deferredPrompt !== null);
    row.hidden = !offer;
    button.hidden = !(where !== "installed" && deferredPrompt !== null);
    steps.hidden = !(where === "ios" && deferredPrompt === null);
  }

  // Chrome announces that the game can be installed; keep the offer for the button.
  win.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    show();
  });
  win.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    show();
  });
  button.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    const offer = deferredPrompt;
    deferredPrompt = null;          // a prompt can be used once
    show();
    try { await offer.prompt(); } catch (error) { /* the player closed it, or the browser refused */ }
  });

  show();
  return { show };
}
