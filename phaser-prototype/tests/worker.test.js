import test from "node:test";
import assert from "node:assert/strict";
import worker, { expectedStage, isTimingPlausible, seedForSession } from "../cloudflare/worker.js";
import { applyMove, createGame, replayGame } from "../src/game-core.js";
import { ORIGIN, SESSION_SECRET, hmacHex, installCacheStub, makeEnv, playRun } from "./helpers/worker-env.js";

/* ---------- Test doubles ---------- */

function makeCtx() {
  const pending = [];
  return { waitUntil: promise => pending.push(promise), settled: () => Promise.all(pending) };
}

// A correctly signed session that was issued `ageMs` ago.
async function signedSession(ageMs = 10 * 60 * 1000, secret = SESSION_SECRET) {
  const sid = crypto.randomUUID();
  const iat = Date.now() - ageMs;
  return { sid, iat, sig: await hmacHex(secret, `${sid}.${iat}`) };
}

// A complete, honest submission for the given (or a fresh) session: the run is
// played from the seed the Worker derives for that session.
const validScore = async (overrides = {}) => {
  const session = overrides.session !== undefined ? overrides.session : await signedSession();
  const seed = session?.sid ? await seedForSession(SESSION_SECRET, session.sid) : 1;
  const run = playRun(seed);
  return {
    playerName: "Mira",
    score: run.score,
    maxTile: run.maxTile,
    bestCombo: run.bestCombo,
    comboRules: 2,
    reachedStage: expectedStage(run.maxTile),
    moves: run.moves,
    deviceId: crypto.randomUUID(),
    session,
    ...overrides
  };
};

// Two honest submissions from one device with different scores, lowest first.
async function lowAndHigh(deviceId) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const a = await validScore({ deviceId });
    const b = await validScore({ deviceId });
    if (a.score !== b.score) return a.score < b.score ? [a, b] : [b, a];
  }
  throw new Error("could not find two runs with different scores");
}

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

