// Achievements and the stats behind them, kept on this device only. The game
// reports what happens (a move, a finished run, a share, a look around the
// garden); this decides what that unlocks. Pure: storage is handed in, so the
// rules can be tested without a browser.
import { previousDay } from "./daily.js";

// kind decides the description ("Reach {world}", "Score {n} points"…), stat
// and target what has to be reached. A new achievement goes at the end of its
// group; ids are stored, so they never change.
export const ACHIEVEMENTS = [
  { id: "firstGame", icon: "🌱", kind: "firstGame", stat: "gamesFinished", target: 1 },
  { id: "world2", icon: "💧", kind: "world", stage: 2, stat: "bestTile", target: 128 },
  { id: "world3", icon: "🌸", kind: "world", stage: 3, stat: "bestTile", target: 512 },
  { id: "world4", icon: "🏔", kind: "world", stage: 4, stat: "bestTile", target: 1024 },
  { id: "sakuraCrown", icon: "👑", kind: "plant", stat: "bestTile", target: 2048 },
  { id: "treeOfLife", icon: "🌳", kind: "plant", stat: "bestTile", target: 4096 },
  { id: "celestial", icon: "✨", kind: "plant", stat: "bestTile", target: 8192 },
  { id: "combo5", icon: "🔥", kind: "combo", stat: "bestCombo", target: 5 },
  { id: "combo10", icon: "⚡", kind: "combo", stat: "bestCombo", target: 10 },
  { id: "score10k", icon: "⭐", kind: "score", stat: "bestScore", target: 10000 },
  { id: "score50k", icon: "🌟", kind: "score", stat: "bestScore", target: 50000 },
  { id: "games10", icon: "🪴", kind: "games", stat: "gamesFinished", target: 10 },
  { id: "games50", icon: "🌲", kind: "games", stat: "gamesFinished", target: 50 },
  { id: "dailyFirst", icon: "📅", kind: "daily", stat: "dailiesPlayed", target: 1 },
  { id: "dailyStreak3", icon: "🗓", kind: "streak", stat: "bestDailyStreak", target: 3 },
  { id: "dailyStreak7", icon: "🏅", kind: "streak", stat: "bestDailyStreak", target: 7 },
  { id: "sharer", icon: "💌", kind: "share", stat: "shares", target: 1 },
  { id: "explorer", icon: "🔭", kind: "view", stat: "gardenViews", target: 1 }
];

// Counts show progress ("3 / 10"); a tile or a score is either reached or not.
const COUNTED = new Set(["games", "streak"]);

export const EMPTY_STATS = Object.freeze({
  gamesFinished: 0,
  bestScore: 0,
  bestTile: 0,
  bestCombo: 0,
  dailiesPlayed: 0,
  dailyStreak: 0,
  bestDailyStreak: 0,
  lastDailyDay: null,
  shares: 0,
  gardenViews: 0
});

const count = value => (Number.isSafeInteger(value) && value >= 0 ? value : 0);

// Whatever was stored, as clean stats and unlocks (a hand-edited or broken
// entry falls back to zero, never to an error).
export function cleanState(raw) {
  const stats = { ...EMPTY_STATS };
  const unlocked = {};
  if (raw && typeof raw === "object") {
    for (const key of Object.keys(EMPTY_STATS)) {
      if (key === "lastDailyDay") stats.lastDailyDay = typeof raw.stats?.lastDailyDay === "string" ? raw.stats.lastDailyDay : null;
      else stats[key] = count(raw.stats?.[key]);
    }
    for (const { id } of ACHIEVEMENTS) {
      const at = raw.unlocked?.[id];
      if (Number.isSafeInteger(at) && at > 0) unlocked[id] = at;
    }
  }
  return { stats, unlocked };
}

// The streak after finishing the ranked garden of `day`.
export function nextStreak(stats, day) {
  if (stats.lastDailyDay === day) return stats.dailyStreak;
  return stats.lastDailyDay === previousDay(day) ? stats.dailyStreak + 1 : 1;
}

// load(): the stored object or null. save(state): store it.
// onUnlock(achievements): newly unlocked ones, to tell the player.
// initialBest: the best score this device already had before achievements
// existed, so an old player does not start from nothing.
export function createAchievements({ load, save, onUnlock = () => {}, initialBest = 0, now = () => Date.now() }) {
  const state = cleanState(load());
  state.stats.bestScore = Math.max(state.stats.bestScore, count(initialBest));

  // Anything already earned unlocks quietly (no message on boot).
  check(false);

  function check(notify = true) {
    const fresh = [];
    for (const achievement of ACHIEVEMENTS) {
      if (state.unlocked[achievement.id]) continue;
      if (state.stats[achievement.stat] >= achievement.target) {
        state.unlocked[achievement.id] = now();
        fresh.push(achievement);
      }
    }
    if (fresh.length) {
      save(state);
      if (notify) onUnlock(fresh);
    }
    return fresh;
  }

  function raise(stat, value) {
    if (count(value) > state.stats[stat]) state.stats[stat] = count(value);
  }

  return {
    // During play: the run's score, top tile and best streak so far.
    progress({ score, maxTile, combo }) {
      raise("bestScore", score);
      raise("bestTile", maxTile);
      raise("bestCombo", combo);
      return check();
    },
    // A run ended (no moves left, or the 8192 victory). mode "daily" is the
    // ranked try of today's garden, `day` its day.
    finish({ score, maxTile, combo, mode, day }) {
      raise("bestScore", score);
      raise("bestTile", maxTile);
      raise("bestCombo", combo);
      state.stats.gamesFinished++;
      if (mode === "daily" && day && state.stats.lastDailyDay !== day) {
        state.stats.dailyStreak = nextStreak(state.stats, day);
        state.stats.lastDailyDay = day;
        state.stats.dailiesPlayed++;
        raise("bestDailyStreak", state.stats.dailyStreak);
      }
      save(state);
      return check();
    },
    // "share" or "gardenView".
    event(name) {
      const stat = name === "share" ? "shares" : name === "gardenView" ? "gardenViews" : null;
      if (!stat) return [];
      state.stats[stat]++;
      save(state);
      return check();
    },
    // The current daily streak, or 0 once a day has been missed.
    currentStreak(today) {
      const { lastDailyDay, dailyStreak } = state.stats;
      return lastDailyDay === today || lastDailyDay === previousDay(today) ? dailyStreak : 0;
    },
    // Every achievement with where the player stands.
    list() {
      return ACHIEVEMENTS.map(achievement => ({
        ...achievement,
        unlocked: Boolean(state.unlocked[achievement.id]),
        at: state.unlocked[achievement.id] || null,
        value: Math.min(state.stats[achievement.stat], achievement.target),
        counted: COUNTED.has(achievement.kind)
      }));
    },
    get stats() { return { ...state.stats }; },
    get unlockedCount() { return Object.keys(state.unlocked).length; }
  };
}
