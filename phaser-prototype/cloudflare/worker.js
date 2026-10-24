import { MAX_MOVES, replayGame } from "../src/game-core.js";
import { isNameAllowed } from "./name-filter.js";
import { dayEnd, dayKey, isDayKey } from "../src/daily.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin"
};

const SCORE_LIMIT = 100_000_000;
const RATE_WINDOW_SECONDS = 10 * 60;
const RATE_WINDOW_LIMIT = 5;
// Starting a game fetches a session. The limit is generous for real players
// (a game lasts minutes) but stops someone from requesting thousands of
// sessions to hunt for a lucky tile sequence.
const SESSION_WINDOW_LIMIT = 30;
// Matches the 14-day lifetime of a saved game (src/game-save.js), so a game
// that is restored after a long pause still carries a session the server
// accepts. The wall-clock floor below only needs the session's age.
const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
// One character per move plus the small fields around it.
const MAX_BODY_BYTES = MAX_MOVES + 4096;
// A move cannot be made faster than the slide animation, and even a key held
// down repeats more slowly than this; a record claiming more moves than the
// session's age allows was not played in real time.
const MIN_MS_PER_MOVE = 40;

// Rough floor on how many seconds a legitimate run needs to reach a given
// tile. These are deliberately conservative (fast but not impossible) —
// calibrate against your own playtests, this is a sanity check, not a
// precise anti-cheat model.
const MIN_SECONDS_PER_TILE = {
  2: 0, 4: 0, 8: 0, 16: 0, 32: 3, 64: 8,
  128: 18, 256: 35, 512: 65, 1024: 120,
  2048: 220, 4096: 420, 8192: 800
};

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

// The boards a player can look at. "all" is the best score ever per device;
// the others rank each player's best score within a rolling window.
const PERIOD_MS = { all: null, week: 7 * 24 * 60 * 60 * 1000, day: 24 * 60 * 60 * 1000 };
const LEADERBOARD_SIZE = 20;
// score_log rows are only needed for the longest window.
const SCORE_LOG_RETENTION_MS = 8 * 24 * 60 * 60 * 1000;

// "daily" is today's garden: everyone played the same seed, one ranked run each.
const DAILY = "daily";
// Today's garden may still be submitted a while after midnight (a run started
// at 23:50 can end after it).
const DAILY_GRACE_MS = 12 * 60 * 60 * 1000;
const DAILY_RETENTION_DAYS = 30;

function periodFrom(url) {
  const period = new URL(url).searchParams.get("period") || "all";
  return Object.hasOwn(PERIOD_MS, period) || period === DAILY ? period : null;
}

// The query string is ignored for caching except for the board itself, so
// ?fresh=1 cannot be used to bypass or fill the cache.
function leaderboardCacheKey(request, period = periodFrom(request.url) || "all") {
  const cacheUrl = new URL(request.url);
  // Today's garden is cached per day, so midnight never serves yesterday's board.
  cacheUrl.search = period === "all" ? "" : period === DAILY ? `?period=${DAILY}&day=${dayKey()}` : `?period=${period}`;
  cacheUrl.hash = "";
  return new Request(cacheUrl.toString(), { method: "GET" });
}

function periodCutoff(period) {
  return new Date(Date.now() - PERIOD_MS[period]).toISOString();
}

// Each player's best score inside the window (one row per device).
const BEST_IN_PERIOD = `
  best AS (
    SELECT player_name, score, max_tile, best_combo, reached_stage, created_at, device_id
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY COALESCE(device_id, 'row-' || id) ORDER BY score DESC, created_at ASC
      ) AS rn
      FROM score_log WHERE created_at >= ?
    )
    WHERE rn = 1
  )`;

function isMissingScoreLog(error) {
  return /no such table:?\s*score_log/i.test(String(error?.message || error));
}

function isMissingDaily(error) {
  return /no such table:?\s*daily_scores/i.test(String(error?.message || error));
}

