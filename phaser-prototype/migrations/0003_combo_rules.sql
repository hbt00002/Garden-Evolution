-- Existing records retain their timed-combo definition (v1).
ALTER TABLE leaderboard ADD COLUMN combo_rules INTEGER NOT NULL DEFAULT 1 CHECK (combo_rules IN (1, 2));
