// What the board looks like: the grid of cells, the tiles sitting on them, the
// puffs of particles when tiles merge and the burst for the Golden Tree. It
// knows nothing of the rules; the game tells it which tile to create, move,
// merge or remove, by id, and asks it what a tile's value is.
//
// Layout. Single source of truth: CSS provides --gap and the board is square
// with padding = --gap. The inner play area (the tiles container) is inset by
// --gap, so its width = boardWidth - 2*gap. Each cell = (inner - 3*gap)/4.
// Tiles are absolutely positioned with width/height = cellSize and translate by
// gap + c*(cellSize+gap). This guarantees exact alignment.
import { BOARD_SIZE } from "./board.js";
import { artValueFor, levelFor, tileLabel } from "./levels.js";

const MERGE_MS = 210;
const STAGE_PARTICLES = ["stage-snow", "stage-leaf", "stage-pollen", "stage-petal", "stage-star"];

// board, grid, tiles: the board element, its background grid and the layer the
// tiles live in. prefs: see preferences.js. tileArt: see tile-art.js.
// language(): the current language code. getStage(): the world showing (1-5).
export function createBoardView({ board, grid: gridEl, tiles: tilesEl, prefs, tileArt, language, getStage }) {
  const tiles = new Map();      // id -> { value, r, c, el }
  let nextId = 1;
  let cellSize = 0;
  let gap = 10;

  /* ---------- Layout ---------- */
  function measure() {
    gap = parseFloat(getComputedStyle(board).getPropertyValue("--gap")) || 10;
    const inner = board.clientWidth - 2 * gap;
    cellSize = (inner - 3 * gap) / 4;
  }

  function cellPos(r, c) {
    // Keep settled tiles on the physical pixel grid. Fractional CSS transforms
    // can leave a pixel-art PNG on a bilinear compositing layer, which made an
    // occasional seed look softer depending on the cell and viewport width.
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const snap = value => Math.round(value * dpr) / dpr;
    return {
      x: snap(c * (cellSize + gap)),
      y: snap(r * (cellSize + gap))
    };
  }

  // Lay every tile out again for the board's current size, without animating.
  function relayout() {
    measure();
    for (const t of tiles.values()) {
      const p = cellPos(t.r, t.c);
      t.el.style.transition = "none";
      t.el.style.width = cellSize + "px";
      t.el.style.height = cellSize + "px";
      t.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      const num = t.el.querySelector(".t-num");
      if (num) num.style.fontSize = Math.max(9, cellSize * 0.13) + "px";
    }
    void tilesEl.offsetWidth;
    for (const t of tiles.values()) t.el.style.transition = "";
  }

  // Keep the tiles on the cells as the board changes size: a window resize, and
  // also the board itself resizing without one (a phone browser's toolbar
  // sliding away, the safe areas, fonts settling, a dialog closing).
  function watchSize() {
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(relayout, 80);
    });
    if (typeof ResizeObserver === "function") {
      let layoutFrame = 0;
      let lastBoardWidth = board.clientWidth;
      new ResizeObserver(() => {
        if (board.clientWidth === lastBoardWidth) return;
        lastBoardWidth = board.clientWidth;
        cancelAnimationFrame(layoutFrame);
        layoutFrame = requestAnimationFrame(relayout);
      }).observe(board);
    }
  }

  function buildGrid() {
    gridEl.innerHTML = "";
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      gridEl.appendChild(cell);
    }
  }

  /* ---------- Tiles ---------- */
  function renderTileContent(el, value) {
    const lvl = levelFor(value);
    const { sprite, assetValue } = artValueFor(value);
    el.dataset.value = value;
    el.dataset.tier = sprite + 1;
    el.style.background = lvl.bg;
    el.style.setProperty("--fg", lvl.fg);
    el.setAttribute("aria-label", tileLabel(value, language()));
    el.classList.toggle("glow", value >= 512);
    el.classList.toggle("golden", value >= 2048);
    let num = el.querySelector(".t-num");
    if (!num) {
      num = document.createElement("span");
      num.className = "t-num";
      el.appendChild(num);
    }
    num.textContent = value;
    el.style.overflow = "hidden";
    tileArt.attach(el, assetValue);
  }

  // Removes every tile and particle (a new game, or a restored board is about to be dealt).
  function reset() {
    tiles.clear();
    nextId = 1;
    tilesEl.innerHTML = "";
    board.querySelectorAll(".particle").forEach(p => p.remove());
    tilesEl.querySelectorAll(".particle").forEach(p => p.remove());
  }

  // Puts a new tile on a cell and returns its id.
  function create(r, c, value, isNew) {
    const id = nextId++;
    const el = document.createElement("div");
    el.className = "tile";
    if (isNew) el.classList.add("spawn");
    renderTileContent(el, value);
    const p = cellPos(r, c);
    const tx = `translate(${p.x}px, ${p.y}px)`;
    el.style.setProperty("--tx", tx);
    el.style.width = cellSize + "px";
    el.style.height = cellSize + "px";
    el.style.transform = tx;
    tilesEl.appendChild(el);
    if (isNew && !prefs.reduceMotion) {
      el.addEventListener("animationend", () => el.classList.remove("spawn"), { once: true });
    } else {
      el.classList.remove("spawn");
    }
    tiles.set(id, { value, r, c, el });
    return id;
  }

  // Slides a tile to a cell.
  function place(id, r, c) {
    const t = tiles.get(id);
    if (!t) return;
    t.r = r; t.c = c;
    const p = cellPos(r, c);
    const tx = `translate(${p.x}px, ${p.y}px)`;
    t.el.style.setProperty("--tx", tx);
    t.el.style.transform = tx;
  }

  function remove(id) {
    const t = tiles.get(id);
    if (!t) return;
    t.el.remove();
    tiles.delete(id);
  }

  // The tile took on a new value: new picture and colours, and a little pulse.
  // Returns false if there is no such tile.
  function merge(id, value) {
    const t = tiles.get(id);
    if (!t) return false;
    t.value = value;
    renderTileContent(t.el, value);
    t.el.classList.add("merge");
    setTimeout(() => t.el && t.el.classList.remove("merge"), MERGE_MS);
    return true;
  }

  const valueOf = id => tiles.get(id).value;

  // The language changed: every tile gets its name in the new one.
  function relabel() {
    for (const t of tiles.values()) t.el.setAttribute("aria-label", tileLabel(t.value, language()));
  }

  /* ---------- Particles ---------- */
  function puff(r, c, value) {
    if (prefs.reduceMotion || !prefs.particlesOn) return;
    const p = cellPos(r, c);
    const cx = p.x + cellSize / 2;
    const cy = p.y + cellSize / 2;
    const count = value >= 1024 ? 10 : value >= 256 ? 7 : 5;
    const golden = value >= 2048;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement("div");
      const stageParticle = STAGE_PARTICLES[Math.max(0, getStage() - 1)];
      dot.className = `particle ${stageParticle}` + (golden ? " gold" : "");
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const dist = cellSize * (0.35 + Math.random() * 0.35);
      dot.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      dot.style.setProperty("--dy", Math.sin(ang) * dist - cellSize * 0.15 + "px");
      dot.style.left = cx + "px";
      dot.style.top = cy + "px";
      tilesEl.appendChild(dot);
      dot.addEventListener("animationend", () => dot.remove(), { once: true });
    }
  }

  // The Golden Tree: the board glows and a ring of gold bursts from its middle.
  function celebrate() {
    board.classList.add("celebrate");
    setTimeout(() => board.classList.remove("celebrate"), 1600);
    const cx = tilesEl.clientWidth / 2;
    const cy = tilesEl.clientHeight / 2;
    for (let i = 0; i < 22; i++) {
      const dot = document.createElement("div");
      dot.className = "particle gold big";
      const ang = Math.random() * Math.PI * 2;
      const dist = board.clientWidth * (0.25 + Math.random() * 0.3);
      dot.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      dot.style.setProperty("--dy", Math.sin(ang) * dist + "px");
      dot.style.left = cx + "px";
      dot.style.top = cy + "px";
      tilesEl.appendChild(dot);
      dot.addEventListener("animationend", () => dot.remove(), { once: true });
    }
  }

  return { buildGrid, measure, relayout, watchSize, reset, create, place, remove, merge, valueOf, relabel, puff, celebrate };
}
