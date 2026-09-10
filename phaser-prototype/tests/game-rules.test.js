import test from "node:test";
import assert from "node:assert/strict";
import {
  FINAL_TILE_VALUE,
  canMergeValues,
  endingForMergedValue
} from "../src/game-rules.js";

test("the final 8192 tile cannot merge again", () => {
  assert.equal(FINAL_TILE_VALUE, 8192);
  assert.equal(canMergeValues(4096, 4096), true);
  assert.equal(canMergeValues(8192, 8192), false);
  assert.equal(canMergeValues(2048, 4096), false);
});

test("2048 pauses for a milestone and 8192 ends the run", () => {
  assert.equal(endingForMergedValue(1024), null);
  assert.equal(endingForMergedValue(2048), "milestone");
  assert.equal(endingForMergedValue(4096), null);
  assert.equal(endingForMergedValue(8192), "victory");
});
