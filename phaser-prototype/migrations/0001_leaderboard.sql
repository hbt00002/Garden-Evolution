CREATE TABLE IF NOT EXISTS leaderboard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_name TEXT NOT NULL CHECK (length(player_name) BETWEEN 2 AND 16),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100000000),
  max_tile INTEGER NOT NULL CHECK (max_tile BETWEEN 2 AND 8192),
  best_combo INTEGER NOT NULL CHECK (best_combo BETWEEN 0 AND 1000),
  reached_stage INTEGER NOT NULL CHECK (reached_stage BETWEEN 1 AND 5),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS leaderboard_ranking
  ON leaderboard (score DESC, created_at ASC);

CREATE TABLE IF NOT EXISTS submission_limits (
  fingerprint TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1 CHECK (count > 0),
  PRIMARY KEY (fingerprint, bucket)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS submission_limits_expiry
  ON submission_limits (bucket);
