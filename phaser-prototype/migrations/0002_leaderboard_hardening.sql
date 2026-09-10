-- Tracks single-use signed play sessions (anti-cheat). A row here means
-- that session id has already been redeemed for a leaderboard submission.
CREATE TABLE IF NOT EXISTS used_sessions (
  sid TEXT PRIMARY KEY,
  used_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS used_sessions_expiry
  ON used_sessions (used_at);

-- SQLite can't ALTER an existing CHECK constraint or add a UNIQUE column
-- in place, so the leaderboard table is recreated with:
--   * a real power-of-two CHECK on max_tile (defense-in-depth, mirrors
--     the check already enforced in worker.js)
--   * a device_id column, so one browser can be limited to a single
--     "best score" row instead of accumulating unlimited rows over time
--
-- NOTE: the SELECT below only copies rows that already satisfy the new
-- power-of-two check. If any pre-existing row somehow has a non-power-of-two
-- max_tile, it will be silently dropped by this migration. Given worker.js
-- has always validated this server-side, that set should be empty — but
-- back up your D1 database before applying this if you want to be sure.
CREATE TABLE leaderboard_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_name TEXT NOT NULL CHECK (length(player_name) BETWEEN 2 AND 16),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100000000),
  max_tile INTEGER NOT NULL CHECK (
    max_tile BETWEEN 2 AND 8192 AND (max_tile & (max_tile - 1)) = 0
  ),
  best_combo INTEGER NOT NULL CHECK (best_combo BETWEEN 0 AND 1000),
  reached_stage INTEGER NOT NULL CHECK (reached_stage BETWEEN 1 AND 5),
  device_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO leaderboard_v2 (id, player_name, score, max_tile, best_combo, reached_stage, created_at)
SELECT id, player_name, score, max_tile, best_combo, reached_stage, created_at
FROM leaderboard
WHERE (max_tile & (max_tile - 1)) = 0;

DROP TABLE leaderboard;
ALTER TABLE leaderboard_v2 RENAME TO leaderboard;

CREATE INDEX IF NOT EXISTS leaderboard_ranking
  ON leaderboard (score DESC, created_at ASC);

-- Partial unique index: legacy rows (device_id IS NULL) never conflict,
-- only new device-tagged submissions dedupe against each other.
CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_device_unique
  ON leaderboard (device_id)
  WHERE device_id IS NOT NULL;
