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

- **Game** (`phaser-prototype/script.js`, `src/`): plain DOM and CSS for the board,
  with [Phaser](https://phaser.io) drawing the animated world and the board frame
  behind it (`src/engine.js`). The Phaser part is an enhancement: without WebGL
  the game falls back to a built-in SVG backdrop and still plays. See
  "Code map" below for what lives where.
- **Rules** (`src/game-core.js`, `src/board.js`): one deterministic, seeded
  implementation of the game, used by both the browser and the Worker.
- **Worker** (`cloudflare/worker.js`): the API and the static assets, on
  Cloudflare Workers with a D1 database.
- **Leaderboard**: a run is its seed plus the moves played. The Worker hands out
  a signed session (and the seed) when a game starts, and when a score arrives
  it **replays the recorded moves** and accepts it only if the finished game
  matches the claimed score, top plant and combo.

### Code map

`phaser-prototype/script.js` is the game and the place where the pieces meet (the
run's state, the rules of a move, starting a game, which world is showing, the
boot sequence). Everything else is a small module in `phaser-prototype/src/` that
is given what it needs, knows nothing of the others and has its own unit tests
in `phaser-prototype/tests/`:

| Area | Modules |
| --- | --- |
| Rules and data | `board.js` (moves), `game-core.js` (seeded deal, replay), `game-rules.js`, `game-save.js`, `levels.js` (plants, worlds) |
| The page | `board-view.js` (cells, tiles, particles), `tile-art.js`, `end-card.js`, `combo-hud.js`, `toast.js`, `dialogs.js` (what is open, inert, Tab trap), `settings-panel.js`, `controls.js` (keys, swipes), `world-view.js` (garden view, world reveal), `world-effects.js`, `scenery-fallback.js` (SVG backdrop) |
| The Phaser backdrop | `engine.js` and `scenes/` (loaded separately by `main.js`) |
| Sound | `audio.js` |
| The server | `game-session.js`, `leaderboard-api.js`, `leaderboard-ui.js`, `score-submit.js`, `error-report.js` |
| The player | `preferences.js`, `storage.js`, `i18n.js`, `features.js` |

Each `create...()` module is a factory: it takes the DOM elements and the few
functions it needs (the current language, "is the menu showing?", a callback for
something that happened) and returns a small API. To change how something works,
find its module; `script.js` only wires them.

### API

| Route | Purpose |
| --- | --- |
| `POST /api/session` | Start a game: returns a signed session and its seed. Rate-limited. |
| `GET /api/leaderboard?period=all\|week\|day` | Top 20 for a board. Cached at the edge for 30 s. |
| `GET /api/leaderboard/me?period=…&device=<uuid>` | One device's rank on a board. Never cached. |
| `POST /api/leaderboard` | Submit a finished run (record is replayed and verified). |
| `POST /api/client-error` | The game reports that it broke in a browser (see "Error reports"). Same-origin only, rate-limited, always answers with an empty body. |

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
  and the camera slides across the painting (drag, or the arrow keys) from edge to
  edge. Only a small "Back to game" button stays on screen; the world's name and
  the position track show while the player touches or moves and fade after a few
  seconds. Escape or "Back to game" returns. While it is open the world runs at
  the screen's full rate and the hidden board's frame rests.
- **World reveal**: when a new world unlocks, the game steps aside for a few
  seconds and shows the world with its name and a line of story; a tap skips it.
  It is **off by default** (it interrupts play) and players can turn it on in
  Settings. It runs a calmer, motionless version when reduced motion is on.

Held sideways the board sits in the middle with the world on both sides, as on a
desktop. The page extends under notches and keeps clear of them. A phone held
sideways is only about 220-390 px tall, so the buttons and cards there are sized
from the height (`LANDSCAPE COMFORT` in `style.css`). The board's frame is drawn by
Phaser, which can miss a rotation (it measures before the new layout settles, and
a sleeping loop does not measure at all), so `engine.js` checks it against the real
box whenever that changes.

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

## Error reports and privacy

When the game breaks in someone's browser (an uncaught error, a file that fails
to load, the game or scenery failing to start) `src/error-report.js` tells the
Worker, so a problem is noticed without a player having to complain. At most five
different reports leave a page, each only once.

What is stored (`client_errors`, one row per distinct error with a count): the
error message and stack, the file and line, the page path, the build name, the
screen size, and a **coarse** browser and device (for example "Safari 17, iOS
phone"). **Not stored:** names, scores, the device id, cookies, the IP address or
the raw User-Agent. Rows older than 30 days are deleted by the cron trigger and
the table is capped at 500 distinct errors. The IP is only used, hashed with the
secret salt, to rate-limit reports (20 per 10 minutes).

Read what has been reported (last 7 days, most frequent first):

```bash
cd phaser-prototype
npm run errors:remote
```

Reports are best effort: if the table is missing (code deployed before its
migration) or the request fails, they are dropped silently.

The leaderboard stores a player's chosen name, score and an anonymous device id
(a random UUID kept in the browser) and keeps it until the player's row is
replaced or removed from the database by the owner.

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
- **Texture memory.** A phone keeps every texture of the worlds it has visited
  decoded (width x height x 4 bytes), whatever the file size. A few source
  paintings were far larger than they are drawn (a 1500 px turtle shown 95 px
  wide), so the originals live in `phaser-prototype/art-source/` (not deployed)
  and `tools/shrink-sprites.mjs` writes the small versions the game loads; the
  scenes scale them back up by the same factor. Worlds 3 and 4 went from about
  57 MB and 32 MB decoded to about 19 MB each. `tests/asset-budget.test.js`
  fails if a world grows past its budget. Art folders are cached for a week, so
  a replaced image always gets a new folder name (`-v2`, `-v3`).
- **Smoothness.** Phaser draws the worlds and the board's living frame on the same
  thread as the game's controls, so what it costs is what a tap or swipe has to
  wait behind. Two things used to keep a phone's main thread busy all the time
  and are guarded by `e2e/performance.spec.js`: a Phaser `Graphics` object
  replays (and re-triangulates) every shape on every frame, so the board's frame
  and sixteen cells are drawn once into a texture (`LivingBoardScene.bakeFrame`),
  and the drifting particles use triangle fans (`scenes/fast-shapes.js`) instead
  of `fillCircle`/`fillEllipse`. The backdrop also runs at 30 frames a second on
  touch screens and weak devices (`engine.js`); the tiles slide with CSS and stay
  smooth either way. To measure, slow the CPU 4x in Chrome's Performance panel
  (or with the DevTools Protocol) and look at how much of the main thread is idle
  while the game just sits there: it was 0% before and is about 60-75% now.
- **Saved games** are the seed and the moves, replayed on load. Changing the
  rules or the random stream changes what old saves replay to, so bump
  `SAVE_VERSION` in `src/game-save.js` when you do.
- **Leaderboard names** are checked by `cloudflare/name-filter.js`; extend its
  word list when something slips through.
- **Art pipeline:** helper scripts for the sprites live in
  [`phaser-prototype/tools`](phaser-prototype/tools) (`optimize_assets.py`
  shrinks PNGs without changing them visibly).
