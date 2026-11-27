// A short message that appears in the combo badge's place, under the board (at
// the top of the screen when the board is covered), and goes away by itself.
// A medal in front: an icon on gold. An achievement has two lines, a small
// "Achievement unlocked" and its name, and stays a little longer.
// The element is a live region, so screen readers announce it too.
//
// Messages wait their turn: one at a time, and none while the combo badge is
// on screen (busy()), so the two never sit on top of each other.
export function createToast(el, { showMs = 2400, longMs = 3200, fadeMs = 300, busy = () => false, pollMs = 200, timers = globalThis } = {}) {
  const iconEl = el.querySelector(".toast-icon");
  const labelEl = el.querySelector(".toast-label");
  const nameEl = el.querySelector(".toast-name");
  const queue = [];
  let showing = false;
  let waiting = null;
  let timer = null;

  function display({ name, label, icon }) {
    showing = true;
    nameEl.textContent = name;
    labelEl.textContent = label;
    labelEl.hidden = !label;
    iconEl.innerHTML = icon;
    el.hidden = false;
    void el.offsetWidth;            // let the entrance transition start from hidden
    el.classList.add("show");
    timer = timers.setTimeout(() => {
      el.classList.remove("show");
      timer = timers.setTimeout(() => {
        el.hidden = true;
        showing = false;
        timer = null;
        next();
      }, fadeMs);
    }, label ? longMs : showMs);
  }

  function next() {
    waiting = null;
    if (showing || !queue.length) return;
    if (busy()) { waiting = timers.setTimeout(next, pollMs); return; }
    display(queue.shift());
  }

  return {
    // name: the message (or an achievement's name); label: the small line
    // above it; icon: an HTML string (a pixel icon or a plant picture).
    // urgent: the answer to something the player just did (Share): it shows
    // at once, cutting short whatever is on screen, and waits for nothing.
    show(name, { label = "", icon = "", urgent = false } = {}) {
      const item = { name, label, icon };
      if (urgent) {
        timers.clearTimeout(timer);
        timers.clearTimeout(waiting);
        waiting = null;
        display(item);
        return;
      }
      queue.push(item);
      if (!waiting) next();
    }
  };
}

// "Achievement unlocked: {name}" → "Achievement unlocked" (every language puts
// the name last, after a colon).
export const achievementLabel = template => template.split("{name}")[0].replace(/[\s:：]+$/u, "");
