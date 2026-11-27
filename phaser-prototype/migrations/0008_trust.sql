-- Leaderboard trust (see docs: leaderboard trust design).

-- Accepted submissions per address and day (Turkey time, like today's
-- garden). The address is a salted hash, never the IP itself.
CREATE TABLE IF NOT EXISTS ip_daily (
  ip TEXT NOT NULL,
  day TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('score', 'daily')),
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip, day, kind)
);

-- Runs worth a look (8192 reached, or played faster than a person plays).
-- They are on the boards like any other; this is the developer's list
-- (npm run mod -- flagged).
CREATE TABLE IF NOT EXISTS flagged_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board TEXT NOT NULL CHECK (board IN ('all', 'daily')),
  device_id TEXT,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  max_tile INTEGER NOT NULL,
  moves INTEGER NOT NULL,
  seconds INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS flagged_scores_recent ON flagged_scores (created_at);
