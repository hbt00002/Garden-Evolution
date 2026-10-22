import test from "node:test";
import assert from "node:assert/strict";
import { GAME_URL, shareMessage, shareResult } from "../src/share.js";
import { TRANSLATIONS } from "../src/i18n.js";
import { plantName } from "../src/levels.js";

test("each ending has its own line, with the score written the player's way", () => {
  const base = { score: 32768, worldName: "Spring Bloom", plantName: "Young Tree", language: "en", text: TRANSLATIONS.en };
  assert.equal(shareMessage({ ...base, mode: "noMoves" }), "I grew my garden to 32,768 points and reached Spring Bloom in Garden Evolution 🌱");
  assert.equal(shareMessage({ ...base, mode: "milestone" }), "My garden bloomed into a Young Tree with 32,768 points in Garden Evolution 🌸");
  assert.equal(shareMessage({ ...base, mode: "victory" }), "I completed every world of Garden Evolution with 32,768 points ✨");
  assert.equal(shareMessage({ ...base, mode: "noMoves", prefix: "Today's Garden, Oct 22:" }),
    "Today's Garden, Oct 22: I grew my garden to 32,768 points and reached Spring Bloom in Garden Evolution 🌱");
  const german = shareMessage({ ...base, mode: "noMoves", language: "de", text: TRANSLATIONS.de });
  assert.match(german, /32\.768/);
});

test("every language has the share button, its messages and all three lines, with their placeholders", () => {
  for (const [language, text] of Object.entries(TRANSLATIONS)) {
    for (const key of ["share", "shareCopied", "shareUnavailable", "shareNoMoves", "shareMilestone", "shareVictory"]) {
      assert.ok(text[key], `${language} ${key}`);
    }
    assert.ok(text.shareNoMoves.includes("{score}") && text.shareNoMoves.includes("{world}"), `${language} no moves`);
    assert.ok(text.shareMilestone.includes("{score}") && text.shareMilestone.includes("{plant}"), `${language} milestone`);
    assert.ok(text.shareVictory.includes("{score}"), `${language} victory`);
  }
});

test("a plant is named in the player's language", () => {
  assert.equal(plantName(128, "en"), "Young Tree");
  assert.equal(plantName(128, "tr"), "Genç Ağaç");
  assert.equal(plantName(128, "xx"), "Young Tree");
});

/* ---------- Choosing how to share ---------- */

const card = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });

function fakeNavigator({ files = true, share = true, clipboard = true, fail = null } = {}) {
  const calls = [];
  const nav = {};
  if (share) {
    nav.share = async data => {
      calls.push(["share", data]);
      if (fail) throw Object.assign(new Error(fail), { name: fail });
    };
    nav.canShare = data => Boolean(files || !data?.files?.length);
  }
  if (clipboard) nav.clipboard = { writeText: async value => { calls.push(["copy", value]); } };
  return { nav, calls };
}

test("a phone that takes pictures gets the card, with the address inside the text", async () => {
  const { nav, calls } = fakeNavigator();
  assert.equal(await shareResult({ card, message: "Grew a garden", nav }), "image");
  const [[kind, data]] = calls;
  assert.equal(kind, "share");
  assert.equal(data.files.length, 1);
  assert.equal(data.files[0].type, "image/png");
  assert.equal(data.text, `Grew a garden ${GAME_URL}`);
});

test("a share sheet without pictures gets the words and the link", async () => {
  const { nav, calls } = fakeNavigator({ files: false });
  assert.equal(await shareResult({ card, message: "Grew a garden", nav }), "text");
  assert.deepEqual(calls, [["share", { text: "Grew a garden", url: GAME_URL }]]);
});

test("without a card (it could not be drawn) the words still go", async () => {
  const { nav, calls } = fakeNavigator();
  assert.equal(await shareResult({ card: null, message: "Grew a garden", nav }), "text");
  assert.equal(calls[0][1].files, undefined);
});

test("closing the share sheet is not a failure and nothing else is tried", async () => {
  const { nav, calls } = fakeNavigator({ fail: "AbortError" });
  assert.equal(await shareResult({ card, message: "m", nav }), "cancelled");
  assert.equal(calls.length, 1);
});

test("if sharing the picture fails for another reason, the words are shared instead", async () => {
  let attempt = 0;
  const calls = [];
  const nav = {
    canShare: () => true,
    share: async data => {
      calls.push(data);
      if (attempt++ === 0) throw Object.assign(new Error("not allowed"), { name: "NotAllowedError" });
    }
  };
  assert.equal(await shareResult({ card, message: "m", nav }), "text");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, GAME_URL);
});

test("a desktop without a share sheet copies the words and the address", async () => {
  const { nav, calls } = fakeNavigator({ share: false });
  assert.equal(await shareResult({ card, message: "Grew a garden", nav }), "copied");
  assert.deepEqual(calls, [["copy", `Grew a garden ${GAME_URL}`]]);
});

test("with neither a share sheet nor a clipboard the player is told", async () => {
  const { nav } = fakeNavigator({ share: false, clipboard: false });
  assert.equal(await shareResult({ card, message: "m", nav }), "unavailable");
});
