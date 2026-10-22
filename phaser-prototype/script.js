/* ============================================================
   Garden Evolution - a relaxing 2048-inspired garden game.

   This file is the game itself and the place where the pieces meet. Each piece
   lives in its own module under src/ and knows nothing of the others:

     rules and data   board.js, game-core.js, game-rules.js, game-save.js, levels.js,
                      daily.js and daily-offer.js (today's garden), achievements.js
     the page         board-view.js, tile-art.js, end-card.js, combo-hud.js, toast.js,
                      dialogs.js, settings-panel.js, achievements-panel.js, controls.js, world-view.js,
                      world-effects.js, scenery-fallback.js (the Phaser backdrop is
                      src/engine.js, loaded separately by main.js)
     sound            audio.js
     the server       game-session.js, leaderboard-api.js, leaderboard-ui.js, score-submit.js
     the player       preferences.js, storage.js, i18n.js, features.js

   What stays here is what ties them together: the run's state (the grid of
   tile ids, the score, the move log), the rules of a move, starting a game, which
   world is showing, and the boot sequence at the bottom.
   ============================================================ */
import { createAchievements } from "./src/achievements.js";
import { createAchievementsPanel } from "./src/achievements-panel.js";
import { BOARD_SIZE, hasMoves, planMove } from "./src/board.js";
import { createBoardView } from "./src/board-view.js";
import { createComboHud } from "./src/combo-hud.js";
import { installControls } from "./src/controls.js";
import { dayKey, dayLabel } from "./src/daily.js";
import { dailyOffer, untilNextGarden } from "./src/daily-offer.js";
import { createDialogs } from "./src/dialogs.js";
import { createEndCard } from "./src/end-card.js";
import { createFallbackScenery } from "./src/scenery-fallback.js";
import { currentFeatures } from "./src/features.js";
import { DIRECTION_CHARS, createRng, drawSpawn } from "./src/game-core.js";
import { endingForMergedValue } from "./src/game-rules.js";
import { createInstallHint } from "./src/install.js";
import { createGameSession, randomSeed, withTimeout } from "./src/game-session.js";
import { PLAY_LABELS, TRANSLATIONS } from "./src/i18n.js";
import { createLeaderboardApi } from "./src/leaderboard-api.js";
import { createLeaderboardUi } from "./src/leaderboard-ui.js";
import { artValueFor, plantName, stageFor, stageMeta as stageMetaFor } from "./src/levels.js";
import { captureBackdrop, createShareButton } from "./src/share.js";
import { createAudio } from "./src/audio.js";
import { createPreferences } from "./src/preferences.js";
import { createScoreSubmit } from "./src/score-submit.js";
import { createSettingsPanel } from "./src/settings-panel.js";
import {
  clearSavedGame, loadAchievements, loadBest, loadDailyRecord, loadLanguage, loadSavedGame, saveAchievements,
  saveBest, saveDailyRecord, saveLanguage, writeSavedGame
} from "./src/storage.js";
import { createTileArt, tileArtUrl } from "./src/tile-art.js";
import { createToast } from "./src/toast.js";
import { createWorldEffects } from "./src/world-effects.js";
import { createWorldView } from "./src/world-view.js";

const SIZE = BOARD_SIZE;
const SLIDE_MS = 115;

