-- Today's garden: everyone plays the same seed on a day (midnight Turkey time).
-- One row per device and day: the first run a device sends for that day.
CREATE TABLE IF NOT EXISTS daily_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL CHECK (length(day) = 10),
  device_id TEXT,
  player_name TEXT NOT NULL CHECK (length(player_name) BETWEEN 2 AND 16),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100000000),
  max_tile INTEGER NOT NULL CHECK (max_tile BETWEEN 2 AND 8192 AND (max_tile & (max_tile - 1)) = 0),
  best_combo INTEGER NOT NULL CHECK (best_combo BETWEEN 0 AND 1000),
  reached_stage INTEGER NOT NULL CHECK (reached_stage BETWEEN 1 AND 5),
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_scores_one_per_device ON daily_scores (day, device_id) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS daily_scores_board ON daily_scores (day, score DESC, created_at);
