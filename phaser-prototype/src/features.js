// Switches for self-contained features, so one can be turned off without
// touching the rest of the game.
//
// Order of precedence, weakest first:
//   1. DEFAULTS below: what every visitor gets. Changing one here and deploying
//      is the global off switch.
//   2. A value saved in this browser (localStorage "gardenEvolutionFeatures").
//   3. The address: ?features=-gardenView,-worldReveal   (handy for testing, or
//      for asking one player to "turn it off and see").
//
// Syntax for 2 and 3: a comma-separated list where "-name" (or "name=off")
// turns a feature off and "+name" (or "name=on", or just "name") turns it on.
// Unknown names are ignored.

export const DEFAULTS = Object.freeze({
  // The "View garden" button: hide the board and look around the world.
  gardenView: true,
  // The short, skippable showcase of a world when it unlocks.
  worldReveal: true
});

export function parseOverrides(text) {
  const result = {};
  for (const raw of String(text ?? "").split(",")) {
    const item = raw.trim();
    if (!item) continue;
    let name = item;
    let on = true;
    if (item.startsWith("-")) { name = item.slice(1); on = false; }
    else if (item.startsWith("+")) { name = item.slice(1); }
    const equals = name.indexOf("=");
    if (equals >= 0) {
      const value = name.slice(equals + 1).toLowerCase();
      name = name.slice(0, equals);
      on = !["off", "0", "false", "no"].includes(value);
    }
    if (Object.prototype.hasOwnProperty.call(DEFAULTS, name)) result[name] = on;
  }
  return result;
}

export function resolveFeatures({ search = "", stored = "" } = {}) {
  const fromAddress = new URLSearchParams(search).get("features");
  return { ...DEFAULTS, ...parseOverrides(stored), ...parseOverrides(fromAddress) };
}

// The features for this page view, read once.
export function currentFeatures() {
  let stored = "";
  try { stored = localStorage.getItem("gardenEvolutionFeatures") || ""; } catch (error) { /* storage blocked */ }
  return resolveFeatures({ search: location.search, stored });
}