/* ---------- DOM refs ---------- */
const boardEl = document.getElementById("board");
const gridEl = document.getElementById("grid");
const tilesEl = document.getElementById("tiles");
const overlayEl = document.getElementById("overlay");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const newBtn = document.getElementById("newBtn");
const playAgainBtn = document.getElementById("playAgainBtn");
const continueMilestoneBtn = document.getElementById("continueMilestoneBtn");
const leaderboardBtn = document.getElementById("leaderboardBtn");
const leaderboardModalEl = document.getElementById("leaderboardModal");
const leaderboardCloseBtn = document.getElementById("leaderboardClose");
const scoreFormEl = document.getElementById("scoreForm");
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
const startDailyBtn = document.getElementById("startDailyBtn");
const startDailySubEl = document.getElementById("startDailySub");
const startAchievementsBtn = document.getElementById("startAchievementsBtn");
const settingsAchievementsBtn = document.getElementById("settingsAchievementsBtn");
const achievementsModalEl = document.getElementById("achievementsModal");
const modeBadgeEl = document.getElementById("modeBadge");
const normalGameBtn = document.getElementById("normalGameBtn");
const restartWarningEl = document.getElementById("newGameConfirmText");
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
const viewBtn = document.getElementById("viewBtn");
const gardenViewEl = document.getElementById("gardenView");
const worldRevealEl = document.getElementById("worldReveal");
const revealRow = document.getElementById("revealRow");
const gameMainEl = document.querySelector("main.game");
const announcerEl = document.getElementById("a11yAnnouncer");

/* ---------- State ---------- */
let grid;
let score;
let best;
let goldenAchieved;
let victoryAchieved;
let busy;
let queuedDirection = null;
let currentStage = 0;
let maxValueReached = 0;
let bestCombo = 0;
let completedMoves = 0;
// A run is its seed plus the moves played: the Worker replays exactly these
// to verify a score. runPending is true until the first tiles are dealt.
let runSeed = null;
let runRng = null;
let moveLog = "";
let runPending = false;
let gameGeneration = 0;
// Which garden this run is: "classic", or today's garden ("daily" is its one
// ranked try, "practice" the same seed again, unranked). runDay is that garden's
// day, practiceSeed the seed a practice run is dealt from.
let runMode = "classic";
let runDay = null;
let practiceSeed = null;
const slotOf = mode => (mode === "classic" ? "classic" : "daily");
const inDailyGarden = () => runMode !== "classic";
const restartPanel = document.getElementById("newGameConfirm");
const cancelRestart = document.getElementById("cancelNewGame");
const confirmRestart = document.getElementById("confirmNewGame");
const prefs = createPreferences();

const stageMeta = stage => stageMetaFor(stage, currentLanguage);
let currentLanguage = "en";
// Show the whole page in a language: every labelled piece of text, the play
// button, the aria-labels, the end card, the tiles' names and the world HUD.
function applyLanguage(language) {
  currentLanguage = TRANSLATIONS[language] ? language : "en";
  const text = TRANSLATIONS[currentLanguage];
  document.documentElement.lang = currentLanguage;
  languageSelect.value = currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const value = text[el.dataset.i18n];
    if (value) el.textContent = value;
  });
  startPlayBtn.textContent = PLAY_LABELS[currentLanguage] || PLAY_LABELS.en;
  playerNameEl.placeholder = text.yourName;
  settingsBtn.setAttribute("aria-label", text.settings);
  viewBtn.setAttribute("aria-label", text.viewGarden);
  viewBtn.title = text.viewGarden;
  musicVolumeEl.setAttribute("aria-label", text.music);
  performanceNoteEl.textContent = lowPowerDevice ? text.balanced : text.fullDetail;
  endCard.localize();
  settingsCloseBtn.setAttribute("aria-label", text.closeSettings);
  leaderboardCloseBtn.setAttribute("aria-label", text.closeLeaderboard);
  boardView.relabel();
  if (currentStage) updateEvolutionUI(currentStage);
  if (leaderboard.isOpen()) leaderboard.refresh();
  achievementsPanel.refresh();
  document.getElementById("achievementsClose").setAttribute("aria-label", text.closeAchievements);
  updateModeBadge();
  updateDailyButton();
  saveLanguage(currentLanguage);
}

// "World 3 of 5" in the player's language.
function worldKicker(stage) {
  const text = TRANSLATIONS[currentLanguage];
  return currentLanguage === "tr" ? `${text.world} ${stage} / 5` : `${text.world} ${stage} ${text.of} 5`;
}

