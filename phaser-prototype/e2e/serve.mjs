// Starts the real thing for the browser tests: a fresh production build served
// by the actual Worker (wrangler dev) on top of a throwaway local D1 database
// that has the schema and the test data from seed.sql.
//
// It never touches your .dev.vars or your normal local database: the secrets
// are passed on the command line and the state lives in .wrangler/e2e-state.
import { execFileSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { freemem, totalmem } from "node:os";
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

// The Worker is run by a small supervisor. On GitHub's runners the server once
// disappeared in the middle of a run (no message, no exit code a test could
// see), and every test after it failed with "connection refused". Now, if it
// stops without being asked to, the reason is printed (so the cause can be read
// in the log next time), the memory left on the machine is shown, and it is
// started again on the same database; the tests wait for it (see fixtures.js).
const startServer = () => spawn(process.execPath, [
  wrangler, "dev", "--local", "--ip", "127.0.0.1", "--port", port, "--persist-to", state,
  "--var", "SESSION_SECRET:e2e-session-secret-0123456789abcdef",
  "--var", "RATE_LIMIT_SALT:e2e-rate-limit-salt-0123456789abcd"
], { cwd: root, stdio: "inherit", env });

const MAX_RESTARTS = 5;
let restarts = 0;
let stopping = false;
let server = startServer();

const mb = bytes => `${Math.round(bytes / 1048576)} MB`;
const memory = () => `free ${mb(freemem())} of ${mb(totalmem())}`;

function watch(child) {
  child.on("exit", (code, signal) => {
    if (stopping) { process.exit(code ?? 0); return; }
    console.error(`[e2e server] the Worker stopped by itself (exit code ${code}, signal ${signal}); ${memory()}`);
    if (restarts >= MAX_RESTARTS) {
      console.error(`[e2e server] giving up after ${MAX_RESTARTS} restarts`);
      process.exit(code || 1);
      return;
    }
    restarts++;
    console.error(`[e2e server] starting it again (${restarts} of ${MAX_RESTARTS})`);
    server = startServer();
    watch(server);
  });
}
watch(server);

// A line every half minute: if the machine runs out of memory, it shows.
const heartbeat = setInterval(() => console.error(`[e2e server] still running; ${memory()}`), 30_000);
heartbeat.unref();

const stop = () => { stopping = true; server.kill(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", () => { stopping = true; server.kill(); });
