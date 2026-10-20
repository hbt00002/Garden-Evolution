// The small visual flourishes of the world behind the game: the soft veil when
// a new world arrives, drifting glyphs that come and go, and a gust of wind.
// They are all light CSS-class and element tricks, and all stay quiet when the
// player (or their system) wants little movement.

const EVENT_GLYPHS = ["✦", "●", "✿", "❀", "✧"];
const EVENT_COLORS = ["#eff9ff", "#82b85f", "#f5d76f", "#f39abb", "#ffe98f"];

// env: the #env element; layer: where the drifting glyphs are added;
// prefs: see preferences.js; getStage(): which world is showing (1-5).
export function createWorldEffects({ env, layer, prefs, getStage }) {
  let eventTimer = null;
  let eventClassTimer = null;
  let veilTimer = null;
  let gustTimer = null;

  // A compositor-only veil softens the scene swap without text, layout work
  // or a synchronous reflow. The game UI remains stable and interactive.
  function transition() {
    env.classList.remove("stage-soft-transition");
    clearTimeout(veilTimer);
    requestAnimationFrame(() => env.classList.add("stage-soft-transition"));
    veilTimer = setTimeout(() => {
      env.classList.remove("stage-soft-transition");
    }, prefs.calm ? 100 : 390);
  }

  // Subtle gust: briefly intensify particle drift via a CSS class
  function gust(strong) {
    if (prefs.reduceMotion) return;
    env.classList.add(strong ? "gust-strong" : "gust");
    clearTimeout(gustTimer);
    gustTimer = setTimeout(() => {
      env.classList.remove("gust", "gust-strong");
    }, strong ? 1800 : 1200);
  }

  function event(stage, strong) {
    if (prefs.calm || !prefs.particlesOn || document.hidden) return;
    const count = document.body.classList.contains("perf-low") ? 3 : (strong ? 8 : 5);
    env.classList.remove("event-stage-1", "event-stage-2", "event-stage-3", "event-stage-4", "event-stage-5");
    env.classList.add(`event-stage-${stage}`);
    clearTimeout(eventClassTimer);
    eventClassTimer = setTimeout(() => env.classList.remove(`event-stage-${stage}`), 3600);
    for (let i = 0; i < count; i++) {
      const mote = document.createElement("span");
      mote.className = "world-event";
      mote.textContent = EVENT_GLYPHS[stage - 1];
      mote.style.setProperty("--x", `${8 + Math.random() * 84}%`);
      mote.style.setProperty("--y", `${55 + Math.random() * 38}%`);
      mote.style.setProperty("--drift", `${-70 + Math.random() * 140}px`);
      mote.style.setProperty("--size", `${10 + Math.random() * 13}px`);
      mote.style.setProperty("--event-color", EVENT_COLORS[stage - 1]);
      mote.style.animationDelay = `${Math.random() * .8}s`;
      layer.appendChild(mote);
      mote.addEventListener("animationend", () => mote.remove(), { once: true });
    }
    gust(stage >= 4 || strong);
  }

  // Every 15-29 seconds the world does something small on its own.
  function schedule() {
    clearTimeout(eventTimer);
    eventTimer = setTimeout(() => {
      event(getStage(), false);
      schedule();
    }, 15000 + Math.random() * 14000);
  }

  return { transition, gust, event, schedule };
}