// The world HUD: "World 3 of 5", its name, what unlocks the next one, and the progress dots.
function updateEvolutionUI(stage) {
  const meta = stageMeta(stage);
  const text = TRANSLATIONS[currentLanguage];
  stageKickerEl.textContent = worldKicker(stage);
  stageNameEl.textContent = meta.name;
  stageNextEl.textContent = meta.next ? `${text.nextWorld} ${meta.next}` : text.fullyEvolved;
  stageFillEl.style.width = `${((stage - 1) / 4) * 100}%`;
  stageDots.forEach((dot, index) => dot.classList.toggle("active", index <= stage - 1));
}

/* ---------- Saving ---------- */
function saveGame() {
  if (!completedMoves || !grid || victoryAchieved || runSeed === null) return;
  writeSavedGame({ seed: runSeed, moves: moveLog, session: gameSession.current, mode: runMode, day: runDay }, slotOf(runMode));
}

/* ---------- Today's garden ---------- */
const dayText = day => dayLabel(day, currentLanguage);

// What the Today's Garden button would start now.
const currentDailyOffer = () => dailyOffer(loadDailyRecord(), loadSavedGame("daily"), dayKey());

// The menu button's second line: the ranked try, carrying on, or practice
// with the time until the next garden.
function updateDailyButton() {
  const text = TRANSLATIONS[currentLanguage];
  const offer = currentDailyOffer();
  startDailyBtn.dataset.offer = offer.kind;
  startDailySubEl.textContent = offer.kind === "ranked" ? text.dailyRanked
    : offer.kind === "continue" ? text.dailyContinue
    : text.dailyPractice.replace("{when}", untilNextGarden(currentLanguage));
}
// Keep the countdown honest while the menu is showing (and pass midnight).
setInterval(() => { if (!startScreenEl.hidden && !document.hidden) updateDailyButton(); }, 30000);

// In today's garden the hint line says which garden this is.
function updateModeBadge() {
  const daily = inDailyGarden() && runDay;
  modeBadgeEl.hidden = !daily;
  document.body.classList.toggle("daily-run", Boolean(daily));
  if (!daily) return;
  const text = TRANSLATIONS[currentLanguage];
  modeBadgeEl.dataset.mode = runMode;
  modeBadgeEl.textContent = (runMode === "daily" ? text.dailyBadge : text.practiceBadge).replace("{day}", dayText(runDay));
}

// Today's garden: carry on with a run of it left unfinished, or start the
// ranked try, or (once that is used) practise the same garden unranked.
function openDailyGarden() {
  const offer = currentDailyOffer();
  if (offer.kind === "continue") newGame(offer.saved);
  else newGame(null, { mode: offer.kind === "practice" ? "practice" : "daily", day: offer.day, seed: offer.seed });
}

// The ranked try is used once its first move is played: leaving the run and
// starting again turns into practice (the server keeps one entry per device).
function markDailyUsed() {
  if (runMode !== "daily" || !runDay || runSeed === null) return;
  const record = loadDailyRecord();
  if (record?.day === runDay && record.used) return;
  saveDailyRecord({ day: runDay, seed: runSeed, used: true });
}

