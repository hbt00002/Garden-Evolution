import test from "node:test";
import assert from "node:assert/strict";
import { createToast, achievementLabel } from "../src/toast.js";
import { TRANSLATIONS } from "../src/i18n.js";

// A toast element with its three parts, and a clock the test moves by hand.
function fakeToastEl() {
  const part = () => ({ textContent: "", innerHTML: "", hidden: false });
  const parts = { ".toast-icon": part(), ".toast-label": part(), ".toast-name": part() };
  const classes = new Set();
  return {
    hidden: true,
    parts,
    querySelector: selector => parts[selector],
    classList: { add: n => classes.add(n), remove: n => classes.delete(n), contains: n => classes.has(n) }
  };
}
function fakeTimers() {
  let now = 0; let id = 0; const pending = new Map();
  return {
    setTimeout(fn, ms) { pending.set(++id, { at: now + ms, fn }); return id; },
    clearTimeout(handle) { pending.delete(handle); },
    tick(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...pending.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        pending.delete(due[0]); now = due[1].at; due[1].fn();
      }
      now = end;
    }
  };
}

test("a toast shows its name, its label and its icon", () => {
  const el = fakeToastEl(); const t = fakeTimers();
  createToast(el, { timers: t }).show("First Harvest", { label: "Achievement unlocked", icon: "<svg></svg>" });
  assert.equal(el.hidden, false);
  assert.ok(el.classList.contains("show"));
  assert.equal(el.parts[".toast-name"].textContent, "First Harvest");
  assert.equal(el.parts[".toast-label"].textContent, "Achievement unlocked");
  assert.equal(el.parts[".toast-label"].hidden, false);
  assert.equal(el.parts[".toast-icon"].innerHTML, "<svg></svg>");
});

test("a toast without a label hides the label line", () => {
  const el = fakeToastEl(); const t = fakeTimers();
  createToast(el, { timers: t }).show("Copied");
  assert.equal(el.parts[".toast-label"].hidden, true);
});

test("a toast waits while the combo badge shows, then appears", () => {
  let busy = true; const el = fakeToastEl(); const t = fakeTimers();
  createToast(el, { busy: () => busy, timers: t }).show("İlk Hasat", { label: "Başarım açıldı" });
  t.tick(600);
  assert.equal(el.hidden, true, "still waiting for the badge");
  busy = false; t.tick(200);
  assert.equal(el.hidden, false);
  assert.equal(el.parts[".toast-name"].textContent, "İlk Hasat");
});

test("two toasts show one after the other, none is lost", () => {
  const el = fakeToastEl(); const t = fakeTimers(); const toast = createToast(el, { timers: t });
  toast.show("A"); toast.show("B");
  assert.equal(el.parts[".toast-name"].textContent, "A");
  t.tick(2400 + 300);
  assert.equal(el.parts[".toast-name"].textContent, "B");
  assert.ok(el.classList.contains("show"));
  t.tick(2400 + 300);
  assert.equal(el.hidden, true);
});

test("a labelled toast stays 3.2 s, a plain one 2.4 s", () => {
  const el = fakeToastEl(); const t = fakeTimers();
  createToast(el, { timers: t }).show("X", { label: "L" });
  t.tick(3100); assert.ok(el.classList.contains("show"));
  t.tick(200); assert.ok(!el.classList.contains("show"));
  const plain = fakeToastEl(); const t2 = fakeTimers();
  createToast(plain, { timers: t2 }).show("Y");
  t2.tick(2300); assert.ok(plain.classList.contains("show"));
  t2.tick(200); assert.ok(!plain.classList.contains("show"));
});

test("achievementLabel takes the words before the name, in all ten languages", () => {
  for (const [lang, text] of Object.entries(TRANSLATIONS)) {
    const label = achievementLabel(text.achUnlocked);
    assert.ok(label.length > 0, lang);
    assert.doesNotMatch(label, /[:：{]\s*$/u, lang);
  }
  assert.equal(achievementLabel("Başarım açıldı: {name}"), "Başarım açıldı");
  assert.equal(achievementLabel("成就解锁：{name}"), "成就解锁");
});

test("an answer to a tap (urgent) shows at once, ahead of waiting toasts", () => {
  const el = fakeToastEl(); const t = fakeTimers(); const toast = createToast(el, { timers: t });
  toast.show("Achievement A", { label: "L" });
  toast.show("Achievement B", { label: "L" });
  t.tick(500);
  toast.show("Copied", { urgent: true });
  assert.equal(el.parts[".toast-name"].textContent, "Copied");
  t.tick(2400 + 300);
  assert.equal(el.parts[".toast-name"].textContent, "Achievement B", "the cut-short toast does not come back; the next waits its turn");
});

test("an urgent toast does not wait for the combo badge", () => {
  const el = fakeToastEl(); const t = fakeTimers();
  createToast(el, { busy: () => true, timers: t }).show("Copied", { urgent: true });
  assert.equal(el.hidden, false);
});
