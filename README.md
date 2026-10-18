# Garden Evolution

A relaxing 2048-style garden game. Merge plants through thirteen stages and
watch the world around the board evolve through five worlds, from a winter
mountain to a moonlit garden. Scores are verified on the server and ranked on
a public leaderboard.

**Play:** https://play.gardenevolution.workers.dev

## Which folder is the game?

| Folder | What it is |
| --- | --- |
| [`phaser-prototype/`](phaser-prototype) | **The live game.** The name is historical; this is the production code and the Cloudflare Worker. Everything below is about this folder. |
| [`legacy/original-dom-version/`](legacy/original-dom-version) | The first, plain-DOM version of the game. Superseded and **not deployed**; kept for reference. |
| `archive/`, `pixi-prototype/`, `three-prototype/`, `supabase-netlify version/`, `tools/` | Old experiments. Git-ignored and only present on the author's machine. |

Visual assets are CC0, the menu music is credited in [CREDITS.md](CREDITS.md).

## How it fits together

- **Game** (`script.js`, `src/`): plain DOM and CSS for the board, with
  [Phaser](https://phaser.io) drawing the animated world and the board frame
  behind it (`src/engine.js`). The Phaser part is an enhancement: without WebGL
  the game falls back to a built-in SVG backdrop and still plays.
- **Rules** (`src/game-core.js`, `src/board.js`): one deterministic, seeded
  implementation of the game, used by both the browser and the Worker.
- **Worker** (`cloudflare/worker.js`): the API and the static assets, on
  Cloudflare Workers with a D1 database.
- **Leaderboard**: a run is its seed plus the moves played. The Worker hands out
  a signed session (and the seed) when a game starts, and when a score arrives
  it **replays the recorded moves** and accepts it only if the finished game
  matches the claimed score, top plant and combo.

### API

| Route | Purpose |
| --- | --- |
| `POST /api/session` | Start a game: returns a signed session and its seed. Rate-limited. |
| `GET /api/leaderboard?period=all\|week\|day` | Top 20 for a board. Cached at the edge for 30 s. |
| `GET /api/leaderboard/me?period=…&device=<uuid>` | One device's rank on a board. Never cached. |
| `POST /api/leaderboard` | Submit a finished run (record is replayed and verified). |

Security headers and the Content-Security-Policy live in
[`public/_headers`](phaser-prototype/public/_headers); long-lived caching for
hashed bundles is set there too.

## Working on it

Requires **Node 24** (the tests use `node:sqlite`).

```bash
cd phaser-prototype
npm install
npm test            # unit tests, including the Worker against a real SQLite
npm run dev         # Vite dev server on :5174 (no API, games play unranked)
```

### Tests

| Command | What it checks |
| --- | --- |
| `npm test` | Unit tests: the rules, saves, leaderboard logic, the Worker against a real SQLite. Seconds. |
| `npm run e2e` | **Browser tests** (Playwright). Builds the game, starts the real Worker on a throwaway local database with seeded leaderboard data and drives it with a real browser: the menu, a whole ranked run through the server's replay check, dialogs and focus, language, saved games, a blocked game file, slow or missing Phaser, no WebGL, security headers, the phone layout. About 3 minutes. |

`npm run e2e` uses the Chrome you already have installed; in CI it installs
Chromium. It never touches your `.dev.vars` or your normal local database
(see `e2e/serve.mjs`). Failures leave a screenshot and a trace in
`test-results/` (`npx playwright show-trace <trace.zip>`). Both suites run in
CI on every pull request.

Two things to know when adding browser tests: the Worker refuses runs played
faster than a person (see `waitUntilHumanPaced` in `e2e/fixtures.js`), and it
rate-limits by IP and user agent, so each test gets its own user agent.

To run the full stack locally (Worker, D1, leaderboard):

```bash
cp .dev.vars.example .dev.vars     # then put in two long random strings
npm run d1:migrate:local
npm run cf:dev                     # builds, then serves on http://localhost:8787
```

`.dev.vars` and the local database (`.wrangler/`) are git-ignored.

## Deploying

Deploys are manual, from your machine, and **the order matters**:

```bash
cd phaser-prototype
git checkout main && git pull
npm install
npm test
npm run d1:migrate:remote     # 1. database first (safe to run when nothing is pending)
npm run cf:deploy             # 2. then build and deploy the Worker and the assets
```

- Apply migrations **before** deploying code that needs them. A new table the
  code expects but the database lacks is the usual way a deploy goes wrong.
- First-time setup of the secrets (once per environment):
  `npx wrangler secret put SESSION_SECRET` and `npx wrangler secret put RATE_LIMIT_SALT`
  (each at least 24 random characters).
- The Worker is named `play`; D1 database `garden-evolution-leaderboard`
  (see [`wrangler.jsonc`](phaser-prototype/wrangler.jsonc)). A cron trigger
  every 15 minutes trims expired rate-limit, session and old score-log rows.
- Check a deploy: the page should reference the new `assets/app-<hash>.js`, and
  `POST /api/session` should answer 200 with a `seed`.

CI (GitHub Actions) runs the tests and the build on every push and pull request;
it does not deploy.

## Phones and the story in the background

The worlds are 16:9 paintings behind the board. On a phone held upright only a
strip of one is visible, and the board covers the middle of that, so there are
two ways to see the rest:

- **View garden** (the picture button next to the gear): the game steps aside
  and the painting can be dragged (or moved with the arrow keys) from edge to
  edge. Escape or "Back to game" returns.
- **World reveal**: when a new world unlocks, the game steps aside for a few
  seconds and shows the world with its name and a line of story; a tap skips it.
  Players can turn it off in Settings. It runs a calmer, motionless version when
  reduced motion is on.

Held sideways the board sits in the middle with the world on both sides, as on a
desktop. The page extends under notches and keeps clear of them.

Both features are self-contained: `src/world-view.js` (state and motion),
`src/pan.js` (the maths), one clearly marked block at the end of `style.css`, and
a few lines in `script.js`.

## Switching a feature off, and rolling back

Newer features have switches (`src/features.js`), from the smallest step to the
largest:

- **One visitor:** add `?features=-gardenView,-worldReveal` to the address (the
  choice can also be saved in that browser's `localStorage` under
  `gardenEvolutionFeatures`).
- **Everyone:** set the feature to `false` in `DEFAULTS` in `src/features.js` and
  deploy. The button and the setting disappear and the controls keep their
  previous layout.
- **A bad deploy:** `npx wrangler rollback` (in `phaser-prototype`) puts the
  previous version of the Worker and its assets back at once. It does not touch
  the database.
- **The code:** each change lands as its own small commit, so `git revert` of one
  leaves the others alone.

## Good to know

- **Ad blockers.** A filter list can swallow a bundle whose name looks like an
  ad or tracker, which kills every button. Bundles therefore get neutral names
  (`app`, `game`, `scenery`, `vendor`, see `vite.config.js`), and if the game's
  code still fails to load the visitor gets an explanation instead of a frozen
  page.
- **Start-up order.** The game comes first and never waits for Phaser. `src/main.js`
  starts both downloads at once, awaits the game, and only then the scenery;
  `vite.config.js` declares the game (normal priority) and the scenery (low
  priority) as `modulepreload` links in the page so neither waits for the
  entry script. The menu backdrop is a WebP preloaded by the page (its PNG
  master stays for link previews; rebuild it with `tools/make-menu-webp.mjs`).
  `performance.getEntriesByType("mark")` shows `game-ready` and `scenery-ready`.
- **Saved games** are the seed and the moves, replayed on load. Changing the
  rules or the random stream changes what old saves replay to, so bump
  `SAVE_VERSION` in `src/game-save.js` when you do.
- **Leaderboard names** are checked by `cloudflare/name-filter.js`; extend its
  word list when something slips through.
- **Art pipeline:** helper scripts for the sprites live in
  [`phaser-prototype/tools`](phaser-prototype/tools) (`optimize_assets.py`
  shrinks PNGs without changing them visibly).
