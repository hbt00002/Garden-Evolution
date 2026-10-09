// Pure (de)serialisation and validation of the in-progress game kept in
// localStorage. Anything that does not look like a game this code could have
// produced is rejected, so a corrupted or hand-edited entry can never crash
// the boot sequence; the caller simply starts a fresh game instead.

export const SAVE_KEY = "gardenEvolutionSave";
export const SAVE_VERSION = 1;
import { BOARD_SIZE, hasMoves } from "./board.js";

export { BOARD_SIZE, hasMoves };

const MAX_SAVE_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_TILE = 8192;
const SCORE_LIMIT = 100_000_000; // mirrors cloudflare/worker.js
const COMBO_LIMIT = 1000;
// Mirrors SESSION_MAX_AGE_MS in cloudflare/worker.js, minus a safety margin so
// a session that would expire mid-submit is replaced instead of restored.
const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const SESSION_MARGIN_MS = 5 * 60 * 1000;

const isPowerOfTwo = value => Number.isInteger(value) && value >= 2 && value <= MAX_TILE && (value & (value - 1)) === 0;
const isCount = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;

function validBoard(board) {
  if (!Array.isArray(board) || board.length !== BOARD_SIZE) return false;
  let tiles = 0;
  for (const row of board) {
    if (!Array.isArray(row) || row.length !== BOARD_SIZE) return false;
    for (const value of row) {
      if (value === 0) continue;
      if (!isPowerOfTwo(value)) return false;
      tiles++;
    }
  }
  return tiles > 0;
}

function cleanSession(session, now) {
  if (!session || typeof session !== "object") return null;
  const { sid, iat, sig } = session;
  if (typeof sid !== "string" || sid.length > 64 || typeof sig !== "string" || sig.length > 128) return null;
  if (!Number.isSafeInteger(iat) || iat > now) return null;
  if (now - iat > SESSION_MAX_AGE_MS - SESSION_MARGIN_MS) return null;
  return { sid, iat, sig };
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
    board: state.board,
    score: state.score,
    maxValueReached: state.maxValueReached,
    bestCombo: state.bestCombo,
    completedMoves: state.completedMoves,
    goldenAchieved: Boolean(state.goldenAchieved),
    session: state.session ?? null
  });
}

// Returns the restorable game state, or null when there is nothing safe to
// restore. A stale or unusable leaderboard session is dropped but does not
// invalidate the board.
export function parseSavedGame(raw, now = Date.now()) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 4096) return null;
  let data;
  try { data = JSON.parse(raw); } catch { return null; }
  if (!data || typeof data !== "object" || data.version !== SAVE_VERSION) return null;

  if (!Number.isSafeInteger(data.savedAt) || data.savedAt > now + 24 * 60 * 60 * 1000 || now - data.savedAt > MAX_SAVE_AGE_MS) return null;
  if (!validBoard(data.board)) return null;
  if (!isCount(data.score, SCORE_LIMIT) || !isCount(data.bestCombo, COMBO_LIMIT) || !isCount(data.completedMoves, 1_000_000)) return null;
  if (typeof data.goldenAchieved !== "boolean") return null;

  const topTile = Math.max(...data.board.flat());
  if (!isPowerOfTwo(data.maxValueReached) || data.maxValueReached < topTile) return null;
  // A finished run is never resumed: the ending screen already offered a new game.
  if (!hasMoves(data.board)) return null;

  return {
    board: data.board.map(row => row.slice()),
    score: data.score,
    maxValueReached: data.maxValueReached,
    bestCombo: data.bestCombo,
    completedMoves: data.completedMoves,
    goldenAchieved: data.goldenAchieved,
    session: cleanSession(data.session, now)
  };
}
