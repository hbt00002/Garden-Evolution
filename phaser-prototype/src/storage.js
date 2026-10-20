// Everything the game keeps in the browser's localStorage. Storage can be
// blocked (private windows, strict settings), so every access is wrapped: a
// failed read gives the default and a failed write is ignored, and the game
// plays on without remembering.
import { SAVE_KEY, parseSavedGame, serializeGame } from "./game-save.js";

const KEYS = {
  best: "gardenEvolutionBest",
  playerName: "gardenEvolutionPlayerName",
  deviceId: "gardenEvolutionDeviceId",
  language: "gardenEvolutionLanguage"
};

function read(key) {
  try { return localStorage.getItem(key); } catch (error) { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, String(value)); } catch (error) { /* storage blocked */ }
}

export function loadBest() {
  const value = read(KEYS.best);
  return value ? parseInt(value, 10) || 0 : 0;
}
export const saveBest = best => write(KEYS.best, best);

// On/off preferences are stored as "true"/"false"; a missing key means the default.
export function loadPref(key, fallback) {
  const value = read(key);
  return value === null ? fallback : value === "true";
}
export const savePref = (key, value) => write(key, value);

export const loadPlayerName = () => read(KEYS.playerName) || "";
export const savePlayerName = name => write(KEYS.playerName, name);

export const loadLanguage = () => read(KEYS.language) || "en";
export const saveLanguage = language => write(KEYS.language, language);

// Stable per-browser id so the leaderboard can keep one "best score" row
// per device instead of growing forever. Not a security boundary (an
// attacker can clear storage or fabricate a UUID) — it's a courtesy id
// for normal players, paired server-side with session + rate limiting.
export function loadDeviceId() {
  try {
    let id = localStorage.getItem(KEYS.deviceId);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEYS.deviceId, id);
    }
    return id;
  } catch (error) {
    return null;
  }
}

/* ---------- In-progress game ----------
   The board is written after every completed move and cleared when a run
   ends or a new one starts. Validation lives in game-save.js. The combo
   streak and flow energy are intentionally not saved: they are short-lived
   audiovisual state that restarts cleanly.
*/
export function writeSavedGame(game) {
  try { localStorage.setItem(SAVE_KEY, serializeGame(game)); } catch (error) { /* storage blocked or full */ }
}
export function clearSavedGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch (error) { /* storage blocked */ }
}
export function loadSavedGame() {
  try { return parseSavedGame(localStorage.getItem(SAVE_KEY)); } catch (error) { return null; }
}
