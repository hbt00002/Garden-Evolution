import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/worker.js";
import { dayKey } from "../src/daily.js";
import { ORIGIN, installCacheStub, makeEnv } from "./helpers/worker-env.js";

// Name moderation: hidden names, reports, bans.

function makeCtx() {
  const pending = [];
  return { waitUntil: promise => pending.push(promise), settled: () => Promise.all(pending) };
}

export function call(env, path, { method = "GET", body, headers = {}, origin = ORIGIN, ctx = makeCtx(), rawBody } = {}) {
  const init = { method, headers: { ...headers } };
  if (origin) init.headers.origin = origin;
  if (method === "POST") {
    init.headers["content-type"] ??= "application/json";
    init.body = rawBody ?? JSON.stringify(body ?? {});
  }
  return worker.fetch(new Request(ORIGIN + path, init), env, ctx);
}

const ago = minutes => new Date(Date.now() - minutes * 60_000).toISOString();

// Three players on every board: Mira (300), Bora (200, written "BORA" on the
// all-time board), Cem (100). Each has a device id.
export function seedBoards(env) {
  const db = env.DB.sqlite;
  const players = [["Mira", 300, "11111111-1111-4111-8111-111111111111"], ["Bora", 200, "22222222-2222-4222-8222-222222222222"], ["Cem", 100, "33333333-3333-4333-8333-333333333333"]];
  for (const [name, score, device] of players) {
    const shown = name === "Bora" ? "BORA" : name;
    db.prepare("INSERT INTO leaderboard (player_name, score, max_tile, best_combo, reached_stage, device_id, created_at) VALUES (?, ?, 16, 1, 1, ?, ?)").run(shown, score, device, ago(5));
    db.prepare("INSERT INTO score_log (device_id, player_name, score, max_tile, best_combo, reached_stage, created_at) VALUES (?, ?, ?, 16, 1, 1, ?)").run(device, name, score, ago(5));
    db.prepare("INSERT INTO daily_scores (day, device_id, player_name, score, max_tile, best_combo, reached_stage, created_at) VALUES (?, ?, ?, ?, 16, 1, 1, ?)").run(dayKey(), device, name, score, ago(5));
  }
  return Object.fromEntries(players.map(([name, , device]) => [name, device]));
}

const hide = (env, key) => env.DB.sqlite.prepare("INSERT INTO hidden_names (name_key, reason, created_at) VALUES (?, 'manual', ?)").run(key, ago(1));
const PERIODS = ["all", "week", "day", "daily"];
const names = async (env, period) => (await (await call(env, `/api/leaderboard?period=${period}`)).json()).entries.map(e => e.player_name.toLowerCase());

test("a hidden name is gone from all four boards", async () => {
  installCacheStub();
  const env = makeEnv();
  seedBoards(env);
  hide(env, "bora");
  for (const period of PERIODS) assert.deepEqual(await names(env, period), ["mira", "cem"], period);
});

test("/me ranks skip hidden names and agree with the rows", async () => {
  installCacheStub();
  const env = makeEnv();
  const devices = seedBoards(env);
  hide(env, "bora");
  for (const period of PERIODS) {
    const me = await (await call(env, `/api/leaderboard/me?period=${period}&device=${devices.Cem}`)).json();
    assert.equal(me.rank, 2, period);
    assert.equal(me.total, 2, period);
    assert.equal(me.hidden, false, period);
  }
});

test("/me says when your own name is hidden", async () => {
  installCacheStub();
  const env = makeEnv();
  const devices = seedBoards(env);
  hide(env, "bora");
  for (const period of PERIODS) {
    const me = await (await call(env, `/api/leaderboard/me?period=${period}&device=${devices.Bora}`)).json();
    assert.equal(me.hidden, true, period);
    assert.equal(me.rank, null, period);
    assert.equal(me.entry.player_name.toLowerCase(), "bora", period);
  }
});