function cleanName(value) {
  return String(value || "")
    .normalize("NFKC")
    // Control characters are exactly what is being removed here.
    // eslint-disable-next-line no-control-regex
    .replace(/[<>\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
}

export function expectedStage(maxTile) {
  if (maxTile <= 64) return 1;
  if (maxTile <= 256) return 2;
  if (maxTile <= 512) return 3;
  if (maxTile <= 1024) return 4;
  return 5;
}

function validPowerOfTwo(value) {
  return Number.isSafeInteger(value) && value >= 2 && value <= 8192 && (value & (value - 1)) === 0;
}

function isValidUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function fingerprint(request, secret, scope = "score") {
  const address = request.headers.get("CF-Connecting-IP") || "local";
  const agent = (request.headers.get("user-agent") || "unknown").slice(0, 160);
  // Score submissions keep their original key so existing counters stay valid.
  const message = scope === "score" ? `${address}|${agent}` : `${scope}|${address}|${agent}`;
  return hmacHex(secret, message).then(full => full.slice(0, 32));
}

async function enforceRateLimit(request, env, { scope = "score", limit = RATE_WINDOW_LIMIT } = {}) {
  if (!env.RATE_LIMIT_SALT || env.RATE_LIMIT_SALT.length < 24) {
    throw new Error("RATE_LIMIT_SALT is not configured securely.");
  }
  const bucket = Math.floor(Date.now() / 1000 / RATE_WINDOW_SECONDS);
  const key = await fingerprint(request, env.RATE_LIMIT_SALT, scope);
  const result = await env.DB.prepare(`
    INSERT INTO submission_limits (fingerprint, bucket, count)
    VALUES (?, ?, 1)
    ON CONFLICT (fingerprint, bucket)
    DO UPDATE SET count = count + 1
    RETURNING count
  `).bind(key, bucket).first();
  const count = Number(result?.count || 1);
  return { allowed: count <= limit, retryAfter: RATE_WINDOW_SECONDS };
}

// required=true is used for POST: an attacker can omit Origin, so writes
// must not be allowed through just because the header is missing.
function requestIsSameOrigin(request, { required = false } = {}) {
  const origin = request.headers.get("origin");
  if (!origin) return !required;
  return origin === new URL(request.url).origin || APP_ORIGINS.has(origin);
}

// The store apps (Capacitor) load the game from inside the app, so their
// requests come from these origins (Android, iPhone) instead of the site's
// own. Only an app on the player's own device can have them; a web page
// cannot, so letting them in opens nothing to other sites.
export const APP_ORIGINS = new Set(["https://localhost", "capacitor://localhost"]);

function corsHeaders(origin) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST",
    "access-control-allow-headers": "content-type, accept",
    "access-control-max-age": "86400",
    vary: "Origin"
  };
}

// The app's request, answered with the headers that let it read the answer.
// Cached responses are immutable, so the headers go on a copy.
function withCors(response, origin) {
  const copy = new Response(response.body, response);
  for (const [name, value] of Object.entries(corsHeaders(origin))) copy.headers.set(name, value);
  return copy;
}

// Reads the body ourselves instead of trusting the Content-Length header,
// which an attacker can omit or lie about.
async function readJsonWithLimit(request, maxBytes) {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new Error("payload_too_large");
      }
      chunks.push(value);
    }
  } finally {
    // reader.cancel() above already releases on the early-exit path
  }
  if (received === 0) return null;
  const buf = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(buf));
}

/* ---------- Game sessions (anti-cheat) ---------- */
// A session is issued when a new game starts and must be presented, valid
// and unused, when a score is submitted. This does not make client-side
// scoring bulletproof (nothing fully does for a client-authoritative game),
// but it closes the "hand-craft one POST with no game played" case and
// gives us a wall-clock floor to sanity-check reported progress against.

