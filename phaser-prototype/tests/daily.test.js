import test from "node:test";
import assert from "node:assert/strict";
import worker, { seedForDay, seedForSession } from "../cloudflare/worker.js";
import { stageFor } from "../src/levels.js";
import { dayEnd, dayKey, dayLabel, dayStart, isDayKey, msUntilNextDay, nextDay, previousDay } from "../src/daily.js";
import { ORIGIN, SESSION_SECRET, hmacHex, installCacheStub as installCache, makeEnv, playRun } from "./helpers/worker-env.js";

/* ---------- What "today" is ---------- */

test("a day changes at midnight Turkey time (21:00 UTC)", () => {
  assert.equal(dayKey(Date.parse("2026-10-22T20:59:59Z")), "2026-10-22");
  assert.equal(dayKey(Date.parse("2026-10-22T21:00:00Z")), "2026-10-23");
  assert.equal(dayKey(Date.parse("2026-10-22T00:30:00Z")), "2026-10-22", "03:30 in Turkey");
  assert.equal(dayKey(Date.parse("2026-12-31T21:00:00Z")), "2027-01-01");
});

test("a day's start and end, the next and the previous day", () => {
  assert.equal(new Date(dayStart("2026-10-22")).toISOString(), "2026-10-21T21:00:00.000Z");
  assert.equal(new Date(dayEnd("2026-10-22")).toISOString(), "2026-10-22T21:00:00.000Z");
  assert.equal(nextDay("2026-10-31"), "2026-11-01");
  assert.equal(previousDay("2026-03-01"), "2026-02-28");
  assert.equal(msUntilNextDay(Date.parse("2026-10-22T20:00:00Z")), 60 * 60 * 1000);
});

test("only a real date is a day", () => {
  assert.equal(isDayKey("2026-10-22"), true);
  for (const bad of ["2026-13-01", "2026-02-30", "26-10-22", "2026-10-22T00", "", null, 20261022]) {
    assert.equal(isDayKey(bad), false, String(bad));
  }
});

test("a day is shown in the player's language", () => {
  assert.match(dayLabel("2026-10-22", "en"), /22/);
  assert.match(dayLabel("2026-10-22", "tr"), /22/);
  assert.notEqual(dayLabel("2026-10-22", "en"), dayLabel("2026-10-22", "tr"));
});

/* ---------- The Worker ---------- */

const ctx = { waitUntil() {} };

// A signed session for a day, issued `ageMs` ago (old enough to pass the timing checks).
async function dailySession(day = dayKey(), ageMs = 30 * 60 * 1000) {
  const sid = crypto.randomUUID();
  const iat = Date.now() - ageMs;
  return { sid, iat, daily: day, sig: await hmacHex(SESSION_SECRET, `${sid}.${iat}.daily.${day}`) };
}

async function submission(session, overrides = {}) {
  const seed = await seedForDay(SESSION_SECRET, session.daily);
  const run = playRun(seed);
  return {
    playerName: "Mira", score: run.score, maxTile: run.maxTile, bestCombo: run.bestCombo, comboRules: 2,
    reachedStage: stageFor(run.maxTile), moves: run.moves, deviceId: crypto.randomUUID(), session, ...overrides
  };
}

const post = (env, path, body, agent = "daily-test") => worker.fetch(new Request(`${ORIGIN}${path}`, {
  method: "POST", headers: { origin: ORIGIN, "content-type": "application/json", "user-agent": agent }, body: body === undefined ? undefined : JSON.stringify(body)
}), env, ctx);
const get = (env, path) => worker.fetch(new Request(`${ORIGIN}${path}`, { headers: { "user-agent": "daily-test" } }), env, ctx);

test("today's garden hands everyone the same seed, which a normal game does not", async () => {
  installCache();
  const env = makeEnv();
  const a = await (await post(env, "/api/session?mode=daily", undefined, "a")).json();
  const b = await (await post(env, "/api/session?mode=daily", undefined, "b")).json();
  assert.equal(a.daily, dayKey());
  assert.equal(a.seed, b.seed, "same seed for everyone");
  assert.notEqual(a.sid, b.sid, "but separate sessions");
  assert.equal(a.seed, await seedForDay(SESSION_SECRET, dayKey()));
  const normal = await (await post(env, "/api/session", undefined, "c")).json();
  assert.equal(normal.daily, undefined);
  assert.equal(normal.seed, await seedForSession(SESSION_SECRET, normal.sid));
  assert.notEqual(await seedForDay(SESSION_SECRET, "2026-10-22"), await seedForDay(SESSION_SECRET, "2026-10-23"), "a new seed every day");
});

test("a finished daily run goes on today's board, and only there", async () => {
  installCache();
  const env = makeEnv();
  const body = await submission(await dailySession());
  const response = await post(env, "/api/leaderboard", body);
  assert.equal(response.status, 201, await response.clone().text());
  assert.equal((await response.json()).daily, dayKey());

  const board = await (await get(env, "/api/leaderboard?period=daily")).json();
  assert.equal(board.day, dayKey());
  assert.equal(board.entries.length, 1);
  assert.equal(board.entries[0].score, body.score);
  const allTime = await (await get(env, "/api/leaderboard")).json();
  assert.equal(allTime.entries.length, 0, "everyone knew the seed, so it stays off the other boards");

  const me = await (await get(env, `/api/leaderboard/me?period=daily&device=${body.deviceId}`)).json();
  assert.equal(me.rank, 1);
  assert.equal(me.total, 1);
});

