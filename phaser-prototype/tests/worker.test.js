import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import worker from "../cloudflare/worker.js";

const ORIGIN = "https://play.test";
const SESSION_SECRET = "s".repeat(32);
const RATE_LIMIT_SALT = "r".repeat(32);

/* ---------- Test doubles ---------- */

// Minimal D1 adapter over node:sqlite so the real migrations and the real SQL
// in worker.js (ON CONFLICT ... WHERE, RETURNING, batch) are exercised.
function createD1() {
  const sqlite = new DatabaseSync(":memory:");
  const migrationsDir = fileURLToPath(new URL("../migrations/", import.meta.url));
  for (const file of readdirSync(migrationsDir).sort()) {
    sqlite.exec(readFileSync(migrationsDir + file, "utf8"));
  }
  const statement = (sql, params = []) => ({
    sql,
    params,
    bind: (...values) => statement(sql, values),
    first: async () => sqlite.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
    run: async () => sqlite.prepare(sql).run(...params)
  });
  return {
    sqlite,
    prepare: sql => statement(sql),
    batch: async statements => {
      sqlite.exec("BEGIN");
      try {
        for (const s of statements) sqlite.prepare(s.sql).run(...s.params);
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    }
  };
}

function installCacheStub() {
  const store = new Map();
  globalThis.caches = {
    default: {
      match: async request => store.get(request.url)?.clone(),
      put: async (request, response) => { store.set(request.url, response); },
      delete: async request => store.delete(request.url)
    }
  };
  return store;
}

function makeEnv(overrides = {}) {
  return {
    DB: createD1(),
    SESSION_SECRET,
    RATE_LIMIT_SALT,
    ASSETS: { fetch: async () => new Response("asset", { status: 200 }) },
    ...overrides
  };
}

function makeCtx() {
  const pending = [];
  return { waitUntil: promise => pending.push(promise), settled: () => Promise.all(pending) };
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// A correctly signed session that was issued `ageMs` ago.
async function signedSession(ageMs = 10 * 60 * 1000, secret = SESSION_SECRET) {
  const sid = crypto.randomUUID();
  const iat = Date.now() - ageMs;
  return { sid, iat, sig: await hmacHex(secret, `${sid}.${iat}`) };
}

const validScore = async (overrides = {}) => ({
  playerName: "Mira",
  score: 5000,
  maxTile: 512,
  bestCombo: 4,
  comboRules: 2,
  reachedStage: 3,
  deviceId: crypto.randomUUID(),
  session: await signedSession(),
  ...overrides
});

function call(env, path, { method = "GET", body, headers = {}, origin = ORIGIN, ctx = makeCtx(), rawBody } = {}) {
  const init = { method, headers: { ...headers } };
  if (origin) init.headers.origin = origin;
  if (method === "POST") {
    init.headers["content-type"] ??= "application/json";
    init.body = rawBody ?? JSON.stringify(body ?? {});
  }
  return worker.fetch(new Request(ORIGIN + path, init), env, ctx);
}

const submit = (env, body, extra = {}) => call(env, "/api/leaderboard", { method: "POST", body, ...extra });
const rows = env => env.DB.sqlite.prepare("SELECT * FROM leaderboard ORDER BY id").all();

/* ---------- /api/session ---------- */

test("session: issues a signed session for same-origin POST", async () => {
  installCacheStub();
  const env = makeEnv();
  const response = await call(env, "/api/session", { method: "POST" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const { sid, iat, sig } = await response.json();
  assert.match(sid, /^[0-9a-f-]{36}$/);
  assert.equal(sig, await hmacHex(SESSION_SECRET, `${sid}.${iat}`));
});

test("session: rejects GET, missing Origin, cross-origin and missing secret", async () => {
  installCacheStub();
  const env = makeEnv();
  const get = await call(env, "/api/session");
  assert.equal(get.status, 405);
  assert.equal(get.headers.get("allow"), "POST");
  assert.equal((await call(env, "/api/session", { method: "POST", origin: null })).status, 403);
  assert.equal((await call(env, "/api/session", { method: "POST", origin: "https://evil.test" })).status, 403);
  assert.equal((await call(makeEnv({ SESSION_SECRET: "short" }), "/api/session", { method: "POST" })).status, 503);
});

/* ---------- POST /api/leaderboard: request validation ---------- */

test("submit: accepts a valid score and stores it", async () => {
  installCacheStub();
  const env = makeEnv();
  const body = await validScore();
  const response = await submit(env, body);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true, playerName: "Mira" });
  const [row] = rows(env);
  assert.equal(row.score, 5000);
  assert.equal(row.max_tile, 512);
  assert.equal(row.reached_stage, 3);
  assert.equal(row.combo_rules, 2);
  assert.equal(row.device_id, body.deviceId);
});

test("submit: enforces origin, content type, body size and JSON syntax", async () => {
  installCacheStub();
  const env = makeEnv();
  const body = await validScore();
  assert.equal((await submit(env, body, { origin: null })).status, 403);
  assert.equal((await submit(env, body, { origin: "https://evil.test" })).status, 403);
  assert.equal((await submit(env, body, { headers: { "content-type": "text/plain" } })).status, 415);
  assert.equal((await submit(env, body, { rawBody: JSON.stringify({ ...body, padding: "x".repeat(3000) }) })).status, 413);
  assert.equal((await submit(env, body, { rawBody: "{not json" })).status, 400);
  assert.equal((await submit(env, body, { rawBody: "[]" })).status, 400);
  assert.equal(rows(env).length, 0);
});

test("submit: rejects a bad, expired, future-dated or reused session", async () => {
  installCacheStub();
  const env = makeEnv();

  const tampered = await signedSession();
  tampered.sig = tampered.sig.replace(/.$/, c => (c === "0" ? "1" : "0"));
  assert.equal((await submit(env, await validScore({ session: tampered }))).status, 400);

  const wrongSecret = await signedSession(10 * 60 * 1000, "x".repeat(32));
  assert.equal((await submit(env, await validScore({ session: wrongSecret }))).status, 400);

  const expired = await signedSession(14 * 24 * 60 * 60 * 1000 + 1000);
  assert.equal((await submit(env, await validScore({ session: expired }))).status, 400);

  const future = await signedSession(-60 * 1000);
  assert.equal((await submit(env, await validScore({ session: future }))).status, 400);

  assert.equal((await submit(env, await validScore({ session: null }))).status, 400);
  assert.equal((await submit(env, await validScore({ session: { sid: "nope", iat: 1, sig: "x" } }))).status, 400);

  const session = await signedSession();
  assert.equal((await submit(env, await validScore({ session }))).status, 201);
  const replay = await submit(env, await validScore({ session }));
  assert.equal(replay.status, 400);
  assert.equal(rows(env).length, 1);
});

test("submit: validates name, score, tile, combo, stage and combo rules", async () => {
  installCacheStub();
  const env = makeEnv();
  const bad = async overrides => (await submit(env, await validScore(overrides))).status;

  assert.equal(await bad({ playerName: "a" }), 400);
  assert.equal(await bad({ playerName: "<>" }), 400);
  assert.equal(await bad({ score: -1 }), 400);
  assert.equal(await bad({ score: 100_000_001 }), 400);
  assert.equal(await bad({ score: 1.5 }), 400);
  assert.equal(await bad({ maxTile: 100 }), 400);
  assert.equal(await bad({ maxTile: 16384 }), 400);
  assert.equal(await bad({ bestCombo: 1001 }), 400);
  assert.equal(await bad({ comboRules: 3 }), 400);
  assert.equal(await bad({ reachedStage: 5 }), 400, "stage must match the top plant");
  assert.equal(rows(env).length, 0);
});

test("submit: the score must be possible for the top plant", async () => {
  installCacheStub();
  const env = makeEnv();
  const status = async (maxTile, reachedStage, score, ip) =>
    (await submit(env, await validScore({ maxTile, reachedStage, score, session: await signedSession(2_000_000) }), {
      headers: { "CF-Connecting-IP": ip }
    })).status;

  // 512 is built from 4-spawns at best (512 * 7) and from 2-spawns at most
  // 12 boards' worth (12 * 512 * 8).
  assert.equal(await status(512, 3, 512 * 7 - 2, "198.51.100.1"), 400, "below the cheapest way to reach the tile");
  assert.equal(await status(512, 3, 512 * 7, "198.51.100.2"), 201);
  assert.equal(await status(512, 3, 12 * 512 * 8, "198.51.100.3"), 201);
  assert.equal(await status(512, 3, 12 * 512 * 8 + 2, "198.51.100.4"), 400, "above anything a 4x4 board can score");
  assert.equal(await status(2048, 5, 100_000_000, "198.51.100.5"), 400, "a huge score with a modest tile");
  assert.equal(await status(2, 1, 0, "198.51.100.6"), 201, "a run that never merged");
  assert.equal(await status(2, 1, 2, "198.51.100.7"), 400);
  assert.equal(rows(env).length, 3);
});

test("submit: sanitises the player name", async () => {
  installCacheStub();
  const env = makeEnv();
  const response = await submit(env, await validScore({ playerName: "  <b>Ada</b>\u0000   Lovelace-Extra-Long  " }));
  assert.equal(response.status, 201);
  const { playerName } = await response.json();
  // Angle brackets and control characters are stripped, whitespace collapsed,
  // and the result is cut to 16 characters.
  assert.equal(playerName, "bAda/b Lovelace-");
  assert.equal(rows(env)[0].player_name, playerName);
});

test("submit: rejects scores that arrive implausibly fast for the top plant", async () => {
  installCacheStub();
  const env = makeEnv();
  // 8192 needs at least 800 s of play; a 10 s old session must be refused.
  const fast = await validScore({ maxTile: 8192, reachedStage: 5, score: 200_000, session: await signedSession(10_000) });
  const refused = await submit(env, fast);
  assert.equal(refused.status, 400);
  assert.match((await refused.json()).error, /too quickly/);
  // The same claim after 900 s is accepted.
  const slow = await validScore({ maxTile: 8192, reachedStage: 5, score: 200_000, session: await signedSession(900_000) });
  assert.equal((await submit(env, slow)).status, 201);
});

test("submit: stage must match the top plant at every boundary", async () => {
  installCacheStub();
  const env = makeEnv();
  const cases = [[64, 1], [128, 2], [256, 2], [512, 3], [1024, 4], [2048, 5], [8192, 5]];
  for (const [index, [maxTile, reachedStage]] of cases.entries()) {
    const score = maxTile * Math.max(1, Math.log2(maxTile) - 1);
    const body = await validScore({ maxTile, reachedStage, score, session: await signedSession(2_000_000) });
    // Distinct clients, so the per-fingerprint rate limit is not what is tested.
    const headers = { "CF-Connecting-IP": `198.51.100.${index + 1}` };
    assert.equal((await submit(env, body, { headers })).status, 201, `tile ${maxTile} -> stage ${reachedStage}`);
  }
});

/* ---------- Device rows and lower-score confirmation ---------- */

test("device: a better score replaces the device's row, keeping one row per device", async () => {
  installCacheStub();
  const env = makeEnv();
  const deviceId = crypto.randomUUID();
  assert.equal((await submit(env, await validScore({ deviceId, score: 4000, playerName: "First" }))).status, 201);
  assert.equal((await submit(env, await validScore({ deviceId, score: 9000, playerName: "Second" }))).status, 201);
  const all = rows(env);
  assert.equal(all.length, 1);
  assert.equal(all[0].score, 9000);
  assert.equal(all[0].player_name, "Second");
});

test("device: a lower score needs confirmation and only overwrites when confirmed", async () => {
  installCacheStub();
  const env = makeEnv();
  const deviceId = crypto.randomUUID();
  await submit(env, await validScore({ deviceId, score: 9000 }));

  const lowerSession = await signedSession();
  const first = await submit(env, await validScore({ deviceId, score: 3600, session: lowerSession }));
  assert.equal(first.status, 409);
  const conflict = await first.json();
  assert.equal(conflict.code, "lower_score_confirmation_required");
  assert.equal(conflict.currentScore, 9000);
  assert.equal(rows(env)[0].score, 9000);

  // The 409 happens before the session is consumed, so the same session can
  // be re-sent with the explicit confirmation flag.
  const confirmed = await submit(env, await validScore({ deviceId, score: 3600, session: lowerSession, replaceLowerScore: true }));
  assert.equal(confirmed.status, 201);
  assert.equal(rows(env).length, 1);
  assert.equal(rows(env)[0].score, 3600);
});

test("device: submissions without a valid deviceId are always inserted", async () => {
  installCacheStub();
  const env = makeEnv();
  await submit(env, await validScore({ deviceId: undefined, score: 3700 }));
  await submit(env, await validScore({ deviceId: "not-a-uuid", score: 3800 }));
  assert.equal(rows(env).length, 2);
  assert.ok(rows(env).every(row => row.device_id === null));
});

/* ---------- Rate limiting ---------- */

test("rate limit: the 6th submission in a window is refused with Retry-After", async () => {
  installCacheStub();
  const env = makeEnv();
  const headers = { "CF-Connecting-IP": "203.0.113.7", "user-agent": "test-agent" };
  for (let i = 0; i < 5; i++) {
    const response = await submit(env, await validScore({ score: 4000 + i }), { headers });
    assert.equal(response.status, 201, `submission ${i + 1}`);
  }
  const limited = await submit(env, await validScore(), { headers });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "600");

  // A different client is unaffected.
  const other = await submit(env, await validScore(), { headers: { "CF-Connecting-IP": "203.0.113.8", "user-agent": "test-agent" } });
  assert.equal(other.status, 201);
});

test("rate limit: stores only a hashed fingerprint, never the raw IP", async () => {
  installCacheStub();
  const env = makeEnv();
  await submit(env, await validScore(), { headers: { "CF-Connecting-IP": "203.0.113.7" } });
  const [limit] = env.DB.sqlite.prepare("SELECT * FROM submission_limits").all();
  assert.match(limit.fingerprint, /^[0-9a-f]{32}$/);
  assert.ok(!JSON.stringify(limit).includes("203.0.113.7"));
});

/* ---------- GET /api/leaderboard and cache ---------- */

test("leaderboard GET: ranks by score then age, caps at 20 and caches", async () => {
  const cache = installCacheStub();
  const env = makeEnv();
  const insert = env.DB.sqlite.prepare(
    "INSERT INTO leaderboard (player_name, score, max_tile, best_combo, reached_stage, created_at) VALUES (?, ?, 2, 0, 1, ?)"
  );
  for (let i = 0; i < 25; i++) insert.run(`Player${i}`, 1000 + i, `2026-01-01T00:00:${String(i).padStart(2, "0")}.000Z`);
  insert.run("Tie-Late", 1024, "2026-02-01T00:00:00.000Z");

  const ctx = makeCtx();
  const response = await call(env, "/api/leaderboard", { ctx });
  await ctx.settled();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=30");
  const { entries } = await response.json();
  assert.equal(entries.length, 20);
  assert.deepEqual(entries.map(e => e.score), [...entries.map(e => e.score)].sort((a, b) => b - a));
  // Player24 and Tie-Late both have 1024 points; the older entry ranks first.
  assert.deepEqual(entries.slice(0, 2).map(e => e.player_name), ["Player24", "Tie-Late"]);
  assert.equal(cache.size, 1, "response was written to the edge cache");

  // A second read is served from cache even after the table changes.
  env.DB.sqlite.exec("DELETE FROM leaderboard");
  const cached = await call(env, "/api/leaderboard");
  assert.equal((await cached.json()).entries.length, 20);
});

test("leaderboard GET: ignores query strings for the cache identity", async () => {
  const cache = installCacheStub();
  const env = makeEnv();
  const ctx = makeCtx();
  await call(env, "/api/leaderboard?a=1", { ctx });
  await ctx.settled();
  await call(env, "/api/leaderboard?b=2", { ctx });
  await ctx.settled();
  assert.equal(cache.size, 1);
});

test("a successful submission invalidates the cached leaderboard immediately", async () => {
  const cache = installCacheStub();
  const env = makeEnv();
  const ctx = makeCtx();
  await call(env, "/api/leaderboard", { ctx });
  await ctx.settled();
  assert.equal(cache.size, 1);

  assert.equal((await submit(env, await validScore({ playerName: "Fresh" }))).status, 201);
  assert.equal(cache.size, 0);

  const { entries } = await (await call(env, "/api/leaderboard")).json();
  assert.equal(entries[0].player_name, "Fresh");
});

test("leaderboard: unsupported methods get 405 with the allowed list", async () => {
  installCacheStub();
  const response = await call(makeEnv(), "/api/leaderboard", { method: "DELETE" });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, POST");
});

/* ---------- Configuration, routing and failures ---------- */

test("misconfiguration: missing DB or secrets is reported, not crashed", async () => {
  installCacheStub();
  const noDb = await call(makeEnv({ DB: undefined }), "/api/leaderboard");
  assert.equal(noDb.status, 503);

  const noSecret = makeEnv({ SESSION_SECRET: undefined });
  assert.equal((await submit(noSecret, await validScore())).status, 503);

  // A weak rate-limit salt surfaces as a generic 500 and never leaks details.
  const weakSalt = makeEnv({ RATE_LIMIT_SALT: "short" });
  const originalError = console.error;
  console.error = () => {};
  let response;
  try {
    response = await submit(weakSalt, await validScore());
  } finally {
    console.error = originalError;
  }
  assert.equal(response.status, 500);
  assert.doesNotMatch(JSON.stringify(await response.json()), /RATE_LIMIT_SALT/);
  assert.equal(rows(weakSalt).length, 0);
});

test("a failed write does not burn the session", async () => {
  installCacheStub();
  const env = makeEnv();
  const session = await signedSession();
  const original = env.DB.batch;
  env.DB.batch = async () => { throw new Error("d1 down"); };
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal((await submit(env, await validScore({ session }))).status, 500);
  } finally {
    console.error = originalError;
  }
  env.DB.batch = original;
  assert.equal((await submit(env, await validScore({ session }))).status, 201);
});

