import test from "node:test";
import assert from "node:assert/strict";
import { createGameSession, randomSeed, withTimeout } from "../src/game-session.js";

const ok = body => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const freshSession = (seed = 12345) => ({ sid: "abc", iat: Date.now(), sig: "x".repeat(64), seed });

function stub(handler) {
  const calls = [];
  globalThis.fetch = async (path, options) => { calls.push({ path, options }); return handler(calls.length); };
  return calls;
}

function setup(overrides = {}) {
  const state = { generation: 1, issued: 0 };
  const session = createGameSession({
    getGeneration: () => state.generation,
    errorMessage: () => "Could not start a ranked game.",
    onIssued: () => { state.issued++; },
    ...overrides
  });
  return { session, state };
}

test("a session is requested once and shared by everyone who asks", async () => {
  const calls = stub(() => ok(freshSession()));
  const { session, state } = setup();
  const [a, b] = await Promise.all([session.ensure(), session.ensure()]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "/api/session");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(a, b);
  assert.equal(session.current.seed, 12345);
  assert.equal(state.issued, 1, "the game saves itself once");
});

test("a run played from the session's own seed is ranked, any other is not", async () => {
  stub(() => ok(freshSession(777)));
  const { session } = setup();
  assert.equal(session.isRanked(777), false, "no session yet");
  await session.ensure();
  assert.equal(session.isRanked(777), true);
  assert.equal(session.isRanked(778), false);
  assert.equal(session.isRanked(null), false);
});

test("a session that is too old to be accepted does not rank a run", async () => {
  stub(() => ok({ ...freshSession(5), iat: Date.now() - 15 * 24 * 60 * 60 * 1000 }));
  const { session } = setup();
  await session.ensure();
  assert.equal(session.isRanked(5), false);
});

test("a failed or malformed answer is an error with the player's wording, and can be retried", async () => {
  let attempt = 0;
  stub(() => (++attempt === 1 ? new Response("no", { status: 500 }) : ok(freshSession())));
  const { session } = setup();
  await assert.rejects(session.ensure(), /Could not start a ranked game\./);
  assert.equal(session.current, null);
  await session.ensure();
  assert.ok(session.current);

  stub(() => ok({ seed: "not a number" }));
  const second = setup();
  await assert.rejects(second.session.ensure(), /Could not start/);
});

test("a slow reply cannot attach itself to a newer game", async () => {
  let release;
  stub(() => new Promise(resolve => { release = () => resolve(ok(freshSession(9))); }));
  const { session, state } = setup();
  const requested = session.ensure();
  state.generation = 2;                  // the player started another game meanwhile
  release();
  await requested;
  assert.equal(session.current, null, "the old game's session was not adopted");
  assert.equal(state.issued, 0);
});

test("a restored game keeps its saved session; a new one starts without", async () => {
  const calls = stub(() => ok(freshSession()));
  const { session } = setup();
  const saved = freshSession(4242);
  session.adopt(saved);
  assert.equal(session.current, saved);
  assert.equal(await session.ensure(), saved, "no request: the saved session is used");
  assert.equal(calls.length, 0);
  assert.equal(session.isRanked(4242), true);
  session.adopt(undefined);
  assert.equal(session.current, null);
  await session.ensure();
  assert.equal(calls.length, 1, "a new game asks the server");
});

test("withTimeout gives up on a promise that takes too long, and passes on one that does not", async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 20), /timeout/);
  assert.equal(await withTimeout(Promise.resolve(7), 50), 7);
  await assert.rejects(withTimeout(Promise.reject(new Error("boom")), 50), /boom/);
});

test("a random seed is an unsigned 32-bit integer", () => {
  for (let i = 0; i < 50; i++) {
    const seed = randomSeed();
    assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff);
  }
});