test("session: issues a signed session and a server-chosen seed for same-origin POST", async () => {
  installCacheStub();
  const env = makeEnv();
  const response = await call(env, "/api/session", { method: "POST" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const { sid, iat, sig, seed } = await response.json();
  assert.match(sid, /^[0-9a-f-]{36}$/);
  assert.equal(sig, await hmacHex(SESSION_SECRET, `${sid}.${iat}`));
  assert.ok(Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff);
  assert.equal(seed, await seedForSession(SESSION_SECRET, sid));
  // Another secret derives another seed: the player cannot compute it alone.
  assert.notEqual(seed, await seedForSession("x".repeat(32), sid));
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

test("session: a client cannot farm sessions to hunt for a lucky seed", async () => {
  installCacheStub();
  const env = makeEnv();
  const headers = { "CF-Connecting-IP": "203.0.113.50", "user-agent": "farm" };
  for (let i = 0; i < 30; i++) {
    assert.equal((await call(env, "/api/session", { method: "POST", headers })).status, 200, `session ${i + 1}`);
  }
  const limited = await call(env, "/api/session", { method: "POST", headers });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "600");
  // Other clients, and the score limiter of the same client, are unaffected.
  const other = await call(env, "/api/session", { method: "POST", headers: { "CF-Connecting-IP": "203.0.113.51" } });
  assert.equal(other.status, 200);
  assert.equal((await submit(env, await validScore(), { headers })).status, 201);
});

/* ---------- POST /api/leaderboard: request validation ---------- */

test("submit: accepts a valid record and stores it", async () => {
  installCacheStub();
  const env = makeEnv();
  const body = await validScore();
  const response = await submit(env, body);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true, playerName: "Mira" });
  const [row] = rows(env);
  assert.equal(row.score, body.score);
  assert.equal(row.max_tile, body.maxTile);
  assert.equal(row.best_combo, body.bestCombo);
  assert.equal(row.reached_stage, expectedStage(body.maxTile));
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
  assert.equal((await submit(env, body, { rawBody: JSON.stringify({ ...body, padding: "x".repeat(40000) }) })).status, 413);
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
  assert.equal(await bad({ comboRules: 1 }), 400, "the replay computes turn-based combos only");
  assert.equal(await bad({ reachedStage: 5 }), 400, "stage must match the top plant");
  assert.equal(rows(env).length, 0);
});

test("stage boundaries follow the top plant", () => {
  const cases = [[2, 1], [64, 1], [128, 2], [256, 2], [512, 3], [1024, 4], [2048, 5], [8192, 5]];
  for (const [maxTile, stage] of cases) assert.equal(expectedStage(maxTile), stage, `tile ${maxTile}`);
});

test("a big tile needs a long enough session", () => {
  // 8192 needs at least 800 s of play; 2 never needs any.
  assert.equal(isTimingPlausible(8192, 10_000), false);
  assert.equal(isTimingPlausible(8192, 900_000), true);
  assert.equal(isTimingPlausible(2, 0), true);
});

/* ---------- POST /api/leaderboard: the game record is replayed ---------- */

test("submit: every claimed number must match the replayed run", async () => {
  installCacheStub();
  const env = makeEnv();
  const honest = await validScore();
  const tweak = async (field, value) => {
    const body = await validScore();
    return (await submit(env, { ...body, [field]: typeof value === "function" ? value(body[field]) : value })).status;
  };
  assert.equal(await tweak("score", n => n + 2), 400, "a higher score");
  assert.equal(await tweak("score", n => Math.max(0, n - 2)), 400, "a lower score");
  assert.equal(await tweak("maxTile", n => n * 2), 400);
  assert.equal(await tweak("bestCombo", n => n + 1), 400);
  assert.equal(await tweak("reachedStage", n => (n === 1 ? 2 : 1)), 400);
  assert.equal(rows(env).length, 0);
  assert.equal((await submit(env, honest)).status, 201);
});

test("submit: a missing, malformed or edited record is refused", async () => {
  installCacheStub();
  const env = makeEnv();
  const status = async overrides => (await submit(env, await validScore(overrides))).status;
  const base = await validScore();

  assert.equal(await status({ moves: undefined }), 400, "no record at all");
  assert.equal(await status({ moves: "" }), 400);
  assert.equal(await status({ moves: 12 }), 400);
  assert.equal(await status({ moves: "LRUDX" }), 400);
  assert.equal(await status({ moves: "lrud" }), 400);

  // A record cut short is a game that has not ended.
  const session = await signedSession();
  const run = await validScore({ session });
  assert.equal((await submit(env, { ...run, moves: run.moves.slice(0, -1) })).status, 400);
  // The last move changed. Two different last moves can end in the very same
  // finished game, so the Worker is only required to refuse the edit when the
  // replay really differs from what is claimed.
  const flipped = run.moves.slice(0, -1) + (run.moves.at(-1) === "L" ? "R" : "L");
  const altered = replayGame(await seedForSession(SESSION_SECRET, session.sid), flipped);
  const stillHonest = altered && altered.over && altered.score === run.score && altered.maxTile === run.maxTile && altered.bestCombo === run.bestCombo;
  if (!stillHonest) assert.equal((await submit(env, { ...run, moves: flipped })).status, 400);
  assert.equal((await submit(env, { ...run, moves: run.moves + "L" })).status, 400);
  // The untouched record still works: nothing above used up the session.
  assert.equal((await submit(env, run)).status, 201);
  assert.ok(base.moves.length > 0);
});

test("submit: a record played from another session's seed is refused", async () => {
  installCacheStub();
  const env = makeEnv();
  const mine = await signedSession();
  const other = await validScore({ session: await signedSession() });
  const body = await validScore({ session: mine });
  assert.equal((await submit(env, { ...body, moves: other.moves, score: other.score, maxTile: other.maxTile, bestCombo: other.bestCombo, reachedStage: other.reachedStage })).status, 400);
  assert.equal(rows(env).length, 0);
});

test("submit: a record cannot have more moves than the session's age allows", async () => {
  installCacheStub();
  const env = makeEnv();
  // 40 ms is the floor per move; a one-second-old session cannot hold a run
  // of dozens of moves.
  const young = await signedSession(1000);
  const body = await validScore({ session: young });
  assert.ok(body.moves.length * 40 > 1000, "the run is long enough for the test");
  const response = await submit(env, body);
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /too quickly/);
});

