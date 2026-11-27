// A finished, ranked run whose score could not be sent (no connection, the
// app closed, the server said no for a while). It is kept on the device and
// offered on the start menu next time, as long as the server would still take
// it. Pure rules here; storage.js keeps it and script.js decides when.
import { dayEnd } from "./daily.js";

// The server's own limits (cloudflare/worker.js): a session lives 14 days, and
// today's garden may be sent until 12 hours after its day ends.
const SESSION_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;
const DAILY_GRACE_MS = 12 * 60 * 60 * 1000;

// Everything sending needs, or null for an unranked run (no session).
export function makePendingRun({ mode, day, session, score, maxTile, bestCombo, reachedStage, moves, now = Date.now() }) {
  if (!session) return null;
  return { mode, day: day ?? null, session, score, maxTile, bestCombo, reachedStage, moves, finishedAt: now };
}

export function isPendingExpired(run, now = Date.now()) {
  const iat = run?.session?.iat;
  if (!Number.isFinite(iat) || typeof run.moves !== "string") return true;
  if (run.mode === "daily") {
    if (!run.day) return true;
    return now > dayEnd(run.day) + DAILY_GRACE_MS;
  }
  return now > iat + SESSION_LIFETIME_MS;
}

// The end card is closed (Play again, a new game…). A player who closed it
// without saving has decided, so the run is forgotten; but not if sending was
// tried and failed, and never a run kept from an earlier visit.
export function shouldClearOnDismiss(run, { finishedSid, sendFailed }) {
  return Boolean(run && finishedSid && run.session?.sid === finishedSid && !sendFailed);
}
