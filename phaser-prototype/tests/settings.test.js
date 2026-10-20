import test from "node:test";
import assert from "node:assert/strict";
import { createPreferences } from "../src/preferences.js";
import { createSettingsPanel } from "../src/settings-panel.js";

function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  globalThis.localStorage = { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
  return data;
}

const media = matches => {
  const listeners = [];
  return {
    query: () => ({ matches, addEventListener: (type, fn) => listeners.push(fn) }),
    change: value => listeners.forEach(fn => fn({ matches: value }))
  };
};

/* ---------- Preferences ---------- */

test("preferences start from what the player chose last time, with sensible defaults", () => {
  storage();
  const fresh = createPreferences({ matchMedia: media(false).query });
  assert.deepEqual([fresh.motionOn, fresh.particlesOn, fresh.contrastOn, fresh.revealOn], [true, true, false, false]);

  storage({ gardenEvolutionMotion: "false", gardenEvolutionContrast: "true", gardenEvolutionReveal: "true" });
  const saved = createPreferences({ matchMedia: media(false).query });
  assert.deepEqual([saved.motionOn, saved.particlesOn, saved.contrastOn, saved.revealOn], [false, true, true, true]);
});

test("a toggle flips the preference, remembers it and says what it is now", () => {
  const data = storage();
  const prefs = createPreferences({ matchMedia: media(false).query });
  assert.equal(prefs.toggle("particles"), false);
  assert.equal(prefs.particlesOn, false);
  assert.equal(data.get("gardenEvolutionParticles"), "false");
  assert.equal(prefs.toggle("particles"), true);
  assert.equal(prefs.toggle("reveal"), true);
  assert.equal(data.get("gardenEvolutionReveal"), "true");
  assert.throws(() => prefs.toggle("volume"), /Unknown preference/);
});

test("calm means the system asks for less movement or the player turned motion off", () => {
  storage();
  const system = media(false);
  const prefs = createPreferences({ matchMedia: system.query });
  assert.equal(prefs.calm, false);
  system.change(true);
  assert.equal(prefs.reduceMotion, true);
  assert.equal(prefs.calm, true);
  system.change(false);
  assert.equal(prefs.calm, false);
  prefs.toggle("motion");
  assert.equal(prefs.calm, true);
});

/* ---------- The panel ---------- */

class FakeElement {
  constructor() {
    this.hidden = true; this.value = ""; this.textContent = ""; this.listeners = {}; this.attributes = {}; this.classes = new Set();
    this.style = { removeProperty: name => { delete this.style[name]; } };
    this.focused = 0;
  }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() { this.focused++; }
  contains(other) { return other === this; }
  getBoundingClientRect() { return { left: 40, bottom: 60, height: 300 }; }
  get classList() { return { toggle: (name, on) => (on ? this.classes.add(name) : this.classes.delete(name)), contains: name => this.classes.has(name) }; }
  fire(type, event = {}) { (this.listeners[type] || []).forEach(fn => fn({ stopPropagation() {}, currentTarget: this, target: this, ...event })); }
}

function setupPanel({ menu = false } = {}) {
  storage();
  globalThis.window = { innerWidth: 390, innerHeight: 700 };
  const documentListeners = {};
  globalThis.document = { addEventListener: (type, fn) => { (documentListeners[type] ||= []).push(fn); } };
  globalThis.requestAnimationFrame = fn => fn();
  const names = ["button", "startButton", "panel", "backdrop", "closeButton", "musicVolume", "musicVolumeValue", "piano", "sfx", "motion", "particles", "contrast", "reveal", "language"];
  const elements = Object.fromEntries(names.map(name => [name, new FakeElement()]));
  const log = { opened: 0, visual: 0, inert: 0, language: [], audio: [] };
  const state = { menu };
  const audio = {
    musicVolume: 100, pianoOn: true, sfxOn: true,
    ensure: () => log.audio.push("ensure"),
    setMusicVolume(value) { this.musicVolume = Number(value); log.audio.push(["volume", Number(value)]); },
    setPianoEnabled(on) { this.pianoOn = on; },
    setSfxEnabled(on) { this.sfxOn = on; }
  };
  const prefs = createPreferences({ matchMedia: media(false).query });
  const panel = createSettingsPanel({
    elements, audio, prefs,
    applyLanguage: code => log.language.push(code),
    hooks: { onOpen: () => log.opened++, onVisualChange: () => log.visual++, startMenuShowing: () => state.menu },
    syncInert: () => log.inert++
  });
  return { elements, panel, log, state, audio, prefs, documentListeners };
}

