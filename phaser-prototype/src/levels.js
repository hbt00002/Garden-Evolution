// The plants, the five worlds and which world a plant belongs to. Pure data and
// lookups with no DOM, so they can be tested and shared.
import { LOCALIZED_STAGES, TILE_NAMES } from "./i18n.js";

/* ---------- Evolution chain ----------
   Each tile gets a distinct background tone (bg) and number colour (fg).
*/
export const LEVELS = [
  { v: 2, name: "Seed", bg: "#efe0c6", fg: "#7a5c34" },
  { v: 4, name: "Sprout", bg: "#e6f0cf", fg: "#5d7a2e" },
  { v: 8, name: "Young Plant", bg: "#d6efda", fg: "#3f6b35" },
  { v: 16, name: "Flower", bg: "#f7dde2", fg: "#9c4a64" },
  { v: 32, name: "Bush", bg: "#cfe6b4", fg: "#3f6b28" },
  { v: 64, name: "Sapling", bg: "#c2d9c2", fg: "#3a5c44" },
  { v: 128, name: "Young Tree", bg: "#a8c9a0", fg: "#2f5230" },
  { v: 256, name: "Mature Tree", bg: "#8eb07e", fg: "#244a26" },
  { v: 512, name: "Fruit Tree", bg: "#e6c79a", fg: "#7a4a22" },
  { v: 1024, name: "Ancient Tree", bg: "#6f8a60", fg: "#1e3a1a" },
  { v: 2048, name: "Golden Tree", bg: "#f2d985", fg: "#6b4d12" },
  { v: 4096, name: "Tree of Life", bg: "#b8e0a0", fg: "#2a5a1a" },
  { v: 8192, name: "Celestial Tree", bg: "#9eb8d6", fg: "#2a3a5e" }
];

// Tile colours; the artwork itself is the PNG pack in /assets/tiles.
const TILE_PALETTE = [
  ["#f4ead8", "#70502e"], ["#e8f1d5", "#4c6b2c"], ["#dcebd2", "#385f36"],
  ["#f3e0e2", "#85475c"], ["#d7e7c1", "#3e632e"], ["#b7d09b", "#315b35"],
  ["#82aa74", "#214a2d"], ["#496e4b", "#173522"], ["#5f7d5e", "#173a25"],
  ["#71866a", "#173a25"], ["#f0c9d5", "#75344f"], ["#b8dca8", "#25531f"],
  ["#aebfdd", "#283d66"]
];
LEVELS.forEach((level, index) => {
  level.sprite = index;
  level.bg = TILE_PALETTE[index][0];
  level.fg = TILE_PALETTE[index][1];
});
LEVELS[8].name = "Mini Forest";
LEVELS[9].name = "Ancient Tree";
LEVELS[10].name = "Sakura Crown";

const BY_VALUE = {};
LEVELS.forEach(l => (BY_VALUE[l.v] = l));
export function levelFor(v) {
  return BY_VALUE[v] || { v, name: "Bloomed", bg: LEVELS[LEVELS.length - 1].bg, fg: "#fff" };
}

// The picture a tile of this value shows (the value of the plant whose art it is).
export function artValueFor(value) {
  const level = levelFor(value);
  const sprite = Number.isInteger(level.sprite) ? level.sprite : LEVELS.length - 1;
  return { sprite, assetValue: LEVELS[sprite]?.v || 8192 };
}

// A tile's accessible name, in the player's language: "Young Tree, 128".
export function tileLabel(value, language) {
  const level = levelFor(value);
  const name = TILE_NAMES[language]?.[LEVELS.indexOf(level)] || level.name;
  return `${name}, ${value}`;
}

/* ---------- Environment stages (by highest tile value) ---------- */
// Returns 1..5
export function stageFor(maxValue) {
  if (maxValue <= 64) return 1;
  if (maxValue <= 256) return 2;
  if (maxValue <= 512) return 3;
  if (maxValue <= 1024) return 4;
  return 5;
}

export const STAGE_META = [
  { name: "Winter Beginning", next: 128, line: "A quiet beginning beneath the snow.", emblem: "❄" },
  { name: "Snowmelt Valley", next: 512, line: "The snow begins to sing.", emblem: "◌" },
  { name: "Spring Bloom", next: 1024, line: "Every corner wakes with life.", emblem: "✿" },
  { name: "Alpine Sakura", next: 2048, line: "Petals rise over the alpine garden.", emblem: "❀" },
  { name: "Moonlit Garden", next: null, line: "The completed garden glows at night.", emblem: "☾" }
];

// A world's name and line of story in the player's language.
export function stageMeta(stage, language) {
  const base = STAGE_META[stage - 1];
  const localized = LOCALIZED_STAGES[language]?.[stage - 1];
  return localized ? { ...base, name: localized[0], line: localized[1] } : base;
}
