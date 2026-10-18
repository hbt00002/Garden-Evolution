// Looking at the world instead of playing: the "View garden" mode and the
// short showcase when a new world unlocks.
//
// How it works. The world behind the game is a 16:9 painting drawn to fill the
// screen. On a phone held upright only a strip of it is visible, and the board
// covers the middle of that. To show the rest, this widens the world's canvas to
// the painting's own proportions (the same scale, so nothing changes size) and
// slides it sideways behind the screen. The scenes already redraw themselves
// when their canvas changes size, so none of them needed to change. On a screen
// that is already wide there is nothing to slide and the mode simply hides the
// game so the whole world can be enjoyed.
//
// Everything visual is CSS (see the "WORLD VIEW" block in style.css); this file
// owns the state and the motion, and the maths lives in pan.js.
import {
  clampOffset, dragOffset, easeInOutCubic, fractionForOffset, normalFocus, offsetForFraction, panExtent,
  positionAt, revealPath
} from "./pan.js";

const FADE_MS = 380;
const REVEAL_GRACE_MS = 600;   // a showcase cannot be skipped by the very tap that caused it
const REDUCED_REVEAL_MS = 2400;
const KEY_STEP = 140;

export function createWorldView({
  env, world, view, reveal, getStage, getMotion, announce, onChange = () => {}, text, canPan = () => true
}) {
  const track = view.querySelector("#gvTrack");
  const thumb = view.querySelector("#gvThumb");
  const back = view.querySelector("#gvBack");
  const drag = view.querySelector("#gvDrag");

  let mode = null;                 // "view" | "reveal" | null
  let extent = { canvasWidth: 0, maxOffset: 0 };
  let focus = 0.5;
  let offset = 0;
  let animation = 0;               // requestAnimationFrame id of a running motion
  let dragState = null;
  let inertia = 0;
  let timers = [];
  let returnFocus = null;
  let revealStartedAt = 0;
  let viewport = { width: 0, height: 0 };

  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const stopMotion = () => { cancelAnimationFrame(animation); animation = 0; inertia = 0; };
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));

  /* ---------- The world's canvas ---------- */

  function measure() {
    viewport = { width: window.innerWidth, height: window.innerHeight };
    // Without Phaser the backdrop is a fixed picture: there is nothing to slide.
    extent = canPan() ? panExtent(viewport.width, viewport.height) : { canvasWidth: viewport.width, maxOffset: 0 };
    focus = normalFocus(getStage(), viewport.width, viewport.height);
    offset = offsetForFraction(focus, extent.maxOffset);
  }

  function render() {
    world.style.transform = extent.maxOffset > 0 ? `translate3d(${-offset}px,0,0)` : "";
    if (extent.maxOffset > 0) {
      const share = viewport.width / extent.canvasWidth;
      thumb.style.width = `${share * 100}%`;
      thumb.style.left = `${fractionForOffset(offset, extent.maxOffset) * (1 - share) * 100}%`;
    }
  }

  // Let the engine redraw at the new size (and, if the living background is
  // off, wake it for a moment so the new size is actually painted).
  function resizeWorld() {
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new CustomEvent("garden:world-resized"));
  }

  function widen() {
    if (extent.maxOffset <= 0) return;
    env.style.setProperty("--world-w", `${extent.canvasWidth}px`);
    env.classList.add("wide");
    render();
    resizeWorld();
  }

  function narrow() {
    if (!env.classList.contains("wide")) { world.style.transform = ""; return; }
    env.classList.remove("wide");
    env.style.removeProperty("--world-w");
    world.style.transform = "";
    resizeWorld();
  }

  // Slide to a position with an ease, then call done.
  function glide(target, ms, done) {
    stopMotion();
    const from = offset;
    const started = performance.now();
    const step = now => {
      const t = Math.min(1, (now - started) / ms);
      offset = from + (target - from) * easeInOutCubic(t);
      render();
      if (t < 1) animation = requestAnimationFrame(step);
      else { animation = 0; done?.(); }
    };
    animation = requestAnimationFrame(step);
  }

  /* ---------- Entering and leaving ---------- */

  function setChrome(on, kind) {
    document.body.classList.toggle("world-focus", on);
    document.body.classList.toggle(kind, on);
  }

  async function begin(kind) {
    mode = kind;
    measure();
    returnFocus = document.activeElement;
    onChange(true);                 // input is blocked from this moment on
    widen();
    // Let the engine redraw at the new size before the game steps aside, but
    // never wait long: on a slow device the frames can be a while coming.
    await Promise.race([nextFrame().then(nextFrame), new Promise(resolve => later(resolve, 700))]);
    setChrome(true, kind === "view" ? "gv-active" : "wr-active");
  }

  function finish(kind, restoreFocusTo) {
    stopMotion();
    clearTimers();
    // Slide (or already rest) at the normal framing, then give the world its
    // normal size back: the two look identical, so there is no jump.
    narrow();
    setChrome(false, kind === "view" ? "gv-active" : "wr-active");
    mode = null;
    dragState = null;
    onChange(false);
    const target = restoreFocusTo ?? returnFocus;
    if (target && document.contains(target) && typeof target.focus === "function") target.focus({ preventScroll: true });
    returnFocus = null;
  }

  /* ---------- Garden view ---------- */

  async function enterView() {
    if (mode) return false;
    await begin("view");
    if (mode !== "view") return false;
    const pannable = extent.maxOffset > 0;
    view.hidden = false;
    view.classList.toggle("pannable", pannable);
    view.classList.remove("hint-done");
    await nextFrame();
    view.classList.add("show");
    render();
    announce?.(text("gvAnnounce"));
    back.focus({ preventScroll: true });
    if (pannable) later(() => view.classList.add("hint-done"), 3600);
    return true;
  }

  function exitView(restoreFocusTo) {
    if (mode !== "view") return;
    stopMotion();
    clearTimers();
    view.classList.remove("show");
    const rest = () => later(() => {
      view.hidden = true;
      finish("view", restoreFocusTo);
    }, FADE_MS);
    if (extent.maxOffset > 0 && Math.abs(offset - offsetForFraction(focus, extent.maxOffset)) > 1) {
      glide(offsetForFraction(focus, extent.maxOffset), 420, rest);
    } else rest();
  }

  const pointerDown = event => {
    if (mode !== "view" || extent.maxOffset <= 0) return;
    stopMotion();
    dragState = { startX: event.clientX, startOffset: offset, lastX: event.clientX, lastT: event.timeStamp, velocity: 0 };
    drag.setPointerCapture?.(event.pointerId);
    view.classList.add("hint-done", "dragging");
  };
  const pointerMove = event => {
    if (!dragState) return;
    offset = dragOffset(dragState.startOffset, dragState.startX, event.clientX, extent.maxOffset);
    const dt = Math.max(1, event.timeStamp - dragState.lastT);
    dragState.velocity = 0.8 * dragState.velocity + 0.2 * ((dragState.lastX - event.clientX) / dt);
    dragState.lastX = event.clientX;
    dragState.lastT = event.timeStamp;
    render();
  };
  const pointerUp = () => {
    if (!dragState) return;
    inertia = dragState.velocity;
    dragState = null;
    view.classList.remove("dragging");
    if (Math.abs(inertia) < 0.05) return;
    let last = performance.now();
    const coast = now => {
      const dt = now - last;
      last = now;
      offset = clampOffset(offset + inertia * dt, extent.maxOffset);
      inertia *= Math.pow(0.94, dt / 16);
      render();
      if (Math.abs(inertia) > 0.02 && offset > 0 && offset < extent.maxOffset) animation = requestAnimationFrame(coast);
      else animation = 0;
    };
    animation = requestAnimationFrame(coast);
  };
  drag.addEventListener("pointerdown", pointerDown);
  drag.addEventListener("pointermove", pointerMove);
  drag.addEventListener("pointerup", pointerUp);
  drag.addEventListener("pointercancel", pointerUp);
  back.addEventListener("click", () => exitView());

  /* ---------- The showcase when a world unlocks ---------- */

  async function showReveal(stage, copy) {
    if (mode) return false;
    const { reduced } = getMotion();
    await begin("reveal");
    if (mode !== "reveal") return false;
    const pannable = extent.maxOffset > 0 && !reduced;
    if (!pannable) narrow();
    reveal.querySelector("#wrKicker").textContent = copy.kicker;
    reveal.querySelector("#wrName").textContent = copy.name;
    reveal.querySelector("#wrLine").textContent = copy.line;
    const path = revealPath(focus, { pannable });
    const duration = reduced ? REDUCED_REVEAL_MS : path.duration + 500;
    reveal.style.setProperty("--wr-ms", `${duration}ms`);
    reveal.hidden = false;
    reveal.classList.remove("show");
    await nextFrame();
    reveal.classList.add("show");
    revealStartedAt = performance.now();

    if (pannable) {
      const tick = now => {
        offset = offsetForFraction(positionAt(path, now - revealStartedAt), extent.maxOffset);
        render();
        animation = requestAnimationFrame(tick);
      };
      animation = requestAnimationFrame(tick);
    }
    later(() => endReveal(), duration);
    return true;
  }

  function endReveal() {
    if (mode !== "reveal") return;
    stopMotion();
    clearTimers();
    reveal.classList.remove("show");
    // Land exactly on the normal framing before the canvas goes back to normal size.
    offset = offsetForFraction(focus, extent.maxOffset);
    render();
    later(() => {
      reveal.hidden = true;
      finish("reveal");
    }, FADE_MS);
  }

  const skipReveal = () => {
    if (mode === "reveal" && performance.now() - revealStartedAt > REVEAL_GRACE_MS) endReveal();
  };
  reveal.addEventListener("click", skipReveal);

  /* ---------- Keyboard, resizing, leaving the page ---------- */

  document.addEventListener("keydown", event => {
    if (mode === "view") {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); exitView(); return; }
      const step = { ArrowLeft: -KEY_STEP, ArrowRight: KEY_STEP }[event.key];
      if (step && extent.maxOffset > 0) {
        event.preventDefault();
        glide(clampOffset(offset + step, extent.maxOffset), 240);
        view.classList.add("hint-done");
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        glide(event.key === "Home" ? 0 : extent.maxOffset, 520);
      } else if (event.key.startsWith("Arrow")) {
        event.preventDefault();
      }
    } else if (mode === "reveal") {
      if (["Escape", "Enter", " "].includes(event.key)) { event.preventDefault(); event.stopPropagation(); skipReveal(); }
      else if (event.key.startsWith("Arrow")) event.preventDefault();
    }
  }, true);

  // Turning the phone or resizing the window changes how much of the painting
  // fits: a showcase just ends; the garden view measures again.
  window.addEventListener("resize", () => {
    if (!mode) return;
    if (window.innerWidth === viewport.width && window.innerHeight === viewport.height) return;
    if (mode === "reveal") { endReveal(); return; }
    const was = fractionForOffset(offset, extent.maxOffset);
    narrow();
    measure();
    view.classList.toggle("pannable", extent.maxOffset > 0);
    offset = offsetForFraction(extent.maxOffset > 0 ? was : focus, extent.maxOffset);
    widen();
    render();
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && mode === "reveal") endReveal(); });

  return {
    get active() { return mode !== null; },
    get mode() { return mode; },
    enterView,
    exitView,
    showReveal,
    skipReveal,
    cancel() {
      if (mode === "view") exitView();
      else if (mode === "reveal") endReveal();
    }
  };
}
