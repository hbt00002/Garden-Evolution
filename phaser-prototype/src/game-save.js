// Pure (de)serialisation of the in-progress game kept in localStorage.
//
// A run is stored as the seed it started from and the moves played so far.
// Restoring replays those moves with the same rules the leaderboard Worker
// uses (src/game-core.js), so the board, score and combo are always exactly
// what the moves produced: a corrupted or hand-edited entry either replays to a
// legal game or is rejected, and can never crash the boot sequence. The caller
// simply starts a fresh game when nothing safe can be restored.
import { BOARD_SIZE, hasMoves } from "./board.js";
import { MAX_MOVES, boardToGrid, replayGame } from "./game-core.js";

export { BOARD_SIZE, hasMoves };

export const SAVE_KEY = "gardenEvolutionSave";
// Version 1 stored a bare board and could not be verified; those saves are
// ignored rather than restored into a run the leaderboard would refuse.
export const SAVE_VERSION = 2;

const MAX_SAVE_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_RAW_LENGTH = MAX_MOVES + 2048;
const SEED_LIMIT = 4294967295;
const GOLDEN_TILE = 2048;
// Mirrors SESSION_MAX_AGE_MS in cloudflare/worker.js, minus a safety margin so
// a session that would expire mid-submit is replaced instead of restored.
const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const SESSION_MARGIN_MS = 5 * 60 * 1000;

const isSeed = value => Number.isSafeInteger(value) && value >= 0 && value <= SEED_LIMIT;

function cleanSession(session, now) {
  if (!session || typeof session !== "object") return null;
  const { sid, iat, sig, seed } = session;
  if (typeof sid !== "string" || sid.length > 64 || typeof sig !== "string" || sig.length > 128) return null;
  if (!isSeed(seed)) return null;
  if (!Number.isSafeInteger(iat) || iat > now) return null;
  if (now - iat > SESSION_MAX_AGE_MS - SESSION_MARGIN_MS) return null;
  return { sid, iat, sig, seed };
}

// True while a leaderboard session is still far enough from expiring that it
// can be presented at the end of the run.
export function isSessionUsable(session, now = Date.now()) {
  return cleanSession(session, now) !== null;
}

export function serializeGame(state, now = Date.now()) {
  return JSON.stringify({
    version: SAVE_VERSION,
    savedAt: now,
    seed: state.seed,
    moves: state.moves,
    session: state.session ?? null
  });
}

// Returns the restorable run, or null when there is nothing safe to restore.
// A stale or unusable leaderboard session is dropped but does not invalidate
// the board.
export function parseSavedGame(raw, now = Date.now()) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_RAW_LENGTH) return null;
  let data;
  try { data = JSON.parse(raw); } catch { return null; }
  if (!data || typeof data !== "object" || data.version !== SAVE_VERSION) return null;

  if (!Number.isSafeInteger(data.savedAt) || data.savedAt > now + 24 * 60 * 60 * 1000 || now - data.savedAt > MAX_SAVE_AGE_MS) return null;
  if (!isSeed(data.seed) || typeof data.moves !== "string" || data.moves.length === 0) return null;

  const game = replayGame(data.seed, data.moves);
  if (!game) return null;
  // A finished run is never resumed: the ending screen already offered a new game.
  if (game.over) return null;

  return {
    seed: game.seed,
    moves: game.moves,
    board: boardToGrid(game.board),
    score: game.score,
    maxValueReached: game.maxTile,
    bestCombo: game.bestCombo,
    streak: game.streak,
    completedMoves: game.moves.length,
    goldenAchieved: game.maxTile >= GOLDEN_TILE,
    rngState: game.rng.s,
    session: cleanSession(data.session, now)
  };
}
