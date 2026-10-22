import test from "node:test";
import assert from "node:assert/strict";
import { createDialogs } from "../src/dialogs.js";

class FakeElement {
  constructor(name, { hidden = true, focusables = [] } = {}) {
    this.name = name; this.hidden = hidden; this.inert = false; this.textContent = "";
    this.focusables = focusables;
  }
  querySelectorAll() { return this.focusables; }
}

const control = name => ({ name, getClientRects: () => [1], focus() { control.focused = name; } });

function setup({ viewActive = false } = {}) {
  const documentListeners = [];
  const observed = [];
  globalThis.document = {
    body: {},
    activeElement: null,
    addEventListener: (type, fn) => documentListeners.push([type, fn])
  };
  globalThis.MutationObserver = class { constructor(fn) { this.fn = fn; observed.push(this); } observe() {} };
  globalThis.requestAnimationFrame = fn => fn();
  const els = {
    main: new FakeElement("main", { hidden: false }),
    startScreen: new FakeElement("start"),
    restart: new FakeElement("restart"),
    settings: new FakeElement("settings", { focusables: [control("a"), control("b"), control("c")] }),
    leaderboard: new FakeElement("leaderboard", { focusables: [control("x"), control("y")] }),
    achievements: new FakeElement("achievements", { focusables: [control("close")] }),
    scoreConfirm: new FakeElement("confirm", { focusables: [control("no"), control("yes")] }),
    endCard: new FakeElement("end", { focusables: [control("again")] }),
    announcer: new FakeElement("announcer")
  };
  const state = { view: viewActive };
  const dialogs = createDialogs({ elements: els, viewActive: () => state.view });
  const tab = (shiftKey = false) => {
    const event = { key: "Tab", shiftKey, prevented: false, preventDefault() { this.prevented = true; } };
    documentListeners.filter(([type]) => type === "keydown").forEach(([, fn]) => fn(event));
    return event;
  };
  return { dialogs, els, state, observed, tab };
}

test("with nothing open the game is reachable and moves are not blocked", () => {
  const t = setup();
  t.dialogs.sync();
  assert.equal(t.els.main.inert, false);
  assert.equal(t.els.startScreen.inert, false);
  assert.equal(t.dialogs.blocking(), false);
  assert.equal(t.dialogs.menusOpen(), false);
  assert.equal(t.dialogs.topDialog(), null);
});

test("behind the start menu the game is inert", () => {
  const t = setup();
  t.els.startScreen.hidden = false;
  t.dialogs.sync();
  assert.equal(t.els.main.inert, true);
  assert.equal(t.els.startScreen.inert, false, "the menu itself stays usable");
});

test("a modal makes both the game and the start menu inert", () => {
  for (const modal of ["settings", "leaderboard", "scoreConfirm"]) {
    const t = setup();
    t.els.startScreen.hidden = false;
    t.els[modal].hidden = false;
    t.dialogs.sync();
    assert.equal(t.els.main.inert, true, modal);
    assert.equal(t.els.startScreen.inert, true, modal);
  }
});

test("the restart prompt and the end card block moves but do not make anything inert", () => {
  const t = setup();
  t.els.restart.hidden = false;
  t.dialogs.sync();
  assert.equal(t.els.main.inert, false);
  assert.equal(t.dialogs.blocking(), true);
  t.els.restart.hidden = true;
  t.els.endCard.hidden = false;
  assert.equal(t.dialogs.blocking(), true);
  assert.equal(t.dialogs.menusOpen(), false, "the end card is not one of the menus that pause the combo");
});

test("the garden view or a world showcase blocks moves and makes the game inert", () => {
  const t = setup({ viewActive: true });
  t.dialogs.sync();
  assert.equal(t.els.main.inert, true);
  assert.equal(t.dialogs.blocking(), true);
  t.state.view = false;
  t.dialogs.sync();
  assert.equal(t.els.main.inert, false);
});

test("the page keeps itself in step by watching for dialogs being shown or hidden", () => {
  const t = setup();
  assert.equal(t.observed.length, 1);
  t.els.settings.hidden = false;
  t.observed[0].fn();
  assert.equal(t.els.main.inert, true);
});

test("the topmost dialog is the one whose controls Tab cycles through", () => {
  const t = setup();
  t.els.endCard.hidden = false;
  assert.equal(t.dialogs.topDialog(), t.els.endCard);
  t.els.settings.hidden = false;
  assert.equal(t.dialogs.topDialog(), t.els.settings);
  t.els.leaderboard.hidden = false;
  assert.equal(t.dialogs.topDialog(), t.els.leaderboard);
  t.els.scoreConfirm.hidden = false;
  assert.equal(t.dialogs.topDialog(), t.els.scoreConfirm);
});

test("Tab wraps inside an open dialog, and is left alone with none open", () => {
  const t = setup();
  assert.equal(t.tab().prevented, false, "no dialog: the browser decides");
  t.els.leaderboard.hidden = false;
  const [x, y] = t.els.leaderboard.focusables;
  document.activeElement = y;
  assert.equal(t.tab().prevented, true);
  assert.equal(control.focused, "x", "from the last control to the first");
  document.activeElement = x;
  t.tab(true);
  assert.equal(control.focused, "y", "Shift+Tab from the first goes to the last");
});

test("the restart prompt does its own focus trap, so this one stays out of the way", () => {
  const t = setup();
  t.els.restart.hidden = false;
  t.els.settings.hidden = false;
  assert.equal(t.tab().prevented, false);
});

test("an announcement is cleared first, then set, so a repeat is read again", () => {
  const t = setup();
  const frames = [];
  globalThis.requestAnimationFrame = fn => frames.push(fn);
  t.dialogs.announce("Spring Bloom");
  assert.equal(t.els.announcer.textContent, "");
  frames[0]();
  assert.equal(t.els.announcer.textContent, "Spring Bloom");
});