let menuMode = !startScreenEl.hidden;
const tileArt = createTileArt();
const boardView = createBoardView({
  board: boardEl,
  grid: gridEl,
  tiles: tilesEl,
  prefs,
  tileArt,
  language: () => currentLanguage,
  getStage: () => currentStage
});
const toast = createToast(toastEl);
// Achievements, on this device only (src/achievements.js). An unlock is told
// with a short message; several at once share it.
const achievements = createAchievements({
  load: loadAchievements,
  save: saveAchievements,
  initialBest: loadBest(),
  onUnlock: unlocked => {
    const text = TRANSLATIONS[currentLanguage];
    toast.show(`🏅 ${text.achUnlocked.replace("{name}", unlocked.map(a => text[`ach_${a.id}`]).join(", "))}`);
    achievementsPanel.refresh();
  }
});
const worldEffects = createWorldEffects({ env: envEl, layer: worldEventLayerEl, prefs, getStage: () => currentStage });
const audio = createAudio({ getStage: () => currentStage, isMenu: () => menuMode });
const comboHud = createComboHud({
  elements: { hud: comboHudEl, value: comboValueEl, score: scoreEl, board: boardEl },
  prefs,
  quiet: () => document.hidden || dialogs.menusOpen(),
  onMerges: (streak, mergeCount) => audio.playComboPiano(streak, mergeCount),
  onTier: () => worldEffects.event(currentStage, true)
});
// Newer, self-contained features can be switched off (src/features.js).
const features = currentFeatures();
let worldView = null;
let pendingReveal = 0;

// Dialogs decide what is reachable: the game goes inert behind a modal, moves
// are ignored, Tab stays inside the open dialog.
const dialogs = createDialogs({
  elements: {
    main: gameMainEl,
    startScreen: startScreenEl,
    restart: restartPanel,
    settings: settingsPanel,
    leaderboard: leaderboardModalEl,
    achievements: achievementsModalEl,
    scoreConfirm: lowerScoreConfirmEl,
    endCard: overlayEl,
    announcer: announcerEl
  },
  viewActive: () => worldView?.active
});
const syncInert = dialogs.sync;
const announce = dialogs.announce;
const inputBlocked = () => menuMode || runPending || dialogs.blocking();

// A tile on the board: the view draws it, the grid below remembers where it is.
function addTile(r, c, value, isNew) {
  const id = boardView.create(r, c, value, isNew);
  grid[r][c] = id;
  return id;
}

