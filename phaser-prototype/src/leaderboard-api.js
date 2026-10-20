// Talking to the leaderboard endpoints: one request helper with a timeout and a
// check that the answer really is JSON (an ad blocker or a proxy can answer with
// a web page instead), and a client that keeps each board for 30 seconds.

const CACHE_MS = 30_000;
const TIMEOUT_MS = 10_000;

export async function leaderboardRequest(options = {}, path = "/api/leaderboard") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const requestOptions = { ...options, signal: controller.signal };
    const response = await fetch(path, requestOptions);
    const type = response.headers.get("content-type") || "";
    if (!type.includes("application/json")) {
      throw new Error("Leaderboard is temporarily unavailable.");
    }
    return response;
  } finally { clearTimeout(timeout); }
}

export function createLeaderboardApi({ now = () => Date.now() } = {}) {
  let cache = {};

  const isFresh = period => {
    const cached = cache[period];
    return Boolean(cached && now() - cached.time < CACHE_MS);
  };

  async function board(period) {
    if (isFresh(period)) return cache[period].entries;
    const path = period === "all" ? "/api/leaderboard" : `/api/leaderboard?period=${period}`;
    const response = await leaderboardRequest({ headers: { accept: "application/json" } }, path);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error("leaderboard_load_failed");
    const entries = Array.isArray(data.entries) ? data.entries : [];
    cache[period] = { time: now(), entries };
    return entries;
  }

  // Never cached, and a failure only hides the rank card: the list still works.
  async function me(period, deviceId) {
    const response = await leaderboardRequest(
      { headers: { accept: "application/json" } },
      `/api/leaderboard/me?period=${period}&device=${encodeURIComponent(deviceId)}`
    );
    if (!response.ok) throw new Error("rank_load_failed");
    return response.json();
  }

  return {
    board,
    me,
    isFresh,
    forget: period => { delete cache[period]; },
    forgetAll: () => { cache = {}; }
  };
}
