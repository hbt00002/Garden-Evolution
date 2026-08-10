"use strict";

/* ============================================================
   Garden Evolution — a relaxing 2048-inspired garden game
   Pure vanilla JS. No backend, no build step.
   ============================================================ */

(() => {
  const SIZE = 4;
  const SLIDE_MS = 150;
  const MERGE_MS = 260;
  const SWIPE_THRESHOLD = 24;

  /* ---------- Evolution chain ----------
     Each tile gets a distinct background tone and inline SVG art.
     bg = tile fill; fg = number text color on that fill.
  */
  const LEVELS = [
    { v: 2, name: "Seed", bg: "#efe0c6", fg: "#7a5c34",
      svg: `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="78" rx="20" ry="7" fill="#8c6438" opacity=".35"/><path d="M50 22 C30 22 24 50 32 72 C36 82 64 82 68 72 C76 50 70 22 50 22 Z" fill="#b87e44"/><path d="M44 26 C32 30 28 52 34 68 C37 76 46 76 44 26 Z" fill="#d49b59" opacity=".75"/><path d="M50 22 Q58 35 52 50" stroke="#7a4e22" stroke-width="3" stroke-linecap="round" fill="none" opacity=".6"/><circle cx="48" cy="22" r="3.5" fill="#8cc152"/></svg>` },
    { v: 4, name: "Sprout", bg: "#e6f0cf", fg: "#5d7a2e",
      svg: `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="80" rx="26" ry="8" fill="#6b8b3a" opacity=".3"/><path d="M30 80 Q50 74 70 80 Q50 86 30 80Z" fill="#a07446"/><path d="M50 80 Q48 50 50 34" stroke="#689932" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M50 48 C25 40 18 18 48 30 C48 42 36 50 50 48 Z" fill="#7ab648"/><path d="M50 48 C75 40 82 18 52 30 C52 42 64 50 50 48 Z" fill="#9dd35a"/><path d="M48 30 Q34 32 26 26" stroke="#bfe07a" stroke-width="2" fill="none" opacity=".8"/></svg>` },
    { v: 8, name: "Young Plant", bg: "#d6efda", fg: "#3f6b35",
      svg: `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="82" rx="24" ry="7" fill="#5c7a38" opacity=".3"/><path d="M50 82 V32" stroke="#5b8a2c" stroke-width="6" stroke-linecap="round"/><path d="M50 64 C22 56 16 34 48 46 C48 58 34 66 50 64 Z" fill="#6b9b36"/><path d="M50 52 C78 44 84 22 52 34 C52 46 66 54 50 52 Z" fill="#7ab648"/><path d="M50 40 C28 30 24 10 48 22 C48 32 36 40 50 40 Z" fill="#9dd35a"/><circle cx="50" cy="20" r="4.5" fill="#bfe07a"/></svg>` },
    { v: 16, name: "Flower", bg: "#f7dde2", fg: "#9c4a64",
      svg: `<svg viewBox="0 0 100 100"><path d="M50 84 V46" stroke="#5b8a2c" stroke-width="5" stroke-linecap="round"/><path d="M50 70 Q30 64 26 52 Q40 50 50 62Z" fill="#7ab648"/><path d="M50 62 Q70 56 74 44 Q60 42 50 54Z" fill="#9dd35a"/><g><circle cx="50" cy="34" r="13" fill="#f78fb3"/><circle cx="65" cy="44" r="12" fill="#f78fb3"/><circle cx="35" cy="44" r="12" fill="#f78fb3"/><circle cx="40" cy="22" r="12" fill="#f78fb3"/><circle cx="60" cy="22" r="12" fill="#f78fb3"/><circle cx="50" cy="34" r="10" fill="#fce4ec"/><circle cx="50" cy="34" r="7" fill="#f6d743"/></g></svg>` },
    { v: 32, name: "Bush", bg: "#cfe6b4", fg: "#3f6b28",
      svg: `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="78" rx="34" ry="10" fill="#4a6b28" opacity=".35"/><circle cx="34" cy="56" r="22" fill="#5b8a2c"/><circle cx="66" cy="56" r="22" fill="#6b9b36"/><circle cx="50" cy="42" r="24" fill="#7ab648"/><circle cx="38" cy="38" r="16" fill="#9dd35a"/><circle cx="60" cy="38" r="14" fill="#bfe07a" opacity=".8"/><circle cx="32" cy="50" r="3.5" fill="#f78fb3"/><circle cx="68" cy="48" r="3.5" fill="#f78fb3"/><circle cx="50" cy="30" r="4" fill="#f6d743"/></svg>` },
    { v: 64, name: "Sapling", bg: "#c2d9c2", fg: "#3a5c44",
      svg: `<svg viewBox="0 0 100 100"><path d="M50 86 V48" stroke="#7a5224" stroke-width="8" stroke-linecap="round"/><circle cx="50" cy="36" r="26" fill="#5b8a2c"/><circle cx="34" cy="42" r="18" fill="#6b9b36"/><circle cx="66" cy="42" r="18" fill="#7ab648"/><circle cx="50" cy="24" r="16" fill="#9dd35a"/><circle cx="42" cy="30" r="7" fill="#bfe07a" opacity=".75"/></svg>` },
    { v: 128, name: "Young Tree", bg: "#a8c9a0", fg: "#2f5230",
      svg: `<svg viewBox="0 0 100 100"><path d="M50 88 V44" stroke="#6b4520" stroke-width="10" stroke-linecap="round"/><circle cx="50" cy="36" r="30" fill="#4a7a24"/><circle cx="32" cy="42" r="20" fill="#5b8a2c"/><circle cx="68" cy="42" r="20" fill="#6b9b36"/><circle cx="50" cy="22" r="20" fill="#7ab648"/><circle cx="42" cy="28" r="10" fill="#9dd35a" opacity=".7"/></svg>` },
    { v: 256, name: "Mature Tree", bg: "#8eb07e", fg: "#244a26",
      svg: `<svg viewBox="0 0 100 100"><path d="M46 90 V46" stroke="#5c3818" stroke-width="12" stroke-linecap="round"/><path d="M54 90 V46" stroke="#7a4e22" stroke-width="7" stroke-linecap="round"/><circle cx="50" cy="36" r="34" fill="#3f6b1e"/><circle cx="30" cy="42" r="22" fill="#4a7a24"/><circle cx="70" cy="42" r="22" fill="#5b8a2c"/><circle cx="50" cy="20" r="22" fill="#6b9b36"/><circle cx="40" cy="28" r="12" fill="#7ab648" opacity=".7"/><circle cx="60" cy="30" r="10" fill="#9dd35a" opacity=".7"/></svg>` },
    { v: 512, name: "Fruit Tree", bg: "#e6c79a", fg: "#7a4a22",
      svg: `<svg viewBox="0 0 100 100"><path d="M48 90 V46" stroke="#6b4520" stroke-width="11" stroke-linecap="round"/><circle cx="50" cy="36" r="34" fill="#4a7a24"/><circle cx="30" cy="42" r="22" fill="#5b8a2c"/><circle cx="70" cy="42" r="22" fill="#6b9b36"/><circle cx="50" cy="20" r="22" fill="#7ab648"/><circle cx="34" cy="36" r="5.5" fill="#e84a4a"/><circle cx="64" cy="34" r="5.5" fill="#e84a4a"/><circle cx="52" cy="48" r="5.5" fill="#e84a4a"/><circle cx="42" cy="22" r="5" fill="#e84a4a"/><circle cx="60" cy="22" r="5" fill="#e84a4a"/></svg>` },
    { v: 1024, name: "Ancient Tree", bg: "#6f8a60", fg: "#1e3a1a",
      svg: `<svg viewBox="0 0 100 100"><path d="M42 90 Q46 66 50 46" stroke="#4a2d13" stroke-width="14" stroke-linecap="round" fill="none"/><path d="M58 90 Q54 66 50 46" stroke="#6b4520" stroke-width="10" stroke-linecap="round" fill="none"/><circle cx="50" cy="34" r="38" fill="#2d5216"/><circle cx="26" cy="42" r="26" fill="#3f6b1e"/><circle cx="74" cy="42" r="26" fill="#4a7a24"/><circle cx="50" cy="18" r="26" fill="#5b8a2c"/><circle cx="38" cy="28" r="14" fill="#7ab648" opacity=".65"/><circle cx="62" cy="26" r="12" fill="#9dd35a" opacity=".65"/></svg>` },
    { v: 2048, name: "Golden Tree", bg: "#f2d985", fg: "#6b4d12",
      svg: `<svg viewBox="0 0 100 100"><path d="M48 90 V44" stroke="#6b4520" stroke-width="11" stroke-linecap="round"/><circle cx="50" cy="36" r="34" fill="#e8b421"/><circle cx="30" cy="42" r="22" fill="#f0c43a"/><circle cx="70" cy="42" r="22" fill="#f4d04e"/><circle cx="50" cy="20" r="22" fill="#f7d86a"/><circle cx="42" cy="28" r="11" fill="#fcea94" opacity=".8"/><circle cx="50" cy="36" r="8" fill="#ffffff" opacity=".7"/></svg>` },
    { v: 4096, name: "Tree of Life", bg: "#b8e0a0", fg: "#2a5a1a",
      svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="38" r="42" fill="#f4d76e" opacity=".25"/><path d="M48 90 V44" stroke="#5c3818" stroke-width="11" stroke-linecap="round"/><circle cx="50" cy="36" r="32" fill="#2f8b3a"/><circle cx="32" cy="42" r="20" fill="#3fa84a"/><circle cx="68" cy="42" r="20" fill="#52c056"/><circle cx="50" cy="22" r="20" fill="#f4d04e"/><g stroke="#fcea94" stroke-width="2.5" stroke-linecap="round"><line x1="50" y1="4" x2="50" y2="10"/><line x1="16" y1="38" x2="22" y2="38"/><line x1="78" y1="38" x2="84" y2="38"/></g><circle cx="50" cy="36" r="8" fill="#ffffff"/></svg>` },
    { v: 8192, name: "Celestial Tree", bg: "#9eb8d6", fg: "#2a3a5e",
      svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="38" r="44" fill="#cfe8ff" opacity=".22"/><path d="M48 90 V44" stroke="#4a637d" stroke-width="10" stroke-linecap="round"/><circle cx="50" cy="36" r="32" fill="#8cb9e0"/><circle cx="32" cy="42" r="20" fill="#a4cbef"/><circle cx="68" cy="42" r="20" fill="#bfe0ff"/><circle cx="50" cy="22" r="20" fill="#e0f0ff"/><g fill="#ffffff"><circle cx="38" cy="28" r="2.5"/><circle cx="62" cy="26" r="2.5"/><circle cx="50" cy="42" r="2"/></g><circle cx="50" cy="36" r="8" fill="#ffffff" opacity=".9"/><circle cx="50" cy="36" r="4" fill="#f4d76e" opacity=".8"/></svg>` }
  ];

  const BY_VALUE = {};
  LEVELS.forEach(l => (BY_VALUE[l.v] = l));
  const TOP_VALUE = LEVELS[LEVELS.length - 1].v;

  function levelFor(v) {
    return BY_VALUE[v] || { v, name: "Bloomed", bg: LEVELS[LEVELS.length - 1].bg, fg: "#fff", svg: LEVELS[LEVELS.length - 1].svg };
  }

  /* ---------- Environment stages (by highest tile value) ---------- */
  // Returns 1..5
  function stageFor(maxValue) {
    if (maxValue <= 64) return 1;
    if (maxValue <= 256) return 2;
    if (maxValue <= 512) return 3;
    if (maxValue <= 1024) return 4;
    return 5;
  }

  /* ---------- DOM refs ---------- */
  const boardEl = document.getElementById("board");
  const gridEl = document.getElementById("grid");
  const tilesEl = document.getElementById("tiles");
  const overlayEl = document.getElementById("overlay");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const finalScoreEl = document.getElementById("finalScore");
  const finalBestEl = document.getElementById("finalBest");
  const newBtn = document.getElementById("newBtn");
  const playAgainBtn = document.getElementById("playAgainBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsPanel = document.getElementById("settingsPanel");
  const musicToggle = document.getElementById("musicToggle");
  const sfxToggle = document.getElementById("sfxToggle");
  const envEl = document.getElementById("env");
  const envSkyEl = document.querySelector(".env-sky");
  const envParticlesEl = document.getElementById("envParticles");
  const toastEl = document.getElementById("toast");

  /* ---------- State ---------- */
  let grid;
  let tiles;
  let nextId;
  let score;
  let best;
  let goldenAchieved;
  let busy;
  let cellSize;
  let gap;
  let currentStage = 0;
  let maxValueReached = 0;
  let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Storage ---------- */
  function loadBest() {
    try { const v = localStorage.getItem("gardenEvolutionBest"); return v ? parseInt(v, 10) || 0 : 0; }
    catch (e) { return 0; }
  }
  function saveBest() { try { localStorage.setItem("gardenEvolutionBest", String(best)); } catch (e) {} }
  function loadPref(key, dflt) { try { const v = localStorage.getItem(key); return v === null ? dflt : v === "true"; } catch (e) { return dflt; } }
  function savePref(key, val) { try { localStorage.setItem(key, String(val)); } catch (e) {} }

  let musicOn = loadPref("gardenEvolutionMusic", true);
  let sfxOn = loadPref("gardenEvolutionSfx", true);

  /* ---------- Layout ----------
     Single source of truth: CSS provides --gap and the board is square with
     padding = --gap. The inner play area (tiles container) is inset by --gap,
     so its width = boardWidth - 2*gap. Each cell = (inner - 3*gap)/4.
     Tiles are absolutely positioned with width/height = cellSize and
     translate by gap + c*(cellSize+gap). This guarantees exact alignment.
  */
  function readGap() {
    gap = parseFloat(getComputedStyle(boardEl).getPropertyValue("--gap")) || 10;
  }
  function measure() {
    readGap();
    const inner = boardEl.clientWidth - 2 * gap;
    cellSize = (inner - 3 * gap) / 4;
  }
  function cellPos(r, c) {
    return { x: c * (cellSize + gap), y: r * (cellSize + gap) };
  }
  function applyLayout() {
    measure();
    Object.keys(tiles).forEach(id => {
      const t = tiles[id];
      if (!t) return;
      const p = cellPos(t.r, t.c);
      t.el.style.transition = "none";
      t.el.style.width = cellSize + "px";
      t.el.style.height = cellSize + "px";
      t.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      const num = t.el.querySelector(".t-num");
      if (num) num.style.fontSize = Math.max(9, cellSize * 0.13) + "px";
    });
    void tilesEl.offsetWidth;
    Object.keys(tiles).forEach(id => { if (tiles[id] && tiles[id].el) tiles[id].el.style.transition = ""; });
  }

  /* ---------- Rendering ---------- */
  function renderTileContent(el, value) {
    const lvl = levelFor(value);
    el.dataset.value = value;
    el.style.background = lvl.bg;
    el.style.setProperty("--fg", lvl.fg);
    el.classList.toggle("glow", value >= 512);
    el.classList.toggle("golden", value >= 2048);
    el.innerHTML = lvl.svg + `<span class="t-num">${value}</span>`;
  }

  function createTile(r, c, value, isNew) {
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
    if (isNew && !reduceMotion) {
      el.addEventListener("animationend", () => el.classList.remove("spawn"), { once: true });
    } else {
      el.classList.remove("spawn");
    }
    tiles[id] = { value, r, c, el };
    grid[r][c] = id;
    return id;
  }

  function positionTile(id, r, c) {
    const t = tiles[id];
    if (!t) return;
    t.r = r; t.c = c;
    const p = cellPos(r, c);
    const tx = `translate(${p.x}px, ${p.y}px)`;
    t.el.style.setProperty("--tx", tx);
    t.el.style.transform = tx;
  }

  /* ---------- Game logic (unchanged 2048 rules) ---------- */
  function emptyCells() {
    const out = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (grid[r][c] == null) out.push([r, c]);
    return out;
  }

  function spawn() {
    const empty = emptyCells();
    if (!empty.length) return null;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    return createTile(r, c, value, true);
  }

  function linesFor(dir) {
    const lines = [];
    if (dir === "left" || dir === "right") {
      for (let r = 0; r < SIZE; r++) {
        const cols = dir === "left" ? [0, 1, 2, 3] : [3, 2, 1, 0];
        lines.push(cols.map(c => ({ r, c })));
      }
    } else {
      for (let c = 0; c < SIZE; c++) {
        const rows = dir === "up" ? [0, 1, 2, 3] : [3, 2, 1, 0];
        lines.push(rows.map(r => ({ r, c })));
      }
    }
    return lines;
  }

  function move(dir) {
    if (busy) return;
    const lines = linesFor(dir);
    let moved = false;
    const slides = [];
    const merges = [];
    const newGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

    lines.forEach(line => {
      const ids = [];
      line.forEach(({ r, c }) => { const id = grid[r][c]; if (id != null) ids.push(id); });
      let write = 0;
      let i = 0;
      while (i < ids.length) {
        const id = ids[i];
        const next = ids[i + 1];
        const dest = line[write];
        if (next && tiles[next].value === tiles[id].value && tiles[id].value < TOP_VALUE * 2) {
          const newVal = tiles[id].value * 2;
          merges.push({ survivor: id, absorbed: next, value: newVal, r: dest.r, c: dest.c });
          slides.push({ id, r: dest.r, c: dest.c });
          slides.push({ id: next, r: dest.r, c: dest.c });
          newGrid[dest.r][dest.c] = id;
          moved = true;
          i += 2;
          write++;
        } else {
          slides.push({ id, r: dest.r, c: dest.c });
          if (tiles[id].r !== dest.r || tiles[id].c !== dest.c) moved = true;
          newGrid[dest.r][dest.c] = id;
          i++;
          write++;
        }
      }
    });

    if (!moved) return;
    busy = true;
    grid = newGrid;

    slides.forEach(s => positionTile(s.id, s.r, s.c));

    const finalize = () => {
      merges.forEach(m => {
        if (tiles[m.absorbed]) { tiles[m.absorbed].el.remove(); delete tiles[m.absorbed]; }
        const t = tiles[m.survivor];
        if (!t) return;
        t.value = m.value;
        renderTileContent(t.el, m.value);
        t.el.classList.add("merge");
        setTimeout(() => t.el && t.el.classList.remove("merge"), MERGE_MS);
        emitParticles(m.r, m.c, m.value);
        score += m.value;
        playMerge(m.value);
        if (m.value > maxValueReached) {
          maxValueReached = m.value;
          maybeEvolveEnvironment();
        }
        if (m.value === 2048 && !goldenAchieved) {
          goldenAchieved = true;
          celebrate();
        }
      });
      updateScore();
      spawn();
      if (isGameOver()) showGameOver();
      busy = false;
    };

    if (reduceMotion) finalize();
    else setTimeout(finalize, SLIDE_MS);
  }

  function isGameOver() {
    if (emptyCells().length) return false;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = tiles[grid[r][c]].value;
        if (c + 1 < SIZE && tiles[grid[r][c + 1]].value === v) return false;
        if (r + 1 < SIZE && tiles[grid[r + 1][c]].value === v) return false;
      }
    }
    return true;
  }

  function updateScore() {
    scoreEl.textContent = score;
    if (score > best) { best = score; saveBest(); }
    bestEl.textContent = best;
  }

  function showGameOver() {
    finalScoreEl.textContent = score;
    finalBestEl.textContent = best;
    overlayEl.hidden = false;
    requestAnimationFrame(() => overlayEl.classList.add("show"));
    playGameOver();
  }
  function hideGameOver() {
    overlayEl.classList.remove("show");
    overlayEl.hidden = true;
  }

  /* ---------- Particles (board-local, transient) ---------- */
  function emitParticles(r, c, value) {
    if (reduceMotion) return;
    const p = cellPos(r, c);
    const cx = p.x + cellSize / 2;
    const cy = p.y + cellSize / 2;
    const count = value >= 1024 ? 10 : value >= 256 ? 7 : 5;
    const golden = value >= 2048;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement("div");
      dot.className = "particle" + (golden ? " gold" : "");
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

  /* ---------- Golden Tree celebration ---------- */
  function celebrate() {
    showToast("The Golden Tree has bloomed!");
    playGolden();
    if (reduceMotion) return;
    boardEl.classList.add("celebrate");
    setTimeout(() => boardEl.classList.remove("celebrate"), 1600);
    const cx = tilesEl.clientWidth / 2;
    const cy = tilesEl.clientHeight / 2;
    for (let i = 0; i < 22; i++) {
      const dot = document.createElement("div");
      dot.className = "particle gold big";
      const ang = Math.random() * Math.PI * 2;
      const dist = boardEl.clientWidth * (0.25 + Math.random() * 0.3);
      dot.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      dot.style.setProperty("--dy", Math.sin(ang) * dist + "px");
      dot.style.left = cx + "px";
      dot.style.top = cy + "px";
      tilesEl.appendChild(dot);
      dot.addEventListener("animationend", () => dot.remove(), { once: true });
    }
    triggerEnvGust(true);
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add("show"));
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toastEl.classList.remove("show");
      setTimeout(() => (toastEl.hidden = true), 300);
    }, 2400);
  }

  /* ============================================================
     AUDIO — procedural Web Audio
     - Warm, layered merge sound (low body + woody transient + airy poof + tonal accent)
     - Procedural ambient music with stage variations
     - Separate Music / SFX toggles
     ============================================================ */
  let audioCtx = null;
  let masterGain = null;
  let musicBus = null;
  let sfxBus = null;

  function ensureAudio() {
    if (audioCtx) {
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
      return;
    }
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.9;
      masterGain.connect(audioCtx.destination);
      musicBus = audioCtx.createGain();
      musicBus.gain.value = musicOn ? 0.5 : 0;
      musicBus.connect(masterGain);
      sfxBus = audioCtx.createGain();
      sfxBus.gain.value = sfxOn ? 1 : 0;
      sfxBus.connect(masterGain);
    } catch (e) { audioCtx = null; }
  }

  /* ---- SFX building blocks ---- */
  function envNode(g, t0, attack, decay, peak) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  // Short low-frequency rounded body (sine, fast decay)
  function bodySound(freq, dur, vol, t0) {
    if (!audioCtx || !sfxOn) return;
    const t = t0 + 0.001;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.7, t + dur);
    envNode(g, t, 0.006, dur, vol);
    o.connect(g).connect(sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // Woody / plucked transient (triangle with fast pitch drop + lowpass)
  function woodySound(freq, dur, vol, t0) {
    if (!audioCtx || !sfxOn) return;
    const t = t0 + 0.004;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 1400;
    o.type = "triangle";
    o.frequency.setValueAtTime(freq * 2.2, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.8, t + dur);
    envNode(g, t, 0.003, dur, vol);
    o.connect(lp).connect(g).connect(sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // Soft airy poof (filtered noise burst)
  function poofSound(dur, vol, t0) {
    if (!audioCtx || !sfxOn) return;
    const t = t0 + 0.002;
    const len = Math.floor(audioCtx.sampleRate * dur);
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const bp = audioCtx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 700; bp.Q.value = 0.7;
    const g = audioCtx.createGain();
    envNode(g, t, 0.004, dur, vol);
    src.connect(bp).connect(g).connect(sfxBus);
    src.start(t); src.stop(t + dur + 0.03);
  }

  // Pleasant tonal accent (soft sine, short)
  function accentSound(freq, dur, vol, t0) {
    if (!audioCtx || !sfxOn) return;
    const t = t0 + 0.006;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, t);
    envNode(g, t, 0.01, dur, vol);
    o.connect(g).connect(sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // Short harmonic shimmer (two detuned sines, higher register)
  function shimmerSound(freq, dur, vol, t0) {
    if (!audioCtx || !sfxOn) return;
    const t = t0 + 0.008;
    [1, 1.5].forEach((mult, idx) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq * mult * (1 + idx * 0.003), t);
      envNode(g, t, 0.015, dur, vol * (idx ? 0.5 : 1));
      o.connect(g).connect(sfxBus);
      o.start(t); o.stop(t + dur + 0.06);
    });
  }

  function playMerge(v) {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const log = Math.log2(v);
    // Warm low body — lower for higher values
    const bodyFreq = 150 - Math.min(60, log * 5);
    bodySound(bodyFreq, 0.16, 0.32, t0);
    // Woody transient — slightly higher pitch for small merges
    woodySound(260 + log * 18, 0.09, 0.14, t0);
    // Airy poof
    poofSound(0.12, 0.06, t0);

    if (v >= 2048) {
      // Golden: richer, elegant — deep body + warm shimmer + tonal bloom
      bodySound(90, 0.28, 0.3, t0);
      accentSound(523.25, 0.5, 0.1, t0);          // C5
      accentSound(659.25, 0.5, 0.08, t0 + 0.05);  // E5
      accentSound(783.99, 0.6, 0.07, t0 + 0.1);   // G5
      shimmerSound(1046.5, 0.7, 0.06, t0 + 0.12); // C6 shimmer
    } else if (v >= 1024) {
      // High: deeper impact + short harmonic shimmer
      accentSound(440 + log * 12, 0.22, 0.09, t0 + 0.01);
      shimmerSound(660 + log * 10, 0.3, 0.06, t0 + 0.02);
    } else if (v >= 128) {
      // Medium: fuller woody impact + gentle tone
      accentSound(330 + log * 14, 0.18, 0.08, t0 + 0.01);
    } else {
      // Low: small soft pop — just body + poof + faint accent
      accentSound(440, 0.1, 0.04, t0 + 0.005);
    }
  }

  function playGolden() {
    if (!audioCtx) return;
    // Rich but elegant ascending chord with warm body
    const t0 = audioCtx.currentTime;
    bodySound(80, 0.5, 0.28, t0);
    [392, 523.25, 659.25, 783.99].forEach((f, i) => accentSound(f, 0.8 - i * 0.05, 0.09 - i * 0.005, t0 + i * 0.07));
    shimmerSound(1046.5, 1.0, 0.05, t0 + 0.2);
  }

  function playGameOver() {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    [330, 277, 220].forEach((f, i) => {
      accentSound(f, 0.6, 0.1, t0 + i * 0.16);
      bodySound(f * 0.5, 0.5, 0.12, t0 + i * 0.16);
    });
  }

  /* ============================================================
     AMBIENT MUSIC — slow procedural pad + occasional pentatonic notes
     Evolves with environment stage. Designed to be subtle and calm.
     Architecture: if real audio files are dropped into /assets/audio/
     later, musicFromFile() can replace this without touching callers.
     ============================================================ */
  let musicTimer = null;
  let musicRunning = false;

  // Pentatonic scales per stage (C-based, relaxing)
  const STAGE_SCALES = [
    [261.63, 311.13, 349.23, 392, 466.16],               // stage1: C minor pent (soft morning)
    [293.66, 349.23, 392, 440, 523.25],                  // stage2: D pent (blooming)
    [261.63, 293.66, 329.63, 392, 440],                  // stage3: C major pent (rich green)
    [220, 261.63, 293.66, 329.63, 392],                  // stage4: A minor pent (warm sunset)
    [261.63, 329.63, 392, 466.16, 523.25]                // stage5: C sus pent (magical)
  ];

  function playPad(freq, dur, vol, t0) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const o2 = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 900;
    o.type = "sine"; o2.type = "sine";
    o.frequency.value = freq; o2.frequency.value = freq * 1.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    o.connect(lp); o2.connect(lp); lp.connect(g).connect(musicBus);
    o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.1); o2.stop(t0 + dur + 0.1);
  }

  function playBell(freq, dur, vol, t0) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(musicBus);
    o.start(t0); o.stop(t0 + dur + 0.1);
  }

  function musicStep() {
    if (!audioCtx || audioCtx.state !== "running" || !musicOn) return;
    const stage = Math.max(1, currentStage || 1);
    const scale = STAGE_SCALES[stage - 1];
    const t0 = audioCtx.currentTime;
    // Slow pad drone (root or fifth)
    const root = scale[0] * 0.5;
    playPad(root, 4.5, 0.05, t0);
    if (stage >= 3) playPad(scale[2] * 0.5, 4.2, 0.035, t0 + 0.2);
    // Occasional gentle bell note from scale
    if (Math.random() < 0.7) {
      const note = scale[Math.floor(Math.random() * scale.length)];
      playBell(note, 1.6, 0.03, t0 + 0.3 + Math.random() * 1.5);
    }
    if (stage >= 4 && Math.random() < 0.5) {
      const note = scale[Math.floor(Math.random() * scale.length)] * 2;
      playBell(note, 1.2, 0.02, t0 + 1 + Math.random() * 1.5);
    }
  }

  function startMusic() {
    if (musicRunning || !audioCtx || audioCtx.state !== "running" || !musicOn) return;
    musicRunning = true;
    musicStep();
    // Slower interval at lower stages, slightly more active higher
    const interval = () => 4200 - Math.min(800, (currentStage - 1) * 200);
    const tick = () => {
      if (!musicRunning || !audioCtx || audioCtx.state !== "running" || !musicOn) {
        stopMusic();
        return;
      }
      musicStep();
      musicTimer = setTimeout(tick, interval());
    };
    musicTimer = setTimeout(tick, interval());
  }
  function stopMusic() {
    musicRunning = false;
    if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
  }
  function setMusicEnabled(on) {
    musicOn = on;
    savePref("gardenEvolutionMusic", on);
    if (audioCtx && musicBus) musicBus.gain.value = on ? 0.5 : 0;
    if (on && audioCtx && audioCtx.state === "running") startMusic();
    else stopMusic();
  }
  function setSfxEnabled(on) {
    sfxOn = on;
    savePref("gardenEvolutionSfx", on);
    if (audioCtx && sfxBus) sfxBus.gain.value = on ? 1 : 0;
  }

  /* ============================================================
     EVOLVING ENVIRONMENT — Japanese countryside, 5 stages
     SVG layers + CSS crossfades + drifting particles.
     ============================================================ */
  const STAGE_SVG = [
    // Stage 1 — Radical Winter Mountain Overlook (asymmetrical high-altitude summit POV plunging into a deep valley)
    `<defs>
      <linearGradient id="s1sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7291aa"/>
        <stop offset="50%" stop-color="#b0d6eb"/>
        <stop offset="100%" stop-color="#e2f0f7"/>
      </linearGradient>
      <linearGradient id="s1valleyfog" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#cae0ee" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="#cae0ee" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="s1ridgeGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1c2b38"/>
        <stop offset="50%" stop-color="#2d4052"/>
        <stop offset="100%" stop-color="#475f75"/>
      </linearGradient>
      <linearGradient id="s1snowGrad" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="60%" stop-color="#e6f2fa"/>
        <stop offset="100%" stop-color="#b8d4e8"/>
      </linearGradient>
      <linearGradient id="s1lake" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#a4c6de" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#d4e8f5" stop-opacity="0.95"/>
      </linearGradient>
    </defs>

    <!-- Frosty Winter Sky & Soft Sun -->
    <rect width="1440" height="900" fill="url(#s1sky)"/>
    <circle cx="1120" cy="160" r="75" fill="#ffffff" opacity="0.35"/>
    <g opacity="0.12" class="env-rays">
      <polygon points="1120,160 450,900 720,900" fill="#ffffff"/>
      <polygon points="1120,160 800,900 1050,900" fill="#ffffff"/>
    </g>

    <!-- Background Chain 1: Highest Jagged Alpine Peaks (Atmospheric Fading) -->
    <path d="M0 420 L120 280 L240 370 L400 240 L580 350 L760 260 L980 370 L1200 250 L1440 360 L1440 620 L0 620Z" fill="#5c7a94" opacity="0.4"/>
    <path d="M120 280 L160 330 L200 310 L240 370 Z" fill="#ffffff" opacity="0.75"/>
    <path d="M400 240 L440 290 L490 270 L580 350 Z" fill="#ffffff" opacity="0.85"/>
    <path d="M760 260 L800 310 L850 290 L980 370 Z" fill="#ffffff" opacity="0.8"/>
    <path d="M1200 250 L1250 300 L1300 280 L1440 360 Z" fill="#ffffff" opacity="0.85"/>

    <!-- Background Chain 2: Mid-Distant Interlocking Snowy Ridges -->
    <path d="M0 480 L180 360 L380 440 L620 320 L860 420 L1120 330 L1360 410 L1440 380 L1440 680 L0 680Z" fill="#446078" opacity="0.55"/>
    <path d="M180 360 L230 410 L280 390 L380 440 Z" fill="#ffffff" opacity="0.75"/>
    <path d="M620 320 L680 380 L730 360 L860 420 Z" fill="#ffffff" opacity="0.8"/>
    <path d="M1120 330 L1180 390 L1230 370 L1360 410 Z" fill="#ffffff" opacity="0.75"/>

    <!-- Deep Valley Basin & Frozen Glacial Lake -->
    <path d="M220 900 Q620 580 1440 540 L1440 900 Z" fill="#7593ab"/>
    <ellipse cx="980" cy="620" rx="380" ry="45" fill="url(#s1lake)"/>
    <rect x="0" y="500" width="1440" height="180" fill="url(#s1valleyfog)" class="env-mist"/>

    <!-- Distant Shrinking Tree Clusters on Valley Spurs (Perspective Scaling) -->
    <g transform="translate(920, 560) scale(0.35)">
      <polygon points="0,-40 -18,10 -6,10 -24,40 24,40 6,10 18,10" fill="#2c3e4d"/>
      <polygon points="0,-40 -12,0 0,-5 12,0" fill="#ffffff" opacity="0.85"/>
      <polygon points="40,-30 25,10 33,10 20,35 60,35 47,10 55,10" fill="#2c3e4d"/>
      <polygon points="40,-30 30,0 40,-4 50,0" fill="#ffffff" opacity="0.85"/>
    </g>
    <g transform="translate(1220, 575) scale(0.45)">
      <polygon points="0,-40 -18,10 -6,10 -24,40 24,40 6,10 18,10" fill="#243442"/>
      <polygon points="0,-40 -12,0 0,-5 12,0" fill="#ffffff" opacity="0.85"/>
    </g>

    <!-- Midground Right Mountain Spur (Sloping Downward into Valley) -->
    <path d="M760 900 Q1020 590 1440 580 L1440 900 Z" fill="#364b5e"/>
    <path d="M800 900 Q1040 610 1440 600 L1440 900 Z" fill="url(#s1snowGrad)"/>

    <!-- FOREGROUND: Massive Asymmetrical Left Summit Ridge (High Overlook Vantage Point) -->
    <path d="M0 900 L0 260 Q220 480 660 900 Z" fill="url(#s1ridgeGrad)"/>
    <!-- Exposed Slate Rock Ledges -->
    <path d="M0 420 Q180 520 520 880 L440 900 Q140 550 0 470 Z" fill="#141f28"/>
    <!-- Wind-Carved Layered Snowdrifts & Contours -->
    <path d="M0 260 Q190 420 580 840 Q380 880 0 490 Z" fill="url(#s1snowGrad)"/>
    <path d="M0 340 Q150 450 460 780 Q320 820 0 410 Z" fill="#ffffff" opacity="0.9"/>
    <!-- Shaded Snow Contour Trough -->
    <path d="M40 360 Q170 480 440 760 Q340 790 20 380 Z" fill="#a4c4dc" opacity="0.6"/>

    <!-- Large Foreground Wind-Bent Frosted Fir Trees (Rooted on Summit Ridge) -->
    <g transform="translate(100, 360)">
      <polygon points="0,-75 -30,15 -10,15 -38,65 38,65 10,15 30,15" fill="#182430"/>
      <polygon points="0,-75 -18,0 0,-10 18,0" fill="#ffffff" opacity="0.95"/>
      <polygon points="-10,15 -24,48 24,48 10,15" fill="#ffffff" opacity="0.85"/>
      <polygon points="-14,35 -28,60 28,60 14,35" fill="#ffffff" opacity="0.75"/>
    </g>
    <g transform="translate(180, 440)">
      <polygon points="0,-60 -24,12 -8,12 -30,50 30,50 8,12 24,12" fill="#141f28"/>
      <polygon points="0,-60 -15,0 0,-8 15,0" fill="#ffffff" opacity="0.95"/>
      <polygon points="-8,12 -20,38 20,38 8,12" fill="#ffffff" opacity="0.85"/>
    </g>
    <g transform="translate(250, 530)">
      <polygon points="0,-46 -18,10 -6,10 -22,40 22,40 6,10 18,10" fill="#182430"/>
      <polygon points="0,-46 -12,0 0,-6 12,0" fill="#ffffff" opacity="0.95"/>
      <polygon points="-6,10 -16,32 16,32 6,10" fill="#ffffff" opacity="0.85"/>
    </g>`,

    // Stage 2 — Polished Early Spring Valley Meadow (Ash & Pine framing, zero element collisions)
    `<defs>
      <linearGradient id="s2sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#5b95c2"/>
        <stop offset="45%" stop-color="#9ed4c4"/>
        <stop offset="100%" stop-color="#ebf7ef"/>
      </linearGradient>
      <linearGradient id="s2haze" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#b4ded0" stop-opacity="0.75"/>
        <stop offset="100%" stop-color="#b4ded0" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="s2stream" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#3fa8d1" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#7be3cd" stop-opacity="0.95"/>
      </linearGradient>
      <linearGradient id="s2meadow1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4e9432"/>
        <stop offset="100%" stop-color="#62b342"/>
      </linearGradient>
      <linearGradient id="s2meadow2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#62b342"/>
        <stop offset="100%" stop-color="#76c752"/>
      </linearGradient>
      <linearGradient id="s2meadow3" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#76c752"/>
        <stop offset="100%" stop-color="#8eda66"/>
      </linearGradient>
    </defs>

    <!-- Bright Early Morning Sky & Soft Sun Disc -->
    <rect width="1440" height="900" fill="url(#s2sky)"/>
    <circle cx="1140" cy="150" r="90" fill="#ffffff" opacity="0.75"/>
    <g class="env-clouds" opacity="0.8" fill="#ffffff">
      <path d="M100 135 Q130 105 170 115 Q205 95 240 120 Q265 110 285 135 Q295 155 270 165 L125 165 Z" opacity="0.8"/>
      <path d="M740 115 Q765 85 800 95 Q835 75 870 100 Q895 90 915 115 Q925 135 900 145 L755 145 Z" opacity="0.75"/>
    </g>

    <!-- Background Tier 1: Soft Distant Alpine Peaks with Faint Snow Traces -->
    <path d="M0 430 Q180 300 420 360 Q660 250 920 330 Q1180 270 1440 330 L1440 600 L0 600Z" fill="#436d5e" opacity="0.5"/>
    <path d="M420 360 L455 395 L385 395 Z" fill="#ffffff" opacity="0.75"/>
    <path d="M660 250 L698 295 L622 295 Z" fill="#ffffff" opacity="0.85"/>
    <path d="M1180 270 L1218 312 L1142 312 Z" fill="#ffffff" opacity="0.75"/>

    <!-- Background Tier 2: Mid-Distant Rolling Foothills -->
    <path d="M0 480 Q260 370 560 430 Q860 350 1160 420 Q1340 390 1440 410 L1440 640 L0 640Z" fill="#365c4f" opacity="0.65"/>

    <!-- Open Valley Floor Meadow (3 Layered Tonal Contours) -->
    <path d="M0 540 Q420 490 840 520 T1440 500 L1440 900 L0 900Z" fill="url(#s2meadow1)"/>
    <path d="M0 610 Q380 560 800 590 T1440 570 L1440 900 L0 900Z" fill="url(#s2meadow2)"/>
    <path d="M0 700 Q400 650 820 680 T1440 660 L1440 900 L0 900Z" fill="url(#s2meadow3)"/>

    <rect x="0" y="460" width="1440" height="150" fill="url(#s2haze)" class="env-mist"/>

    <!-- Natural Dark Shoreline Integration -->
    <path d="M100 900 Q260 770 410 700 T670 620 T830 560 T950 510 L970 510 Q850 560 T690 620 T430 700 T280 770 T140 900 Z" fill="#3d2c1e" opacity="0.55"/>

    <!-- Perspective Meltwater Stream (Winding & Tapering: 45px down to 5px) -->
    <path d="M105 900 Q265 770 415 700 T675 620 T835 560 T955 510 L962 510 Q842 560 T682 620 T422 700 T272 770 T125 900 Z" fill="url(#s2stream)"/>

    <!-- Water Surface Shimmer Lines -->
    <path d="M125 900 Q270 770 420 700 T680 620 T840 560 T960 510" stroke="#ffffff" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.65"/>
    <path d="M132 900 Q275 770 425 700 T685 620 T845 560 T965 510" stroke="#7be3cd" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.45"/>

    <!-- Wet Soil Patches -->
    <path d="M50 800 Q130 775 210 815 Q150 845 60 825 Z" fill="#3d2c1e" opacity="0.45"/>
    <path d="M720 690 Q800 675 870 700 Q790 720 730 710 Z" fill="#3d2c1e" opacity="0.4"/>
    <path d="M1100 640 Q1160 630 1220 650 Q1160 665 1110 655 Z" fill="#3d2c1e" opacity="0.38"/>
    <path d="M60 810 Q110 800 150 820 Q100 830 65 825 Z" fill="#e8f4fa" opacity="0.8"/>

    <!-- LEFT SIDE TREES & PINES -->
    <!-- Far-Left Evergreen Pine (x=70, y=620, scale 0.85) -->
    <g transform="translate(70, 620) scale(0.85)">
      <rect x="-6" y="0" width="12" height="70" fill="#2d1e14" rx="3"/>
      <polygon points="0,-120 -35,-60 -15,-60 -45,-15 -20,-15 -55 35 55 35 20,-15 45,-15 15,-60 35,-60" fill="#274235"/>
      <polygon points="0,-120 -28,-65 -12,-65 -36,-22 -14,-22 -44 28 44 28 14,-22 36,-22 12,-65 28,-65" fill="#355948" opacity="0.85"/>
      <polygon points="0,-120 -20,-70 -8,-70 -26,-30 -8,-30 -32 20 32 20 8,-30 26,-30 8,-70 20,-70" fill="#45735e" opacity="0.75"/>
    </g>

    <!-- Mid-Left Mountain Pine (x=210, y=540, scale 0.55) -->
    <g transform="translate(210, 540) scale(0.55)">
      <rect x="-5" y="0" width="10" height="50" fill="#2d1e14" rx="2"/>
      <polygon points="0,-90 -28,-45 -12,-45 -36,-10 -15,-10 -42 25 42 25 15,-10 36,-10 12,-45 28,-45" fill="#274235"/>
      <polygon points="0,-90 -22,-50 -8,-50 -28,-15 -10,-15 -34 20 34 20 10,-15 28,-15 8,-50 22,-50" fill="#355948" opacity="0.85"/>
    </g>

    <!-- Tree 1: Large Foreground-Left Tree (x=140, y=680, scale 1.1) -->
    <g transform="translate(140, 680) scale(1.1)" class="env-fg-sway">
      <path d="M0 120 Q-10 40 -20 -30 Q-30 -80 -50 -130" stroke="#322215" stroke-width="18" stroke-linecap="round" fill="none"/>
      <path d="M-15 10 Q25 -40 60 -90" stroke="#322215" stroke-width="12" stroke-linecap="round" fill="none"/>
      <path d="M-25 -40 Q-5 -90 20 -140" stroke="#322215" stroke-width="8" stroke-linecap="round" fill="none"/>
      <path d="M-85 -145 Q-40 -185 5 -135 Q45 -175 90 -115 Q75 -55 15 -75 Q-45 -55 -85 -145 Z" fill="#4e9630"/>
      <path d="M-70 -135 Q-30 -170 5 -125 Q35 -160 75 -105 Q60 -58 10 -73 Q-35 -58 -70 -135 Z" fill="#6bb846"/>
      <circle cx="-28" cy="-130" r="26" fill="#88d65e" opacity="0.9"/>
      <circle cx="38" cy="-100" r="22" fill="#a2eb80" opacity="0.85"/>
    </g>

    <!-- RIGHT-SIDE HARMONIOUS TREE GROUPING (Pines + Ash Trees) -->
    <!-- Ash Tree 1: Broadleaf European Ash Tree (x=1160, y=630, scale 0.85) -->
    <g transform="translate(1160, 630) scale(0.85)" class="env-fg-sway">
      <path d="M0 110 Q-8 40 -16 -20 Q-24 -60 -40 -100" stroke="#423428" stroke-width="14" stroke-linecap="round" fill="none"/>
      <path d="M-10 15 Q20 -25 50 -65" stroke="#423428" stroke-width="9" stroke-linecap="round" fill="none"/>
      <path d="M-18 -20 Q-5 -55 15 -85" stroke="#423428" stroke-width="6" stroke-linecap="round" fill="none"/>
      <!-- Lighter, Branching Early-Spring Ash Canopy -->
      <path d="M-70 -110 Q-30 -145 10 -100 Q40 -135 75 -85 Q60 -40 12 -55 Q-35 -40 -70 -110 Z" fill="#5cb842"/>
      <path d="M-55 -100 Q-20 -130 10 -90 Q30 -120 60 -75 Q48 -35 8 -48 Q-28 -35 -55 -100 Z" fill="#75d455"/>
      <circle cx="-22" cy="-95" r="18" fill="#8cd96e" opacity="0.9"/>
      <circle cx="28" cy="-75" r="15" fill="#a6e38a" opacity="0.85"/>
    </g>

    <!-- Pine Tree 1: Anchor Swiss Spruce (x=1260, y=710, scale 1.1) -->
    <g transform="translate(1260, 710) scale(1.1)">
      <rect x="-8" y="0" width="16" height="85" fill="#24170f" rx="3"/>
      <polygon points="0,-145 -45,-75 -20,-75 -55,-20 -25,-20 -70 40 70 40 25,-20 55,-20 20,-75 45,-75" fill="#1e382b"/>
      <polygon points="0,-145 -36,-80 -16,-80 -44,-26 -18,-26 -56 32 56 32 18,-26 44,-26 16,-80 36,-80" fill="#2b4f3d" opacity="0.88"/>
      <polygon points="0,-145 -25,-85 -10,-85 -32,-32 -10,-32 -42 24 42 24 10,-32 32,-32 10,-85 25,-85" fill="#38664f" opacity="0.78"/>
    </g>

    <!-- Ash Tree 2: Midground Ash Sapling (x=1080, y=540, scale 0.55) -->
    <g transform="translate(1080, 540) scale(0.55)" class="env-fg-sway">
      <path d="M0 90 Q-6 30 -12 -20 Q-18 -50 -30 -90" stroke="#423428" stroke-width="11" stroke-linecap="round" fill="none"/>
      <path d="M-10 10 Q15 -25 40 -60" stroke="#423428" stroke-width="7" stroke-linecap="round" fill="none"/>
      <path d="M-50 -100 Q-20 -130 15 -90 Q45 -120 70 -80 Q65 -40 25 -50 Q-25 -40 -50 -100 Z" fill="#5cb842"/>
      <path d="M-40 -90 Q-15 -115 12 -80 Q38 -110 55 -75 Q50 -45 15 -52 Q-25 -45 -40 -90 Z" fill="#75d455"/>
      <circle cx="-15" cy="-85" r="16" fill="#8cd96e" opacity="0.9"/>
    </g>

    <!-- Pine Tree 2: Secondary Far-Right Spruce (x=1390, y=630, scale 0.75) -->
    <g transform="translate(1390, 630) scale(0.75)">
      <rect x="-6" y="0" width="12" height="65" fill="#24170f" rx="2"/>
      <polygon points="0,-115 -38,-58 -16,-58 -46,-16 -20,-16 -56 32 56 32 20,-16 46,-16 16,-58 38,-58" fill="#1e382b"/>
      <polygon points="0,-115 -28,-62 -12,-62 -35,-22 -14,-22 -44 24 44 24 14,-22 35,-22 12,-62 28,-62" fill="#2b4f3d" opacity="0.85"/>
    </g>

    <!-- MIDGROUND LEFT TREES -->
    <g transform="translate(280, 560) scale(0.6)" class="env-fg-sway">
      <path d="M0 90 Q-6 30 -12 -20 Q-18 -50 -30 -90" stroke="#3a281a" stroke-width="12" stroke-linecap="round" fill="none"/>
      <path d="M-10 10 Q15 -25 40 -60" stroke="#3a281a" stroke-width="8" stroke-linecap="round" fill="none"/>
      <path d="M-50 -100 Q-20 -130 15 -90 Q45 -120 70 -80 Q65 -40 25 -50 Q-25 -40 -50 -100 Z" fill="#4e9630"/>
      <path d="M-40 -90 Q-15 -115 12 -80 Q38 -110 55 -75 Q50 -45 15 -52 Q-25 -45 -40 -90 Z" fill="#6bb846"/>
      <circle cx="-15" cy="-85" r="16" fill="#88d65e" opacity="0.9"/>
    </g>

    <!-- BOLD, RECOGNIZABLE FLOWER & PLANT CLUSTERS (Collision-Free Spacing) -->
    <!-- Cluster 1: Left Foreground Flower Patch -->
    <g transform="translate(240, 760)">
      <path d="M-15 10 Q-5 -15 0 -30 M15 10 Q5 -10 10 -25 M-5 10 Q0 -20 20 -20" stroke="#3f7e28" stroke-width="3" fill="none"/>
      <circle cx="0" cy="-30" r="8" fill="#ffffff"/><circle cx="0" cy="-30" r="3" fill="#ffea6b"/>
      <circle cx="10" cy="-25" r="7" fill="#ffffff"/><circle cx="10" cy="-25" r="2.5" fill="#ffea6b"/>
      <circle cx="20" cy="-20" r="6" fill="#ffffff"/><circle cx="20" cy="-20" r="2" fill="#ffea6b"/>
    </g>

    <!-- Cluster 2: Open Meadow Flower Patch (Repositioned to x=1100, y=750 away from all tree trunks) -->
    <g transform="translate(1100, 750)">
      <path d="M-10 10 Q-3 -12 0 -25 M10 10 Q3 -8 8 -20" stroke="#3f7e28" stroke-width="3" fill="none"/>
      <circle cx="0" cy="-25" r="8" fill="#ffea6b"/><circle cx="0" cy="-25" r="3" fill="#ffffff"/>
      <circle cx="8" cy="-20" r="7" fill="#ffea6b"/><circle cx="8" cy="-20" r="2.5" fill="#ffffff"/>
    </g>

    <!-- Cluster 3: Stream Shoreline White Flowers -->
    <g transform="translate(760, 670)">
      <path d="M-8 8 Q0 -10 5 -20 M8 8 Q2 -8 -5 -18" stroke="#3f7e28" stroke-width="2.5" fill="none"/>
      <circle cx="5" cy="-20" r="7" fill="#ffffff"/><circle cx="5" cy="-20" r="2.5" fill="#ffea6b"/>
      <circle cx="-5" cy="-18" r="6" fill="#ffffff"/><circle cx="-5" cy="-18" r="2" fill="#ffea6b"/>
    </g>

    <!-- BOLD LOW MEADOW GRASS CLUMPS -->
    <path d="M30 860 Q55 810 80 860 M50 860 Q70 800 95 860 M100 870 Q125 820 150 870" stroke="#468c2a" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M1230 850 Q1255 800 1280 850 M1250 850 Q1270 790 1295 850 M1300 860 Q1325 810 1350 860" stroke="#468c2a" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M680 720 Q700 680 720 720 M700 720 Q715 675 735 720" stroke="#468c2a" stroke-width="4.5" stroke-linecap="round" fill="none"/>`,

    // Stage 3 — Blooming Spring (life returning, wildflowers across meadows, floral haze)
    `<defs>
      <linearGradient id="s3sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#aae0f5"/>
        <stop offset="50%" stop-color="#cdeee0"/>
        <stop offset="100%" stop-color="#e8f8ec"/>
      </linearGradient>
      <linearGradient id="s3haze" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f7e8f0" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#e8f8ec" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="1440" height="900" fill="url(#s3sky)"/>
    <circle cx="1160" cy="160" r="75" fill="#fff9d6" opacity="0.8"/>
    <!-- Sunbeams -->
    <g class="env-rays" opacity="0.6">
      <polygon points="1160,160 600,900 850,900" fill="#ffffff"/>
      <polygon points="1160,160 900,900 1150,900" fill="#ffffff"/>
    </g>
    <!-- Background Spring Hills -->
    <path d="M0 510 L180 410 L360 470 L540 380 L740 460 L940 390 L1140 460 L1340 390 L1440 450 L1440 620 L0 620Z" fill="#58ab46" opacity="0.55"/>
    <path d="M0 550 L220 450 L420 500 L620 420 L820 480 L1020 420 L1220 480 L1440 440 L1440 640 L0 640Z" fill="#469935" opacity="0.65"/>
    <!-- Midground Blooming Meadows -->
    <path d="M0 610 Q360 550 720 590 T1440 580 L1440 900 L0 900Z" fill="#69c445"/>
    <rect x="0" y="550" width="1440" height="110" fill="url(#s3haze)" class="env-mist"/>
    <path d="M0 670 Q420 625 780 655 T1440 645 L1440 900 L0 900Z" fill="#52ae30"/>
    <path d="M0 740 Q400 705 800 725 T1440 715 L1440 900 L0 900Z" fill="#3e9420"/>
    <!-- Wildflower Patches across slopes -->
    <g fill="#f78fb3">
      <circle cx="240" cy="710" r="4"/><circle cx="255" cy="705" r="4.5"/><circle cx="270" cy="712" r="3.5"/>
      <circle cx="940" cy="720" r="4"/><circle cx="955" cy="715" r="4.5"/><circle cx="970" cy="722" r="3.5"/>
    </g>
    <g fill="#f6d743">
      <circle cx="290" cy="725" r="3.5"/><circle cx="305" cy="720" r="4"/><circle cx="1000" cy="735" r="3.5"/>
    </g>
    <g fill="#b88bf7">
      <circle cx="200" cy="730" r="3.5"/><circle cx="215" cy="725" r="4"/><circle cx="890" cy="740" r="3.5"/>
    </g>
    <!-- Rich Spring Trees -->
    <g transform="translate(160, 590)">
      <path d="M0 45 V0" stroke="#5c3a1e" stroke-width="7" stroke-linecap="round"/>
      <circle cx="0" cy="-18" r="30" fill="#52ae30"/>
      <circle cx="-16" cy="-10" r="20" fill="#7cd850"/>
      <circle cx="16" cy="-10" r="20" fill="#9be670"/>
    </g>
    <g transform="translate(1240, 580)">
      <path d="M0 48 V0" stroke="#5c3a1e" stroke-width="7" stroke-linecap="round"/>
      <circle cx="0" cy="-20" r="32" fill="#52ae30"/>
      <circle cx="-18" cy="-10" r="22" fill="#7cd850"/>
      <circle cx="18" cy="-10" r="22" fill="#9be670"/>
    </g>`,

    // Stage 4 — lush spring Sakura Garden, bright blue sky, rolling alpine hills & falling petals
    `<defs>
      <linearGradient id="s4sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#3b9de3"/>
        <stop offset="45%" stop-color="#6ee2ec"/>
        <stop offset="100%" stop-color="#cbf4e2"/>
      </linearGradient>
      <radialGradient id="s4sun" cx="0.2" cy="0.18" r="0.45">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
        <stop offset="35%" stop-color="#fff4b8" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#fff4b8" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="s4ray" x1="0" y1="0" x2="0.5" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="s4river" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#76d0e8" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="#a4f4e0" stop-opacity="0.95"/>
      </linearGradient>
      <linearGradient id="s4mist" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#d4f6e8" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#d4f6e8" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <!-- Sky & Sun -->
    <rect width="1440" height="900" fill="url(#s4sky)"/>
    <circle cx="280" cy="150" r="160" fill="url(#s4sun)"/>
    <g class="env-rays" opacity="0.85">
      <polygon points="280,150 -50,650 100,650" fill="url(#s4ray)"/>
      <polygon points="280,150 160,900 380,900" fill="url(#s4ray)"/>
      <polygon points="280,150 560,900 800,900" fill="url(#s4ray)"/>
    </g>
    <!-- Drifting White Clouds -->
    <g class="env-clouds" opacity="0.85" fill="#ffffff">
      <path d="M80 150 Q110 110 150 120 Q190 100 230 130 Q260 120 280 150 Q290 170 260 180 L100 180 Z"/>
      <path d="M740 120 Q765 90 800 100 Q835 80 870 105 Q895 95 915 120 Q925 140 900 150 L755 150 Z" opacity="0.75"/>
      <path d="M1140 170 Q1165 140 1200 150 Q1235 130 1270 155 Q1295 145 1315 170 Q1325 190 1300 200 L1155 200 Z" opacity="0.7"/>
    </g>
    <!-- Snow-dusted Mountain Ranges -->
    <path d="M0 500 L140 380 L280 450 L440 350 L620 440 L820 370 L1020 450 L1220 370 L1440 440 L1440 620 L0 620Z" fill="#3c867c" opacity="0.45"/>
    <path d="M0 540 L180 440 L340 490 L500 400 L700 480 L900 410 L1100 480 L1300 420 L1440 470 L1440 640 L0 640Z" fill="#2e746a" opacity="0.55"/>
    <!-- Valley Floor & Winding River -->
    <path d="M0 600 Q360 540 720 580 T1440 570 L1440 900 L0 900Z" fill="#69b848"/>
    <path d="M720 580 Q660 620 685 670 T750 730 T670 810 T720 900 L785 900 Q720 810 L790 730 Q725 670 750 580 Z" fill="url(#s4river)"/>
    <!-- Valley Mist Layer -->
    <rect x="0" y="560" width="1440" height="120" fill="url(#s4mist)" class="env-mist"/>
    <!-- Midground Rolling Hills -->
    <path d="M0 660 Q420 615 780 645 T1440 635 L1440 900 L0 900Z" fill="#52a035"/>
    <path d="M0 730 Q380 690 760 715 T1440 705 L1440 900 L0 900Z" fill="#3f8826"/>
    <!-- Midground Sakura Groves (Slope Accents) -->
    <g transform="translate(1140, 590)">
      <path d="M0 35 Q-4 15 0 0" stroke="#3d261a" stroke-width="5" fill="none"/>
      <path d="M0 -15 Q-25 -25 -38 0 Q-15 25 0 15 Z" fill="#e77f9d"/>
      <path d="M0 -15 Q25 -25 38 0 Q15 25 0 15 Z" fill="#f78fb3"/>
      <circle cx="0" cy="-18" r="28" fill="#f8a5c2"/>
    </g>
    <!-- Foreground High Cliff Bluff (Bottom Right) -->
    <path d="M920 900 Q1040 690 1440 670 L1440 900 Z" fill="#2d6e1b"/>
    <path d="M960 900 Q1070 715 1440 700 L1440 900 Z" fill="#225414"/>
    <!-- Static Petal Drifts on Bluff Edge -->
    <path d="M1060 745 Q1200 710 1380 730 Q1240 760 1060 745 Z" fill="#f8a5c2" opacity="0.85"/>
    <path d="M1120 760 Q1240 735 1350 750 Q1240 775 1120 760 Z" fill="#f78fb3" opacity="0.8"/>
    <!-- Detailed Wildflowers & Grass Tufts -->
    <g fill="#f78fb3">
      <circle cx="1020" cy="760" r="3.5"/><circle cx="1035" cy="755" r="4"/><circle cx="1050" cy="762" r="3"/>
      <circle cx="1240" cy="735" r="3.5"/><circle cx="1255" cy="730" r="4"/><circle cx="1270" cy="738" r="3"/>
    </g>
    <g fill="#f6d743">
      <circle cx="1080" cy="770" r="3"/><circle cx="1095" cy="765" r="3.5"/><circle cx="1290" cy="745" r="3"/>
    </g>
    <g fill="#ffffff">
      <circle cx="1140" cy="778" r="2.5"/><circle cx="1155" cy="772" r="3"/><circle cx="1330" cy="752" r="2.5"/>
    </g>
    <!-- Intricate Organic Sakura Framing Branch (Top Left) -->
    <g class="env-fg-sway" transform="translate(0, 0)">
      <!-- Detailed Branching Splines -->
      <path d="M-30 -10 Q140 30 310 135 Q380 180 440 225" stroke="#331e13" stroke-width="16" stroke-linecap="round" fill="none"/>
      <path d="M150 42 Q240 95 300 165" stroke="#331e13" stroke-width="9" stroke-linecap="round" fill="none"/>
      <path d="M280 120 Q350 135 410 168" stroke="#331e13" stroke-width="7" stroke-linecap="round" fill="none"/>
      <path d="M80 18 Q140 60 190 95" stroke="#331e13" stroke-width="6" stroke-linecap="round" fill="none"/>
      <!-- Organic Layered Blossom Masses -->
      <path d="M110 15 Q170 -25 240 15 Q280 60 210 90 Q140 95 110 50 Z" fill="#d96b8a"/>
      <path d="M130 25 Q180 -10 230 25 Q260 60 200 80 Q150 80 130 50 Z" fill="#e77f9d"/>
      <path d="M150 30 Q190 5 220 30 Q240 60 190 70 Q160 70 150 50 Z" fill="#f78fb3"/>
      <!-- Mid Cluster -->
      <path d="M210 90 Q280 50 350 95 Q390 145 320 175 Q250 180 210 130 Z" fill="#d96b8a"/>
      <path d="M230 100 Q290 65 340 105 Q370 145 310 165 Q260 165 230 135 Z" fill="#e77f9d"/>
      <path d="M250 110 Q300 80 330 115 Q350 145 300 155 Q270 155 250 135 Z" fill="#f8a5c2"/>
      <!-- Outer Tip Cluster -->
      <path d="M320 150 Q380 120 430 160 Q460 205 400 230 Q340 235 320 190 Z" fill="#e77f9d"/>
      <path d="M340 160 Q395 135 435 170 Q455 205 405 220 Q360 220 340 195 Z" fill="#f78fb3"/>
      <path d="M360 170 Q405 150 430 178 Q445 205 405 212 Q375 210 360 195 Z" fill="#fce4ec"/>
      <!-- Delicate Petal Highlights -->
      <circle cx="180" cy="35" r="16" fill="#ffffff" opacity="0.65"/>
      <circle cx="280" cy="115" r="18" fill="#ffffff" opacity="0.65"/>
      <circle cx="385" cy="180" r="15" fill="#ffffff" opacity="0.7"/>
    </g>`,

    // Stage 5 — Lush Magical Alpine Garden at Twilight / Night (reflective lake, ancient golden tree, lush pines, fireflies)
    `<defs>
      <linearGradient id="s5sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#140b24"/>
        <stop offset="35%" stop-color="#381b42"/>
        <stop offset="70%" stop-color="#8a3052"/>
        <stop offset="100%" stop-color="#df7345"/>
      </linearGradient>
      <radialGradient id="s5sun" cx="0.5" cy="0.48" r="0.5">
        <stop offset="0%" stop-color="#fff8d6" stop-opacity="0.95"/>
        <stop offset="30%" stop-color="#f7c552" stop-opacity="0.75"/>
        <stop offset="70%" stop-color="#e87e38" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#8a3052" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="s5lake" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#f7c552" stop-opacity="0.75"/>
        <stop offset="50%" stop-color="#e8804c" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#291333" stop-opacity="0.95"/>
      </linearGradient>
      <linearGradient id="s5mist" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#8a3052" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="#df7345" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="s5meadow1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#143022"/>
        <stop offset="100%" stop-color="#1f4230"/>
      </linearGradient>
      <linearGradient id="s5meadow2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1f4230"/>
        <stop offset="100%" stop-color="#2a573f"/>
      </linearGradient>
      <linearGradient id="s5meadow3" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2a573f"/>
        <stop offset="100%" stop-color="#376e51"/>
      </linearGradient>
    </defs>

    <!-- Deep Purple Sky & Radiant Twilight Setting Sun -->
    <rect width="1440" height="900" fill="url(#s5sky)"/>
    <circle cx="720" cy="380" r="320" fill="url(#s5sun)" class="env-sun-glow"/>

    <!-- Distant Dusky Alpine Mountain Chains -->
    <path d="M0 460 L180 350 L360 430 L560 330 L760 410 L960 340 L1160 420 L1360 350 L1440 410 L1440 600 L0 600Z" fill="#210e2b" opacity="0.6"/>
    <path d="M0 500 L220 400 L420 460 L620 380 L820 450 L1020 390 L1220 450 L1440 400 L1440 640 L0 640Z" fill="#301538" opacity="0.7"/>

    <!-- Lush Deep Night Emerald Meadow Floors -->
    <path d="M0 540 Q420 490 840 520 T1440 500 L1440 900 L0 900Z" fill="url(#s5meadow1)"/>
    <path d="M0 610 Q380 560 800 590 T1440 570 L1440 900 L0 900Z" fill="url(#s5meadow2)"/>
    <path d="M0 700 Q400 650 820 680 T1440 660 L1440 900 L0 900Z" fill="url(#s5meadow3)"/>

    <!-- Reflective Golden Twilight Mountain Lake -->
    <ellipse cx="720" cy="615" rx="460" ry="42" fill="url(#s5lake)"/>
    <path d="M300 615 Q510 605 720 615 T1140 615" stroke="#ffffff" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.5"/>

    <rect x="0" y="470" width="1440" height="130" fill="url(#s5mist)" class="env-mist"/>

    <!-- Glowing Lowland Cottage Window Accents -->
    <g fill="#ffe89e" opacity="0.95">
      <rect x="620" y="640" width="4" height="4" rx="1"/>
      <rect x="628" y="640" width="4" height="4" rx="1"/>
      <rect x="810" y="650" width="4" height="4" rx="1"/>
      <rect x="818" y="650" width="4" height="4" rx="1"/>
    </g>

    <!-- LEFT FRAME: Ancient Luminous Golden/Pink Blossom Tree -->
    <g class="env-fg-sway" transform="translate(160, 670) scale(1.1)">
      <path d="M-20 220 Q-15 80 -40 -40 Q-50 -100 -80 -160" stroke="#210d06" stroke-width="26" stroke-linecap="round" fill="none"/>
      <path d="M-30 -20 Q40 -90 120 -150 Q180 -190 260 -230" stroke="#210d06" stroke-width="16" stroke-linecap="round" fill="none"/>
      <path d="M30 -70 Q100 -120 180 -150" stroke="#210d06" stroke-width="10" stroke-linecap="round" fill="none"/>
      <!-- Glowing Dusk Canopy Masses -->
      <path d="M-140 -200 Q-80 -270 0 -220 Q70 -270 140 -210 Q190 -150 120 -110 Q20 -90 -60 -110 Q-150 -120 -140 -200 Z" fill="#d96b43"/>
      <path d="M-120 -190 Q-70 -250 0 -205 Q60 -250 120 -195 Q165 -145 105 -110 Q15 -90 -50 -105 Q-130 -115 -120 -190 Z" fill="#f5c438"/>
      <path d="M-100 -180 Q-60 -230 0 -190 Q50 -230 100 -180 Q140 -135 90 -105 Q10 -85 -40 -100 Q-110 -110 -100 -180 Z" fill="#ffea80"/>
      <path d="M120 -240 Q200 -300 280 -250 Q340 -300 400 -240 Q440 -180 370 -140 Q280 -120 200 -140 Q110 -150 120 -240 Z" fill="#e26d5c"/>
      <path d="M140 -230 Q210 -285 280 -240 Q330 -285 380 -230 Q415 -175 355 -140 Q275 -120 200 -138 Q130 -145 140 -230 Z" fill="#f5c438"/>
      <path d="M160 -220 Q220 -270 280 -230 Q320 -270 360 -220 Q390 -170 340 -140 Q270 -120 200 -135 Q150 -140 160 -220 Z" fill="#ffea80"/>
      <circle cx="-10" cy="-180" r="30" fill="#ffffff" opacity="0.75"/>
      <circle cx="270" cy="-210" r="35" fill="#ffffff" opacity="0.75"/>
    </g>

    <!-- RIGHT FRAME: Medium-Large Lush Broadleaf Landscape Tree -->
    <g transform="translate(1250, 680) scale(1.25)" class="env-fg-sway">
      <!-- Strong Hardwood Trunk & Branching Boughs -->
      <path d="M0 120 Q-8 40 -16 -35 Q-24 -85 -40 -140" stroke="#1c120a" stroke-width="20" stroke-linecap="round" fill="none"/>
      <path d="M-10 10 Q25 -35 60 -85 Q80 -115 100 -145" stroke="#1c120a" stroke-width="12" stroke-linecap="round" fill="none"/>
      <path d="M-18 -30 Q-40 -70 -60 -115" stroke="#1c120a" stroke-width="8" stroke-linecap="round" fill="none"/>
      <path d="M25 -45 Q45 -80 58 -115" stroke="#1c120a" stroke-width="6" stroke-linecap="round" fill="none"/>
      <!-- Multi-Layered Nighttime Broadleaf Canopy -->
      <path d="M-75 -160 Q-30 -205 15 -155 Q55 -200 90 -145 Q70 -100 15 -115 Q-40 -105 -75 -160 Z" fill="#163b2b"/>
      <path d="M-60 -150 Q-22 -190 12 -145 Q40 -185 75 -135 Q58 -95 12 -105 Q-32 -95 -60 -150 Z" fill="#23573f"/>
      <ellipse cx="-35" cy="-150" rx="28" ry="20" fill="#347858"/>
      <ellipse cx="100" cy="-155" rx="30" ry="22" fill="#23573f"/>
      <ellipse cx="100" cy="-155" rx="22" ry="16" fill="#347858"/>
      <ellipse cx="58" cy="-125" rx="22" ry="16" fill="#23573f"/>
      <!-- Moonlit Foliage Highlights -->
      <circle cx="-30" cy="-155" r="15" fill="#4fa87c" opacity="0.9"/>
      <circle cx="104" cy="-160" r="14" fill="#6dca98" opacity="0.85"/>
      <circle cx="60" cy="-130" r="11" fill="#6dca98" opacity="0.8"/>
    </g>

    <!-- MIDGROUND DEPTH TREES -->
    <g transform="translate(280, 560) scale(0.6)" class="env-fg-sway">
      <path d="M0 90 Q-6 30 -12 -20 Q-18 -50 -30 -90" stroke="#1b120a" stroke-width="12" stroke-linecap="round" fill="none"/>
      <path d="M-50 -100 Q-20 -130 15 -90 Q45 -120 70 -80 Q65 -40 25 -50 Q-25 -40 -50 -100 Z" fill="#1f4533"/>
      <path d="M-40 -90 Q-15 -115 12 -80 Q38 -110 55 -75 Q50 -45 15 -52 Q-25 -45 -40 -90 Z" fill="#2e5e47"/>
    </g>
    <g transform="translate(1080, 530) scale(0.5)" class="env-fg-sway">
      <path d="M0 90 Q-6 30 -12 -20 Q-18 -50 -30 -90" stroke="#1b120a" stroke-width="11" stroke-linecap="round" fill="none"/>
      <path d="M-50 -100 Q-20 -130 15 -90 Q45 -120 70 -80 Q65 -40 25 -50 Q-25 -40 -50 -100 Z" fill="#1f4533"/>
      <path d="M-40 -90 Q-15 -115 12 -80 Q38 -110 55 -75 Q50 -45 15 -52 Q-25 -45 -40 -90 Z" fill="#2e5e47"/>
    </g>

    <!-- LUMINOUS NIGHTTIME WILDFLOWER CLUSTERS -->
    <!-- Cluster 1: Left Foreground Soft White & Gold Flowers -->
    <g transform="translate(240, 760)">
      <path d="M-15 10 Q-5 -15 0 -30 M15 10 Q5 -10 10 -25 M-5 10 Q0 -20 20 -20" stroke="#25523b" stroke-width="3" fill="none"/>
      <circle cx="0" cy="-30" r="8" fill="#ffffff"/><circle cx="0" cy="-30" r="3" fill="#ffe169"/>
      <circle cx="10" cy="-25" r="7" fill="#f7b2bd"/><circle cx="10" cy="-25" r="2.5" fill="#ffe169"/>
      <circle cx="20" cy="-20" r="6" fill="#ffffff"/><circle cx="20" cy="-20" r="2" fill="#ffe169"/>
    </g>

    <!-- Cluster 2: Right Foreground Lavender & Gold Flowers -->
    <g transform="translate(1120, 750)">
      <path d="M-10 10 Q-3 -12 0 -25 M10 10 Q3 -8 8 -20" stroke="#25523b" stroke-width="3" fill="none"/>
      <circle cx="0" cy="-25" r="8" fill="#d8bbff"/><circle cx="0" cy="-25" r="3" fill="#ffffff"/>
      <circle cx="8" cy="-20" r="7" fill="#ffe169"/><circle cx="8" cy="-20" r="2.5" fill="#ffffff"/>
    </g>

    <!-- Cluster 3: Lake Shoreline Luminous Pink Flowers -->
    <g transform="translate(760, 665)">
      <path d="M-8 8 Q0 -10 5 -20 M8 8 Q2 -8 -5 -18" stroke="#25523b" stroke-width="2.5" fill="none"/>
      <circle cx="5" cy="-20" r="7" fill="#f7b2bd"/><circle cx="5" cy="-20" r="2.5" fill="#ffe169"/>
      <circle cx="-5" cy="-18" r="6" fill="#ffffff"/><circle cx="-5" cy="-18" r="2" fill="#ffe169"/>
    </g>

    <!-- BOLD NIGHTTIME MEADOW GRASS CLUMPS -->
    <path d="M30 860 Q55 810 80 860 M50 860 Q70 800 95 860 M100 870 Q125 820 150 870" stroke="#2b5e46" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M1230 850 Q1255 800 1280 850 M1250 850 Q1270 790 1295 850 M1300 860 Q1325 810 1350 860" stroke="#2b5e46" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M680 715 Q700 675 720 715 M700 715 Q715 670 735 715" stroke="#2b5e46" stroke-width="4.5" stroke-linecap="round" fill="none"/>`
  ];

  // Floating particle config per stage
  const STAGE_PARTICLES = [
    { type: "snow", count: 12 },    // stage1 winter snow
    { type: "leaf", count: 7 },     // stage2 fresh green leaves
    { type: "pollen", count: 12 },  // stage3 spring pollen / blossom haze
    { type: "petal", count: 15 },   // stage4 lush alpine sakura petals
    { type: "firefly", count: 18 }  // stage5 luminous fireflies
  ];

  function renderStageSVG(stage) {
    envSkyEl.innerHTML = STAGE_SVG[stage - 1];
  }

  function clearEnvParticles() {
    envParticlesEl.innerHTML = "";
  }

  function spawnEnvParticles(stage) {
    if (reduceMotion) return;
    clearEnvParticles();
    const cfg = STAGE_PARTICLES[stage - 1];
    for (let i = 0; i < cfg.count; i++) {
      const el = document.createElement("span");
      el.className = "env-particle " + cfg.type;
      if (cfg.type === "snow" && i % 3 === 0) {
        el.classList.add("fg");
      }
      el.style.left = Math.random() * 100 + "%";
      el.style.top = (10 + Math.random() * 70) + "%";
      el.style.animationDelay = -Math.random() * 18 + "s";
      el.style.animationDuration = (cfg.type === "snow" && i % 3 === 0 ? 8 + Math.random() * 5 : 14 + Math.random() * 10) + "s";
      if (cfg.type === "firefly" || cfg.type === "pollen") {
        el.style.setProperty("--fx", (Math.random() * 60 - 30) + "px");
        el.style.setProperty("--fy", (Math.random() * 40 - 20) + "px");
      }
      envParticlesEl.appendChild(el);
    }
  }

  function setEnvironmentStage(stage, immediate) {
    if (stage === currentStage && !immediate) return;
    currentStage = stage;
    envEl.dataset.stage = stage;
    renderStageSVG(stage);
    spawnEnvParticles(stage);
  }
  window.debugSetEnvironmentStage = setEnvironmentStage;

  function maybeEvolveEnvironment() {
    const newStage = stageFor(maxValueReached);
    if (newStage !== currentStage) {
      setEnvironmentStage(newStage);
      // Brief gentle reaction on stage transition
      triggerEnvGust(false);
    }
  }

  // Subtle gust: briefly intensify particle drift via a CSS class
  let gustTimer = null;
  function triggerEnvGust(strong) {
    if (reduceMotion) return;
    envEl.classList.add(strong ? "gust-strong" : "gust");
    clearTimeout(gustTimer);
    gustTimer = setTimeout(() => {
      envEl.classList.remove("gust", "gust-strong");
    }, strong ? 1800 : 1200);
  }

  /* ---------- New game ---------- */
  function newGame() {
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    tiles = {};
    nextId = 1;
    score = 0;
    goldenAchieved = false;
    busy = false;
    maxValueReached = 0;
    tilesEl.innerHTML = "";
    boardEl.querySelectorAll(".particle").forEach(p => p.remove());
    tilesEl.querySelectorAll(".particle").forEach(p => p.remove());
    hideGameOver();
    setEnvironmentStage(1, true);
    measure();
    spawn();
    spawn();
    updateScore();
  }

  function buildGrid() {
    gridEl.innerHTML = "";
    for (let i = 0; i < SIZE * SIZE; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      gridEl.appendChild(cell);
    }
  }

  /* ---------- Controls ---------- */
  const KEY = {
    ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
    a: "left", d: "right", w: "up", s: "down",
    A: "left", D: "right", W: "up", S: "down"
  };
  window.addEventListener("keydown", e => {
    const dir = KEY[e.key];
    if (!dir) return;
    e.preventDefault();
    ensureAudio();
    move(dir);
  }, { passive: false });

  let ptrStart = null;
  boardEl.addEventListener("pointerdown", e => {
    ensureAudio();
    ptrStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  boardEl.addEventListener("pointermove", e => {
    if (!ptrStart || e.pointerId !== ptrStart.id) return;
    const dx = e.clientX - ptrStart.x;
    const dy = e.clientY - ptrStart.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
    let dir;
    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? "right" : "left";
    else dir = dy > 0 ? "down" : "up";
    ptrStart = null;
    move(dir);
  });
  const endPtr = e => { if (ptrStart && e.pointerId === ptrStart.id) ptrStart = null; };
  boardEl.addEventListener("pointerup", endPtr);
  boardEl.addEventListener("pointercancel", endPtr);
  boardEl.addEventListener("pointerleave", endPtr);

  boardEl.addEventListener("touchstart", e => e.preventDefault(), { passive: false });
  boardEl.addEventListener("touchmove", e => e.preventDefault(), { passive: false });

  newBtn.addEventListener("click", () => { ensureAudio(); newGame(); });
  playAgainBtn.addEventListener("click", () => { ensureAudio(); newGame(); });

  // Settings panel
  function syncToggles() {
    musicToggle.setAttribute("aria-checked", String(musicOn));
    musicToggle.classList.toggle("off", !musicOn);
    sfxToggle.setAttribute("aria-checked", String(sfxOn));
    sfxToggle.classList.toggle("off", !sfxOn);
  }
  settingsBtn.addEventListener("click", e => {
    e.stopPropagation();
    const open = !settingsPanel.hidden;
    if (open) { settingsPanel.hidden = true; settingsBtn.setAttribute("aria-expanded", "false"); }
    else { settingsPanel.hidden = false; settingsBtn.setAttribute("aria-expanded", "true"); syncToggles(); }
  });
  document.addEventListener("click", e => {
    if (!settingsPanel.hidden && !settingsPanel.contains(e.target) && e.target !== settingsBtn) {
      settingsPanel.hidden = true;
      settingsBtn.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !settingsPanel.hidden) {
      settingsPanel.hidden = true;
      settingsBtn.setAttribute("aria-expanded", "false");
    }
  });
  musicToggle.addEventListener("click", () => { ensureAudio(); setMusicEnabled(!musicOn); syncToggles(); });
  sfxToggle.addEventListener("click", () => { ensureAudio(); setSfxEnabled(!sfxOn); syncToggles(); });

  // Resize handling
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyLayout, 80);
  });

  // First user interaction unlocks audio + starts music
  function firstInteraction() {
    ensureAudio();
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().then(() => {
        if (musicOn) startMusic();
      }).catch(() => {});
    } else if (audioCtx && audioCtx.state === "running") {
      if (musicOn) startMusic();
    }
    window.removeEventListener("pointerdown", firstInteraction);
    window.removeEventListener("keydown", firstInteraction);
  }
  window.addEventListener("pointerdown", firstInteraction);
  window.addEventListener("keydown", firstInteraction);

  /* ---------- Boot ---------- */
  best = loadBest();
  bestEl.textContent = best;
  syncToggles();
  buildGrid();
  setEnvironmentStage(1, true);
  newGame();
})();
