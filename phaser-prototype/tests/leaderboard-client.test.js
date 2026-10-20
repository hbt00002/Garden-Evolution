import test from "node:test";
import assert from "node:assert/strict";
import { createLeaderboardApi, leaderboardRequest } from "../src/leaderboard-api.js";
import { createScoreSubmit } from "../src/score-submit.js";
import { LOWER_SCORE_COPY, TRANSLATIONS } from "../src/i18n.js";

const json = (body, { status = 200, type = "application/json; charset=utf-8" } = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": type } });

function stubFetch(handler) {
  const calls = [];
  globalThis.fetch = async (path, options) => { calls.push({ path, options }); return handler(path, options, calls.length); };
  return calls;
}

/* ---------- The API client ---------- */

test("a board is fetched once and kept for 30 seconds", async () => {
  let clock = 0;
  const calls = stubFetch(() => json({ entries: [{ player_name: "Mira", score: 10 }] }));
  const api = createLeaderboardApi({ now: () => clock });
  assert.equal(api.isFresh("all"), false);
  assert.equal((await api.board("all"))[0].player_name, "Mira");
  assert.equal(calls[0].path, "/api/leaderboard");
  clock = 29_000;
  await api.board("all");
  assert.equal(calls.length, 1, "still fresh");
  assert.equal(api.isFresh("all"), true);
  clock = 31_000;
  await api.board("all");
  assert.equal(calls.length, 2, "expired");
});

test("each period has its own board and its own cache entry", async () => {
  const calls = stubFetch(path => json({ entries: path.includes("week") ? [{ score: 1 }] : [] }));
  const api = createLeaderboardApi();
  await api.board("all");
  await api.board("week");
  await api.board("day");
  assert.deepEqual(calls.map(call => call.path), ["/api/leaderboard", "/api/leaderboard?period=week", "/api/leaderboard?period=day"]);
  api.forget("week");
  assert.equal(api.isFresh("week"), false);
  assert.equal(api.isFresh("day"), true);
  api.forgetAll();
  assert.equal(api.isFresh("day"), false);
});

test("the player's rank is never cached and carries the device id", async () => {
  const calls = stubFetch(() => json({ rank: 3, total: 40 }));
  const api = createLeaderboardApi();
  await api.me("day", "a b/c");
  await api.me("day", "a b/c");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].path, "/api/leaderboard/me?period=day&device=a%20b%2Fc");
});

test("a failed or odd answer is an error, not an empty board", async () => {
  stubFetch(() => json({ error: "x" }, { status: 500 }));
  await assert.rejects(createLeaderboardApi().board("all"), /leaderboard_load_failed/);
  stubFetch(() => json({}, { status: 500 }));
  await assert.rejects(createLeaderboardApi().me("all", "d"), /rank_load_failed/);
  // An ad blocker or proxy answering with a web page instead of JSON.
  stubFetch(() => new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } }));
  await assert.rejects(leaderboardRequest({}, "/api/leaderboard"), /temporarily unavailable/);
  // entries that are not a list are treated as no entries
  stubFetch(() => json({ entries: "nope" }));
  assert.deepEqual(await createLeaderboardApi().board("all"), []);
});

/* ---------- Saving a score ---------- */

class FakeElement {
  constructor() { this.hidden = false; this.textContent = ""; this.value = ""; this.disabled = false; this.listeners = {}; this.classes = new Set(); this.focused = 0; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(other => other !== fn); }
  focus() { this.focused++; }
  get classList() { return { add: name => this.classes.add(name), remove: name => this.classes.delete(name), contains: name => this.classes.has(name) }; }
  fire(type, event = {}) { return Promise.all((this.listeners[type] || []).map(fn => fn({ preventDefault() {}, target: this, ...event }))); }
}

function setupSubmit({ ranked = true, name = "Mira Lane" } = {}) {
  const documentListeners = {};
  const bodyClasses = new Set();
  const events = [];
  globalThis.document = {
    body: { classList: { add: n => bodyClasses.add(n), remove: n => bodyClasses.delete(n) } },
    addEventListener: (type, fn) => { (documentListeners[type] ||= []).push(fn); },
    removeEventListener: (type, fn) => { documentListeners[type] = (documentListeners[type] || []).filter(other => other !== fn); }
  };
  globalThis.window = { dispatchEvent: event => events.push([event.type, event.detail]) };
  globalThis.localStorage = (() => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }; })();
  const els = Object.fromEntries(["form", "playerName", "submitBtn", "status", "confirm", "confirmTitle", "confirmMessage", "cancel", "accept"].map(key => [key, new FakeElement()]));
  els.playerName.value = name;
  els.confirm.hidden = true;
  const saved = [];
  let inertSyncs = 0;
  const run = { ranked, session: { sid: "s", seed: 5 }, score: 4096, maxValueReached: 512, bestCombo: 7, moves: "LURD" };
  const instance = createScoreSubmit({
    elements: els,
    text: () => TRANSLATIONS.en,
    language: () => "en",
    getRun: () => run,
    syncInert: () => { inertSyncs++; },
    onSaved: () => saved.push(true)
  });
  return { instance, els, saved, events, bodyClasses, documentListeners, run, inert: () => inertSyncs, text: TRANSLATIONS.en };
}

