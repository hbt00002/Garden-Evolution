// The signed play session the server hands out when a game starts. It carries
// the seed the tiles are dealt from, which is what lets the server replay a
// finished run and accept its score. Requested when play begins so its issue
// time reflects actual play time, not however long the submit form took to
// open. Without one (offline, a failed request) the game is played unranked.
import { isSessionUsable } from "./game-save.js";

// Rejects if the promise takes longer than `ms`.
export function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

// A seed for a game that has no server session (unranked).
export function randomSeed() {
  try { return crypto.getRandomValues(new Uint32Array(1))[0]; }
  catch (e) { return Math.floor(Math.random() * 4294967296) >>> 0; }
}

// getGeneration(): which game is current, so a slow reply cannot attach itself
// to a newer one. errorMessage(): the player-facing text when a session fails.
// onIssued(): called once a session has been stored (the game saves itself).
// getMode(): "daily" asks for a session of today's garden (the day's seed).
export function createGameSession({ getGeneration, errorMessage, onIssued = () => {}, getMode = () => "classic" }) {
  let session = null;
  let pending = null;

  async function ensure() {
    if (pending) return pending;
    const generation = getGeneration();
    const daily = getMode() === "daily";
    pending = (async () => {
      try {
        const response = await fetch(daily ? "/api/session?mode=daily" : "/api/session", {
          method: "POST",
          headers: { accept: "application/json" }
        });
        if (!response.ok) throw new Error("session_failed");
        const issued = await response.json();
        if (!Number.isSafeInteger(issued?.seed)) throw new Error("session_failed");
        if (daily && typeof issued.daily !== "string") throw new Error("session_failed");
        // A slow reply must not attach itself to a newer game.
        if (generation === getGeneration()) {
          session = issued;
          onIssued();
        }
        return issued;
      } catch (error) {
        if (generation === getGeneration()) {
          session = null;
          pending = null;
        }
        throw new Error(errorMessage());
      }
    })();
    return pending;
  }

  return {
    ensure,
    get current() { return session; },
    // A new game starts with the session of the saved game it restores, or none.
    adopt(saved) {
      session = saved || null;
      pending = session ? Promise.resolve(session) : null;
    },
    // Only a run played from the seed of its own server session can be verified
    // and join the leaderboard; offline or failed starts are played unranked.
    isRanked(runSeed) {
      return Boolean(session && runSeed !== null && session.seed === runSeed && isSessionUsable(session));
    }
  };
}