export async function seedForSession(secret, sid) {
  return parseInt((await hmacHex(secret, `seed.${sid}`)).slice(0, 8), 16);
}

// Today's garden: the same seed for everyone on a day, which nobody can predict
// before the day comes (it needs the server's secret).
export async function seedForDay(secret, day) {
  return parseInt((await hmacHex(secret, `daily.${day}`)).slice(0, 8), 16);
}

// What a session's signature covers. A session for today's garden also names
// its day, so it cannot be moved to another day's board.
const sessionPayload = (sid, iat, daily) => (daily ? `${sid}.${iat}.daily.${daily}` : `${sid}.${iat}`);

async function issueSession(request, env) {
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed." }, { allow: "POST" });
  }
  if (!requestIsSameOrigin(request, { required: true })) {
    return json(403, { error: "Cross-origin session requests are not allowed." });
  }
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 24) {
    return json(503, { error: "Leaderboard is not configured." });
  }
  if (!env.DB) return json(503, { error: "Leaderboard database is not configured." });
  const rate = await enforceRateLimit(request, env, { scope: "session", limit: SESSION_WINDOW_LIMIT });
  if (!rate.allowed) {
    return json(429, { error: "Too many new games. Please try again later." }, {
      "retry-after": String(rate.retryAfter)
    });
  }
  const sid = crypto.randomUUID();
  const iat = Date.now();
  if (new URL(request.url).searchParams.get("mode") === DAILY) {
    const day = dayKey(iat);
    const sig = await hmacHex(env.SESSION_SECRET, sessionPayload(sid, iat, day));
    return json(200, { sid, iat, sig, daily: day, seed: await seedForDay(env.SESSION_SECRET, day) });
  }
  const sig = await hmacHex(env.SESSION_SECRET, sessionPayload(sid, iat));
  // The seed is derived from the session id with the server's secret, so the
  // player cannot choose it and the Worker can recompute it when replaying.
  return json(200, { sid, iat, sig, seed: await seedForSession(env.SESSION_SECRET, sid) });
}

async function verifySession(session, env) {
  const sid = session?.sid;
  const iat = Number(session?.iat);
  const sig = session?.sig;
  const daily = session?.daily ?? null;
  if (!isValidUuid(sid) || !Number.isSafeInteger(iat) || typeof sig !== "string") {
    return { ok: false, reason: "malformed_session" };
  }
  if (daily !== null && !isDayKey(daily)) return { ok: false, reason: "malformed_session" };
  const expected = await hmacHex(env.SESSION_SECRET, sessionPayload(sid, iat, daily));
  if (!timingSafeEqual(expected, sig)) return { ok: false, reason: "bad_signature" };

  const ageMs = Date.now() - iat;
  if (ageMs < 0 || ageMs > SESSION_MAX_AGE_MS) return { ok: false, reason: "expired" };

  if (daily && Date.now() > dayEnd(daily) + DAILY_GRACE_MS) return { ok: false, reason: "expired" };

  const used = await env.DB.prepare("SELECT 1 FROM used_sessions WHERE sid = ?").bind(sid).first();
  if (used) return { ok: false, reason: "already_used" };

  const seed = daily ? await seedForDay(env.SESSION_SECRET, daily) : await seedForSession(env.SESSION_SECRET, sid);
  return { ok: true, sid, ageMs, daily, seed };
}

export function isTimingPlausible(maxTile, ageMs) {
  const minSeconds = MIN_SECONDS_PER_TILE[maxTile] ?? 0;
  return ageMs / 1000 >= minSeconds;
}

/* ---------- Leaderboard ---------- */

