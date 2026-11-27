-- Name moderation. A name is compared by its key: the cleaned name with ASCII
-- letters lowered, which is what SQLite's lower() gives, so the boards can
-- filter with lower(player_name).

-- One row per reporter and name. The reporter is a salted hash of the IP
-- address, not the device id the game makes up itself.
CREATE TABLE IF NOT EXISTS name_reports (
  name_key TEXT NOT NULL,
  reporter TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (name_key, reporter)
);

CREATE INDEX IF NOT EXISTS name_reports_recent ON name_reports (created_at);

-- Names no board shows: hidden by 3 reports or by hand (npm run mod).
CREATE TABLE IF NOT EXISTS hidden_names (
  name_key TEXT PRIMARY KEY,
  reason TEXT NOT NULL CHECK (reason IN ('reports', 'manual')),
  created_at TEXT NOT NULL
);

-- Devices whose scores are no longer accepted (npm run mod -- ban).
CREATE TABLE IF NOT EXISTS banned_devices (
  device_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