/* ---------- Game logic (unchanged 2048 rules) ---------- */
// Deals the next tile from the run's seeded stream, so the Worker can
// replay the same game from the recorded moves.
function spawn() {
  const next = drawSpawn(valueGrid().flat(), runRng);
  if (!next) return null;
  maxValueReached = Math.max(maxValueReached, next.value);
  return addTile(Math.floor(next.index / SIZE), next.index % SIZE, next.value, true);
}

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

  slides.forEach(s => boardView.place(s.id, s.r, s.c));

  const generation = gameGeneration;
  const finalize = () => {
    if (generation !== gameGeneration) {
      return;
    }
    completedMoves++;
    moveLog += DIRECTION_CHARS[dir];
    let stageAdvancePending = false;
    let endingPending = null;
    bestCombo = comboHud.update(merges.length).best;
    merges.forEach(m => {
      boardView.remove(m.absorbed);
      if (!boardView.merge(m.survivor, m.value)) return;
      boardView.puff(m.r, m.c, m.value);
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
    comboHud.pulse(merges.length);
    updateScore();
    if (completedMoves === 1) markDailyUsed();
    achievements.progress({ score, maxTile: maxValueReached, combo: bestCombo });
    // 8192 is the official ending. Do not add another random tile after the
    // winning merge; freeze the exact completed board behind the final card.
    if (endingPending !== "victory") spawn();
    const finished = endingPending === "victory" || isGameOver();
    if (finished) {
      clearSavedGame(slotOf(runMode));
      achievements.finish({ score, maxTile: maxValueReached, combo: bestCombo, mode: runMode, day: runDay });
    } else saveGame();
    if (endingPending === "victory") endCard.show("victory");
    else if (isGameOver()) endCard.show("noMoves");
    else if (endingPending === "milestone") endCard.show("milestone");
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
  return grid.map(row => row.map(id => (id == null ? 0 : boardView.valueOf(id))));
}

function isGameOver() {
  return !hasMoves(valueGrid());
}

function updateScore() {
  scoreEl.textContent = score;
  if (score > best) { best = score; saveBest(best); }
  bestEl.textContent = best;
}

const gameSession = createGameSession({
  getGeneration: () => gameGeneration,
  errorMessage: () => TRANSLATIONS[currentLanguage].sessionError,
  onIssued: () => saveGame(),
  getMode: () => runMode
});
const isRankedRun = () => gameSession.isRanked(runSeed);

// Starts a fresh run: wait briefly for the server to hand out a session (and
// with it the seed), then deal the first two tiles from that seed. If the
// server cannot be reached the game still starts, unranked.
// Practice of today's garden needs no server: its seed is already known.
// Today's ranked try needs one (the seed comes with the session); without a
// connection a normal game starts instead.
async function beginRun() {
  const generation = gameGeneration;
  let session = null;
  if (runMode !== "practice") {
    try { session = await withTimeout(gameSession.ensure(), 3000); } catch (e) {}
  }
  if (generation !== gameGeneration || !runPending) return;
  if (runMode === "daily" && !session) {
    // Back to the normal game (its own slot), so this run cannot overwrite it.
    toast.show(TRANSLATIONS[currentLanguage].dailyOffline);
    openNormalGame();
    return;
  }
  if (runMode === "daily") {
    runDay = session.daily;
    const record = loadDailyRecord();
    // A new day's garden: remember its seed so it can be practised later.
    if (record?.day !== runDay) saveDailyRecord({ day: runDay, seed: session.seed >>> 0, used: false });
    updateModeBadge();
  }
  runSeed = runMode === "practice" ? practiceSeed >>> 0 : session ? session.seed >>> 0 : randomSeed();
  runRng = createRng(runSeed);
  moveLog = "";
  runPending = false;
  spawn();
  spawn();
  updateScore();
}
const endCard = createEndCard({
  elements: {
    overlay: overlayEl,
    finalScore: document.getElementById("finalScore"),
    finalBest: document.getElementById("finalBest"),
    finalTitle: document.getElementById("finalTitle"),
    finalExplanation: document.getElementById("finalExplanation"),
    scoreForm: scoreFormEl,
    playerName: playerNameEl,
    submitBtn: submitScoreBtn,
    status: scoreSubmitStatusEl,
    continueBtn: continueMilestoneBtn,
    playAgainBtn,
    finalWorld: document.getElementById("finalWorld"),
    finalTile: document.getElementById("finalTile"),
    finalCombo: document.getElementById("finalCombo"),
    finalEmblem: document.getElementById("finalEmblem"),
    unrankedNote: document.getElementById("unrankedNote"),
    milestoneArt: document.getElementById("milestoneArt"),
    victoryArt: document.getElementById("victoryArt"),
    normalGameBtn
  },
  prefs,
  text: () => TRANSLATIONS[currentLanguage],
  language: () => currentLanguage,
  snapshot: () => ({ score, best, maxValueReached, bestCombo, ranked: isRankedRun(), currentStage, mode: runMode }),
  onShow: () => {
    comboHud.cool();
    // Draw the share card now, so a tap on Share can open the share sheet at once.
    setTimeout(() => shareButton.prepare(), 250);
  },
  playGameOver: () => audio.playGameOver()
});

// Sharing the run on the end card (src/share.js).
const shareButton = createShareButton({
  button: document.getElementById("shareBtn"),
  text: () => TRANSLATIONS[currentLanguage],
  getResult: () => {
    if (overlayEl.hidden) return null;
    const top = Math.max(2, maxValueReached);
    const stage = stageFor(top);
    const text = TRANSLATIONS[currentLanguage];
    const daily = inDailyGarden() && runDay;
    return {
      mode: overlayEl.dataset.mode,
      score,
      worldName: stageMeta(stage).name,
      // Today's garden says so on the card and in the text: everyone had the same one.
      worldKicker: daily ? text.dailyBadge.replace("{day}", dayText(runDay)) : worldKicker(stage),
      prefix: daily ? text.shareDaily.replace("{day}", dayText(runDay)) : "",
      daily: Boolean(daily),
      plantName: plantName(top, currentLanguage),
      plantArt: tileArtUrl(artValueFor(top).assetValue),
      language: currentLanguage
    };
  },
  capture: () => captureBackdrop({ engine: window.gardenEngine, plate: document.getElementById("phaserWorld"), stage: currentStage }),
  onOutcome: outcome => {
    if (outcome === "image" || outcome === "text" || outcome === "copied") achievements.event("share");
    if (outcome === "copied") toast.show(TRANSLATIONS[currentLanguage].shareCopied);
    else if (outcome === "unavailable") toast.show(TRANSLATIONS[currentLanguage].shareUnavailable);
  }
});

const leaderboardApi = createLeaderboardApi();
const leaderboard = createLeaderboardUi({
  api: leaderboardApi,
  elements: {
    modal: leaderboardModalEl,
    closeBtn: leaderboardCloseBtn,
    list: document.getElementById("leaderboardList"),
    me: document.getElementById("leaderboardMe"),
    tabs: Array.from(document.querySelectorAll(".lb-tab")),
    tabBar: document.querySelector(".lb-tabs"),
    daily: document.getElementById("leaderboardDaily"),
    dailyWhen: document.getElementById("leaderboardDailyWhen"),
    dailyPlay: document.getElementById("leaderboardDailyPlay")
  },
  text: () => TRANSLATIONS[currentLanguage],
  language: () => currentLanguage,
  onOpen: () => { closeRestart(false); comboHud.cool(); queuedDirection = null; },
  returnTarget: () => (!startScreenEl.hidden ? startLeaderboardBtn : leaderboardBtn),
  syncInert,
  daily: {
    when: () => `${dayText(dayKey())} · ${TRANSLATIONS[currentLanguage].dailyNext.replace("{when}", untilNextGarden(currentLanguage))}`,
    // Nothing to offer while already playing today's garden in the game.
    action: () => {
      if (startScreenEl.hidden && inDailyGarden() && runDay === dayKey()) return null;
      const text = TRANSLATIONS[currentLanguage];
      const kind = currentDailyOffer().kind;
      return kind === "ranked" ? text.dailyPlay : kind === "continue" ? text.dailyContinueBtn : text.dailyPracticeBtn;
    },
    play: () => {
      if (!startScreenEl.hidden) { openDailyGarden(); leaveMenu(); return; }
      saveGame();
      openDailyGarden();
      boardEl.focus?.();
    }
  }
});

const achievementsPanel = createAchievementsPanel({
  achievements,
  elements: {
    modal: achievementsModalEl,
    closeBtn: document.getElementById("achievementsClose"),
    summary: document.getElementById("achievementsSummary"),
    stats: document.getElementById("achievementsStats"),
    list: document.getElementById("achievementsList")
  },
  text: () => TRANSLATIONS[currentLanguage],
  language: () => currentLanguage,
  onOpen: () => { closeRestart(false); comboHud.cool(); queuedDirection = null; if (settings.isOpen()) settings.close(); },
  returnTarget: () => (!startScreenEl.hidden ? startAchievementsBtn : settingsBtn),
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
    session: gameSession.current,
    score,
    maxValueReached,
    bestCombo,
    moves: moveLog
  }),
  syncInert,
  // The board the score joined (all time, or today's garden), with the
  // player's new rank, after a short pause.
  onSaved: data => {
    leaderboard.showNext(data?.daily ? "daily" : "all");
    setTimeout(leaderboard.open, 550);
  }
});

