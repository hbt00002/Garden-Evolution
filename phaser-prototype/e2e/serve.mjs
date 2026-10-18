// Starts the real thing for the browser tests: a fresh production build served
// by the actual Worker (wrangler dev) on top of a throwaway local D1 database
// that has the schema and the test data from seed.sql.
//
// It never touches your .dev.vars or your normal local database: the secrets
// are passed on the command line and the state lives in .wrangler/e2e-state.
import { execFileSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const state = ".wrangler/e2e-state";
const port = process.env.E2E_PORT || "8787";
const env = { ...process.env, WRANGLER_SEND_METRICS: "false", CI: process.env.CI || "1" };

// The tools are run from their own files rather than through npx, so this
// works the same on every platform and without a network.
const vite = join(root, "node_modules", "vite", "bin", "vite.js");
const wrangler = join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const node = (script, args) => execFileSync(process.execPath, [script, ...args], { cwd: root, stdio: "inherit", env });

node(vite, ["build"]);
rmSync(fileURLToPath(new URL(`../${state}`, import.meta.url)), { recursive: true, force: true });
node(wrangler, ["d1", "migrations", "apply", "garden-evolution-leaderboard", "--local", "--persist-to", state]);
node(wrangler, ["d1", "execute", "garden-evolution-leaderboard", "--local", "--persist-to", state, "--file", "e2e/seed.sql"]);

const server = spawn(process.execPath, [
  wrangler, "dev", "--local", "--ip", "127.0.0.1", "--port", port, "--persist-to", state,
  "--var", "SESSION_SECRET:e2e-session-secret-0123456789abcdef",
  "--var", "RATE_LIMIT_SALT:e2e-rate-limit-salt-0123456789abcd"
], { cwd: root, stdio: "inherit", env });

const stop = () => { server.kill(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", () => server.kill());
server.on("exit", code => process.exit(code ?? 0));
