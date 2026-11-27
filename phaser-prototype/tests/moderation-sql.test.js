import test from "node:test";
import assert from "node:assert/strict";
import { createD1 } from "./helpers/worker-env.js";
import { nameKey } from "../src/player-name.js";
import { banSql, countSql, deviceCountSql, flaggedSql, hiddenSql, hideSql, purgeSql, reportsSql, sqlString, unbanSql, unhideSql } from "../tools/moderation-sql.mjs";

// The SQL `npm run mod` sends, run against the real migrations.

const NOW = "2026-11-27T10:00:00.000Z";
const DEVICES = { a: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", b: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", c: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" };

function seeded(names) {
  const { sqlite } = createD1();
  for (const [name, device] of names) {
    sqlite.prepare("INSERT INTO leaderboard (player_name, score, max_tile, best_combo, reached_stage, device_id, created_at) VALUES (?, 10, 16, 1, 1, ?, ?)").run(name, device, NOW);
    sqlite.prepare("INSERT INTO score_log (device_id, player_name, score, max_tile, best_combo, reached_stage, created_at) VALUES (?, ?, 10, 16, 1, 1, ?)").run(device, name, NOW);
    sqlite.prepare("INSERT INTO daily_scores (day, device_id, player_name, score, max_tile, best_combo, reached_stage, created_at) VALUES ('2026-11-27', ?, ?, 10, 16, 1, 1, ?)").run(device, name, NOW);
  }
  return sqlite;
}
const count = (sqlite, table) => sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
const tables = sqlite => sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name).sort();

test("sqlString quotes, doubles single quotes and refuses NUL", () => {
  assert.equal(sqlString("O'Neil"), "'O''Neil'");
  assert.equal(sqlString("şey 🌸"), "'şey 🌸'");
  assert.throws(() => sqlString("a\u0000b"));
});

test("purge removes exactly that name, even one built to break the SQL", () => {
  const evil = "'OR 1=1--"; // unquoted, this would delete every row
  const sqlite = seeded([[evil, DEVICES.a], ["Mira", DEVICES.b]]);
  const before = tables(sqlite);
  sqlite.exec(purgeSql(nameKey(evil)));
  assert.deepEqual(tables(sqlite), before);
  for (const table of ["leaderboard", "score_log", "daily_scores"]) assert.equal(count(sqlite, table), 1, table);
  assert.equal(sqlite.prepare("SELECT player_name FROM leaderboard").get().player_name, "Mira");
});

test("purge also clears the name's reports and its hide", () => {
  const sqlite = seeded([["Bora", DEVICES.a]]);
  sqlite.prepare("INSERT INTO name_reports VALUES ('bora', 'r1', ?)").run(NOW);
  sqlite.exec(hideSql("bora"));
  sqlite.exec(purgeSql("bora"));
  assert.equal(count(sqlite, "name_reports"), 0);
  assert.equal(count(sqlite, "hidden_names"), 0);
});

test("ban bans every device that used the name, in any case, and hides it", () => {
  const sqlite = seeded([["Bora", DEVICES.a], ["BORA", DEVICES.b], ["Mira", DEVICES.c]]);
  assert.equal(sqlite.prepare(deviceCountSql("bora")).get().devices, 2);
  sqlite.exec(banSql("bora"));
  assert.deepEqual(sqlite.prepare("SELECT device_id FROM banned_devices ORDER BY device_id").all().map(r => r.device_id), [DEVICES.a, DEVICES.b]);
  assert.deepEqual({ ...sqlite.prepare("SELECT name_key, reason FROM hidden_names").get() }, { name_key: "bora", reason: "manual" });
  sqlite.exec(banSql("bora"));
  assert.equal(count(sqlite, "banned_devices"), 2, "banning twice is harmless");
  sqlite.exec(unbanSql("bora"));
  assert.equal(count(sqlite, "banned_devices"), 0);
});

test("hide, unhide and the listings", () => {
  const sqlite = seeded([["Şey", DEVICES.a]]);
  const key = nameKey("Şey");
  sqlite.prepare("INSERT INTO name_reports VALUES (?, 'r1', ?), (?, 'r2', ?)").run(key, NOW, key, NOW);
  assert.deepEqual(sqlite.prepare(reportsSql()).all().map(r => [r.name_key, r.reports, r.hidden]), [[key, 2, 0]]);
  sqlite.exec(hideSql(key));
  sqlite.exec(hideSql(key));
  assert.deepEqual(sqlite.prepare(hiddenSql()).all().map(r => [r.name_key, r.reason]), [[key, "manual"]]);
  assert.equal(sqlite.prepare(reportsSql()).all()[0].hidden, 1);
  sqlite.exec(unhideSql(key));
  assert.equal(count(sqlite, "hidden_names"), 0);
  assert.equal(count(sqlite, "name_reports"), 0, "unhide clears the reports, so it takes 3 new ones");
});

test("count says how many rows each table has for the name", () => {
  const sqlite = seeded([["Bora", DEVICES.a], ["bora", DEVICES.b], ["Mira", DEVICES.c]]);
  assert.deepEqual(sqlite.prepare(countSql("bora")).all().map(r => [r.place, r.rows]), [["leaderboard", 2], ["score_log", 2], ["daily_scores", 2]]);
});

test("flagged lists the runs worth a look, newest first", () => {
  const { sqlite } = createD1();
  const insert = sqlite.prepare("INSERT INTO flagged_scores (board, player_name, score, max_tile, moves, seconds, reason, created_at) VALUES (?, ?, ?, ?, 300, 50, ?, ?)");
  insert.run("all", "Older", 90000, 8192, "8192", "2026-11-26T10:00:00.000Z");
  insert.run("daily", "Newer", 5000, 512, "fast", "2026-11-27T10:00:00.000Z");
  assert.deepEqual(sqlite.prepare(flaggedSql()).all().map(r => [r.player_name, r.reason, r.board]), [["Newer", "fast", "daily"], ["Older", "8192", "all"]]);
});
