import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import worker, { coarseClient } from "../cloudflare/worker.js";
import { describe, installErrorReporting } from "../src/error-report.js";

const ORIGIN = "https://play.test";

function createD1() {
  const sqlite = new DatabaseSync(":memory:");
  const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
  for (const file of readdirSync(dir).sort()) sqlite.exec(readFileSync(dir + file, "utf8"));
  const statement = (sql, params = []) => ({
    sql, params,
    bind: (...values) => statement(sql, values),
    first: async () => sqlite.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
    run: async () => sqlite.prepare(sql).run(...params)
  });
  return { sqlite, prepare: sql => statement(sql), batch: async () => {} };
}

const makeEnv = () => ({ DB: createD1(), SESSION_SECRET: "s".repeat(32), RATE_LIMIT_SALT: "r".repeat(32), ASSETS: { fetch: async () => new Response("asset") } });

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

const report = (env, body, { origin = ORIGIN, agent = IPHONE, method = "POST" } = {}) =>
  worker.fetch(new Request(`${ORIGIN}/api/client-error`, {
    method,
    headers: { "content-type": "application/json", ...(origin ? { origin } : {}), "user-agent": agent },
    body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined
  }), env, { waitUntil() {} });

const rows = env => env.DB.sqlite.prepare("SELECT * FROM client_errors ORDER BY id").all();

test("an error report is stored with a coarse browser and device and nothing that identifies the player", async () => {
  const env = makeEnv();
  const response = await report(env, { kind: "error", message: "x is not a function", source: "/assets/app-abc.js", line: 10, column: 4, stack: "TypeError...", page: "/", build: "app-abc", screen: "390x844@3" });
  assert.equal(response.status, 204);
  const [row] = rows(env);
  assert.equal(row.message, "x is not a function");
  assert.equal(row.browser, "Safari 17");
  assert.equal(row.device, "iOS phone");
  assert.equal(row.count, 1);
  // Neither the raw user agent nor an address is kept.
  assert.ok(!JSON.stringify(row).includes("Mozilla"));
  assert.deepEqual(Object.keys(row).sort(), ["browser", "build", "column", "count", "device", "first_seen", "id", "kind", "last_seen", "line", "message", "page", "screen", "signature", "source", "stack"]);
});

test("the same error is one row with a count, a different one is another row", async () => {
  const env = makeEnv();
  const body = { kind: "resource", message: "Failed to load script", source: "/assets/game-1.js" };
  for (let i = 0; i < 3; i++) await report(env, body);
  await report(env, { ...body, source: "/assets/other.js" });
  const all = rows(env);
  assert.equal(all.length, 2);
  assert.equal(all[0].count, 3);
});

test("reports from another site, with a bad shape, or too large are refused", async () => {
  const env = makeEnv();
  assert.equal((await report(env, { kind: "error", message: "boom" }, { origin: "https://evil.example" })).status, 403);
  assert.equal((await report(env, { kind: "error", message: "boom" }, { origin: null })).status, 403);
  assert.equal((await report(env, { kind: "nonsense", message: "boom" })).status, 400);
  assert.equal((await report(env, { kind: "error" })).status, 400);
  assert.equal((await report(env, "not json")).status, 400);
  assert.equal((await report(env, { kind: "error", message: "a".repeat(20_000) })).status, 413);
  assert.equal((await report(env, null, { method: "GET" })).status, 405);
  assert.equal(rows(env).length, 0);
});

test("long fields are clipped before they are stored", async () => {
  const env = makeEnv();
  await report(env, { kind: "error", message: "m".repeat(400), source: "s".repeat(300), stack: "t".repeat(2000) });
  const [row] = rows(env);
  assert.equal(row.message.length, 300);
  assert.equal(row.source.length, 200);
  assert.equal(row.stack.length, 1500);
});

test("one browser is rate limited, and a flood of different errors stops at the row cap", async () => {
  const env = makeEnv();
  let refused = 0;
  for (let i = 0; i < 25; i++) if ((await report(env, { kind: "error", message: `err ${i}` })).status === 429) refused++;
  assert.equal(refused, 5);
  assert.equal(rows(env).length, 20);

  // The cap on distinct rows: fill the table, then a new error is dropped but a known one still counts.
  const full = makeEnv();
  const insert = full.DB.sqlite.prepare("INSERT INTO client_errors (signature, kind, message, count, first_seen, last_seen) VALUES (?, 'error', ?, 1, 'x', 'x')");
  for (let i = 0; i < 500; i++) insert.run(`sig${i}`, `filler ${i}`);
  assert.equal((await report(full, { kind: "error", message: "brand new" })).status, 204);
  assert.equal(rows(full).length, 500);
});

