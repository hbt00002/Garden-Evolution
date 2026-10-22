// What the Today's Garden button offers, from what this device remembers:
//   continue  a run of today's garden left unfinished (ranked or practice)
//   ranked    today's one ranked try, not used yet
//   practice  the same garden again, unranked, once the try is used
// The server has the final say on the ranked try (one entry per device and
// day); this only decides what the button says and which run it starts.
import { msUntilNextDay } from "./daily.js";

// record: { day, seed, used } or null. saved: the run in the daily save slot
// (game-save.js) or null. today: dayKey() now.
export function dailyOffer(record, saved, today) {
  // A ranked run of yesterday's garden that can still be sent is carried on too.
  if (saved && (saved.day === today || saved.mode === "daily")) return { kind: "continue", saved, day: saved.day };
  if (record?.day === today && record.used) return { kind: "practice", day: today, seed: record.seed };
  return { kind: "ranked", day: today };
}

// "in 5 hours" / "5 saat sonra": how long until the next garden, in the
// player's language. Hours while there are any, then minutes.
export function untilNextGarden(language, now = Date.now()) {
  const minutes = Math.max(1, Math.ceil(msUntilNextDay(now) / 60000));
  const [value, unit] = minutes >= 60 ? [Math.floor(minutes / 60), "hour"] : [minutes, "minute"];
  try {
    return new Intl.RelativeTimeFormat(language, { numeric: "always" }).format(value, unit);
  } catch (error) {
    return `${value} ${unit === "hour" ? "h" : "min"}`;
  }
}
