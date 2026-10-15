-- One row per accepted submission, so the 24-hour and 7-day boards can rank a
-- player's best score *within* the period. The all-time board keeps its single
-- best row per device in `leaderboard`.
CREATE TABLE IF NOT EXISTS score_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT,
  player_name TEXT NOT NULL CHECK (length(player_name) BETWEEN 2 AND 16),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100000000),
  max_tile INTEGER NOT NULL CHECK (max_tile BETWEEN 2 AND 8192),
  best_combo INTEGER NOT NULL CHECK (best_combo BETWEEN 0 AND 1000),
  reached_stage INTEGER NOT NULL CHECK (reached_stage BETWEEN 1 AND 5),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS score_log_recent ON score_log (created_at);
CREATE INDEX IF NOT EXISTS score_log_device ON score_log (device_id, created_at);

-- Seed the period boards with what the all-time table already knows, so they
-- are not empty on the first day.
INSERT INTO score_log (device_id, player_name, score, max_tile, best_combo, reached_stage, created_at)
SELECT device_id, player_name, score, max_tile, best_combo, reached_stage, created_at
FROM leaderboard
WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-8 days');