test("a report is quietly dropped when the table does not exist yet", async () => {
  const env = makeEnv();
  env.DB.sqlite.exec("DROP TABLE client_errors");
  assert.equal((await report(env, { kind: "error", message: "boom" })).status, 204);
});

test("coarseClient keeps only the browser family, its major version and the kind of device", () => {
  assert.deepEqual(coarseClient("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"), { browser: "Chrome 126", device: "Android phone" });
  assert.deepEqual(coarseClient("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0"), { browser: "Edge 126", device: "Windows desktop" });
  assert.deepEqual(coarseClient("Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0"), { browser: "Firefox 127", device: "Linux desktop" });
  assert.deepEqual(coarseClient(""), { browser: "Other", device: "Other desktop" });
});

/* ---------- In the browser ---------- */

const origin = "https://play.test";
const scriptElement = (tagName, src) => ({ nodeType: 1, tagName, src });

test("describe: our own errors are reported, noise and other sites' scripts are not", () => {
  const own = describe({ type: "error", message: "Cannot read x", filename: `${origin}/assets/app-1.js?v=2`, lineno: 3, colno: 9, error: { stack: "at f" } }, { origin });
  assert.deepEqual(own, { kind: "error", message: "Cannot read x", source: "/assets/app-1.js", line: 3, column: 9, stack: "at f" });
  assert.equal(describe({ type: "error", message: "Uncaught TypeError: x is not a function", filename: `${origin}/a.js` }, { origin }).message, "TypeError: x is not a function");
  assert.equal(describe({ type: "error", message: "Script error.", filename: "" }, { origin }), null);
  assert.equal(describe({ type: "error", message: "boom", filename: "chrome-extension://abc/content.js" }, { origin }), null);
  assert.equal(describe({ type: "error", message: "boom", filename: "https://ads.example/x.js" }, { origin }), null);
  assert.equal(describe({ type: "error", message: "ResizeObserver loop completed with undelivered notifications.", filename: "" }, { origin }), null);
  assert.equal(describe({ type: "unhandledrejection", reason: new Error("nope") }, { origin }).kind, "rejection");
});

test("describe: a file that failed to load is reported by path only", () => {
  const event = { type: "error", target: scriptElement("SCRIPT", `${origin}/assets/game-9.js?x=1`), currentTarget: {} };
  assert.deepEqual(describe(event, { origin }), { kind: "resource", message: "Failed to load script", source: "/assets/game-9.js" });
  const foreign = { type: "error", target: scriptElement("SCRIPT", "https://cdn.example/lib.js"), currentTarget: {} };
  assert.equal(describe(foreign, { origin }), null);
});

function fakeWindow() {
  const handlers = {};
  return {
    location: { origin, pathname: "/" },
    innerWidth: 390, innerHeight: 844, devicePixelRatio: 3,
    addEventListener: (type, fn) => { (handlers[type] ||= []).push(fn); },
    fire: (type, event) => (handlers[type] || []).forEach(fn => fn({ type, currentTarget: {}, ...event }))
  };
}
const fakeDoc = { querySelector: () => ({ getAttribute: () => "/assets/app-Ab12Cd.js" }) };

test("the reporter sends each distinct error once, at most five per page, and never throws", () => {
  const win = fakeWindow();
  const sent = [];
  installErrorReporting({ win, doc: fakeDoc, send: body => { sent.push(JSON.parse(body)); } });
  for (let i = 0; i < 3; i++) win.fire("error", { message: "same", filename: `${origin}/assets/app.js`, lineno: 1 });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].build, "app-Ab12Cd");
  assert.equal(sent[0].screen, "390x844@3");
  for (let i = 0; i < 10; i++) win.fire("error", { message: `different ${i}`, filename: `${origin}/assets/app.js`, lineno: 1 });
  assert.equal(sent.length, 5);

  const throwing = fakeWindow();
  installErrorReporting({ win: throwing, doc: fakeDoc, send: () => { throw new Error("offline"); } });
  assert.doesNotThrow(() => throwing.fire("error", { message: "boom", filename: `${origin}/a.js` }));
});
