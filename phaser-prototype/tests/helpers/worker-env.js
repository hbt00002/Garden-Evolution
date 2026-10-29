// What the Worker tests share: a D1 database over node:sqlite with the real
// migrations, an edge cache, the Worker's environment, and a seeded player.
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { applyMove, createGame, createRng, nextRandom } from "../../src/game-core.js";

export const ORIGIN = "https://play.test";
export const SESSION_SECRET = "s".repeat(32);
export const RATE_LIMIT_SALT = "r".repeat(32);

// Minimal D1 adapter over node:sqlite so the real migrations and the real SQL
// in worker.js (ON CONFLICT ... WHERE, RETURNING, batch) are exercised.
export function createD1() {
  const sqlite = new DatabaseSync(":memory:");
  const migrationsDir = fileURLToPath(new URL("../../migrations/", import.meta.url));
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

// The Workers edge cache (caches.default), kept in a Map; returns the Map.
export function installCacheStub() {
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

export function makeEnv(overrides = {}) {
  return {
    DB: createD1(),
    SESSION_SECRET,
    RATE_LIMIT_SALT,
    ASSETS: { fetch: async () => new Response("asset", { status: 200 }) },
    ...overrides
  };
}

export async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Plays a whole run with a seeded "player" so the tests submit records the
// Worker can really replay.
export function playRun(seed, strategy = 1) {
  const game = createGame(seed);
  const choice = createRng((seed ^ 0x9e3779b9) + strategy);
  const dirs = ["left", "right", "up", "down"];
  let guard = 0;
  while (!game.over && guard++ < 20000) {
    const first = Math.floor(nextRandom(choice) * 4);
    for (let i = 0; i < 4; i++) if (applyMove(game, dirs[(first + i) % 4])) break;
  }
  return game;
}