test("in the game the panel opens as a popover under the gear, and gives focus back when it closes", () => {
  const t = setupPanel();
  t.elements.button.fire("click");
  assert.equal(t.panel.isOpen(), true);
  assert.equal(t.log.opened, 1);
  assert.ok(t.elements.panel.classes.has("settings-panel--popover"));
  assert.equal(t.elements.panel.style.top, "69px");
  assert.equal(t.elements.backdrop.hidden, true, "no backdrop for a popover");
  assert.equal(t.elements.button.attributes["aria-expanded"], "true");
  assert.equal(t.elements.closeButton.focused, 1);
  const before = t.elements.button.focused;
  t.elements.closeButton.fire("click");
  assert.equal(t.panel.isOpen(), false);
  assert.equal(t.elements.button.focused, before + 1, "the gear gets focus back");
});

test("on the start menu it is a dialog with a backdrop, and focus returns to the menu's button", () => {
  const t = setupPanel({ menu: true });
  t.elements.startButton.fire("click");
  assert.equal(t.panel.isOpen(), true);
  assert.equal(t.elements.panel.classes.has("settings-panel--popover"), false);
  assert.equal(t.elements.backdrop.hidden, false);
  t.panel.close();
  assert.equal(t.elements.startButton.focused, 1);
});

test("a click outside closes it, a click inside does not", () => {
  const t = setupPanel();
  t.elements.button.fire("click");
  const outside = { target: new FakeElement() };
  t.documentListeners.click.forEach(fn => fn(outside));
  assert.equal(t.panel.isOpen(), false);
  t.elements.button.fire("click");
  t.documentListeners.click.forEach(fn => fn({ target: t.elements.panel }));
  assert.equal(t.panel.isOpen(), true);
});

test("a panel taller than the screen is kept on it", () => {
  const t = setupPanel();
  globalThis.window.innerHeight = 360;
  t.elements.button.fire("click");
  assert.equal(t.elements.panel.style.maxHeight, "344px");
  assert.equal(t.elements.panel.style.top, "52px", "moved up so the 300 px panel fits above the bottom edge");
});

test("the controls show and change the real settings", () => {
  const t = setupPanel();
  t.panel.sync();
  assert.equal(t.elements.musicVolume.value, "100");
  assert.equal(t.elements.musicVolumeValue.textContent, "100%");
  assert.equal(t.elements.piano.attributes["aria-checked"], "true");
  assert.equal(t.elements.reveal.attributes["aria-checked"], "false");
  assert.ok(t.elements.reveal.classes.has("off"));

  t.elements.musicVolume.value = "35";
  t.elements.musicVolume.fire("input");
  assert.equal(t.audio.musicVolume, 35);
  assert.equal(t.elements.musicVolumeValue.textContent, "35%");

  t.elements.sfx.fire("click");
  assert.equal(t.audio.sfxOn, false);
  assert.equal(t.elements.sfx.attributes["aria-checked"], "false");

  t.elements.particles.fire("click");
  assert.equal(t.prefs.particlesOn, false);
  assert.equal(t.log.visual, 1, "the page is told to restyle");
  t.elements.reveal.fire("click");
  assert.equal(t.prefs.revealOn, true);
  assert.equal(t.log.visual, 1, "the world reveal needs no restyle");
  assert.equal(t.elements.reveal.attributes["aria-checked"], "true");

  t.elements.language.value = "tr";
  t.elements.language.fire("change");
  assert.deepEqual(t.log.language, ["tr"]);
});
