// Leaderboard moderation, run on your own computer:
//
//   npm run mod -- reports              names people reported, newest first
//   npm run mod -- hidden               names no board shows, and why
//   npm run mod -- flagged              runs worth a look: 8192 reached, or played too fast
//   npm run mod -- hide "name"          hide a name on every board
//   npm run mod -- unhide "name"        show it again (its reports are forgotten)
//   npm run mod -- ban "name"           refuse scores from every device that used it, and hide it
//   npm run mod -- unban "name"         accept those devices again
//   npm run mod -- purge "name"         delete every score under the name (asks first)
//
// Add --local to work on the local database instead of the live one.
// It runs wrangler with your own Cloudflare login; nothing here holds a secret.
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { nameKey } from "../src/player-name.js";
import { banSql, countSql, deviceCountSql, flaggedSql, hiddenSql, hideSql, purgeSql, reportsSql, unbanSql, unhideSql } from "./moderation-sql.mjs";

const DATABASE = "garden-evolution-leaderboard";
const WRANGLER = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const ROOT = fileURLToPath(new URL("..", import.meta.url));

const args = process.argv.slice(2);
const local = args.includes("--local");
const [command, name] = args.filter(arg => arg !== "--local");
const where = local ? "--local" : "--remote";

// Runs SQL through wrangler (no shell: the SQL is one argument) and returns
// the rows of every statement.
function run(sql) {
  const output = execFileSync(process.execPath, [WRANGLER, "d1", "execute", DATABASE, where, "--json", "--command", sql], {
    cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"]
  });
  return JSON.parse(output).flatMap(result => result.results || []);
}

function needName() {
  const key = nameKey(name || "");
  if (key.length < 2) {
    console.error(`Which name? For example: npm run mod -- ${command} "Some Name"`);
    process.exit(1);
  }
  return key;
}

const show = rows => (rows.length ? console.table(rows) : console.log("(nothing)"));

async function main() {
  console.log(local ? "Local database" : "LIVE database");
  switch (command) {
    case "reports": return show(run(reportsSql()));
    case "hidden": return show(run(hiddenSql()));
    case "flagged": return show(run(flaggedSql()));
    case "hide": run(hideSql(needName())); return console.log(`Hidden: ${needName()}`);
    case "unhide": run(unhideSql(needName())); return console.log(`Shown again: ${needName()}`);
    case "ban": {
      const key = needName();
      const devices = run(deviceCountSql(key))[0]?.devices ?? 0;
      run(banSql(key));
      return console.log(`Banned ${devices} device(s) that used "${key}", and hid the name.`);
    }
    case "unban": run(unbanSql(needName())); return console.log(`Devices that used "${needName()}" may send scores again.`);
    case "purge": {
      const key = needName();
      const counts = run(countSql(key));
      show(counts);
      if (!counts.some(row => row.rows > 0)) console.log("No scores under that name; its reports and hide are still cleared.");
      const prompt = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await prompt.question(`This cannot be undone. Type the name again to delete everything under "${key}": `);
      prompt.close();
      if (nameKey(answer) !== key) return console.log("Not the same name. Nothing was deleted.");
      run(purgeSql(key));
      return console.log("Deleted.");
    }
    default:
      console.log("Commands: reports, hidden, flagged, hide, unhide, ban, unban, purge. Names in quotes; add --local for the local database.");
      process.exitCode = command ? 1 : 0;
  }
}

await main();
