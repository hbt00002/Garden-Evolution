// Turn-based streak and bounded, time-based audiovisual energy.
export function createBloomFlow() {
  let streak = 0, best = 0, energy = 0, lastMerge = -Infinity;
  const level = now => energy * Math.max(0, 1 - Math.max(0, now - lastMerge - 1200) / 2000);
  return {
    move(merges, now) {
      if (merges > 0) {
        streak += 1;
        best = Math.max(best, streak);
        energy = Math.min(8, level(now) + Math.min(merges, 3));
        lastMerge = now;
      } else streak = 0;
      return { streak, best, flow: level(now) };
    },
    level,
    cool() { energy = 0; lastMerge = -Infinity; },
    reset() { streak = 0; best = 0; this.cool(); }
  };
}