async function handleLeaderboardGet(request, env, ctx) {
  const period = periodFrom(request.url);
  if (!period) return json(400, { error: "Unknown leaderboard period." });
  const cache = caches.default;
  const cacheKey = leaderboardCacheKey(request, period);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let result;
  try {
    result = period === DAILY
      ? await env.DB.prepare(`
          SELECT player_name, score, max_tile, best_combo, reached_stage, created_at
          FROM daily_scores WHERE day = ?
          ORDER BY score DESC, created_at ASC
          LIMIT ${LEADERBOARD_SIZE}
        `).bind(dayKey()).all()
      : period === "all"
      ? await env.DB.prepare(`
          SELECT player_name, score, max_tile, best_combo, combo_rules, reached_stage, created_at
          FROM leaderboard
          ORDER BY score DESC, created_at ASC
          LIMIT ${LEADERBOARD_SIZE}
        `).all()
      : await env.DB.prepare(`
          WITH ${BEST_IN_PERIOD}
          SELECT player_name, score, max_tile, best_combo, reached_stage, created_at
          FROM best
          ORDER BY score DESC, created_at ASC
          LIMIT ${LEADERBOARD_SIZE}
        `).bind(periodCutoff(period)).all();
  } catch (error) {
    if (isMissingScoreLog(error) || isMissingDaily(error)) return json(503, { error: "This board is not available yet." });
    throw error;
  }

  const response = json(200, { period, ...(period === DAILY ? { day: dayKey() } : {}), entries: result.results || [] }, {
    "cache-control": "public, max-age=30"
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

// Where one device stands on a board: its own entry and rank (computed with
// the same ordering as the list, so the rank is the row number) and how many
// players are ranked. Never cached: it is specific to the device.
async function handleLeaderboardMe(request, env) {
  if (!env.DB) return json(503, { error: "Leaderboard database is not configured." });
  if (request.method !== "GET") return json(405, { error: "Method not allowed." }, { allow: "GET" });
  const url = new URL(request.url);
  const period = periodFrom(request.url);
  const device = url.searchParams.get("device");
  if (!period) return json(400, { error: "Unknown leaderboard period." });
  if (!isValidUuid(device)) return json(400, { error: "Invalid device." });

  const ahead = "(SELECT COUNT(*) FROM %T% b WHERE b.score > a.score OR (b.score = a.score AND b.created_at < a.created_at)) + 1";
  let entry;
  let total;
  try {
    if (period === DAILY) {
      const day = dayKey();
      entry = await env.DB.prepare(`
        SELECT player_name, score, max_tile, best_combo, reached_stage, created_at,
               (SELECT COUNT(*) FROM daily_scores b WHERE b.day = a.day AND (b.score > a.score OR (b.score = a.score AND b.created_at < a.created_at))) + 1 AS rank
        FROM daily_scores a WHERE a.day = ? AND a.device_id = ?
      `).bind(day, device).first();
      total = await env.DB.prepare("SELECT COUNT(*) AS n FROM daily_scores WHERE day = ?").bind(day).first();
    } else if (period === "all") {
      entry = await env.DB.prepare(`
        SELECT player_name, score, max_tile, best_combo, reached_stage, created_at,
               ${ahead.replace("%T%", "leaderboard")} AS rank
        FROM leaderboard a WHERE a.device_id = ?
      `).bind(device).first();
      total = await env.DB.prepare("SELECT COUNT(*) AS n FROM leaderboard").first();
    } else {
      const cutoff = periodCutoff(period);
      entry = await env.DB.prepare(`
        WITH ${BEST_IN_PERIOD}
        SELECT player_name, score, max_tile, best_combo, reached_stage, created_at,
               ${ahead.replace("%T%", "best")} AS rank
        FROM best a WHERE a.device_id = ?
      `).bind(cutoff, device).first();
      total = await env.DB.prepare(`WITH ${BEST_IN_PERIOD} SELECT COUNT(*) AS n FROM best`).bind(cutoff).first();
    }
  } catch (error) {
    if (isMissingScoreLog(error) || isMissingDaily(error)) return json(503, { error: "This board is not available yet." });
    throw error;
  }

  const { rank, ...rest } = entry || {};
  return json(200, { period, total: Number(total?.n || 0), rank: entry ? Number(rank) : null, entry: entry ? rest : null });
}

async function leaderboard(request, env, ctx) {
  if (!env.DB) return json(503, { error: "Leaderboard database is not configured." });

  if (request.method === "GET") {
    return handleLeaderboardGet(request, env, ctx);
  }

  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed." }, { allow: "GET, POST" });
  }
  if (!requestIsSameOrigin(request, { required: true })) {
    return json(403, { error: "Cross-origin submissions are not allowed." });
  }
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
    return json(415, { error: "Content-Type must be application/json." });
  }

  let raw;
  try {
    raw = await readJsonWithLimit(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error?.message === "payload_too_large") {
      return json(413, { error: "Score payload is too large." });
    }
    return json(400, { error: "Invalid JSON payload." });
  }
  if (!raw || Array.isArray(raw)) return json(400, { error: "Invalid score payload." });

  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 24) {
    return json(503, { error: "Leaderboard is not configured." });
  }
  const session = await verifySession(raw.session, env);
  if (!session.ok) return json(400, { error: "Invalid or expired game session." });

  const playerName = cleanName(raw.playerName);
  const score = Number(raw.score);
  const maxTile = Number(raw.maxTile);
  const bestCombo = Number(raw.bestCombo);
  const comboRules = raw.comboRules ?? 1;
  // Combos are the turn-based streak the replay computes (rules version 2).
  if (comboRules !== 2) return json(400, { error: "Invalid combo rules." });
  const reachedStage = Number(raw.reachedStage);
  const deviceId = isValidUuid(raw.deviceId) ? raw.deviceId : null;
  const replaceLowerScore = raw.replaceLowerScore === true;

  if (playerName.length < 2) return json(400, { error: "Name must contain at least 2 characters." });
  if (!isNameAllowed(playerName)) {
    return json(400, { error: "That name is not allowed.", code: "name_not_allowed" });
  }
  if (!Number.isSafeInteger(score) || score < 0 || score > SCORE_LIMIT) return json(400, { error: "Invalid score." });
  if (!validPowerOfTwo(maxTile)) return json(400, { error: "Invalid top plant." });
  if (!Number.isSafeInteger(bestCombo) || bestCombo < 0 || bestCombo > 1000) return json(400, { error: "Invalid combo." });
  if (!Number.isInteger(reachedStage) || reachedStage !== expectedStage(maxTile)) {
    return json(400, { error: "World and top plant do not match." });
  }
  if (!isTimingPlausible(maxTile, session.ageMs)) {
    return json(400, { error: "Score submitted too quickly for this progress." });
  }

  // The run is verified, not trusted: replay the recorded moves from the
  // seed this session was issued with and require the finished game to match
  // every number the player claims.
  const moves = raw.moves;
  if (typeof moves !== "string" || !/^[LRUD]+$/.test(moves)) {
    return json(400, { error: "Missing game record." });
  }
  if (session.ageMs < moves.length * MIN_MS_PER_MOVE) {
    return json(400, { error: "Score submitted too quickly for this many moves." });
  }
  const record = replayGame(session.seed, moves);
  if (!record || !record.over) {
    return json(400, { error: "Game record is not a finished game." });
  }
  if (record.score !== score || record.maxTile !== maxTile || record.bestCombo !== bestCombo) {
    return json(400, { error: "Game record does not match the score." });
  }

  if (session.daily) return submitDaily({ request, env, session, deviceId, playerName, score, maxTile, bestCombo, reachedStage });

  if (deviceId && !replaceLowerScore) {
    const existing = await env.DB.prepare("SELECT score FROM leaderboard WHERE device_id = ?")
      .bind(deviceId)
      .first();
    if (existing && score < Number(existing.score)) {
      return json(409, {
        error: "This score is lower than your current score.",
        code: "lower_score_confirmation_required",
        currentScore: Number(existing.score)
      });
    }
  }

  const rate = await enforceRateLimit(request, env);
  if (!rate.allowed) {
    return json(429, { error: "Too many score submissions. Please try again later." }, {
      "retry-after": String(rate.retryAfter)
    });
  }

  const now = new Date().toISOString();
  const statements = [
    env.DB.prepare("INSERT INTO used_sessions (sid, used_at) VALUES (?, ?)").bind(session.sid, now)
  ];

  if (deviceId) {
    // One row per device: keep only the best score, don't grow forever.
    statements.push(
      env.DB.prepare(`
        INSERT INTO leaderboard (player_name, score, max_tile, best_combo, reached_stage, device_id, created_at, combo_rules)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(device_id) WHERE device_id IS NOT NULL DO UPDATE SET
          player_name = excluded.player_name,
          score = excluded.score,
          max_tile = excluded.max_tile,
          best_combo = excluded.best_combo,
          combo_rules = excluded.combo_rules,
          reached_stage = excluded.reached_stage,
          created_at = CASE WHEN excluded.score = leaderboard.score THEN leaderboard.created_at ELSE excluded.created_at END
        WHERE excluded.score >= leaderboard.score OR ? = 1
      `).bind(playerName, score, maxTile, bestCombo, reachedStage, deviceId, now, comboRules, replaceLowerScore ? 1 : 0)
    );
  } else {
    // No/invalid deviceId (e.g. localStorage blocked) — fall back to the
    // old always-insert behavior rather than rejecting the submission.
    statements.push(
      env.DB.prepare(`
        INSERT INTO leaderboard (player_name, score, max_tile, best_combo, reached_stage, created_at, combo_rules)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(playerName, score, maxTile, bestCombo, reachedStage, now, comboRules)
    );
  }

  // Every accepted run also goes into the log the 24-hour and 7-day boards
  // are ranked from.
  const logged = [...statements, env.DB.prepare(`
    INSERT INTO score_log (device_id, player_name, score, max_tile, best_combo, reached_stage, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(deviceId, playerName, score, maxTile, bestCombo, reachedStage, now)];
  try {
    await env.DB.batch(logged);
  } catch (error) {
    // Until migration 0004 is applied the period boards do not exist; never
    // let that stop the all-time board from taking scores.
    if (!isMissingScoreLog(error)) throw error;
    await env.DB.batch(statements);
  }

  // A successful write must be visible on the very next leaderboard read.
  // Await deletion instead of using waitUntil so the response cannot win a
  // race against an older 30-second edge-cache entry.
  await Promise.all(Object.keys(PERIOD_MS).map(period => caches.default.delete(leaderboardCacheKey(request, period))));

  return json(201, { ok: true, playerName });
}

// Today's garden: the first run each device sends for a day is its entry on
// that day's board; any later one is refused (the game plays later runs as
// practice). Daily runs stay off the other boards, because everyone knew the seed.
async function submitDaily({ request, env, session, deviceId, playerName, score, maxTile, bestCombo, reachedStage }) {
  if (deviceId) {
    let existing;
    try {
      existing = await env.DB.prepare("SELECT 1 FROM daily_scores WHERE day = ? AND device_id = ?").bind(session.daily, deviceId).first();
    } catch (error) {
      if (isMissingDaily(error)) return json(503, { error: "Today's garden is not available yet." });
      throw error;
    }
    if (existing) return json(409, { error: "You have already played today's garden.", code: "daily_already_played" });
  }
  const rate = await enforceRateLimit(request, env);
  if (!rate.allowed) {
    return json(429, { error: "Too many score submissions. Please try again later." }, {
      "retry-after": String(rate.retryAfter)
    });
  }
  const now = new Date().toISOString();
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO used_sessions (sid, used_at) VALUES (?, ?)").bind(session.sid, now),
      env.DB.prepare(`
        INSERT INTO daily_scores (day, device_id, player_name, score, max_tile, best_combo, reached_stage, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(session.daily, deviceId, playerName, score, maxTile, bestCombo, reachedStage, now)
    ]);
  } catch (error) {
    if (isMissingDaily(error)) return json(503, { error: "Today's garden is not available yet." });
    // Two runs of the same device racing each other: the unique index decides.
    if (/UNIQUE constraint failed/i.test(String(error?.message || error))) {
      return json(409, { error: "You have already played today's garden.", code: "daily_already_played" });
    }
    throw error;
  }
  await caches.default.delete(leaderboardCacheKey(request, DAILY));
  return json(201, { ok: true, playerName, daily: session.daily });
}

/* ---------- Client error reports ---------- */
// The game reports when it breaks in a player's browser (src/error-report.js).
// Only technical facts are stored, one row per distinct error with a count;
// see migrations/0005_client_errors.sql. Everything here is best effort: a
// report that cannot be stored is dropped, never turned into a visible error.
const ERROR_KINDS = new Set(["error", "rejection", "resource", "load"]);
const ERROR_RATE_LIMIT = 20;           // reports per IP+browser per 10 minutes
const ERROR_ROW_CAP = 500;             // distinct errors kept; flooding with new ones is ignored
const ERROR_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ERROR_BODY_BYTES = 6 * 1024;

const clip = (value, max) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);
const smallInt = value => (Number.isSafeInteger(value) && value >= 0 && value < 1_000_000 ? value : null);

// A coarse description of the browser and device, from the User-Agent. The
// raw header (which can be nearly unique) is not stored.
export function coarseClient(userAgent = "") {
  const ua = String(userAgent);
  const pick = (pairs, fallback) => (pairs.find(([pattern]) => pattern.test(ua)) || [null, fallback])[1];
  const major = pattern => ua.match(pattern)?.[1];
  const family = pick([
    [/Edg(?:e|A|iOS)?\//, "Edge"], [/SamsungBrowser\//, "Samsung Internet"], [/OPR\/|Opera/, "Opera"],
    [/Firefox\/|FxiOS\//, "Firefox"], [/CriOS\/|Chrome\//, "Chrome"], [/Safari\//, "Safari"]
  ], "Other");
  const version = family === "Chrome" ? major(/(?:CriOS|Chrome)\/(\d+)/)
    : family === "Safari" ? major(/Version\/(\d+)/)
    : family === "Firefox" ? major(/(?:Firefox|FxiOS)\/(\d+)/)
    : family === "Edge" ? major(/Edg(?:e|A|iOS)?\/(\d+)/) : null;
  const system = pick([
    [/iPhone|iPad|iPod/, "iOS"], [/Android/, "Android"], [/Windows/, "Windows"], [/Mac OS X|Macintosh/, "macOS"],
    [/CrOS/, "ChromeOS"], [/Linux/, "Linux"]
  ], "Other");
  const form = /Mobi|iPhone|Android.*Mobile/.test(ua) ? "phone" : /iPad|Tablet|Android/.test(ua) ? "tablet" : "desktop";
  return { browser: version ? `${family} ${version}` : family, device: `${system} ${form}` };
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function handleClientError(request, env) {
  // The answer is always empty and quick: the game does not look at it.
  const quiet = status => new Response(null, { status, headers: { "cache-control": "no-store" } });
  if (request.method !== "POST") return quiet(405);
  if (!requestIsSameOrigin(request, { required: true })) return quiet(403);
  let raw;
  try {
    raw = await readJsonWithLimit(request, MAX_ERROR_BODY_BYTES);
  } catch (error) {
    return quiet(error?.message === "payload_too_large" ? 413 : 400);
  }
  if (!raw || typeof raw !== "object" || !ERROR_KINDS.has(raw.kind)) return quiet(400);
  const message = clip(raw.message, 300);
  if (!message) return quiet(400);
  const kind = raw.kind;
  const source = clip(raw.source, 200);
  const line = smallInt(raw.line);
  const column = smallInt(raw.column);
  try {
    const limit = await enforceRateLimit(request, env, { scope: "error", limit: ERROR_RATE_LIMIT });
    if (!limit.allowed) return quiet(429);
    const { browser, device } = coarseClient(request.headers.get("user-agent") || "");
    const now = new Date().toISOString();
    const signature = (await sha256Hex(`${kind}|${message}|${source ?? ""}|${line ?? ""}`)).slice(0, 32);
    await env.DB.prepare(`
      INSERT INTO client_errors (signature, kind, message, source, line, column, stack, page, build, browser, device, screen, count, first_seen, last_seen)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?
      WHERE (SELECT COUNT(*) FROM client_errors) < ? OR EXISTS (SELECT 1 FROM client_errors WHERE signature = ?)
      ON CONFLICT (signature) DO UPDATE SET count = count + 1, last_seen = excluded.last_seen
    `).bind(
      signature, kind, message, source, line, column,
      clip(raw.stack, 1500), clip(raw.page, 100), clip(raw.build, 40), browser, device, clip(raw.screen, 24),
      now, now, ERROR_ROW_CAP, signature
    ).run();
  } catch (error) {
    // The table may not exist yet (code deployed before the migration), or the database is busy.
    console.warn("Could not store a client error report", error?.message);
    return quiet(204);
  }
  return quiet(204);
}

async function handleScheduledCleanup(env) {
  const bucket = Math.floor(Date.now() / 1000 / RATE_WINDOW_SECONDS);
  const sessionCutoff = new Date(Date.now() - SESSION_MAX_AGE_MS * 2).toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM submission_limits WHERE bucket < ?").bind(bucket - 6),
    env.DB.prepare("DELETE FROM used_sessions WHERE used_at < ?").bind(sessionCutoff)
  ]);
  try {
    await env.DB.prepare("DELETE FROM client_errors WHERE last_seen < ?")
      .bind(new Date(Date.now() - ERROR_RETENTION_MS).toISOString()).run();
  } catch (error) {
    console.warn("Could not trim client errors", error?.message);   // table not migrated yet
  }
  try {
    const oldest = dayKey(Date.now() - DAILY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await env.DB.prepare("DELETE FROM daily_scores WHERE day < ?").bind(oldest).run();
  } catch (error) {
    if (!isMissingDaily(error)) throw error;
  }
  try {
    await env.DB.prepare("DELETE FROM score_log WHERE created_at < ?")
      .bind(new Date(Date.now() - SCORE_LOG_RETENTION_MS).toISOString()).run();
  } catch (error) {
    if (!isMissingScoreLog(error)) throw error;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const fromApp = url.pathname.startsWith("/api/") && APP_ORIGINS.has(origin);
    // The app asks first whether it may send JSON.
    if (fromApp && request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    const response = await route(request, env, ctx, url);
    return fromApp ? withCors(response, origin) : response;
  },

  // Runs on the Cron Trigger declared in wrangler.jsonc. Moves cleanup out
  // of the hot POST path (previously ran on every single submission).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduledCleanup(env));
  }
};

async function route(request, env, ctx, url) {
  try {
    if (url.pathname === "/api/session") {
      return await issueSession(request, env);
    }
    if (url.pathname === "/api/client-error") return await handleClientError(request, env);
    if (url.pathname === "/api/leaderboard") return await leaderboard(request, env, ctx);
    if (url.pathname === "/api/leaderboard/me") return await handleLeaderboardMe(request, env);
    return env.ASSETS.fetch(request);
  } catch (error) {
    console.error("Leaderboard worker failure", error);
    return json(500, { error: "Leaderboard is temporarily unavailable." });
  }
}

// Keep the cache identity invariant directly testable without changing the
// Worker's public HTTP surface.
export { leaderboardCacheKey };