test("a name that is too short is refused before anything is sent", async () => {
  const calls = stubFetch(() => json({}));
  const t = setupSubmit({ name: " A " });
  await t.els.form.fire("submit");
  assert.equal(calls.length, 0);
  assert.equal(t.els.status.textContent, t.text.nameTooShort);
  assert.equal(t.els.playerName.focused, 1);
});

test("only a run played from its own server session can be saved", async () => {
  const calls = stubFetch(() => json({}));
  const t = setupSubmit({ ranked: false });
  await t.els.form.fire("submit");
  assert.equal(calls.length, 0);
  assert.equal(t.els.status.textContent, t.text.sessionError);
  assert.equal(t.els.submitBtn.disabled, false, "the player can try again");
  assert.deepEqual(t.saved, []);
});

test("the record of the run is what is sent, and success reports back once", async () => {
  const calls = stubFetch(() => json({ ok: true, playerName: "Mira Lane" }, { status: 201 }));
  const t = setupSubmit();
  await t.els.form.fire("submit");
  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(
    { name: body.playerName, score: body.score, maxTile: body.maxTile, combo: body.bestCombo, stage: body.reachedStage, moves: body.moves, replace: body.replaceLowerScore, sid: body.session.sid },
    { name: "Mira Lane", score: 4096, maxTile: 512, combo: 7, stage: 3, moves: "LURD", replace: false, sid: "s" }
  );
  assert.match(body.deviceId, /^[0-9a-f-]{36}$/);
  assert.deepEqual(t.saved, [true]);
  assert.equal(t.els.status.textContent, t.text.submitSuccess);
  assert.ok(t.els.form.classes.has("success"));
  assert.equal(t.els.playerName.value, "", "the field is cleared");
  assert.equal(localStorage.getItem("gardenEvolutionPlayerName"), "Mira Lane");
  // The same run cannot be saved twice.
  await t.els.form.fire("submit");
  assert.equal(calls.length, 1);
});

test("a lower score asks first, and a refusal sends nothing more", async () => {
  const calls = stubFetch(() => json({ code: "lower_score_confirmation_required", currentScore: 9000 }, { status: 409 }));
  const t = setupSubmit();
  const submitting = t.els.form.fire("submit");
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(t.els.confirm.hidden, false);
  assert.match(t.els.confirmMessage.textContent, /4,096/);
  assert.match(t.els.confirmMessage.textContent, /9,000/);
  assert.equal(t.els.confirmTitle.textContent, LOWER_SCORE_COPY.en[0]);
  assert.ok(t.bodyClasses.has("score-confirm-open"));
  assert.deepEqual(t.events.at(-1), ["garden:score-confirm", { open: true }]);
  await t.els.cancel.fire("click");
  await submitting;
  assert.equal(calls.length, 1, "nothing was replaced");
  assert.equal(t.els.confirm.hidden, true);
  assert.equal(t.bodyClasses.has("score-confirm-open"), false);
  assert.equal(t.els.submitBtn.disabled, false);
  assert.deepEqual(t.saved, []);
  assert.equal((t.documentListeners.keydown || []).length, 0, "the Escape listener is removed");
});

test("accepting the lower score sends it again with the replace flag", async () => {
  const calls = stubFetch((path, options, n) => (n === 1
    ? json({ code: "lower_score_confirmation_required", currentScore: 9000 }, { status: 409 })
    : json({ ok: true, playerName: "Mira Lane" }, { status: 201 })));
  const t = setupSubmit();
  const submitting = t.els.form.fire("submit");
  await new Promise(resolve => setTimeout(resolve, 20));
  await t.els.accept.fire("click");
  await submitting;
  assert.equal(calls.length, 2);
  assert.equal(JSON.parse(calls[1].options.body).replaceLowerScore, true);
  assert.deepEqual(t.saved, [true]);
});

test("each kind of server refusal is explained", async () => {
  const cases = [
    [{ code: "name_not_allowed" }, 400, "nameNotAllowed"],
    [{}, 429, "submitRateLimited"],
    [{}, 500, "submitError"]
  ];
  for (const [body, status, key] of cases) {
    stubFetch(() => json(body, { status }));
    const t = setupSubmit();
    await t.els.form.fire("submit");
    assert.equal(t.els.status.textContent, t.text[key], `status ${status}`);
    assert.equal(t.els.submitBtn.disabled, false);
    assert.deepEqual(t.saved, []);
  }
});

test("after a new run the score can be saved again", async () => {
  const calls = stubFetch(() => json({ ok: true, playerName: "Mira Lane" }, { status: 201 }));
  const t = setupSubmit();
  await t.els.form.fire("submit");
  await t.els.form.fire("submit");
  assert.equal(calls.length, 1, "the same run is saved once");
  t.instance.reset();
  t.els.playerName.value = "Mira Lane";
  await t.els.form.fire("submit");
  assert.equal(calls.length, 2);
});
