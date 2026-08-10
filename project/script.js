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
      svg: `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="56" rx="22" ry="30" fill="#b07a3e"/><ellipse cx="44" cy="48" rx="7" ry="11" fill="#cba066" opacity=".7"/><path d="M50 30 Q58 40 50 52" stroke="#7a5224" stroke-width="2.5" fill="none" opacity=".5"/></svg>` },
    { v: 4, name: "Sprout", bg: "#e6f0cf", fg: "#5d7a2e",
      svg: `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="66" rx="15" ry="19" fill="#b07a3e"/><path d="M50 52 Q30 46 24 60 Q34 64 50 58Z" fill="#8cc152"/><path d="M50 52 Q70 46 76 60 Q66 64 50 58Z" fill="#a8d864"/></svg>` },
    { v: 8, name: "Young Plant", bg: "#d6efda", fg: "#3f6b35",
      svg: `<svg viewBox="0 0 100 100"><path d="M50 86 V52" stroke="#7a8b4a" stroke-width="4" stroke-linecap="round"/><path d="M50 70 Q34 66 30 54 Q42 52 50 64Z" fill="#8cc152"/><path d="M50 64 Q66 60 70 48 Q58 46 50 58Z" fill="#a8d864"/><path d="M50 54 Q40 48 38 40 Q48 40 50 50Z" fill="#bfe07a"/></svg>` },
    { v: 16, name: "Flower", bg: "#f7dde2", fg: "#9c4a64",
      svg: `<svg viewBox="0 0 100 100"><path d="M50 88 V52" stroke="#7a8b4a" stroke-width="4" stroke-linecap="round"/><path d="M50 70 Q36 66 32 56 Q44 54 50 64Z" fill="#8cc152"/><circle cx="50" cy="42" r="9" fill="#f6b8c0"/><circle cx="62" cy="50" r="9" fill="#f6b8c0"/><circle cx="38" cy="50" r="9" fill="#f6b8c0"/><circle cx="44" cy="34" r="9" fill="#f6b8c0"/><circle cx="56" cy="34" r="9" fill="#f6b8c0"/><circle cx="50" cy="42" r="6" fill="#f4d76e"/></svg>` },
    { v: 32, name: "Bush", bg: "#cfe6b4", fg: "#3f6b28",
      svg: `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="74" rx="30" ry="11" fill="#6b8b3a" opacity=".5"/><circle cx="38" cy="58" r="18" fill="#7ab648"/><circle cx="62" cy="58" r="18" fill="#8cc152"/><circle cx="50" cy="48" r="20" fill="#9dd35a"/><circle cx="44" cy="50" r="6" fill="#bfe07a" opacity=".7"/></svg>` },
    { v: 64, name: "Sapling", bg: "#c2d9c2", fg: "#3a5c44",
      svg: `<svg viewBox="0 0 100 100"><path d="M50 88 V56" stroke="#8b5e3c" stroke-width="6" stroke-linecap="round"/><circle cx="50" cy="44" r="22" fill="#7ab648"/><circle cx="40" cy="48" r="12" fill="#9dd35a"/><circle cx="60" cy="48" r="12" fill="#bfe07a"/></svg>` },
    { v: 128, name: "Young Tree", bg: "#a8c9a0", fg: "#2f5230",
      svg: `<svg viewBox="0 0 100 100"><path d="M50 90 V50" stroke="#8b5e3c" stroke-width="7" stroke-linecap="round"/><circle cx="50" cy="40" r="26" fill="#5b8a2c"/><circle cx="36" cy="44" r="16" fill="#7ab648"/><circle cx="64" cy="44" r="16" fill="#8cc152"/><circle cx="50" cy="30" r="16" fill="#9dd35a"/></svg>` },
    { v: 256, name: "Mature Tree", bg: "#8eb07e", fg: "#244a26",
      svg: `<svg viewBox="0 0 100 100"><path d="M48 92 V52" stroke="#7a5224" stroke-width="9" stroke-linecap="round"/><path d="M52 92 V52" stroke="#8b5e3c" stroke-width="5" stroke-linecap="round"/><circle cx="50" cy="38" r="32" fill="#4a7a24"/><circle cx="34" cy="44" r="20" fill="#5b8a2c"/><circle cx="66" cy="44" r="20" fill="#6b9b36"/><circle cx="50" cy="26" r="20" fill="#7ab648"/><circle cx="44" cy="34" r="8" fill="#9dd35a" opacity=".6"/></svg>` },
    { v: 512, name: "Fruit Tree", bg: "#e6c79a", fg: "#7a4a22",
      svg: `<svg viewBox="0 0 100 100"><path d="M48 92 V52" stroke="#7a5224" stroke-width="9" stroke-linecap="round"/><circle cx="50" cy="38" r="32" fill="#5b8a2c"/><circle cx="34" cy="44" r="20" fill="#6b9b36"/><circle cx="66" cy="44" r="20" fill="#7ab648"/><circle cx="50" cy="26" r="20" fill="#8cc152"/><circle cx="36" cy="40" r="5.5" fill="#e8674a"/><circle cx="60" cy="36" r="5.5" fill="#e8674a"/><circle cx="52" cy="48" r="5.5" fill="#d94a35"/></svg>` },
    { v: 1024, name: "Ancient Tree", bg: "#6f8a60", fg: "#1e3a1a",
      svg: `<svg viewBox="0 0 100 100"><path d="M44 92 Q46 70 50 52" stroke="#6b4520" stroke-width="10" stroke-linecap="round" fill="none"/><path d="M56 92 Q54 70 50 52" stroke="#7a5224" stroke-width="8" stroke-linecap="round" fill="none"/><circle cx="50" cy="36" r="36" fill="#3f6b1e"/><circle cx="30" cy="42" r="24" fill="#4a7a24"/><circle cx="70" cy="42" r="24" fill="#5b8a2c"/><circle cx="50" cy="22" r="24" fill="#6b9b36"/><circle cx="40" cy="32" r="10" fill="#8cc152" opacity=".55"/><circle cx="62" cy="30" r="8" fill="#9dd35a" opacity=".55"/></svg>` },
    { v: 2048, name: "Golden Tree", bg: "#f2d985", fg: "#6b4d12",
      svg: `<svg viewBox="0 0 100 100"><path d="M48 92 V50" stroke="#7a5224" stroke-width="9" stroke-linecap="round"/><circle cx="50" cy="38" r="32" fill="#e8b421"/><circle cx="34" cy="44" r="20" fill="#f0c43a"/><circle cx="66" cy="44" r="20" fill="#f4d04e"/><circle cx="50" cy="26" r="20" fill="#f7d86a"/><circle cx="44" cy="34" r="8" fill="#fcea94" opacity=".7"/><circle cx="50" cy="38" r="6" fill="#fff4c2" opacity=".6"/></svg>` },
    { v: 4096, name: "Tree of Life", bg: "#b8e0a0", fg: "#2a5a1a",
      svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="40" r="40" fill="#f4d76e" opacity=".18"/><path d="M48 92 V50" stroke="#7a5224" stroke-width="9" stroke-linecap="round"/><circle cx="50" cy="38" r="30" fill="#2f8b3a"/><circle cx="34" cy="44" r="18" fill="#3fa84a"/><circle cx="66" cy="44" r="18" fill="#52c056"/><circle cx="50" cy="26" r="18" fill="#f4d04e"/><g stroke="#fcea94" stroke-width="2" stroke-linecap="round"><line x1="50" y1="8" x2="50" y2="14"/><line x1="20" y1="40" x2="26" y2="40"/><line x1="74" y1="40" x2="80" y2="40"/></g><circle cx="50" cy="38" r="7" fill="#fff4c2"/></svg>` },
    { v: 8192, name: "Celestial Tree", bg: "#9eb8d6", fg: "#2a3a5e",
      svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="40" r="44" fill="#cfe8ff" opacity=".18"/><path d="M48 92 V50" stroke="#6b8caa" stroke-width="8" stroke-linecap="round"/><circle cx="50" cy="38" r="30" fill="#9ec7e8"/><circle cx="34" cy="44" r="18" fill="#b5d6ef"/><circle cx="66" cy="44" r="18" fill="#cfe8ff"/><circle cx="50" cy="26" r="18" fill="#e4f2ff"/><g fill="#ffffff"><circle cx="40" cy="32" r="2"/><circle cx="58" cy="30" r="2"/><circle cx="52" cy="44" r="1.5"/><circle cx="64" cy="40" r="1.5"/></g><circle cx="50" cy="38" r="6" fill="#ffffff" opacity=".8"/><circle cx="50" cy="38" r="3" fill="#f4d76e" opacity=".7"/></svg>` }
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
    if (maxValue >= 2048) return 5;
    if (maxValue >= 512) return 4;
    if (maxValue >= 64) return 3;
    if (maxValue >= 16) return 2;
    return 1;
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
    if (audioCtx) { if (audioCtx.state === "suspended") audioCtx.resume(); return; }
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
    if (!audioCtx || !musicOn) return;
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
    if (musicRunning || !audioCtx) return;
    musicRunning = true;
    musicStep();
    // Slower interval at lower stages, slightly more active higher
    const interval = () => 4200 - Math.min(800, (currentStage - 1) * 200);
    const tick = () => {
      if (!musicRunning) return;
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
    if (on && audioCtx) startMusic();
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
    // Stage 1 — early morning, pale sky, simple fields, sparse leaves
    `<defs>
      <linearGradient id="s1sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6eef5"/><stop offset="0.55" stop-color="#eef2e6"/><stop offset="1" stop-color="#e2ead7"/></linearGradient>
    </defs>
    <rect width="1440" height="900" fill="url(#s1sky)"/>
    <circle cx="1180" cy="200" r="60" fill="#f5f0e0" opacity="0.5"/>
    <path d="M0 620 Q360 560 720 600 T1440 590 L1440 900 L0 900Z" fill="#c7d9b0"/>
    <path d="M0 680 Q420 640 780 672 T1440 660 L1440 900 L0 900Z" fill="#a9c796"/>
    <path d="M0 750 Q400 720 800 740 T1440 730 L1440 900 L0 900Z" fill="#8eb680"/>
    <g opacity="0.5"><path d="M120 640 q10 -18 20 0 q10 -14 20 0" stroke="#7a9b6a" stroke-width="1.5" fill="none"/></g>
    <g opacity="0.4"><path d="M500 670 q10 -18 20 0 q10 -14 20 0" stroke="#6b8b5a" stroke-width="1.5" fill="none"/></g>`,

    // Stage 2 — blooming, flowers, blossoming trees, petals
    `<defs>
      <linearGradient id="s2sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8ecf0"/><stop offset="0.5" stop-color="#f0e8e8"/><stop offset="1" stop-color="#e2e0c8"/></linearGradient>
    </defs>
    <rect width="1440" height="900" fill="url(#s2sky)"/>
    <circle cx="220" cy="180" r="55" fill="#f5ecd8" opacity="0.45"/>
    <path d="M0 640 Q360 580 720 620 T1440 610 L1440 900 L0 900Z" fill="#bcd2a2"/>
    <path d="M0 700 Q420 660 780 692 T1440 680 L1440 900 L0 900Z" fill="#9dc286"/>
    <path d="M0 760 Q400 730 800 750 T1440 740 L1440 900 L0 900Z" fill="#7fae72"/>
    <!-- Blossom trees -->
    <g transform="translate(180,620)"><rect x="-3" y="0" width="6" height="40" fill="#8b6b4a"/><circle cx="0" cy="-8" r="26" fill="#f6c4d2"/><circle cx="-14" cy="-2" r="18" fill="#f4b4c6"/><circle cx="14" cy="-2" r="18" fill="#f8cadc"/></g>
    <g transform="translate(1100,610)"><rect x="-3" y="0" width="6" height="44" fill="#8b6b4a"/><circle cx="0" cy="-10" r="28" fill="#f6c4d2"/><circle cx="-16" cy="-4" r="20" fill="#f4b4c6"/><circle cx="16" cy="-4" r="20" fill="#f8cadc"/></g>
    <!-- Flower patches -->
    <g fill="#e8678a" opacity="0.55"><circle cx="320" cy="710" r="4"/><circle cx="340" cy="704" r="4"/><circle cx="360" cy="712" r="4"/><circle cx="900" cy="730" r="4"/><circle cx="920" cy="724" r="4"/><circle cx="940" cy="732" r="4"/></g>
    <g fill="#f4d76e" opacity="0.5"><circle cx="600" cy="750" r="3.5"/><circle cx="620" cy="744" r="3.5"/><circle cx="1200" cy="755" r="3.5"/></g>`,

    // Stage 3 — richer vegetation, deeper colors, developed landscape
    `<defs>
      <linearGradient id="s3sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8e4ec"/><stop offset="0.5" stop-color="#e0e8d8"/><stop offset="1" stop-color="#c8d8b0"/></linearGradient>
    </defs>
    <rect width="1440" height="900" fill="url(#s3sky)"/>
    <circle cx="1150" cy="170" r="58" fill="#f0ecdc" opacity="0.5"/>
    <!-- Distant mountains -->
    <path d="M0 560 L200 440 L360 520 L520 400 L700 500 L900 420 L1100 510 L1300 430 L1440 500 L1440 620 L0 620Z" fill="#8fae8a" opacity="0.55"/>
    <path d="M0 640 Q360 590 720 625 T1440 615 L1440 900 L0 900Z" fill="#9fbe88"/>
    <path d="M0 705 Q420 665 780 695 T1440 685 L1440 900 L0 900Z" fill="#7ba670"/>
    <path d="M0 770 Q400 740 800 758 T1440 750 L1440 900 L0 900Z" fill="#5c8a52"/>
    <!-- Trees -->
    <g transform="translate(160,610)"><rect x="-4" y="0" width="8" height="50" fill="#7a5c3a"/><circle cx="0" cy="-12" r="30" fill="#4a7a24"/><circle cx="-18" cy="-4" r="20" fill="#5b8a2c"/><circle cx="18" cy="-4" r="20" fill="#6b9b36"/></g>
    <g transform="translate(1080,600)"><rect x="-4" y="0" width="8" height="54" fill="#7a5c3a"/><circle cx="0" cy="-14" r="32" fill="#4a7a24"/><circle cx="-20" cy="-6" r="22" fill="#5b8a2c"/><circle cx="20" cy="-6" r="22" fill="#6b9b36"/></g>
    <g transform="translate(760,640)"><rect x="-3" y="0" width="6" height="40" fill="#7a5c3a"/><circle cx="0" cy="-8" r="24" fill="#5b8a2c"/><circle cx="-14" cy="-2" r="16" fill="#6b9b36"/></g>`,

    // Stage 4 — late afternoon / sunset, golden light, pollen/fireflies
    `<defs>
      <linearGradient id="s4sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0d8c0"/><stop offset="0.45" stop-color="#f4e2c4"/><stop offset="1" stop-color="#e8d4a8"/></linearGradient>
    </defs>
    <rect width="1440" height="900" fill="url(#s4sky)"/>
    <circle cx="280" cy="200" r="70" fill="#f6dca0" opacity="0.6"/>
    <circle cx="280" cy="200" r="40" fill="#f4e8c0" opacity="0.4"/>
    <path d="M0 580 L240 460 L400 540 L580 420 L760 520 L960 440 L1160 530 L1340 450 L1440 520 L1440 620 L0 620Z" fill="#b09878" opacity="0.5"/>
    <path d="M0 640 Q360 590 720 625 T1440 615 L1440 900 L0 900Z" fill="#c4b078"/>
    <path d="M0 710 Q420 670 780 700 T1440 690 L1440 900 L0 900Z" fill="#a8945c"/>
    <path d="M0 775 Q400 745 800 762 T1440 755 L1440 900 L0 900Z" fill="#8a7848"/>
    <!-- Warm-lit trees -->
    <g transform="translate(180,600)"><rect x="-4" y="0" width="8" height="52" fill="#6b4a2a"/><circle cx="0" cy="-14" r="32" fill="#7a8b3a"/><circle cx="-20" cy="-6" r="22" fill="#8c9b4a"/><circle cx="20" cy="-6" r="22" fill="#9dab5a"/></g>
    <g transform="translate(1120,590)"><rect x="-4" y="0" width="8" height="56" fill="#6b4a2a"/><circle cx="0" cy="-16" r="34" fill="#7a8b3a"/><circle cx="-22" cy="-8" r="24" fill="#8c9b4a"/><circle cx="22" cy="-8" r="24" fill="#9dab5a"/></g>`,

    // Stage 5 — golden hour / magical evening, luminous, fantastical
    `<defs>
      <linearGradient id="s5sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8b0d8"/><stop offset="0.4" stop-color="#e0c8d0"/><stop offset="0.75" stop-color="#f0dca8"/><stop offset="1" stop-color="#d8c890"/></linearGradient>
      <radialGradient id="s5glow" cx="0.5" cy="0.4" r="0.5"><stop offset="0" stop-color="#f4d76e" stop-opacity="0.35"/><stop offset="1" stop-color="#f4d76e" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1440" height="900" fill="url(#s5sky)"/>
    <rect width="1440" height="900" fill="url(#s5glow)"/>
    <circle cx="720" cy="180" r="50" fill="#f8e8a0" opacity="0.55"/>
    <path d="M0 580 L260 440 L420 530 L600 410 L780 510 L980 430 L1180 520 L1360 440 L1440 510 L1440 620 L0 620Z" fill="#9a86a8" opacity="0.5"/>
    <path d="M0 640 Q360 590 720 625 T1440 615 L1440 900 L0 900Z" fill="#b8a878"/>
    <path d="M0 710 Q420 670 780 700 T1440 690 L1440 900 L0 900Z" fill="#988a5c"/>
    <path d="M0 775 Q400 745 800 762 T1440 755 L1440 900 L0 900Z" fill="#7a6c48"/>
    <!-- Luminous golden trees -->
    <g transform="translate(200,600)"><rect x="-4" y="0" width="8" height="54" fill="#6b4a2a"/><circle cx="0" cy="-16" r="34" fill="#e8b421" opacity="0.85"/><circle cx="-22" cy="-8" r="24" fill="#f0c43a" opacity="0.8"/><circle cx="22" cy="-8" r="24" fill="#f4d04e" opacity="0.8"/><circle cx="0" cy="-16" r="12" fill="#fcea94" opacity="0.5"/></g>
    <g transform="translate(1100,590)"><rect x="-4" y="0" width="8" height="58" fill="#6b4a2a"/><circle cx="0" cy="-18" r="36" fill="#e8b421" opacity="0.85"/><circle cx="-24" cy="-10" r="26" fill="#f0c43a" opacity="0.8"/><circle cx="24" cy="-10" r="26" fill="#f4d04e" opacity="0.8"/><circle cx="0" cy="-18" r="14" fill="#fcea94" opacity="0.5"/></g>`
  ];

  // Floating particle config per stage
  const STAGE_PARTICLES = [
    { type: "leaf", count: 6 },    // stage1 sparse leaves
    { type: "petal", count: 10 },  // stage2 petals
    { type: "leaf", count: 9 },    // stage3 more leaves
    { type: "firefly", count: 8 }, // stage4 pollen/fireflies
    { type: "firefly", count: 12 } // stage5 luminous
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
      el.style.left = Math.random() * 100 + "%";
      el.style.top = (10 + Math.random() * 70) + "%";
      el.style.animationDelay = -Math.random() * 18 + "s";
      el.style.animationDuration = (14 + Math.random() * 10) + "s";
      if (cfg.type === "firefly") {
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
    if (musicOn) startMusic();
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
