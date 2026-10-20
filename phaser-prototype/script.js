"use strict";
import { createBloomFlow } from "./src/bloom-flow.js";
import { endingForMergedValue } from "./src/game-rules.js";
import { isSessionUsable } from "./src/game-save.js";
import { installControls } from "./src/controls.js";
import { nextFocus } from "./src/focus-trap.js";
import { BOARD_SIZE, hasMoves, planMove } from "./src/board.js";
import { DIRECTION_CHARS, createRng, drawSpawn } from "./src/game-core.js";
import { createLeaderboardApi } from "./src/leaderboard-api.js";
import { createLeaderboardUi } from "./src/leaderboard-ui.js";
import { createScoreSubmit } from "./src/score-submit.js";
import { currentFeatures } from "./src/features.js";
import { createAudio } from "./src/audio.js";
import { createWorldEffects } from "./src/world-effects.js";
import { createPreferences } from "./src/preferences.js";
import { createSettingsPanel } from "./src/settings-panel.js";
import { createTileArt } from "./src/tile-art.js";
import { createFallbackScenery } from "./src/scenery-fallback.js";
import { createWorldView } from "./src/world-view.js";
import { PLAY_LABELS, TRANSLATIONS } from "./src/i18n.js";
import { artValueFor, levelFor, stageFor, stageMeta as stageMetaFor, tileLabel as tileLabelFor } from "./src/levels.js";
import {
  clearSavedGame, loadBest, loadLanguage, loadPlayerName, loadSavedGame, saveBest, saveLanguage, writeSavedGame
} from "./src/storage.js";

/* ============================================================
   Garden Evolution — a relaxing 2048-inspired garden game
   DOM game logic backed by Phaser scenes and a Cloudflare Worker API.
   ============================================================ */

