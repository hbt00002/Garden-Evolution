import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// A phone keeps every texture of the worlds it has visited decoded in memory
// (width x height x 4 bytes), however small the file is. These budgets keep a
// new painting from quietly doubling that; shrink it with tools/shrink-sprites.mjs.
const assets = new URL("../public/assets/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function decodedBytes(folder) {
  let total = 0;
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith(".png")) {
        const header = readFileSync(path).subarray(16, 24);
        total += header.readUInt32BE(0) * header.readUInt32BE(4) * 4;
      }
    }
  };
  if (existsSync(join(assets, folder))) walk(join(assets, folder));
  return total;
}

const MB = 1024 * 1024;

test("each world's textures stay within a memory budget on a phone", () => {
  // Only the folders the game loads today (older folders are kept for caches and not loaded).
  const loaded = { "stage1": 1, "stage1-v3": 4, "stage1-v2": 4, "stage2-v3": 18, "stage3-v1": 22, "stage3-v2": 1, "stage4-v1": 28, "stage4-v2": 1, "stage5-v2": 10 };
  for (const [folder, budget] of Object.entries(loaded)) {
    const mb = decodedBytes(folder) / MB;
    assert.ok(mb <= budget, `${folder} decodes to ${mb.toFixed(1)} MB, over its ${budget} MB budget`);
  }
});