test("a device's first daily run counts; a second one that day is refused", async () => {
  installCache();
  const env = makeEnv();
  const first = await submission(await dailySession());
  assert.equal((await post(env, "/api/leaderboard", first)).status, 201);
  const second = await submission(await dailySession(), { deviceId: first.deviceId });
  const response = await post(env, "/api/leaderboard", second);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "daily_already_played");
  // Another device can still play.
  assert.equal((await post(env, "/api/leaderboard", await submission(await dailySession()), "other")).status, 201);
});

test("a daily session cannot be moved to another day or reused, and expires after its day", async () => {
  installCache();
  const env = makeEnv();
  const session = await dailySession();
  const moved = await submission({ ...session, daily: nextDay(session.daily) });
  assert.equal((await post(env, "/api/leaderboard", moved)).status, 400, "the signature covers the day");

  const old = await submission(await dailySession("2020-01-01"));
  assert.equal((await post(env, "/api/leaderboard", old)).status, 400, "long past its day");

  const body = await submission(session);
  assert.equal((await post(env, "/api/leaderboard", body)).status, 201);
  assert.equal((await post(env, "/api/leaderboard", { ...body, deviceId: crypto.randomUUID() })).status, 400, "a session is used once");
});

test("a daily run that does not match its seed is refused like any other", async () => {
  installCache();
  const env = makeEnv();
  const body = await submission(await dailySession());
  const response = await post(env, "/api/leaderboard", { ...body, score: body.score + 4 });
  assert.equal(response.status, 400);
});

test("yesterday's garden can still be sent a while after midnight", async () => {
  installCache();
  const env = makeEnv();
  // A run of yesterday's garden finished just now (within the grace period after midnight).
  const yesterday = previousDay(dayKey());
  if (Date.now() - dayEnd(yesterday) < 12 * 60 * 60 * 1000) {
    const response = await post(env, "/api/leaderboard", await submission(await dailySession(yesterday)));
    assert.equal(response.status, 201);
  }
});

test("the board is not offered before its table exists, and old days are trimmed", async () => {
  installCache();
  const env = makeEnv();
  const insert = env.DB.sqlite.prepare("INSERT INTO daily_scores (day, device_id, player_name, score, max_tile, best_combo, reached_stage, created_at) VALUES (?, ?, 'Mira', 10, 8, 0, 1, 'x')");
  insert.run("2020-01-01", crypto.randomUUID());
  insert.run(dayKey(), crypto.randomUUID());
  await worker.scheduled({}, env, { waitUntil: promise => promise });
  await new Promise(resolve => setTimeout(resolve, 10));
  const days = env.DB.sqlite.prepare("SELECT day FROM daily_scores").all().map(row => row.day);
  assert.deepEqual(days, [dayKey()]);

  env.DB.sqlite.exec("DROP TABLE daily_scores");
  installCache();
  assert.equal((await get(env, "/api/leaderboard?period=daily")).status, 503);
});

/* ---------- The store apps ---------- */

const fromApp = (env, path, { method = "GET", body, origin = "https://localhost" } = {}) => worker.fetch(new Request(`${ORIGIN}${path}`, {
  method,
  headers: { origin, "content-type": "application/json", "user-agent": `app-${origin}` },
  body: body === undefined ? undefined : JSON.stringify(body)
}), env, ctx);

test("the Android and iPhone apps may start a game, send a score and read the boards", async () => {
  installCache();
  const env = makeEnv();
  for (const origin of ["https://localhost", "capacitor://localhost"]) {
    const preflight = await fromApp(env, "/api/leaderboard", { method: "OPTIONS", origin });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
    assert.match(preflight.headers.get("access-control-allow-headers"), /content-type/);

    const session = await fromApp(env, "/api/session?mode=daily", { method: "POST", origin });
    assert.equal(session.status, 200);
    assert.equal(session.headers.get("access-control-allow-origin"), origin);

    const sent = await fromApp(env, "/api/leaderboard", { method: "POST", origin, body: await submission(await dailySession()) });
    assert.equal(sent.status, 201, await sent.clone().text());
    assert.equal(sent.headers.get("access-control-allow-origin"), origin);

    // Twice, so the second answer comes from the edge cache and still carries the header.
    for (let i = 0; i < 2; i++) {
      const board = await fromApp(env, "/api/leaderboard?period=daily", { origin });
      assert.equal(board.status, 200);
      assert.equal(board.headers.get("access-control-allow-origin"), origin);
    }
  }
});

test("other sites are still refused, and the website gets no CORS headers", async () => {
  installCache();
  const env = makeEnv();
  const evil = await fromApp(env, "/api/session", { method: "POST", origin: "https://evil.example" });
  assert.equal(evil.status, 403);
  assert.equal(evil.headers.get("access-control-allow-origin"), null);
  const lookalike = await fromApp(env, "/api/session", { method: "POST", origin: "https://localhost.evil.example" });
  assert.equal(lookalike.status, 403);
  const site = await post(env, "/api/session");
  assert.equal(site.status, 200);
  assert.equal(site.headers.get("access-control-allow-origin"), null);
  // The app origins only reach the API, not the pages.
  const page = await fromApp(env, "/", { origin: "https://localhost" });
  assert.equal(page.headers.get("access-control-allow-origin"), null);
});
