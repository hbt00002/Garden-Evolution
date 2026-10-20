// Tells the server when the game breaks in someone's browser, so it can be
// fixed without waiting for a complaint. Only technical facts are sent: what
// failed, in which file, which build, and the screen size. No name, score,
// cookie or identifier. Reporting must never get in the way of playing: every
// step is wrapped, nothing is shown, and failures are ignored.

const MAX_PER_PAGE = 5;
const ENDPOINT = "/api/client-error";

// Noise that is not ours: browser extensions, cross-origin scripts that the
// browser hides the details of, and harmless layout notices.
const IGNORED_MESSAGE = /^(script error\.?|resizeobserver loop|non-error promise rejection captured)/i;
const IGNORED_SOURCE = /^(chrome|moz|safari|safari-web)-extension:/i;

export function pathOf(url, origin) {
  try {
    const parsed = new URL(url, origin);
    return parsed.pathname;
  } catch (error) {
    return "";
  }
}

// Returns a report for an event, or null when it is not worth reporting.
export function describe(event, { origin }) {
  const target = event.target;
  // A file, picture or style that failed to load: the event goes to the
  // element, not to window, and does not bubble (so it is caught while capturing).
  if (target && target !== event.currentTarget && target.nodeType === 1 && /^(SCRIPT|LINK|IMG)$/.test(target.tagName)) {
    const src = target.src || target.href || "";
    const path = pathOf(src, origin);
    if (!path || (src && !src.startsWith(origin) && !src.startsWith("/"))) return null;
    return { kind: "resource", message: `Failed to load ${target.tagName.toLowerCase()}`, source: path };
  }
  if (event.type === "unhandledrejection") {
    const reason = event.reason;
    const message = String(reason?.message ?? reason ?? "").trim();
    if (!message || IGNORED_MESSAGE.test(message)) return null;
    return { kind: "rejection", message, stack: reason?.stack };
  }
  // Chrome starts the message with "Uncaught "; the others do not.
  const message = String(event.message ?? "").trim().replace(/^Uncaught\s+/, "");
  const file = event.filename || "";
  if (!message || IGNORED_MESSAGE.test(message) || IGNORED_SOURCE.test(file)) return null;
  // A script from another site (an injected ad or tracker) is not ours to fix.
  if (file && !file.startsWith(origin) && !/^(blob:|about:)/.test(file)) return null;
  return {
    kind: "error",
    message,
    source: pathOf(file, origin),
    line: event.lineno || undefined,
    column: event.colno || undefined,
    stack: event.error?.stack
  };
}

function buildOf(doc) {
  const entry = doc.querySelector('script[type="module"][src*="/assets/"]');
  const match = entry?.getAttribute("src")?.match(/\/assets\/([\w-]+)\./);
  return match ? match[1] : "dev";
}

export function installErrorReporting({
  win = window,
  doc = document,
  send = body => fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }),
  limit = MAX_PER_PAGE
} = {}) {
  const origin = win.location.origin;
  const seen = new Set();
  let sent = 0;

  function report(details) {
    try {
      if (!details) return;
      const key = `${details.kind}|${details.message}|${details.source ?? ""}|${details.line ?? ""}`;
      if (seen.has(key) || sent >= limit) return;
      seen.add(key);
      sent++;
      const body = JSON.stringify({
        ...details,
        page: win.location.pathname,
        build: buildOf(doc),
        screen: `${win.innerWidth}x${win.innerHeight}@${win.devicePixelRatio || 1}`
      });
      Promise.resolve(send(body)).catch(() => {});
    } catch (error) { /* reporting must never throw */ }
  }

  win.addEventListener("error", event => { try { report(describe(event, { origin })); } catch (error) { /* ignore */ } }, true);
  win.addEventListener("unhandledrejection", event => { try { report(describe(event, { origin })); } catch (error) { /* ignore */ } });
  // Lets the start-up code report a failure it handles itself (e.g. the game file did not load).
  return { report };
}
