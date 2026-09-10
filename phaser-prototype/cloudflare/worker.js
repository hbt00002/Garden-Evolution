const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin"
};

const SCORE_LIMIT = 100_000_000;
const RATE_WINDOW_SECONDS = 10 * 60;
const RATE_WINDOW_LIMIT = 5;
const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours: generous upper bound for a play session
const MAX_BODY_BYTES = 2048;

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

function leaderboardCacheKey(request) {
  const cacheUrl = new URL(request.url);
  cacheUrl.search = "";
  cacheUrl.hash = "";
  return new Request(cacheUrl.toString(), { method: "GET" });
}

function cleanName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[<>\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
}

function expectedStage(maxTile) {
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

async function fingerprint(request, secret) {
  const address = request.headers.get("CF-Connecting-IP") || "local";
  const agent = (request.headers.get("user-agent") || "unknown").slice(0, 160);
  return hmacHex(secret, `${address}|${agent}`).then(full => full.slice(0, 32));
}

async function enforceRateLimit(request, env) {
  if (!env.RATE_LIMIT_SALT || env.RATE_LIMIT_SALT.length < 24) {
    throw new Error("RATE_LIMIT_SALT is not configured securely.");
  }
  const bucket = Math.floor(Date.now() / 1000 / RATE_WINDOW_SECONDS);
  const key = await fingerprint(request, env.RATE_LIMIT_SALT);
  const result = await env.DB.prepare(`
    INSERT INTO submission_limits (fingerprint, bucket, count)
    VALUES (?, ?, 1)
    ON CONFLICT (fingerprint, bucket)
    DO UPDATE SET count = count + 1
    RETURNING count
  `).bind(key, bucket).first();
  const count = Number(result?.count || 1);
  return { allowed: count <= RATE_WINDOW_LIMIT, retryAfter: RATE_WINDOW_SECONDS };
}

// required=true is used for POST: an attacker can omit Origin, so writes
// must not be allowed through just because the header is missing.
function requestIsSameOrigin(request, { required = false } = {}) {
  const origin = request.headers.get("origin");
  if (!origin) return !required;
  return origin === new URL(request.url).origin;
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
  const sid = crypto.randomUUID();
  const iat = Date.now();
  const sig = await hmacHex(env.SESSION_SECRET, `${sid}.${iat}`);
  return json(200, { sid, iat, sig });
}

async function verifySession(session, env) {
  const sid = session?.sid;
  const iat = Number(session?.iat);
  const sig = session?.sig;
  if (!isValidUuid(sid) || !Number.isSafeInteger(iat) || typeof sig !== "string") {
    return { ok: false, reason: "malformed_session" };
  }
  const expected = await hmacHex(env.SESSION_SECRET, `${sid}.${iat}`);
  if (!timingSafeEqual(expected, sig)) return { ok: false, reason: "bad_signature" };

  const ageMs = Date.now() - iat;
  if (ageMs < 0 || ageMs > SESSION_MAX_AGE_MS) return { ok: false, reason: "expired" };

  const used = await env.DB.prepare("SELECT 1 FROM used_sessions WHERE sid = ?").bind(sid).first();
  if (used) return { ok: false, reason: "already_used" };

  return { ok: true, sid, ageMs };
}

function isTimingPlausible(maxTile, ageMs) {
  const minSeconds = MIN_SECONDS_PER_TILE[maxTile] ?? 0;
  return ageMs / 1000 >= minSeconds;
}

/* ---------- Leaderboard ---------- */

async function handleLeaderboardGet(request, env, ctx) {
  const cache = caches.default;
  const cacheKey = leaderboardCacheKey(request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const result = await env.DB.prepare(`
    SELECT player_name, score, max_tile, best_combo, combo_rules, reached_stage, created_at
    FROM leaderboard
    ORDER BY score DESC, created_at ASC
    LIMIT 20
  `).all();

  const response = json(200, { entries: result.results || [] }, {
    "cache-control": "public, max-age=30"
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
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
  if (comboRules !== 1 && comboRules !== 2) return json(400, { error: "Invalid combo rules." });
  const reachedStage = Number(raw.reachedStage);
  const deviceId = isValidUuid(raw.deviceId) ? raw.deviceId : null;
  const replaceLowerScore = raw.replaceLowerScore === true;

  if (playerName.length < 2) return json(400, { error: "Name must contain at least 2 characters." });
  if (!Number.isSafeInteger(score) || score < 0 || score > SCORE_LIMIT) return json(400, { error: "Invalid score." });
  if (!validPowerOfTwo(maxTile)) return json(400, { error: "Invalid top plant." });
  if (!Number.isSafeInteger(bestCombo) || bestCombo < 0 || bestCombo > 1000) return json(400, { error: "Invalid combo." });
  if (!Number.isInteger(reachedStage) || reachedStage !== expectedStage(maxTile)) {
    return json(400, { error: "World and top plant do not match." });
  }
  if (!isTimingPlausible(maxTile, session.ageMs)) {
    return json(400, { error: "Score submitted too quickly for this progress." });
  }

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
          created_at = excluded.created_at
        WHERE excluded.score > leaderboard.score OR ? = 1
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

  await env.DB.batch(statements);

  // A successful write must be visible on the very next leaderboard read.
  // Await deletion instead of using waitUntil so the response cannot win a
  // race against an older 30-second edge-cache entry.
  await caches.default.delete(leaderboardCacheKey(request));

  return json(201, { ok: true, playerName });
}

async function handleScheduledCleanup(env) {
  const bucket = Math.floor(Date.now() / 1000 / RATE_WINDOW_SECONDS);
  const sessionCutoff = new Date(Date.now() - SESSION_MAX_AGE_MS * 2).toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM submission_limits WHERE bucket < ?").bind(bucket - 6),
    env.DB.prepare("DELETE FROM used_sessions WHERE used_at < ?").bind(sessionCutoff)
  ]);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/session") {
        return await issueSession(request, env);
      }
      if (url.pathname === "/api/leaderboard") return await leaderboard(request, env, ctx);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Leaderboard worker failure", error);
      return json(500, { error: "Leaderboard is temporarily unavailable." });
    }
  },

  // Runs on the Cron Trigger declared in wrangler.jsonc. Moves cleanup out
  // of the hot POST path (previously ran on every single submission).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduledCleanup(env));
  }
};

// Keep the cache identity invariant directly testable without changing the
// Worker's public HTTP surface.
export { leaderboardCacheKey };
