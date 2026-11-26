import test from "node:test";
import assert from "node:assert/strict";
import { cleanName } from "../src/player-name.js";

test("spaces are tidied and markup characters dropped", () => {
  assert.equal(cleanName("  Mira   Lee  "), "Mira Lee");
  assert.equal(cleanName("<b>Ada</b>"), "bAda/b");
});

test("invisible and direction-changing characters are removed", () => {
  assert.equal(cleanName("Player\u200B01"), "Player01");
  assert.equal(cleanName("\u202Eniwdrow"), "niwdrow");
});

test("blank-looking fillers leave nothing", () => {
  assert.equal(cleanName("\u3164\u3164"), "");
  assert.equal(cleanName("\u2800\u2800\u2800"), "");
});

test("a pile of combining marks is cut to two", () => {
  assert.equal(cleanName("Z" + "̵".repeat(13) + "algo"), "Z̵̵algo");
});

test("a name is cut to 16 characters without splitting an emoji", () => {
  assert.equal(cleanName("abcdefghijklmno🌸xyz"), "abcdefghijklmno🌸");
  assert.equal(cleanName("abcdefghijklmnop🌸"), "abcdefghijklmnop");
});

test("never more than 16 characters as the database counts them", () => {
  const family = "👨\u200D👩\u200D👧";
  const cleaned = cleanName("abcdefghijklmn" + family);
  assert.ok([...cleaned].length <= 16, cleaned);
  assert.equal(cleaned, "abcdefghijklmn");
});
