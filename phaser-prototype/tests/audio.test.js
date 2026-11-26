import test from "node:test";
import assert from "node:assert/strict";

// A stand-in for the browser's audio: just enough to see what the game asks for.
function fakeBrowser({ context = true, autoplayRefused = true } = {}) {
  const log = { oscillators: 0, played: 0, paused: 0, listeners: {}, resumed: 0 };
  const node = () => ({
    gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
    frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    Q: { value: 0 },
    connect(target) { return target ?? this; },
    start() {}, stop() {}
  });
  class FakeContext {
    constructor() { this.state = "suspended"; this.currentTime = 0; this.sampleRate = 8000; this.destination = node(); FakeContext.last = this; }
    createGain() { return node(); }
    createOscillator() { log.oscillators++; return node(); }
    createBiquadFilter() { return node(); }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { return { ...node(), buffer: null }; }
    resume() { log.resumed++; this.state = "running"; return Promise.resolve(); }
    suspend() { log.suspended = (log.suspended || 0) + 1; this.state = "suspended"; return Promise.resolve(); }
  }
  class FakeAudio {
    constructor(src) { this.src = src; this.volume = 1; FakeAudio.last = this; }
    play() { log.played++; return autoplayRefused ? Promise.reject(new Error("NotAllowedError")) : Promise.resolve(); }
    pause() { log.paused++; }
  }
  globalThis.window = {
    AudioContext: context ? FakeContext : undefined,
    addEventListener: (type, fn) => { (log.listeners[type] ||= []).push(fn); },
    removeEventListener: (type, fn) => { log.listeners[type] = (log.listeners[type] || []).filter(other => other !== fn); }
  };
  globalThis.Audio = FakeAudio;
  globalThis.Element = class {};
  globalThis.localStorage = (() => {
    const data = new Map();
    return { getItem: key => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
  })();
  return { log, FakeContext, FakeAudio };
}

async function loadAudio(options, config = {}) {
  const browser = fakeBrowser(options);
  const { createAudio } = await import(`../src/audio.js?${Math.random()}`);
  const state = { stage: 1, menu: true, ...config };
  const audio = createAudio({ getStage: () => state.stage, isMenu: () => state.menu });
  return { audio, state, ...browser };
}

test("nothing makes a sound until the player has touched the page", async () => {
  const { audio, log } = await loadAudio();
  audio.playMerge(8);
  audio.playGolden();
  assert.equal(log.oscillators, 0, "no audio context yet, so nothing is created");
  audio.ensure();
  assert.equal(log.oscillators, 0);
});

test("the first touch unlocks the audio, and the menu track plays on the menu", async () => {
  const { audio, log, state } = await loadAudio({ autoplayRefused: false });
  const unlock = log.listeners.pointerdown[0];
  await unlock({ target: {} });
  assert.equal(log.resumed, 1);
  assert.ok(log.played >= 1, "the menu track starts");
  // Once unlocked the listeners go away.
  assert.equal(log.listeners.pointerdown.length, 0);
  assert.equal(audio.musicOn, true);
  assert.equal(state.menu, true);
});

test("music volume, sound effects and the piano are the audio module's to remember", async () => {
  const { audio } = await loadAudio();
  audio.ensure();
  assert.equal(audio.musicVolume, 100);
  audio.setMusicVolume(40);
  assert.equal(audio.musicVolume, 40);
  assert.equal(audio.musicOn, true);
  audio.setMusicVolume(0);
  assert.equal(audio.musicOn, false);
  audio.setMusicVolume(500);
  assert.equal(audio.musicVolume, 100);
  audio.setMusicVolume("not a number");
  assert.equal(audio.musicVolume, 0);

  assert.equal(audio.sfxOn, true);
  audio.setSfxEnabled(false);
  assert.equal(audio.sfxOn, false);
  assert.equal(localStorage.getItem("gardenEvolutionSfx"), "false");
  audio.setPianoEnabled(false);
  assert.equal(audio.pianoOn, false);
  assert.equal(localStorage.getItem("gardenEvolutionComboPiano"), "false");
});

test("with sound effects off a merge is silent", async () => {
  const { audio, log } = await loadAudio();
  audio.ensure();
  audio.setSfxEnabled(false);
  const before = log.oscillators;
  audio.playMerge(2048);
  assert.equal(log.oscillators, before);
  audio.setSfxEnabled(true);
  audio.playMerge(2048);
  assert.ok(log.oscillators > before);
});

test("gameplay music waits for the menu to be left and for a running context", async () => {
  const { audio, log, state } = await loadAudio();
  audio.ensure();
  audio.startMusic();           // still on the menu, context suspended
  assert.equal(log.oscillators, 0);
  state.menu = false;
  audio.startGameplayMusic();   // resumes the context, then starts the ambient bed
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(log.resumed >= 1);
  assert.ok(log.oscillators > 0, "the ambient bed is playing");
  audio.stopMusic();            // the bed reschedules itself; stop it so the test can end
});

test("a browser without Web Audio still lets the game run", async () => {
  const { audio } = await loadAudio({ context: false });
  assert.doesNotThrow(() => {
    audio.ensure();
    audio.playMerge(4);
    audio.playComboPiano(3, 2);
    audio.playStageRise(2);
    audio.startMusic();
    audio.startGameplayMusic();
    audio.stopMusic();
  });
});

// Leaving the game (another app, the home screen, another tab) must not leave
// its music playing over everything else.
test("when the game goes to the background the music stops and the audio sleeps, and it comes back after", async t => {
  const { audio, log, state, FakeContext } = await loadAudio({ autoplayRefused: false });
  t.after(() => audio.stopMusic());
  await log.listeners.pointerdown[0]({ target: {} });
  state.menu = false;
  audio.startGameplayMusic();
  await Promise.resolve();
  const before = log.oscillators;
  audio.setBackground(true);
  assert.equal(log.suspended, 1, "the audio context is put to sleep");
  assert.equal(FakeContext.last.state, "suspended");
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(log.oscillators, before, "no new notes are scheduled while away");
  audio.setBackground(false);
  await Promise.resolve();
  assert.equal(FakeContext.last.state, "running", "back: the audio wakes");
  assert.ok(log.oscillators > before, "and the garden's music carries on");
});

test("on the menu the menu track pauses in the background and plays again on return", async () => {
  const { audio, log } = await loadAudio({ autoplayRefused: false });
  await log.listeners.pointerdown[0]({ target: {} });
  const played = log.played;
  const paused = log.paused;
  audio.setBackground(true);
  assert.ok(log.paused > paused, "the menu track is paused");
  audio.setBackground(false);
  await Promise.resolve();
  assert.ok(log.played > played, "and plays again");
});

test("coming back does not start music the player turned off", async t => {
  const { audio, log, state } = await loadAudio({ autoplayRefused: false });
  t.after(() => audio.stopMusic());
  await log.listeners.pointerdown[0]({ target: {} });
  state.menu = false;
  audio.setMusicVolume(0);
  audio.setBackground(true);
  const played = log.played;
  const before = log.oscillators;
  audio.setBackground(false);
  await Promise.resolve();
  assert.equal(log.played, played);
  assert.equal(log.oscillators, before);
});
