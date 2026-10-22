// Everything the game keeps in the browser's localStorage. Storage can be
// blocked (private windows, strict settings), so every access is wrapped: a
// failed read gives the default and a failed write is ignored, and the game
// plays on without remembering.
import { DAILY_SAVE_KEY, SAVE_KEY, parseSavedGame, serializeGame } from "./game-save.js";
import { isDayKey } from "./daily.js";

const KEYS = {
  best: "gardenEvolutionBest",
  playerName: "gardenEvolutionPlayerName",
  deviceId: "gardenEvolutionDeviceId",
  language: "gardenEvolutionLanguage",
  daily: "gardenEvolutionDaily",
  achievements: "gardenEvolutionAchievements"
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
// slot: "classic" for normal games, "daily" for today's garden (ranked or practice).
const slotKey = slot => (slot === "daily" ? DAILY_SAVE_KEY : SAVE_KEY);
export function writeSavedGame(game, slot = "classic") {
  try { localStorage.setItem(slotKey(slot), serializeGame(game)); } catch (error) { /* storage blocked or full */ }
}
export function clearSavedGame(slot = "classic") {
  try { localStorage.removeItem(slotKey(slot)); } catch (error) { /* storage blocked */ }
}
export function loadSavedGame(slot = "classic") {
  try { return parseSavedGame(localStorage.getItem(slotKey(slot))); } catch (error) { return null; }
}

/* ---------- Today's garden ----------
   What this device knows of the latest day it played: the day, its seed (so
   the garden can be practised again without the server) and whether the
   ranked try is used. The server keeps the real count; this only decides what
   the button offers.
*/
export function loadDailyRecord() {
  try {
    const data = JSON.parse(read(KEYS.daily) || "null");
    if (!data || !isDayKey(data.day) || !Number.isSafeInteger(data.seed) || data.seed < 0 || data.seed > 4294967295) return null;
    return { day: data.day, seed: data.seed, used: data.used === true };
  } catch (error) {
    return null;
  }
}
export const saveDailyRecord = record => write(KEYS.daily, JSON.stringify({ day: record.day, seed: record.seed, used: Boolean(record.used) }));

// Achievements and the stats behind them (src/achievements.js checks the contents).
export function loadAchievements() {
  try { return JSON.parse(read(KEYS.achievements) || "null"); } catch (error) { return null; }
}
export const saveAchievements = state => write(KEYS.achievements, JSON.stringify(state));
