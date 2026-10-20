-- Errors the game reports from players' browsers, so a break on one phone is
-- noticed without anyone having to complain. Only technical facts are kept
-- (what failed, where, which build, a coarse browser and device); no name,
-- score, address or anything that identifies a person. The same error is one
-- row with a running count.
CREATE TABLE IF NOT EXISTS client_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signature TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('error', 'rejection', 'resource', 'load')),
  message TEXT NOT NULL,
  source TEXT,
  line INTEGER,
  column INTEGER,
  stack TEXT,
  page TEXT,
  build TEXT,
  browser TEXT,
  device TEXT,
  screen TEXT,
  count INTEGER NOT NULL DEFAULT 1,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS client_errors_recent ON client_errors (last_seen);