test("boards still load before the moderation migration", async () => {
  installCacheStub();
  const env = makeEnv();
  const devices = seedBoards(env);
  env.DB.sqlite.exec("DROP TABLE hidden_names");
  for (const period of PERIODS) {
    assert.deepEqual(await names(env, period), ["mira", "bora", "cem"], period);
    const me = await (await call(env, `/api/leaderboard/me?period=${period}&device=${devices.Bora}`)).json();
    assert.equal(me.rank, 2, period);
    assert.equal(me.hidden, false, period);
  }
});

/* ---------- Reports ---------- */

const report = (env, name, ip = "1.1.1.1", extra = {}) =>
  call(env, "/api/report", { method: "POST", body: { name }, headers: { "CF-Connecting-IP": ip }, ...extra });
const hiddenRows = env => env.DB.sqlite.prepare("SELECT name_key, reason FROM hidden_names").all().map(r => ({ ...r }));

test("three reports from three IPs hide a name", async () => {
  installCacheStub();
  const env = makeEnv();
  seedBoards(env);
  assert.equal((await report(env, "Bora", "1.1.1.1")).status, 200);
  assert.equal((await report(env, "Bora", "2.2.2.2")).status, 200);
  assert.deepEqual(hiddenRows(env), []);
  const third = await report(env, "Bora", "3.3.3.3");
  assert.deepEqual(await third.json(), { ok: true });
  assert.deepEqual(hiddenRows(env), [{ name_key: "bora", reason: "reports" }]);
  assert.deepEqual(await names(env, "all"), ["mira", "cem"]);
});

test("one IP reporting three times does not hide", async () => {
  installCacheStub();
  const env = makeEnv();
  seedBoards(env);
  for (let i = 0; i < 3; i++) await report(env, "Bora", "1.1.1.1");
  assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) AS n FROM name_reports").get().n, 1);
  assert.deepEqual(hiddenRows(env), []);
});

test("reports are compared by name key", async () => {
  installCacheStub();
  const env = makeEnv();
  seedBoards(env);
  await report(env, "BORA", "1.1.1.1");
  await report(env, "bora", "2.2.2.2");
  await report(env, " Bora ", "3.3.3.3");
  assert.deepEqual(hiddenRows(env), [{ name_key: "bora", reason: "reports" }]);
});

test("a hide clears the cached boards", async () => {
  const cache = installCacheStub();
  const env = makeEnv();
  seedBoards(env);
  const ctx = makeCtx();
  for (const period of PERIODS) await call(env, `/api/leaderboard?period=${period}`, { ctx });
  await ctx.settled();
  assert.ok(cache.size >= 4);
  const reportCtx = makeCtx();
  for (const ip of ["1.1.1.1", "2.2.2.2", "3.3.3.3"]) await report(env, "Bora", ip, { ctx: reportCtx });
  await reportCtx.settled();
  assert.equal(cache.size, 0);
});

test("report refuses other origins and bad bodies", async () => {
  installCacheStub();
  const env = makeEnv();
  assert.equal((await report(env, "Bora", "1.1.1.1", { origin: null })).status, 403);
  assert.equal((await report(env, "Bora", "1.1.1.1", { origin: "https://evil.test" })).status, 403);
  assert.equal((await report(env, "Bora", "1.1.1.1", { rawBody: "x" })).status, 400);
  assert.equal((await report(env, "a")).status, 400);
  assert.equal((await report(env, 42)).status, 400);
  assert.equal((await call(env, "/api/report")).status, 405);
});

test("report before the migration answers ok and writes nothing", async () => {
  installCacheStub();
  const env = makeEnv();
  env.DB.sqlite.exec("DROP TABLE name_reports; DROP TABLE hidden_names;");
  const response = await report(env, "Bora");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("reporting is rate limited", async () => {
  installCacheStub();
  const env = makeEnv();
  for (let i = 0; i < 20; i++) assert.equal((await report(env, `Name ${i}`)).status, 200, `report ${i + 1}`);
  assert.equal((await report(env, "Name 21")).status, 429);
});
