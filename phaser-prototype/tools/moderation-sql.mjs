// The SQL behind `npm run mod`. Every function takes a name *key* (nameKey()
// in src/player-name.js: the cleaned name with ASCII letters lowered, which is
// what SQLite's lower() gives) and returns SQL text for wrangler d1 execute.
// Names only ever appear inside one quoted literal made by sqlString().

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

// A SQL string literal: quoted, inner single quotes doubled.
export function sqlString(value) {
  const text = String(value);
  if (text.includes("\u0000")) throw new Error("A name cannot contain a NUL character.");
  return `'${text.replaceAll("'", "''")}'`;
}

const SCORE_TABLES = ["leaderboard", "score_log", "daily_scores"];

// Every device id that ever sent a score under the name, on any board.
const devicesUsing = key => SCORE_TABLES
  .map(table => `SELECT device_id FROM ${table} WHERE lower(player_name) = ${sqlString(key)} AND device_id IS NOT NULL`)
  .join(" UNION ");

export const reportsSql = () => `
SELECT r.name_key, COUNT(*) AS reports, MAX(r.created_at) AS last_report,
       CASE WHEN h.name_key IS NULL THEN 0 ELSE 1 END AS hidden
FROM name_reports r LEFT JOIN hidden_names h ON h.name_key = r.name_key
GROUP BY r.name_key ORDER BY last_report DESC LIMIT 50;`;

// Runs the Worker flagged (8192 reached, or played faster than a person plays).
export const flaggedSql = () => `
SELECT player_name, score, max_tile, reason, board, created_at
FROM flagged_scores ORDER BY created_at DESC LIMIT 50;`;

export const hiddenSql = () => "SELECT name_key, reason, created_at FROM hidden_names ORDER BY created_at DESC;";

export const hideSql = key => `
INSERT INTO hidden_names (name_key, reason, created_at) VALUES (${sqlString(key)}, 'manual', ${NOW})
ON CONFLICT (name_key) DO UPDATE SET reason = 'manual';`;

// Unhiding also forgets the reports, so it takes three new ones to hide again.
export const unhideSql = key => `
DELETE FROM hidden_names WHERE name_key = ${sqlString(key)};
DELETE FROM name_reports WHERE name_key = ${sqlString(key)};`;

export const banSql = key => `
INSERT OR IGNORE INTO banned_devices (device_id, created_at) SELECT device_id, ${NOW} FROM (${devicesUsing(key)});
${hideSql(key)}`;

export const deviceCountSql = key => `SELECT COUNT(*) AS devices FROM (${devicesUsing(key)});`;

export const unbanSql = key => `DELETE FROM banned_devices WHERE device_id IN (${devicesUsing(key)});`;

export const countSql = key => SCORE_TABLES
  .map(table => `SELECT '${table}' AS place, COUNT(*) AS rows FROM ${table} WHERE lower(player_name) = ${sqlString(key)}`)
  .join(" UNION ALL ") + ";";

// Everything about the name: its scores on every board, its reports, its hide.
export const purgeSql = key => [
  ...SCORE_TABLES.map(table => `DELETE FROM ${table} WHERE lower(player_name) = ${sqlString(key)};`),
  `DELETE FROM name_reports WHERE name_key = ${sqlString(key)};`,
  `DELETE FROM hidden_names WHERE name_key = ${sqlString(key)};`
].join("\n");