(() => {
  const SIZE = BOARD_SIZE;
  const SLIDE_MS = 115;
  const MERGE_MS = 210;

  /* ---------- DOM refs ---------- */
  const boardEl = document.getElementById("board");
  const gridEl = document.getElementById("grid");
  const tilesEl = document.getElementById("tiles");
  const overlayEl = document.getElementById("overlay");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const finalScoreEl = document.getElementById("finalScore");
  const finalScoreLabelEl = finalScoreEl.previousElementSibling;
  const finalBestEl = document.getElementById("finalBest");
  const finalTitleEl = document.getElementById("finalTitle");
  const finalExplanationEl = document.getElementById("finalExplanation");
  const newBtn = document.getElementById("newBtn");
  const playAgainBtn = document.getElementById("playAgainBtn");
  const continueMilestoneBtn = document.getElementById("continueMilestoneBtn");
  const leaderboardBtn = document.getElementById("leaderboardBtn");
  const leaderboardModalEl = document.getElementById("leaderboardModal");
  const leaderboardCloseBtn = document.getElementById("leaderboardClose");
  const scoreFormEl = document.getElementById("scoreForm");
  const scoreFormLabelEl = scoreFormEl.querySelector("label");
  const playerNameEl = document.getElementById("playerName");
  const submitScoreBtn = document.getElementById("submitScoreBtn");
  const scoreSubmitStatusEl = document.getElementById("scoreSubmitStatus");
  const lowerScoreConfirmEl = document.getElementById("lowerScoreConfirm");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsPanel = document.getElementById("settingsPanel");
  const settingsCloseBtn = document.getElementById("settingsClose");
  const startScreenEl = document.getElementById("startScreen");
  const startPlayBtn = document.getElementById("startPlayBtn");
  const startSettingsBtn = document.getElementById("startSettingsBtn");
  const startLeaderboardBtn = document.getElementById("startLeaderboardBtn");
  const musicVolumeEl = document.getElementById("musicVolume");
  const performanceNoteEl = document.getElementById("performanceNote");
  const languageSelect = document.getElementById("languageSelect");
  const envEl = document.getElementById("env");
  const envSkyEl = document.querySelector(".env-sky");
  const envParticlesEl = document.getElementById("envParticles");
  const toastEl = document.getElementById("toast");
  const stageKickerEl = document.getElementById("stageKicker");
  const stageNameEl = document.getElementById("stageName");
  const stageNextEl = document.getElementById("stageNext");
  const stageFillEl = document.getElementById("stageFill");
  const stageDots = Array.from(document.querySelectorAll(".stage-dot"));
  const comboHudEl = document.getElementById("comboHud");
  const comboValueEl = document.getElementById("comboValue");
  const worldEventLayerEl = document.getElementById("worldEventLayer");
  const finalWorldEl = document.getElementById("finalWorld");
  const finalTileEl = document.getElementById("finalTile");
  const finalComboEl = document.getElementById("finalCombo");
  const finalEmblemEl = document.getElementById("finalEmblem");
  const unrankedNoteEl = document.getElementById("unrankedNote");
  const viewBtn = document.getElementById("viewBtn");
  const gardenViewEl = document.getElementById("gardenView");
  const worldRevealEl = document.getElementById("worldReveal");
  const revealRow = document.getElementById("revealRow");
  const gameMainEl = document.querySelector("main.game");
  const announcerEl = document.getElementById("a11yAnnouncer");
  const milestoneArtEl = document.getElementById("milestoneArt");
  const victoryArtEl = document.getElementById("victoryArt");

  /* ---------- State ---------- */
  let grid;
  let tiles;
  let nextId;
  let score;
  let best;
  let goldenAchieved;
  let victoryAchieved;
  let busy;
  let queuedDirection = null;
  let cellSize;
  let gap;
  let currentStage = 0;
  let maxValueReached = 0;
  let combo = 0;
  let bestCombo = 0;
  const bloomFlow = createBloomFlow();
  let flow = 0;
  let flowTimer = null;
  let completedMoves = 0;
  // A run is its seed plus the moves played: the Worker replays exactly these
  // to verify a score. runPending is true until the first tiles are dealt.
  let runSeed = null;
  let runRng = null;
  let moveLog = "";
  let runPending = false;
  let gameGeneration = 0;
  const restartPanel = document.getElementById("newGameConfirm");
  const cancelRestart = document.getElementById("cancelNewGame");
  const confirmRestart = document.getElementById("confirmNewGame");
  const prefs = createPreferences();

  const stageMeta = stage => stageMetaFor(stage, currentLanguage);
  let currentLanguage = "en";
  function localizeGameOver(text) {
    overlayEl.querySelectorAll("[data-i18n]").forEach(el => {
      const value = text[el.dataset.i18n];
      if (value) el.textContent = value;
    });
    playerNameEl.placeholder = text.yourName;
    if (currentStage) {
      const overlayStage = overlayEl.hidden ? currentStage : stageFor(Math.max(2, maxValueReached));
      const mode = overlayEl.dataset.mode;
      finalWorldEl.textContent = !overlayEl.hidden && mode === "milestone"
        ? text.milestoneKicker
        : !overlayEl.hidden && mode === "victory"
          ? text.victoryKicker
          : stageMeta(overlayStage).name;
    }
  }
  function applyLanguage(language){
    currentLanguage=TRANSLATIONS[language]?language:"en";const text=TRANSLATIONS[currentLanguage];
    document.documentElement.lang=currentLanguage;languageSelect.value=currentLanguage;
    document.querySelectorAll("[data-i18n]").forEach(el=>{const value=text[el.dataset.i18n];if(value)el.textContent=value;});
    startPlayBtn.textContent=PLAY_LABELS[currentLanguage]||PLAY_LABELS.en;
    playerNameEl.placeholder=text.yourName;settingsBtn.setAttribute("aria-label",text.settings);viewBtn.setAttribute("aria-label",text.viewGarden);viewBtn.title=text.viewGarden;musicVolumeEl.setAttribute("aria-label",text.music);
    performanceNoteEl.textContent=lowPowerDevice?text.balanced:text.fullDetail;
    localizeGameOver(text);
    settingsCloseBtn.setAttribute("aria-label",text.closeSettings);leaderboardCloseBtn.setAttribute("aria-label",text.closeLeaderboard);
    if(tiles)Object.values(tiles).forEach(t=>{if(t&&t.el)t.el.setAttribute("aria-label",tileLabel(t.value));});
    if(currentStage)updateEvolutionUI(currentStage);
    if(leaderboard.isOpen())leaderboard.refresh();
    saveLanguage(currentLanguage);
  }

  function updateEvolutionUI(stage) {
    const meta = stageMeta(stage), text=TRANSLATIONS[currentLanguage];
    stageKickerEl.textContent = currentLanguage === "tr" ? `${text.world} ${stage} / 5` : `${text.world} ${stage} ${text.of} 5`;
    stageNameEl.textContent = meta.name;
    stageNextEl.textContent = meta.next ? `${text.nextWorld} ${meta.next}` : text.fullyEvolved;
    stageFillEl.style.width = `${((stage - 1) / 4) * 100}%`;
    stageDots.forEach((dot, index) => dot.classList.toggle("active", index <= stage - 1));
  }

  /* ---------- Saving ---------- */
  function saveGame() {
    if (!completedMoves || !grid || victoryAchieved || runSeed === null) return;
    writeSavedGame({ seed: runSeed, moves: moveLog, session: gameSession });
  }

  let menuMode = !startScreenEl.hidden;
  const tileArt = createTileArt();
  const worldEffects = createWorldEffects({ env: envEl, layer: worldEventLayerEl, prefs, getStage: () => currentStage });
  const audio = createAudio({ getStage: () => currentStage, isMenu: () => menuMode });
  // Newer, self-contained features can be switched off (src/features.js).
  const features = currentFeatures();
  let worldView = null;
  let pendingReveal = 0;

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
  const tileLabel = value => tileLabelFor(value, currentLanguage);

  function renderTileContent(el, value) {
    const lvl = levelFor(value);
    const { sprite, assetValue } = artValueFor(value);
    el.dataset.value = value;
    el.dataset.tier = sprite + 1;
    el.style.background = lvl.bg;
    el.style.setProperty("--fg", lvl.fg);
    el.setAttribute("aria-label", tileLabel(value));
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
    if (isNew && !prefs.reduceMotion) {
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
  // Deals the next tile from the run's seeded stream, so the Worker can
  // replay the same game from the recorded moves.
  function spawn() {
    const next = drawSpawn(valueGrid().flat(), runRng);
    if (!next) return null;
    maxValueReached = Math.max(maxValueReached, next.value);
    return createTile(Math.floor(next.index / SIZE), next.index % SIZE, next.value, true);
  }

  function inputBlocked() {
    return menuMode || runPending || Boolean(worldView?.active) || !restartPanel.hidden || !settingsPanel.hidden || !leaderboardModalEl.hidden || !overlayEl.hidden;
  }

  // Screen readers and Tab must not reach the game behind the start menu or a
  // modal dialog.
  function syncInert() {
    const modalOpen = !settingsPanel.hidden || !leaderboardModalEl.hidden || !lowerScoreConfirmEl.hidden;
    gameMainEl.inert = !startScreenEl.hidden || modalOpen || Boolean(worldView?.active);
    startScreenEl.inert = modalOpen;
  }
  new MutationObserver(syncInert).observe(document.body, {
    subtree: true, attributes: true, attributeFilter: ["hidden"]
  });

  function announce(message) {
    announcerEl.textContent = "";
    requestAnimationFrame(() => { announcerEl.textContent = message; });
  }

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function openDialog() {
    if (!lowerScoreConfirmEl.hidden) return lowerScoreConfirmEl;
    if (!leaderboardModalEl.hidden) return leaderboardModalEl;
    if (!settingsPanel.hidden) return settingsPanel;
    if (!overlayEl.hidden) return overlayEl;
    return null;
  }
  document.addEventListener("keydown", event => {
    // The restart confirmation has its own two-button trap.
    if (event.key !== "Tab" || !restartPanel.hidden) return;
    const dialog = openDialog();
    if (!dialog) return;
    const focusables = [...dialog.querySelectorAll(FOCUSABLE)].filter(el => el.getClientRects().length > 0);
    const target = nextFocus(focusables, document.activeElement, event.shiftKey);
    if (target) {
      event.preventDefault();
      target.focus();
    }
  });

  function move(dir) {
    if (inputBlocked()) return;
    if (busy) {
      // Keep the newest intention so fast key presses and mobile swipes never feel lost.
      queuedDirection = dir;
      return;
    }
    const plan = planMove(valueGrid(), dir);
    if (!plan.moved) return;
    const idAt = ({ r, c }) => grid[r][c];
    const newGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    const slides = plan.slides.map(slide => ({ id: idAt(slide.from), r: slide.to.r, c: slide.to.c, absorbed: slide.absorbed }));
    slides.forEach(slide => { if (!slide.absorbed) newGrid[slide.r][slide.c] = slide.id; });
    const merges = plan.merges.map(m => ({ survivor: idAt(m.survivor), absorbed: idAt(m.absorbed), value: m.value, r: m.to.r, c: m.to.c }));
    busy = true;
    grid = newGrid;

    slides.forEach(s => positionTile(s.id, s.r, s.c));

    const generation = gameGeneration;
    const finalize = () => {
      if (generation !== gameGeneration) {
        return;
      }
      completedMoves++;
      moveLog += DIRECTION_CHARS[dir];
      let stageAdvancePending = false;
      let endingPending = null;
      updateCombo(merges.length);
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
        audio.playMerge(m.value);
        if (m.value > maxValueReached) {
          maxValueReached = m.value;
          stageAdvancePending = true;
        }
        const ending = endingForMergedValue(m.value);
        if (ending === "milestone" && !goldenAchieved) {
          goldenAchieved = true;
          endingPending = "milestone";
          celebrate();
        }
        if (ending === "victory" && !victoryAchieved) {
          victoryAchieved = true;
          endingPending = "victory";
        }
      });
      pulseGameEnergy(merges.length);
      updateScore();
      // 8192 is the official ending. Do not add another random tile after the
      // winning merge; freeze the exact completed board behind the final card.
      if (endingPending !== "victory") spawn();
      if (endingPending === "victory" || isGameOver()) clearSavedGame();
      else saveGame();
      if (endingPending === "victory") showGameOver("victory");
      else if (isGameOver()) showGameOver("noMoves");
      else if (endingPending === "milestone") showMilestone();
      // Keep scene creation/theme work off the merge-finalization frame. The
      // tile update and its forced animation layouts finish first.
      if (stageAdvancePending) requestAnimationFrame(maybeEvolveEnvironment);
      busy = false;
      const nextMove = queuedDirection;
      queuedDirection = null;
      if (nextMove && !overlayEl.classList.contains("show") && !victoryAchieved) {
        requestAnimationFrame(() => move(nextMove));
      }
    };

    if (prefs.reduceMotion) finalize();
    else setTimeout(finalize, SLIDE_MS);
  }

  function valueGrid() {
    return grid.map(row => row.map(id => (id == null ? 0 : tiles[id].value)));
  }

  function isGameOver() {
    return !hasMoves(valueGrid());
  }

  function updateScore() {
    scoreEl.textContent = score;
    if (score > best) { best = score; saveBest(best); }
    bestEl.textContent = best;
  }

  function resetCombo() {
    combo = 0;
    bloomFlow.reset();
    comboHudEl.hidden = true;
    coolFlow();
  }

  function publishFlow(value) {
    flow = value;
    comboHudEl.querySelector("i").style.transform = `scaleX(${flow / 8})`;
    window.dispatchEvent(new CustomEvent("garden:combo", { detail: { combo: flow } }));
  }

  function coolFlow() {
    clearTimeout(flowTimer);
    flowTimer = null;
    bloomFlow.cool();
    publishFlow(0);
  }

  function tickFlow() {
    flowTimer = null;
    const next = bloomFlow.level(performance.now());
    if (next !== flow) publishFlow(next);
    // At most five small updates per second, only while energy remains.
    if (next > 0) flowTimer = setTimeout(tickFlow, 200);
  }

  function updateCombo(mergeCount) {
    const previousFlow = bloomFlow.level(performance.now());
    const state = bloomFlow.move(mergeCount, performance.now());
    combo = state.streak;
    bestCombo = state.best;
    comboValueEl.textContent = `${combo}×`;
    comboHudEl.hidden = combo < 2;
    publishFlow(state.flow);
    if (mergeCount > 0) audio.playComboPiano(state.streak, mergeCount);
    if ([3, 5, 8].some(tier => previousFlow < tier && state.flow >= tier)) worldEffects.event(currentStage, true);
    if (document.hidden || !restartPanel.hidden || !settingsPanel.hidden || !leaderboardModalEl.hidden) coolFlow();
    else if (flowTimer === null && flow > 0) flowTimer = setTimeout(tickFlow, 200);
  }

  function pulseGameEnergy(mergeCount) {
    if (prefs.reduceMotion || mergeCount < 1) return;
    scoreEl.getAnimations().forEach(animation => animation.cancel());
    boardEl.getAnimations().forEach(animation => animation.cancel());
    scoreEl.animate([
      { transform:"scale(1)" },{ transform:"scale(1.28)", offset:.45 },{ transform:"scale(1)" }
    ], { duration:240, easing:"cubic-bezier(.2,1.7,.35,1)" });
    const strong = mergeCount > 1;
    boardEl.animate([
      { transform:"scale(1)", filter:"saturate(1)" },
      { transform:`scale(${strong ? 1.012 : 1.006})`, filter:`saturate(${strong ? 1.08 : 1})`, offset:strong ? .42 : .48 },
      { transform:"scale(1)", filter:"saturate(1)" }
    ], { duration:strong ? 250 : 220, easing:"ease-out" });
  }

  function emitEndingParticles(artEl) {
    artEl.querySelectorAll(".milestone-mote").forEach(node => node.remove());
    if (prefs.reduceMotion || !prefs.particlesOn) return;
    const kinds = ["leaf", "spark", "firefly"];
    for (let index = 0; index < 18; index++) {
      const mote = document.createElement("i");
      const angle = (Math.PI * 2 * index) / 18 + Math.random() * .22;
      const distance = 58 + Math.random() * 42;
      mote.className = `milestone-mote milestone-mote--${kinds[index % kinds.length]}`;
      mote.style.setProperty("--mote-x", `${Math.cos(angle) * distance}px`);
      mote.style.setProperty("--mote-y", `${Math.sin(angle) * distance - 14}px`);
      mote.style.setProperty("--mote-delay", `${(index % 6) * 34}ms`);
      mote.style.setProperty("--mote-spin", `${90 + Math.random() * 240}deg`);
      artEl.appendChild(mote);
      mote.addEventListener("animationend", () => mote.remove(), { once:true });
    }
  }

  function showEndOverlay(mode) {
    coolFlow();
    const text = TRANSLATIONS[currentLanguage];
    const milestone = mode === "milestone";
    finalTitleEl.dataset.i18n = milestone ? "milestoneTitle" : mode === "victory" ? "victoryTitle" : "noMoves";
    finalExplanationEl.dataset.i18n = milestone ? "milestoneText" : mode === "victory" ? "victoryText" : "noMovesText";
    scoreFormLabelEl.dataset.i18n = mode === "victory" ? "saveFinalScore" : "joinLeaderboard";
    finalScoreLabelEl.dataset.i18n = milestone ? "currentScore" : "final";
    overlayEl.dataset.mode = mode;
    localizeGameOver(text);
    const endingStage = stageFor(Math.max(2, maxValueReached));
    finalScoreEl.textContent = Number(score).toLocaleString(currentLanguage);
    finalBestEl.textContent = Number(best).toLocaleString(currentLanguage);
    finalWorldEl.textContent = milestone ? text.milestoneKicker : mode === "victory" ? text.victoryKicker : stageMeta(endingStage).name;
    finalTileEl.textContent = Number(maxValueReached || 2).toLocaleString(currentLanguage);
    finalComboEl.textContent = `${bestCombo || 0}×`;
    finalEmblemEl.textContent = stageMeta(endingStage).emblem;
    playerNameEl.value = loadPlayerName();
    const ranked = isRankedRun();
    scoreFormEl.hidden = milestone || !ranked;
    unrankedNoteEl.hidden = milestone || ranked;
    scoreFormEl.classList.remove("success");
    scoreSubmitStatusEl.textContent = "";
    submitScoreBtn.disabled = false;
    submitScoreBtn.textContent = text.submit;
    continueMilestoneBtn.hidden = !milestone;
    playAgainBtn.hidden = milestone;
    overlayEl.dataset.stage = endingStage;
    overlayEl.hidden = false;
    overlayEl.classList.remove("ready");
    requestAnimationFrame(() => {
      overlayEl.classList.add("show");
      if (milestone) emitEndingParticles(milestoneArtEl);
      else if (mode === "victory") emitEndingParticles(victoryArtEl);
    });
    clearTimeout(showEndOverlay._readyTimer);
    showEndOverlay._readyTimer = setTimeout(() => {
      overlayEl.classList.add("ready");
      (milestone ? continueMilestoneBtn : ranked ? playerNameEl : playAgainBtn).focus();
    }, milestone ? 350 : 850);
    if (!milestone) audio.playGameOver();
  }
  function showGameOver(mode = "noMoves") { showEndOverlay(mode); }
  function showMilestone() { showEndOverlay("milestone"); }
  function hideGameOver() {
    clearTimeout(showEndOverlay._readyTimer);
    overlayEl.classList.remove("ready");
    overlayEl.classList.remove("show");
    overlayEl.hidden = true;
  }


  // Signed play session used for leaderboard anti-cheat. Requested when a
  // new game starts (see newGame()) so its issue time reflects actual play
  // duration, not "however long it took to open the submit form".
  let gameSession = null;
  let gameSessionPromise = null;
  async function ensureGameSession() {
    if (gameSessionPromise) return gameSessionPromise;
    const generation = gameGeneration;
    gameSessionPromise = (async () => {
      try {
        const response = await fetch("/api/session", {
          method: "POST",
          headers: { accept: "application/json" }
        });
        if (!response.ok) throw new Error("session_failed");
        const session = await response.json();
        if (!Number.isSafeInteger(session?.seed)) throw new Error("session_failed");
        // A slow reply must not attach itself to a newer game.
        if (generation === gameGeneration) {
          gameSession = session;
          saveGame();
        }
        return session;
      } catch (error) {
        if (generation === gameGeneration) {
          gameSession = null;
          gameSessionPromise = null;
        }
        throw new Error(TRANSLATIONS[currentLanguage].sessionError);
      }
    })();
    return gameSessionPromise;
  }

  // Only a run played from the seed of its own server session can be verified
  // and join the leaderboard; offline or failed starts are played unranked.
  function isRankedRun() {
    return Boolean(gameSession && runSeed !== null && gameSession.seed === runSeed && isSessionUsable(gameSession));
  }

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), ms);
      promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
    });
  }

  function randomSeed() {
    try { return crypto.getRandomValues(new Uint32Array(1))[0]; }
    catch (e) { return Math.floor(Math.random() * 4294967296) >>> 0; }
  }

  // Starts a fresh run: wait briefly for the server to hand out a session (and
  // with it the seed), then deal the first two tiles from that seed. If the
  // server cannot be reached the game still starts, unranked.
  async function beginRun() {
    const generation = gameGeneration;
    let session = null;
    try { session = await withTimeout(ensureGameSession(), 3000); } catch (e) {}
    if (generation !== gameGeneration || !runPending) return;
    runSeed = session ? session.seed >>> 0 : randomSeed();
    runRng = createRng(runSeed);
    moveLog = "";
    runPending = false;
    spawn();
    spawn();
    updateScore();
  }
  const leaderboardApi = createLeaderboardApi();
  const leaderboard = createLeaderboardUi({
    api: leaderboardApi,
    elements: {
      modal: leaderboardModalEl,
      closeBtn: leaderboardCloseBtn,
      list: document.getElementById("leaderboardList"),
      me: document.getElementById("leaderboardMe"),
      tabs: Array.from(document.querySelectorAll(".lb-tab")),
      tabBar: document.querySelector(".lb-tabs")
    },
    text: () => TRANSLATIONS[currentLanguage],
    language: () => currentLanguage,
    onOpen: () => { closeRestart(false); coolFlow(); queuedDirection = null; },
    returnTarget: () => (!startScreenEl.hidden ? startLeaderboardBtn : leaderboardBtn),
    syncInert
  });

  const scoreSubmit = createScoreSubmit({
    elements: {
      form: scoreFormEl,
      playerName: playerNameEl,
      submitBtn: submitScoreBtn,
      status: scoreSubmitStatusEl,
      confirm: lowerScoreConfirmEl,
      confirmTitle: document.getElementById("lowerScoreTitle"),
      confirmMessage: document.getElementById("lowerScoreMessage"),
      cancel: document.getElementById("cancelLowerScore"),
      accept: document.getElementById("confirmLowerScore")
    },
    text: () => TRANSLATIONS[currentLanguage],
    language: () => currentLanguage,
    getRun: () => ({
      ranked: isRankedRun(),
      session: gameSession,
      score,
      maxValueReached,
      bestCombo,
      moves: moveLog
    }),
    syncInert,
    // The all-time board, with the player's new rank, after a short pause.
    onSaved: () => {
      leaderboard.showAllTimeNext();
      setTimeout(leaderboard.open, 550);
    }
  });

  /* ---------- Particles (board-local, transient) ---------- */
  function emitParticles(r, c, value) {
    if (prefs.reduceMotion || !prefs.particlesOn) return;
    const p = cellPos(r, c);
    const cx = p.x + cellSize / 2;
    const cy = p.y + cellSize / 2;
    const count = value >= 1024 ? 10 : value >= 256 ? 7 : 5;
    const golden = value >= 2048;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement("div");
      const stageParticle = ["stage-snow", "stage-leaf", "stage-pollen", "stage-petal", "stage-star"][Math.max(0, currentStage - 1)];
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

  /* ---------- Golden Tree celebration ---------- */
  function celebrate() {
    showToast(TRANSLATIONS[currentLanguage].crownBloomed);
    audio.playGolden();
    if (prefs.reduceMotion) return;
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
    worldEffects.gust(true);
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

  const scenery = createFallbackScenery({
    env: envEl,
    sky: envSkyEl,
    particles: envParticlesEl,
    canAnimate: () => !prefs.reduceMotion && prefs.particlesOn
  });

  function setEnvironmentStage(stage, immediate) {
    if (stage === currentStage && !immediate) return;
    const previousStage = currentStage;
    currentStage = stage;
    envEl.dataset.stage = stage;
    scenery.renderStage(stage);
    scenery.spawnParticles(stage);
    tileArt.preloadAll();
    updateEvolutionUI(stage);
    worldEffects.schedule();
    audio.startMusic();
    if (!immediate) {
      announce(`${stageKickerEl.textContent}: ${stageNameEl.textContent}`);
      audio.playStageRise(stage);
      worldEffects.transition();
      if (previousStage && stage > previousStage) scheduleWorldReveal(stage);
    }
  }

  // The showcase waits for the merge to settle, and for anything that is in the
  // way (an ending card, a dialog) to be dealt with.
  function scheduleWorldReveal(stage) {
    if (!features.worldReveal || !prefs.revealOn) return;
    const generation = gameGeneration;
    setTimeout(() => {
      if (generation !== gameGeneration) return;
      if (!overlayEl.hidden) { pendingReveal = stage; return; }
      showWorldReveal(stage);
    }, 650);
  }

  function showWorldReveal(stage) {
    if (!worldView || worldView.active || menuMode || document.hidden) return;
    if (!restartPanel.hidden || !settingsPanel.hidden || !leaderboardModalEl.hidden || !overlayEl.hidden) return;
    const meta = stageMeta(stage);
    worldView.showReveal(stage, {
      kicker: stageKickerEl.textContent,
      name: stageNameEl.textContent,
      line: meta.line
    });
  }
  // If the Phaser scenery fails to start after the game, fall back to the SVG one.
  window.addEventListener("garden:scenery-failed", () => {
    scenery.renderStage(currentStage || 1);
    scenery.spawnParticles(currentStage || 1);
  });
  if (["localhost", "127.0.0.1"].includes(location.hostname)) window.debugSetEnvironmentStage = setEnvironmentStage;

  function maybeEvolveEnvironment() {
    const newStage = stageFor(maxValueReached);
    if (newStage !== currentStage) {
      setEnvironmentStage(newStage);
      // Brief gentle reaction on stage transition
      worldEffects.gust(false);
    }
  }

  /* ---------- New game ---------- */
  function newGame(saved = null) {
    gameGeneration++;
    completedMoves = saved ? saved.completedMoves : 0;
    closeRestart(false);
    // A restored game keeps its leaderboard session (and so its seed) across
    // a reload; a new one asks the server for a session once play starts.
    gameSession = saved?.session || null;
    gameSessionPromise = gameSession ? Promise.resolve(gameSession) : null;
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    tiles = {};
    nextId = 1;
    score = saved ? saved.score : 0;
    goldenAchieved = saved ? saved.goldenAchieved : false;
    victoryAchieved = false;
    busy = false;
    queuedDirection = null;
    maxValueReached = saved ? saved.maxValueReached : 0;
    bestCombo = saved ? saved.bestCombo : 0;
    scoreSubmit.reset();
    pendingReveal = 0;
    resetCombo();
    if (saved) bloomFlow.restore(saved.streak, saved.bestCombo);
    runSeed = saved ? saved.seed : null;
    runRng = saved ? { s: saved.rngState } : null;
    moveLog = saved ? saved.moves : "";
    runPending = !saved;
    tilesEl.innerHTML = "";
    boardEl.querySelectorAll(".particle").forEach(p => p.remove());
    tilesEl.querySelectorAll(".particle").forEach(p => p.remove());
    hideGameOver();
    setEnvironmentStage(saved ? stageFor(saved.maxValueReached) : 1, true);
    measure();
    if (saved) {
      saved.board.forEach((row, r) => row.forEach((value, c) => {
        if (value) createTile(r, c, value, false);
      }));
    } else {
      clearSavedGame();
      // The boot-time board waits behind the menu; the run (and the signed
      // timer) starts once the player actually presses Play.
      if (!menuMode) beginRun();
    }
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
  installControls({ board: boardEl, onMove: move, blocked: inputBlocked, onGesture: () => audio.ensure() });

  function closeRestart(restoreFocus = true) {
    restartPanel.hidden = true;
    newBtn.setAttribute("aria-expanded", "false");
    if (restoreFocus) newBtn.focus();
  }
  newBtn.setAttribute("aria-haspopup", "dialog");
  newBtn.setAttribute("aria-controls", "newGameConfirm");
  newBtn.addEventListener("click", () => {
    audio.ensure();
    if (!completedMoves && !busy) { newGame(); return; }
    if (!restartPanel.hidden) { closeRestart(); return; }
    queuedDirection = null;
    coolFlow();
    restartPanel.hidden = false;
    newBtn.setAttribute("aria-expanded", "true");
    cancelRestart.focus();
  });
  cancelRestart.addEventListener("click", () => closeRestart());
  confirmRestart.addEventListener("click", () => { newGame(); newBtn.focus(); });
  document.addEventListener("click", event => {
    if (!restartPanel.hidden && !restartPanel.contains(event.target) && !newBtn.contains(event.target)) closeRestart(false);
  });
  restartPanel.addEventListener("keydown", event => {
    if (event.key === "Tab") {
      event.preventDefault();
      (document.activeElement === cancelRestart ? confirmRestart : cancelRestart).focus();
    }
  });
  playAgainBtn.addEventListener("click", () => { audio.ensure(); newGame(); });
  continueMilestoneBtn.addEventListener("click", () => {
    hideGameOver();
    boardEl.focus?.();
    // The world that unlocked together with the milestone gets its showcase now.
    if (pendingReveal) {
      const stage = pendingReveal;
      pendingReveal = 0;
      setTimeout(() => showWorldReveal(stage), 450);
    }
  });
  startPlayBtn.addEventListener("click", () => {
    audio.ensure();
    menuMode = false;
    if (runPending) beginRun();
    window.dispatchEvent(new CustomEvent("garden:game-started"));
    audio.startGameplayMusic();
    startScreenEl.classList.add("leaving");
    const finish = () => {
      startScreenEl.hidden = true;
      syncInert();
      startScreenEl.classList.remove("leaving");
      document.body.classList.remove("start-menu-active");
      boardEl.focus?.();
    };
    if (prefs.reduceMotion) finish(); else setTimeout(finish, 480);
  });
  startLeaderboardBtn.addEventListener("click", leaderboard.open);
  leaderboardBtn.addEventListener("click", leaderboard.open);

  // Settings panel
  function applyVisualPrefs() {
    document.body.classList.toggle("motion-off", !prefs.motionOn);
    document.body.classList.toggle("particles-off", !prefs.particlesOn);
    document.body.classList.toggle("high-contrast", prefs.contrastOn);
    if (prefs.particlesOn) scenery.spawnParticles(Math.max(1, currentStage));
    else scenery.clearParticles();
    window.dispatchEvent(new CustomEvent("garden:preferences", { detail: {
      motionOn: prefs.motionOn, particlesOn: prefs.particlesOn, contrastOn: prefs.contrastOn
    }}));
  }
  const settings = createSettingsPanel({
    elements: {
      button: settingsBtn,
      startButton: startSettingsBtn,
      panel: settingsPanel,
      backdrop: document.getElementById("settingsBackdrop"),
      closeButton: settingsCloseBtn,
      musicVolume: musicVolumeEl,
      musicVolumeValue: document.getElementById("musicVolumeValue"),
      piano: document.getElementById("pianoToggle"),
      sfx: document.getElementById("sfxToggle"),
      motion: document.getElementById("motionToggle"),
      particles: document.getElementById("particlesToggle"),
      contrast: document.getElementById("contrastToggle"),
      reveal: document.getElementById("revealToggle"),
      language: languageSelect
    },
    audio,
    prefs,
    applyLanguage,
    hooks: {
      onOpen: () => { closeRestart(false); coolFlow(); queuedDirection = null; },
      onVisualChange: applyVisualPrefs,
      startMenuShowing: () => !startScreenEl.hidden
    },
    syncInert
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !restartPanel.hidden) { closeRestart(); return; }
    if (e.key === "Escape" && leaderboard.isOpen()) {
      leaderboard.close();
      return;
    }
    if (e.key === "Escape" && settings.isOpen()) settings.close();
  });

  // Start fetching the tile pictures while the player is still on the menu.
  tileArt.preloadAll();

  // Resize handling
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyLayout, 80);
  });
  // The board can change size without a window resize (a phone browser's toolbar
  // sliding away, the safe areas, fonts settling, a dialog closing): measure the
  // board itself so the tiles always sit on the cells.
  if (typeof ResizeObserver === "function") {
    let layoutFrame = 0;
    let lastBoardWidth = boardEl.clientWidth;
    new ResizeObserver(() => {
      if (boardEl.clientWidth === lastBoardWidth) return;
      lastBoardWidth = boardEl.clientWidth;
      cancelAnimationFrame(layoutFrame);
      layoutFrame = requestAnimationFrame(applyLayout);
    }).observe(boardEl);
  }

  // Conserve battery/GPU time on modest devices and whenever the page is not visible.
  const lowPowerDevice = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  document.body.classList.toggle("perf-low", Boolean(lowPowerDevice));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { coolFlow(); queuedDirection = null; }
    document.body.classList.toggle("page-hidden", document.hidden);
  });

  /* ---------- Boot ---------- */
  best = loadBest();
  bestEl.textContent = best;
  applyLanguage(loadLanguage());
  applyVisualPrefs();
  settings.sync();
  buildGrid();
  // Look around the world instead of playing.
  viewBtn.hidden = !features.gardenView;
  revealRow.hidden = !features.worldReveal;
  document.body.classList.toggle("no-garden-view", !features.gardenView);
  worldView = createWorldView({
    env: envEl,
    world: document.getElementById("phaserWorld"),
    view: gardenViewEl,
    reveal: worldRevealEl,
    getStage: () => currentStage || 1,
    getMotion: () => ({ reduced: prefs.calm }),
    canPan: () => Boolean(window.gardenEngine),
    announce,
    text: key => TRANSLATIONS[currentLanguage][key],
    onChange: active => {
      if (active) { queuedDirection = null; coolFlow(); }
      syncInert();
    }
  });
  viewBtn.addEventListener("click", () => {
    if (inputBlocked()) return;
    document.getElementById("gvKicker").textContent = stageKickerEl.textContent;
    document.getElementById("gvName").textContent = stageNameEl.textContent;
    worldView.enterView();
  });
  syncInert();
  setEnvironmentStage(1, true);
  newGame(loadSavedGame());
  // Local art direction helper: http://localhost:4173/?stage=2
  if (["localhost", "127.0.0.1"].includes(location.hostname)) {
    const previewParams = new URLSearchParams(location.search);
    const previewStage = Number(previewParams.get("stage"));
    if (previewStage >= 1 && previewStage <= 5) setEnvironmentStage(previewStage, true);
    // Local-only art review: show the complete current tile progression
    // without altering normal starts, saved data, scoring or production play.
    if (previewParams.get("tiles") === "preview") {
      grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
      tiles = {};nextId = 1;tilesEl.innerHTML = "";
      const previewValues=[2,4,8,16,32,64,128,256,512,1024,2048,2];
      previewValues.forEach((value,index)=>createTile(Math.floor(index/SIZE),index%SIZE,value,false));
    }
    const previewEnding = previewParams.get("ending");
    if (previewEnding === "milestone" || previewEnding === "victory") {
      const finalValue = previewEnding === "victory" ? 8192 : 2048;
      menuMode = false;
      startScreenEl.hidden = true;
      document.body.classList.remove("start-menu-active");
      score = previewEnding === "victory" ? 32768 : 8192;
      maxValueReached = finalValue;
      goldenAchieved = true;
      victoryAchieved = previewEnding === "victory";
      updateScore();
      setEnvironmentStage(5, true);
      previewEnding === "victory" ? showGameOver("victory") : showMilestone();
    }
  }
})();
