-- Test data for the browser tests: a leaderboard with enough players that the
-- one under test ("E2E Me", device 11111111-...) falls outside the top 20 on
-- the all-time and 7-day boards but inside the list on the 24-hour board.
--
-- Everything is relative to "now", so the data is always fresh. Scores are
-- chosen so no game the tests play (a few thousand points at most) can change
-- any rank that is asserted.

-- 25 players, best first: 20000, 19500 ... 8000. Plant and world follow the score.
WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < 24)
INSERT INTO leaderboard (device_id, player_name, score, max_tile, best_combo, reached_stage, created_at, combo_rules)
SELECT
  '00000000-0000-4000-8000-' || printf('%012d', i),
  'Player ' || printf('%02d', i + 1),
  20000 - i * 500,
  CASE WHEN i < 2 THEN 2048 WHEN i < 6 THEN 1024 WHEN i < 12 THEN 512 WHEN i < 18 THEN 256 ELSE 128 END,
  3 + (i % 9),
  CASE WHEN i < 2 THEN 5 WHEN i < 6 THEN 4 WHEN i < 12 THEN 3 ELSE 2 END,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-' || (i * 7 + 1) || ' hours'),
  2
FROM n;

-- The player under test: rank 26 of 26 all-time.
INSERT INTO leaderboard (device_id, player_name, score, max_tile, best_combo, reached_stage, created_at, combo_rules)
VALUES ('11111111-1111-4111-8111-111111111111', 'E2E Me', 7000, 128, 5, 2,
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 hours'), 2);

-- The period boards are ranked from the log: players 1-24 played within the
-- last 7 days (a player's row is i * 7 + 1 hours old), players 1-4 within the
-- last 24 hours, and "E2E Me" 5 hours ago.
INSERT INTO score_log (device_id, player_name, score, max_tile, best_combo, reached_stage, created_at)
SELECT device_id, player_name, score, max_tile, best_combo, reached_stage, created_at
FROM leaderboard
WHERE device_id LIKE '00000000-0000-4000-8000-%'
  AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days');

INSERT INTO score_log (device_id, player_name, score, max_tile, best_combo, reached_stage, created_at)
VALUES ('11111111-1111-4111-8111-111111111111', 'E2E Me', 7000, 128, 5, 2,
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-5 hours'));
