import test from "node:test";
import assert from "node:assert/strict";
import { createEndCard } from "../src/end-card.js";
import { TRANSLATIONS } from "../src/i18n.js";

class FakeElement {
  constructor(name = "") {
    this.name = name; this.hidden = false; this.textContent = ""; this.value = ""; this.disabled = false; this.placeholder = "";
    this.dataset = new Proxy({}, { set: (target, key, value) => { target[key] = String(value); return true; } }); this.classes = new Set(); this.focused = 0; this.children = []; this.previousElementSibling = null;
  }
  get classList() { return { add: n => this.classes.add(n), remove: n => this.classes.delete(n), contains: n => this.classes.has(n) }; }
  focus() { this.focused++; }
  querySelector() { return this.label ?? null; }
  querySelectorAll(selector) { return selector === "[data-i18n]" ? this.i18n ?? [] : this.children; }
  appendChild(child) { this.children.push(child); child.parent = this; }
  setAttribute() {}
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function setup({ language = "en", ranked = true, particlesOn = true, reduceMotion = false, savedName = "Mira" } = {}) {
  globalThis.requestAnimationFrame = fn => fn();
  globalThis.localStorage = { getItem: key => (key === "gardenEvolutionPlayerName" ? savedName : null), setItem() {}, removeItem() {} };
  globalThis.document = { createElement: () => Object.assign(new FakeElement("mote"), { style: { setProperty() {} }, addEventListener() {}, remove() {} }) };
  const el = {};
  for (const name of ["overlay", "finalScore", "finalBest", "finalTitle", "finalExplanation", "scoreForm", "playerName", "submitBtn", "status", "continueBtn", "playAgainBtn", "finalWorld", "finalTile", "finalCombo", "finalEmblem", "unrankedNote", "milestoneArt", "victoryArt", "normalGameBtn"]) {
    el[name] = new FakeElement(name);
  }
  el.finalScore.previousElementSibling = new FakeElement("scoreLabel");
  el.scoreForm.label = new FakeElement("formLabel");
  el.overlay.hidden = true;
  const state = { run: { score: 5120, best: 8000, maxValueReached: 512, bestCombo: 6, ranked, currentStage: 3 }, language, cooled: 0, sounds: 0 };
  const card = createEndCard({
    elements: el,
    prefs: { reduceMotion, particlesOn },
    text: () => TRANSLATIONS[state.language],
    language: () => state.language,
    snapshot: () => state.run,
    onShow: () => { state.cooled++; },
    playGameOver: () => { state.sounds++; }
  });
  return { card, el, state, text: TRANSLATIONS[language] };
}

test("a run with no moves left shows its numbers, the world reached and the name form", async () => {
  const t = setup();
  t.card.show("noMoves");
  assert.equal(t.el.overlay.hidden, false);
  assert.equal(t.el.overlay.dataset.mode, "noMoves");
  assert.equal(t.el.overlay.dataset.stage, "3", "512 belongs to the third world");
  assert.equal(t.el.finalScore.textContent, "5,120");
  assert.equal(t.el.finalBest.textContent, "8,000");
  assert.equal(t.el.finalTile.textContent, "512");
  assert.equal(t.el.finalCombo.textContent, "6×");
  assert.equal(t.el.finalWorld.textContent, "Spring Bloom");
  assert.equal(t.el.finalEmblem.textContent, "✿");
  assert.equal(t.el.finalTitle.dataset.i18n, "noMoves");
  assert.equal(t.el.scoreForm.hidden, false);
  assert.equal(t.el.unrankedNote.hidden, true);
  assert.equal(t.el.playerName.value, "Mira", "the last name used is offered again");
  assert.equal(t.el.continueBtn.hidden, true);
  assert.equal(t.el.playAgainBtn.hidden, false);
  assert.equal(t.state.cooled, 1);
  assert.equal(t.state.sounds, 1);
  assert.ok(t.el.overlay.classes.has("show"));
  assert.equal(t.el.overlay.classes.has("ready"), false, "not ready for input until the entrance settles");
  await wait(900);
  assert.ok(t.el.overlay.classes.has("ready"));
  assert.equal(t.el.playerName.focused, 1, "a ranked run focuses the name field");
});

test("an unranked run explains why and has no form", async () => {
  const t = setup({ ranked: false });
  t.card.show("noMoves");
  assert.equal(t.el.scoreForm.hidden, true);
  assert.equal(t.el.unrankedNote.hidden, false);
  await wait(900);
  assert.equal(t.el.playAgainBtn.focused, 1);
});

test("the 2048 milestone lets the player play on, and is quicker to become ready", async () => {
  const t = setup();
  t.state.run = { ...t.state.run, maxValueReached: 2048, score: 20000, currentStage: 5 };
  t.card.show("milestone");
  assert.equal(t.el.continueBtn.hidden, false);
  assert.equal(t.el.playAgainBtn.hidden, true);
  assert.equal(t.el.scoreForm.hidden, true, "no score is saved at a milestone");
  assert.equal(t.el.finalWorld.textContent, t.text.milestoneKicker);
  assert.equal(t.state.sounds, 0, "no game-over sound for a milestone");
  assert.equal(t.el.milestoneArt.children.length, 18, "a burst of motes around the art");
  await wait(400);
  assert.equal(t.el.continueBtn.focused, 1);
});

test("the 8192 victory saves the final score and bursts around its own art", () => {
  const t = setup();
  t.card.show("victory");
  assert.equal(t.el.finalTitle.dataset.i18n, "victoryTitle");
  assert.equal(t.el.scoreForm.label.dataset.i18n, "saveFinalScore");
  assert.equal(t.el.finalWorld.textContent, t.text.victoryKicker);
  assert.equal(t.el.victoryArt.children.length, 18);
  assert.equal(t.el.milestoneArt.children.length, 0);
});

test("no motes when particles are off or motion is reduced", () => {
  for (const options of [{ particlesOn: false }, { reduceMotion: true }]) {
    const t = setup(options);
    t.card.show("milestone");
    assert.equal(t.el.milestoneArt.children.length, 0, JSON.stringify(options));
  }
});

test("hiding the card clears it, and a late focus does not follow", async () => {
  const t = setup();
  t.card.show("noMoves");
  t.card.hide();
  assert.equal(t.el.overlay.hidden, true);
  assert.equal(t.el.overlay.classes.has("show"), false);
  await wait(900);
  assert.equal(t.el.playerName.focused, 0, "the timer was cancelled");
  assert.equal(t.el.overlay.classes.has("ready"), false);
});

test("the card follows the language, open or closed", () => {
  const t = setup({ language: "tr" });
  const title = new FakeElement("title");
  title.dataset.i18n = "final";
  t.el.overlay.i18n = [title];
  t.card.localize();
  assert.equal(title.textContent, TRANSLATIONS.tr.final);
  assert.equal(t.el.playerName.placeholder, TRANSLATIONS.tr.yourName);
  // closed: the world name of the current world, translated
  assert.notEqual(t.el.finalWorld.textContent, "Spring Bloom");
  assert.ok(t.el.finalWorld.textContent.length > 0);
  t.card.show("milestone");
  t.state.language = "en";
  t.card.localize();
  assert.equal(t.el.finalWorld.textContent, TRANSLATIONS.en.milestoneKicker, "an open milestone card keeps its kicker");
});

test("today's garden: its own form label, practice explained, and a way back to a normal game", () => {
  const t = setup();
  t.state.run.mode = "daily";
  t.card.show("noMoves");
  assert.equal(t.el.scoreForm.label.dataset.i18n, "joinDaily");
  assert.equal(t.el.normalGameBtn.hidden, false);
  t.card.hide();
  t.state.run = { ...t.state.run, mode: "practice", ranked: false };
  t.card.show("noMoves");
  assert.equal(t.el.unrankedNote.hidden, false);
  assert.equal(t.el.unrankedNote.dataset.i18n, "dailyPracticeNote");
  t.card.hide();
  t.state.run = { ...t.state.run, mode: "classic", ranked: true };
  t.card.show("noMoves");
  assert.equal(t.el.normalGameBtn.hidden, true);
  assert.equal(t.el.unrankedNote.dataset.i18n, "unrankedRun");
});