test("routing: other paths fall through to static assets", async () => {
  installCacheStub();
  const response = await call(makeEnv(), "/index.html");
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "asset");
});

test("every JSON response carries the hardening headers", async () => {
  installCacheStub();
  const response = await call(makeEnv(), "/api/session");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "same-origin");
  assert.match(response.headers.get("content-type"), /application\/json/);
});

/* ---------- Scheduled cleanup ---------- */

test("scheduled cleanup removes stale rate-limit buckets and old sessions only", async () => {
  installCacheStub();
  const env = makeEnv();
  const bucket = Math.floor(Date.now() / 1000 / 600);
  const sqlite = env.DB.sqlite;
  sqlite.prepare("INSERT INTO submission_limits (fingerprint, bucket, count) VALUES (?, ?, 1)").run("old", bucket - 7);
  sqlite.prepare("INSERT INTO submission_limits (fingerprint, bucket, count) VALUES (?, ?, 1)").run("recent", bucket - 1);
  sqlite.prepare("INSERT INTO used_sessions (sid, used_at) VALUES (?, ?)").run("old-sid", new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString());
  sqlite.prepare("INSERT INTO used_sessions (sid, used_at) VALUES (?, ?)").run("new-sid", new Date().toISOString());

  const ctx = makeCtx();
  await worker.scheduled({}, env, ctx);
  await ctx.settled();

  assert.deepEqual(sqlite.prepare("SELECT fingerprint FROM submission_limits").all().map(r => r.fingerprint), ["recent"]);
  assert.deepEqual(sqlite.prepare("SELECT sid FROM used_sessions").all().map(r => r.sid), ["new-sid"]);
});