// The Golden Tree: a message, a chime, and (unless motion is reduced) a burst.
function celebrate() {
  toast.show(TRANSLATIONS[currentLanguage].crownBloomed);
  audio.playGolden();
  if (prefs.reduceMotion) return;
  boardView.celebrate();
  worldEffects.gust(true);
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
  if (dialogs.menusOpen() || !overlayEl.hidden) return;
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
// saved: a run to restore (it knows its own mode). Otherwise start says which
// garden to begin: { mode, day, seed } (today's garden), or a normal game.
function newGame(saved = null, start = { mode: "classic" }) {
  shareButton.forget();
  gameGeneration++;
  runMode = saved ? saved.mode : start.mode;
  runDay = saved ? saved.day : start.day ?? null;
  practiceSeed = runMode === "practice" && !saved ? start.seed : null;
  updateModeBadge();
  completedMoves = saved ? saved.completedMoves : 0;
  closeRestart(false);
  // A restored game keeps its leaderboard session (and so its seed) across
  // a reload; a new one asks the server for a session once play starts.
  gameSession.adopt(saved?.session);
  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  score = saved ? saved.score : 0;
  goldenAchieved = saved ? saved.goldenAchieved : false;
  victoryAchieved = false;
  busy = false;
  queuedDirection = null;
  maxValueReached = saved ? saved.maxValueReached : 0;
  bestCombo = saved ? saved.bestCombo : 0;
  scoreSubmit.reset();
  pendingReveal = 0;
  comboHud.reset();
  if (saved) comboHud.restore(saved.streak, saved.bestCombo);
  runSeed = saved ? saved.seed : null;
  runRng = saved ? { s: saved.rngState } : null;
  moveLog = saved ? saved.moves : "";
  runPending = !saved;
  boardView.reset();
  endCard.hide();
  setEnvironmentStage(saved ? stageFor(saved.maxValueReached) : 1, true);
  boardView.measure();
  if (saved) {
    saved.board.forEach((row, r) => row.forEach((value, c) => {
      if (value) addTile(r, c, value, false);
    }));
  } else {
    clearSavedGame(slotOf(runMode));
    // The boot-time board waits behind the menu; the run (and the signed
    // timer) starts once the player actually presses Play.
    if (!menuMode) beginRun();
  }
  updateScore();
}

// New Game and Play Again stay in the same garden: a normal game starts a new
// normal game, today's garden goes back to today's garden (practice, once its
// ranked try is used, or a new day's garden after midnight).
function restartSameGarden() {
  if (!inDailyGarden()) { newGame(); return; }
  clearSavedGame("daily");
  openDailyGarden();
}
// Back to the normal game, carrying on with one left unfinished.
const openNormalGame = () => newGame(loadSavedGame("classic"));

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
  if (!completedMoves && !busy) { restartSameGarden(); return; }
  if (!restartPanel.hidden) { closeRestart(); return; }
  queuedDirection = null;
  comboHud.cool();
  restartWarningEl.textContent = TRANSLATIONS[currentLanguage][runMode === "daily" ? "dailyRestartWarning" : "restartWarning"];
  restartPanel.hidden = false;
  newBtn.setAttribute("aria-expanded", "true");
  cancelRestart.focus();
});
cancelRestart.addEventListener("click", () => closeRestart());
confirmRestart.addEventListener("click", () => { restartSameGarden(); newBtn.focus(); });
document.addEventListener("click", event => {
  if (!restartPanel.hidden && !restartPanel.contains(event.target) && !newBtn.contains(event.target)) closeRestart(false);
});
restartPanel.addEventListener("keydown", event => {
  if (event.key === "Tab") {
    event.preventDefault();
    (document.activeElement === cancelRestart ? confirmRestart : cancelRestart).focus();
  }
});
playAgainBtn.addEventListener("click", () => { audio.ensure(); restartSameGarden(); });
normalGameBtn.addEventListener("click", () => { audio.ensure(); openNormalGame(); boardEl.focus?.(); });
continueMilestoneBtn.addEventListener("click", () => {
  endCard.hide();
  boardEl.focus?.();
  // The world that unlocked together with the milestone gets its showcase now.
  if (pendingReveal) {
    const stage = pendingReveal;
    pendingReveal = 0;
    setTimeout(() => showWorldReveal(stage), 450);
  }
});
// Leaving the start menu for the run on the board.
function leaveMenu() {
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
}
startPlayBtn.addEventListener("click", () => {
  // The board behind the menu is the normal game unless something else was opened there.
  if (inDailyGarden()) openNormalGame();
  leaveMenu();
});
startDailyBtn.addEventListener("click", () => {
  openDailyGarden();
  leaveMenu();
});
startLeaderboardBtn.addEventListener("click", leaderboard.open);
startAchievementsBtn.addEventListener("click", achievementsPanel.open);
settingsAchievementsBtn.addEventListener("click", achievementsPanel.open);
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
    onOpen: () => { closeRestart(false); comboHud.cool(); queuedDirection = null; },
    onVisualChange: applyVisualPrefs,
    startMenuShowing: () => !startScreenEl.hidden
  },
  syncInert
});
// "Add to home screen", only where it can help (see src/install.js).
createInstallHint({
  row: document.getElementById("installRow"),
  button: document.getElementById("installBtn"),
  steps: document.getElementById("installSteps")
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !restartPanel.hidden) { closeRestart(); return; }
  if (e.key === "Escape" && leaderboard.isOpen()) {
    leaderboard.close();
    return;
  }
  if (e.key === "Escape" && achievementsPanel.isOpen()) {
    achievementsPanel.close();
    return;
  }
  if (e.key === "Escape" && settings.isOpen()) settings.close();
});

