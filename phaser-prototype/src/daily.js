// Today's garden: one seed for everyone, changing at midnight Turkey time
// (UTC+3 all year; Turkey has not changed its clocks since 2016). Shared by the
// game and the Worker so both agree on what "today" is.

const TURKEY_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// "2026-10-22": the day a moment belongs to, in Turkey time.
export function dayKey(ms = Date.now()) {
  return new Date(ms + TURKEY_OFFSET_MS).toISOString().slice(0, 10);
}

export const isDayKey = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

// When the given day starts and ends, as UTC milliseconds.
export function dayStart(key) {
  return Date.parse(`${key}T00:00:00Z`) - TURKEY_OFFSET_MS;
}
export const dayEnd = key => dayStart(key) + DAY_MS;

// How long until the next garden, in milliseconds.
export const msUntilNextDay = (ms = Date.now()) => dayEnd(dayKey(ms)) - ms;

// The day before / after a key ("2026-10-21" -> "2026-10-20").
export const previousDay = key => dayKey(dayStart(key) - 1);
export const nextDay = key => dayKey(dayEnd(key));

// "22 Oct" / "22 Eki" for showing the day to a player.
export function dayLabel(key, language) {
  try {
    return new Date(`${key}T12:00:00Z`).toLocaleDateString(language, { day: "numeric", month: "short", timeZone: "UTC" });
  } catch (error) {
    return key;
  }
}
