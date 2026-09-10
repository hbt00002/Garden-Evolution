export const FINAL_TILE_VALUE = 8192;
export const MILESTONE_TILE_VALUE = 2048;

export function canMergeValues(left, right) {
  return left === right && left < FINAL_TILE_VALUE;
}

export function endingForMergedValue(value) {
  if (value === FINAL_TILE_VALUE) return "victory";
  if (value === MILESTONE_TILE_VALUE) return "milestone";
  return null;
}