// Start fetching the tile pictures while the player is still on the menu.
tileArt.preloadAll();

// Keep the tiles on their cells as the board changes size.
boardView.watchSize();

// Conserve battery/GPU time on modest devices and whenever the page is not visible.
const lowPowerDevice = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
document.body.classList.toggle("perf-low", Boolean(lowPowerDevice));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { comboHud.cool(); queuedDirection = null; }
  document.body.classList.toggle("page-hidden", document.hidden);
});

/* ---------- Boot ---------- */
best = loadBest();
bestEl.textContent = best;
applyLanguage(loadLanguage());
applyVisualPrefs();
settings.sync();
boardView.buildGrid();
// Look around the world instead of playing.
viewBtn.hidden = !features.gardenView;
revealRow.hidden = !features.worldReveal;
document.body.classList.toggle("no-garden-view", !features.gardenView);
worldView = createWorldView({
  view: gardenViewEl,
  reveal: worldRevealEl,
  getStage: () => currentStage || 1,
  getMotion: () => ({ reduced: prefs.calm }),
  canPan: () => Boolean(window.gardenEngine),
  announce,
  text: key => TRANSLATIONS[currentLanguage][key],
  onChange: active => {
    if (active) { queuedDirection = null; comboHud.cool(); }
    syncInert();
  }
});
viewBtn.addEventListener("click", () => {
  if (inputBlocked()) return;
  document.getElementById("gvKicker").textContent = stageKickerEl.textContent;
  document.getElementById("gvName").textContent = stageNameEl.textContent;
  worldView.enterView();
  achievements.event("gardenView");
});
syncInert();
setEnvironmentStage(1, true);
newGame(loadSavedGame("classic"));
updateDailyButton();
// Local art direction helper: http://localhost:4173/?stage=2
if (["localhost", "127.0.0.1"].includes(location.hostname)) {
  const previewParams = new URLSearchParams(location.search);
  const previewStage = Number(previewParams.get("stage"));
  if (previewStage >= 1 && previewStage <= 5) setEnvironmentStage(previewStage, true);
  // Local-only art review: show the complete current tile progression
  // without altering normal starts, saved data, scoring or production play.
  if (previewParams.get("tiles") === "preview") {
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    boardView.reset();
    const previewValues=[2,4,8,16,32,64,128,256,512,1024,2048,2];
    previewValues.forEach((value,index)=>addTile(Math.floor(index/SIZE),index%SIZE,value,false));
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
    endCard.show(previewEnding);
  }
}