test("submit: the 8192 victory board is a finished game", async () => {
  // A run that wins ends on the winning board; the replay agrees it is over.
  const game = createGame(1);
  game.board.fill(0);
  game.board[0] = 4096;
  game.board[1] = 4096;
  applyMove(game, "left");
  assert.equal(game.over, true);
  assert.equal(game.victory, true);
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

/* ---------- Device rows and lower-score confirmation ---------- */

test("device: a better score replaces the device's row, keeping one row per device", async () => {
  installCacheStub();
  const env = makeEnv();
  const deviceId = crypto.randomUUID();
  const [low, high] = await lowAndHigh(deviceId);
  assert.equal((await submit(env, { ...low, playerName: "First" })).status, 201);
  assert.equal((await submit(env, { ...high, playerName: "Second" })).status, 201);
  const all = rows(env);
  assert.equal(all.length, 1);
  assert.equal(all[0].score, high.score);
  assert.equal(all[0].player_name, "Second");
});

test("device: a lower score needs confirmation and only overwrites when confirmed", async () => {
  installCacheStub();
  const env = makeEnv();
  const deviceId = crypto.randomUUID();
  const [low, high] = await lowAndHigh(deviceId);
  assert.equal((await submit(env, high)).status, 201);

  const first = await submit(env, low);
  assert.equal(first.status, 409);
  const conflict = await first.json();
  assert.equal(conflict.code, "lower_score_confirmation_required");
  assert.equal(conflict.currentScore, high.score);
  assert.equal(rows(env)[0].score, high.score);

  // The 409 happens before the session is consumed, so the same session can
  // be re-sent with the explicit confirmation flag.
  const confirmed = await submit(env, { ...low, replaceLowerScore: true });
  assert.equal(confirmed.status, 201);
  assert.equal(rows(env).length, 1);
  assert.equal(rows(env)[0].score, low.score);
});

test("device: submissions without a valid deviceId are always inserted", async () => {
  installCacheStub();
  const env = makeEnv();
  await submit(env, await validScore({ deviceId: undefined }));
  await submit(env, await validScore({ deviceId: "not-a-uuid" }));
  assert.equal(rows(env).length, 2);
  assert.ok(rows(env).every(row => row.device_id === null));
});

/* ---------- Rate limiting ---------- */

test("rate limit: the 6th submission in a window is refused with Retry-After", async () => {
  installCacheStub();
  const env = makeEnv();
  const headers = { "CF-Connecting-IP": "203.0.113.7", "user-agent": "test-agent" };
  for (let i = 0; i < 5; i++) {
    const response = await submit(env, await validScore(), { headers });
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

/* ---------- Period boards, a player's own rank and name rules ---------- */

const insertLog = (env, device, name, score, createdAt, maxTile = 128) =>
  env.DB.sqlite.prepare(
    "INSERT INTO score_log (device_id, player_name, score, max_tile, best_combo, reached_stage, created_at) VALUES (?, ?, ?, ?, 3, 2, ?)"
  ).run(device, name, score, maxTile, createdAt);
const insertBoardRow = (env, device, name, score, createdAt, maxTile = 128) =>
  env.DB.sqlite.prepare(
    "INSERT INTO leaderboard (device_id, player_name, score, max_tile, best_combo, reached_stage, created_at, combo_rules) VALUES (?, ?, ?, ?, 3, 2, ?, 2)"
  ).run(device, name, score, maxTile, createdAt);
const ago = ms => new Date(Date.now() - ms).toISOString();
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const get = async (env, path) => {
  const response = await call(env, path);
  return { status: response.status, body: await response.json() };
};

test("boards: 24 hours and 7 days rank each player's best score inside the window", async () => {
  installCacheStub();
  const env = makeEnv();
  const [a, b, c] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  insertLog(env, a, "Ayla", 9000, ago(10 * DAY_MS));   // best ever, but out of both windows
  insertLog(env, a, "Ayla", 4000, ago(2 * HOUR_MS));   // her best inside the day
  insertLog(env, a, "Ayla", 3000, ago(5 * HOUR_MS));
  insertLog(env, b, "Bora", 6000, ago(3 * DAY_MS));    // inside the week only
  insertLog(env, c, "Cem", 2000, ago(HOUR_MS));
  insertLog(env, null, "Anon", 1000, ago(HOUR_MS));    // no device id still ranks

  const day = await get(env, "/api/leaderboard?period=day");
  assert.equal(day.status, 200);
  assert.equal(day.body.period, "day");
  assert.deepEqual(day.body.entries.map(e => [e.player_name, e.score]), [["Ayla", 4000], ["Cem", 2000], ["Anon", 1000]]);

  const week = await get(env, "/api/leaderboard?period=week");
  assert.deepEqual(week.body.entries.map(e => [e.player_name, e.score]), [["Bora", 6000], ["Ayla", 4000], ["Cem", 2000], ["Anon", 1000]]);

  assert.equal((await get(env, "/api/leaderboard?period=year")).status, 400);
  assert.equal((await get(env, "/api/leaderboard")).body.period, "all");
});

test("boards: each period is cached on its own and a submission clears all of them", async () => {
  const cache = installCacheStub();
  const env = makeEnv();
  const ctx = makeCtx();
  for (const period of ["all", "week", "day"]) await call(env, `/api/leaderboard?period=${period}`, { ctx });
  await ctx.settled();
  assert.equal(cache.size, 3);
  await call(env, "/api/leaderboard?period=week&fresh=1", { ctx });
  await ctx.settled();
  assert.equal(cache.size, 3, "extra query parameters do not create cache entries");

  assert.equal((await submit(env, await validScore({ playerName: "Fresh" }))).status, 201);
  assert.equal(cache.size, 0);
  const day = await get(env, "/api/leaderboard?period=day");
  assert.equal(day.body.entries[0].player_name, "Fresh");
});

test("boards: an accepted run is logged for the period boards", async () => {
  installCacheStub();
  const env = makeEnv();
  const body = await validScore();
  assert.equal((await submit(env, body)).status, 201);
  const [row] = env.DB.sqlite.prepare("SELECT * FROM score_log").all();
  assert.equal(row.score, body.score);
  assert.equal(row.device_id, body.deviceId);
  assert.equal(row.max_tile, body.maxTile);
});

test("me: reports the device's rank, entry and the number of ranked players", async () => {
  installCacheStub();
  const env = makeEnv();
  const mine = crypto.randomUUID();
  for (let i = 0; i < 30; i++) insertBoardRow(env, crypto.randomUUID(), `P${i}`, 10000 - i * 100, ago(DAY_MS));
  insertBoardRow(env, mine, "Me", 10000 - 24 * 100 - 50, ago(DAY_MS)); // between P24 and P25 -> rank 26

  const me = await get(env, `/api/leaderboard/me?device=${mine}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.rank, 26);
  assert.equal(me.body.total, 31);
  assert.equal(me.body.entry.player_name, "Me");
  assert.ok(!("device_id" in me.body.entry), "the device id is never echoed back");

  const list = (await get(env, "/api/leaderboard")).body.entries;
  assert.equal(list.length, 20);
  assert.ok(list.every(e => e.player_name !== "Me"), "rank 26 is outside the top 20");
});

test("me: ties rank by who got there first, matching the list order", async () => {
  installCacheStub();
  const env = makeEnv();
  const [first, second] = [crypto.randomUUID(), crypto.randomUUID()];
  insertBoardRow(env, first, "Early", 5000, ago(2 * DAY_MS));
  insertBoardRow(env, second, "Late", 5000, ago(DAY_MS));
  assert.equal((await get(env, `/api/leaderboard/me?device=${first}`)).body.rank, 1);
  assert.equal((await get(env, `/api/leaderboard/me?device=${second}`)).body.rank, 2);
  const list = (await get(env, "/api/leaderboard")).body.entries;
  assert.deepEqual(list.map(e => e.player_name), ["Early", "Late"]);
});

test("me: works on the period boards and for a device with no entry", async () => {
  installCacheStub();
  const env = makeEnv();
  const [a, b] = [crypto.randomUUID(), crypto.randomUUID()];
  insertLog(env, a, "Ayla", 4000, ago(2 * HOUR_MS));
  insertLog(env, b, "Bora", 6000, ago(3 * DAY_MS));
  const weekA = (await get(env, `/api/leaderboard/me?period=week&device=${a}`)).body;
  assert.equal(weekA.rank, 2);
  assert.equal(weekA.total, 2);
  const dayB = (await get(env, `/api/leaderboard/me?period=day&device=${b}`)).body;
  assert.equal(dayB.rank, null, "Bora has no run in the last 24 hours");
  assert.equal(dayB.entry, null);
  assert.equal(dayB.total, 1);
  const stranger = (await get(env, `/api/leaderboard/me?device=${crypto.randomUUID()}`)).body;
  assert.deepEqual([stranger.rank, stranger.entry, stranger.total], [null, null, 0]);
});

test("me: validates the device and the period, never caches and accepts only GET", async () => {
  const cache = installCacheStub();
  const env = makeEnv();
  assert.equal((await get(env, "/api/leaderboard/me")).status, 400);
  assert.equal((await get(env, "/api/leaderboard/me?device=nope")).status, 400);
  assert.equal((await get(env, `/api/leaderboard/me?period=year&device=${crypto.randomUUID()}`)).status, 400);
  const ok = await call(env, `/api/leaderboard/me?device=${crypto.randomUUID()}`);
  assert.equal(ok.headers.get("cache-control"), "no-store");
  assert.equal(cache.size, 0);
  assert.equal((await call(env, `/api/leaderboard/me?device=${crypto.randomUUID()}`, { method: "POST" })).status, 405);
  assert.equal((await call(makeEnv({ DB: undefined }), `/api/leaderboard/me?device=${crypto.randomUUID()}`)).status, 503);
});

test("device: the same score again updates the name but keeps the earlier time", async () => {
  installCacheStub();
  const env = makeEnv();
  const deviceId = crypto.randomUUID();
  const run = await validScore({ deviceId });
  assert.equal((await submit(env, { ...run, playerName: "Old Name" })).status, 201);
  const before = rows(env)[0];
  const sameScore = await validScore({ deviceId });
  // Make the stored score equal to the new run's, then submit it again.
  env.DB.sqlite.prepare("UPDATE leaderboard SET score = ? WHERE id = ?").run(sameScore.score, before.id);
  const stored = rows(env)[0];
  assert.equal((await submit(env, { ...sameScore, playerName: "New Name" })).status, 201);
  const after = rows(env)[0];
  assert.equal(after.player_name, "New Name");
  assert.equal(after.created_at, stored.created_at, "the tie-break time did not move");
  assert.equal(rows(env).length, 1);
});

test("submit: names that are not allowed are refused with a code", async () => {
  installCacheStub();
  const env = makeEnv();
  const response = await submit(env, await validScore({ playerName: "Admin" }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "name_not_allowed");
  const rude = await submit(env, await validScore({ playerName: "xX_f.u.c.k_Xx" }));
  assert.equal(rude.status, 400);
  assert.equal(rows(env).length, 0);
  assert.equal((await submit(env, await validScore({ playerName: "山田太郎" }))).status, 201);
});

test("migration gap: scores are still accepted before score_log exists", async () => {
  installCacheStub();
  const env = makeEnv();
  env.DB.sqlite.exec("DROP TABLE score_log");
  assert.equal((await submit(env, await validScore())).status, 201);
  assert.equal(rows(env).length, 1);
  assert.equal((await get(env, "/api/leaderboard")).status, 200);
  assert.equal((await get(env, "/api/leaderboard?period=week")).status, 503);
  assert.equal((await get(env, `/api/leaderboard/me?period=day&device=${crypto.randomUUID()}`)).status, 503);
});

test("scheduled cleanup trims the score log to the longest window", async () => {
  installCacheStub();
  const env = makeEnv();
  insertLog(env, crypto.randomUUID(), "Old", 100, ago(9 * DAY_MS));
  insertLog(env, crypto.randomUUID(), "New", 100, ago(6 * DAY_MS));
  const ctx = makeCtx();
  await worker.scheduled({}, env, ctx);
  await ctx.settled();
  assert.deepEqual(env.DB.sqlite.prepare("SELECT player_name FROM score_log").all().map(r => r.player_name), ["New"]);
});
